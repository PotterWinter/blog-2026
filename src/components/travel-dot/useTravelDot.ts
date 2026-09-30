"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { PointerEvent } from "react";

// The v4 travel dot: the signature motion of the site. One dot per group of labels
// (the nav, the category filter). Clicking a label makes the dot hop to it along a
// low arc and land with a squash; clicking the current one bounces it in place.

type Point = { x: number; y: number };
// Which way the arc bows: "down" for the nav (it sits at the top edge), "up" elsewhere
export type HopDirection = "up" | "down";
// "hop": the signature jump with a squash landing (nav, categories).
// "slide": a quick glide on a low 12px arc, no landing bounce (the pager, as in v4).
export type Motion = "hop" | "slide";

const HOP_MS = 330;
const HOP_HEIGHT = 76;
const SETTLE_MS = 600;
const BOING_MS = 820;
const SQUASH = 0.35;
const SETTLE_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const SLIDE_MS = HOP_MS + 80;
const SLIDE_LIFT = 12;
const SLIDE_EASE = "cubic-bezier(0.3, 0.7, 0.25, 1)";
// The minute's closing hop (v4 _dotHop): up 0.6 of a hop, then two bounces that die away
const CLOSE_BOUNCES = 2;
const CLOSE_BOUNCE_MS = 500;
const CLOSE_BOUNCE_AMP = 16;

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Where the dot rests once the slots finish animating (the old slot still closing, the
// new one still opening), predicted from the layout of this very moment:
//   left-aligned group:  the active label is pushed left by earlier slots that close
//   right-aligned group (the pager): it's pulled left by its own slot opening, and
//                        pushed right by later slots that close
function restingPoint(items: (HTMLElement | null)[], active: number, dot: HTMLElement): Point {
  const item = items[active]!;
  const slotWidth = (el: HTMLElement | null | undefined) =>
    (el?.firstElementChild as HTMLElement | null | undefined)?.offsetWidth ?? 0;
  const group = dot.parentElement!;
  const style = getComputedStyle(group);
  let x = item.offsetLeft;
  if (/end|right/.test(style.justifyContent)) {
    const open = parseFloat(style.getPropertyValue("--slot")) || 13;
    x -= open - slotWidth(item);
    for (let i = active + 1; i < items.length; i++) x += slotWidth(items[i]);
  } else {
    for (let i = 0; i < active; i++) x -= slotWidth(items[i]);
  }
  const y = item.offsetTop + item.offsetHeight / 2 - dot.offsetHeight / 2;
  return { x, y };
}

// Where the dot is drawn right now, even halfway through a hop.
function currentPoint(el: HTMLElement): Point {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return { x: m.m41, y: m.m42 };
}

// A low arc (the dot stretches as it flies), then the shared landing:
// squash, 6px, 1.5px, rest. sign = 1 bows downward, -1 upward.
function hopKeyframes(from: Point, to: Point, sign: number): Keyframe[] {
  const flight = HOP_MS / (HOP_MS + SETTLE_MS);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = sign * HOP_HEIGHT * (0.55 + Math.min(1, dist / 320) * 0.75);

  const frame = (x: number, y: number, sx: number, sy: number, offset: number): Keyframe => ({
    transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy})`,
    offset,
  });

  const frames: Keyframe[] = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14;
    const x = from.x + (to.x - from.x) * (1 - Math.pow(1 - u, 2.1));
    const y = from.y + (to.y - from.y) * u + lift * 4 * u * (1 - u);
    const stretch = Math.sin(Math.PI * u) * SQUASH * 0.85;
    frames.push(frame(x, y, 1 - stretch * 0.7, 1 + stretch, flight * u));
  }

  const settle = (at: number, drop: number, sx: number, sy: number) =>
    frame(to.x, to.y + sign * drop, sx, sy, flight + (1 - flight) * at);
  frames.push(
    settle(0.14, 0, 1.2, 0.78),
    settle(0.4, 6, 0.94, 1.06),
    settle(0.66, 0, 1.08, 0.92),
    settle(0.84, 1.5, 1, 1),
    frame(to.x, to.y, 1, 1, 1),
  );
  // From touchdown on, every step uses the settle easing
  for (let i = 14; i < frames.length - 1; i++) frames[i].easing = SETTLE_EASE;
  return frames;
}

// v4 pager: the row does the moving, the dot only hints at lift
function slideKeyframes(from: Point, to: Point, sign: number): Keyframe[] {
  const at = (x: number, y: number, offset: number): Keyframe => ({
    transform: `translate(${x}px, ${y}px)`,
    offset,
  });
  return [
    at(from.x, from.y, 0),
    at((from.x + to.x) / 2, (from.y + to.y) / 2 + sign * SLIDE_LIFT, 0.5),
    at(to.x, to.y, 1),
  ];
}

// Re-press on the current label: the shared hop in place — 16px, land with a
// squash, then 6px and 1.5px settles (the same profile as the footer dot)
function boingKeyframes(at: Point, sign: number): Keyframe[] {
  const frame = (drop: number, sx: number, sy: number, offset: number): Keyframe => ({
    transform: `translate(${at.x}px, ${at.y + sign * drop}px) scale(${sx}, ${sy})`,
    offset,
    easing: SETTLE_EASE,
  });
  return [
    frame(0, 1, 1, 0),
    frame(16, 0.9, 1.1, 0.2),
    frame(0, 1.2, 0.78, 0.42),
    frame(6, 0.94, 1.06, 0.6),
    frame(0, 1.08, 0.92, 0.78),
    frame(1.5, 1, 1, 0.9),
    frame(0, 1, 1, 1),
  ];
}

// v4 _dotHop: a jump straight up for the first third, then bounces that shrink and
// squash as they land. sign = -1 jumps up.
function closingHopKeyframes(at: Point, sign: number): Keyframe[] {
  const height = Math.max(10, HOP_HEIGHT * 0.6);
  const frames: Keyframe[] = [];
  for (let i = 0; i <= 60; i++) {
    const v = i / 60;
    let y = 0;
    let sx = 1;
    let sy = 1;
    if (v < 0.34) y = height * Math.sin((v / 0.34) * Math.PI);
    else {
      const u = (v - 0.34) / 0.66;
      const env = Math.exp(-3.2 * u) * (1 - u);
      const h = Math.abs(Math.sin(Math.PI * CLOSE_BOUNCES * u));
      y = CLOSE_BOUNCE_AMP * env * h;
      const squash = env * Math.pow(1 - h, 2.4) * SQUASH;
      sx = 1 + squash;
      sy = 1 - squash;
    }
    frames.push({
      transform: `translate(${at.x}px, ${(at.y + sign * y).toFixed(2)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
      offset: v,
    });
  }
  return frames;
}

type Parts = {
  dot: HTMLElement;
  items: (HTMLElement | null)[];
  hop: { current: Animation | null };
};

// Put the dot in front of the active label, hopping there when asked.
// active = -1 hides it (e.g. the nav on a 404).
function placeDot(
  { dot, items, hop }: Parts,
  active: number,
  sign: number,
  motion: Motion,
  animate: boolean,
) {
  if (active === -1) {
    delete dot.dataset.ready;
    return;
  }
  // A zero-width group isn't laid out yet (hidden tab, mid-reload): measure later
  if (dot.parentElement!.offsetWidth === 0) return;
  const to = restingPoint(items, active, dot);
  const from = currentPoint(dot);

  const wasShown = dot.dataset.ready !== undefined;
  const moved = Math.hypot(to.x - from.x, to.y - from.y) > 2;

  hop.current?.cancel();
  dot.style.transform = `translate(${to.x}px, ${to.y}px)`;
  if (animate && wasShown && moved && !calm()) {
    hop.current =
      motion === "slide"
        ? dot.animate(slideKeyframes(from, to, sign), { duration: SLIDE_MS, easing: SLIDE_EASE })
        : dot.animate(hopKeyframes(from, to, sign), { duration: HOP_MS + SETTLE_MS });
  }
  dot.dataset.ready = "";
}

// Press = pointer held down on a label, until it's released or slides off
const release = (e: PointerEvent<HTMLElement>) => {
  delete e.currentTarget.dataset.pressed;
};

export const pressHandlers = {
  draggable: false,
  onPointerDown: (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.dataset.pressed = "";
  },
  onPointerUp: release,
  onPointerLeave: release,
  onPointerCancel: release,
};

// layout: anything that can move the labels without changing the active one or the group's
// size — e.g. the pager's page list (02 disappears, 01 slides right in a right-aligned group)
export function useTravelDot(
  active: number,
  direction: HopDirection,
  motion: Motion = "hop",
  layout = "",
) {
  const sign = direction === "down" ? 1 : -1;
  const dotRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const hopRef = useRef<Animation | null>(null);
  const activeRef = useRef(active);

  // Active label changed: hop to it
  useLayoutEffect(() => {
    activeRef.current = active;
    if (!dotRef.current) return;
    placeDot({ dot: dotRef.current, items: itemRefs.current, hop: hopRef }, active, sign, motion, true);
  }, [active, sign, motion]);

  // The labels moved under a dot that keeps its label: glide along with them
  const laidOut = useRef(layout);
  useLayoutEffect(() => {
    if (laidOut.current === layout || !dotRef.current) return;
    laidOut.current = layout;
    placeDot(
      { dot: dotRef.current, items: itemRefs.current, hop: hopRef },
      activeRef.current,
      sign,
      "slide",
      true,
    );
  }, [layout, sign]);

  // The group resized (window, breakpoint, shown again): snap into place.
  // Mid-hop, let the hop land first — a second hop would read as a double bounce.
  useLayoutEffect(() => {
    const dot = dotRef.current;
    const group = dot?.parentElement;
    if (!dot || !group) return;
    const snap = () =>
      placeDot({ dot, items: itemRefs.current, hop: hopRef }, activeRef.current, sign, motion, false);
    const observer = new ResizeObserver(() => {
      const hop = hopRef.current;
      if (hop?.playState === "running") hop.finished.then(snap, () => {});
      else snap();
    });
    // border-box: past the 1680 frame only the padding grows, the content box doesn't
    observer.observe(group, { box: "border-box" });
    return () => observer.disconnect();
  }, [sign, motion]);

  // Bounce in place, unless the dot is still mid-hop
  const boing = useCallback(() => {
    const dot = dotRef.current;
    if (!dot || hopRef.current?.playState === "running" || calm()) return;
    hopRef.current = dot.animate(boingKeyframes(currentPoint(dot), sign), { duration: BOING_MS });
  }, [sign]);

  // The headline's once-a-minute jump ends with this dot hopping in place (JumpMotion
  // sends "dothop" to groups marked data-dot-hop)
  useLayoutEffect(() => {
    const dot = dotRef.current;
    const group = dot?.parentElement;
    if (!dot || !group) return;
    const onHop = () => {
      if (hopRef.current?.playState === "running" || calm()) return;
      hopRef.current = dot.animate(closingHopKeyframes(currentPoint(dot), sign), {
        duration: HOP_MS + CLOSE_BOUNCE_MS * 1.6,
        easing: "linear",
      });
    };
    group.addEventListener("dothop", onHop);
    return () => group.removeEventListener("dothop", onHop);
  }, [sign]);

  // ref={itemRef(i)} on each label, in order
  const itemRef = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      itemRefs.current[i] = el;
    },
    [],
  );

  return { dotRef, itemRef, boing };
}
