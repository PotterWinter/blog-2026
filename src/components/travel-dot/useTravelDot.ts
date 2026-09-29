"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { PointerEvent } from "react";

// The v4 travel dot: the signature motion of the site. One dot per group of labels
// (the nav, the category filter). Clicking a label makes the dot hop to it along a
// low arc and land with a squash; clicking the current one bounces it in place.

type Point = { x: number; y: number };
// Which way the arc bows: "down" for the nav (it sits at the top edge), "up" elsewhere
export type HopDirection = "up" | "down";

const DOT = 8;
const HOP_MS = 330;
const HOP_HEIGHT = 76;
const SETTLE_MS = 600;
const BOING_MS = 820;
const SQUASH = 0.35;
const SETTLE_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

const calm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Where the dot rests once the slots finish animating: the active slot's left edge,
// minus the width of any earlier slot that is still collapsing.
function restingPoint(items: (HTMLElement | null)[], active: number): Point {
  const item = items[active]!;
  let x = item.offsetLeft;
  for (let i = 0; i < active; i++) {
    const slot = items[i]?.firstElementChild as HTMLElement | null | undefined;
    x -= slot?.offsetWidth ?? 0;
  }
  const y = item.offsetTop + item.offsetHeight / 2 - DOT / 2;
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

type Parts = {
  dot: HTMLElement;
  items: (HTMLElement | null)[];
  hop: { current: Animation | null };
};

// Put the dot in front of the active label, hopping there when asked.
// active = -1 hides it (e.g. the nav on a 404).
function placeDot({ dot, items, hop }: Parts, active: number, sign: number, animate: boolean) {
  if (active === -1) {
    delete dot.dataset.ready;
    return;
  }
  // A zero-width group isn't laid out yet (hidden tab, mid-reload): measure later
  if (dot.parentElement!.offsetWidth === 0) return;
  const to = restingPoint(items, active);
  const from = currentPoint(dot);

  const wasShown = dot.dataset.ready !== undefined;
  const moved = Math.hypot(to.x - from.x, to.y - from.y) > 2;

  hop.current?.cancel();
  dot.style.transform = `translate(${to.x}px, ${to.y}px)`;
  if (animate && wasShown && moved && !calm()) {
    hop.current = dot.animate(hopKeyframes(from, to, sign), { duration: HOP_MS + SETTLE_MS });
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

export function useTravelDot(active: number, direction: HopDirection) {
  const sign = direction === "down" ? 1 : -1;
  const dotRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const hopRef = useRef<Animation | null>(null);
  const activeRef = useRef(active);

  // Active label changed: hop to it
  useLayoutEffect(() => {
    activeRef.current = active;
    if (!dotRef.current) return;
    placeDot({ dot: dotRef.current, items: itemRefs.current, hop: hopRef }, active, sign, true);
  }, [active, sign]);

  // The group resized (window, breakpoint, shown again): snap into place.
  // Mid-hop, let the hop land first — a second hop would read as a double bounce.
  useLayoutEffect(() => {
    const dot = dotRef.current;
    const group = dot?.parentElement;
    if (!dot || !group) return;
    const snap = () =>
      placeDot({ dot, items: itemRefs.current, hop: hopRef }, activeRef.current, sign, false);
    const observer = new ResizeObserver(() => {
      const hop = hopRef.current;
      if (hop?.playState === "running") hop.finished.then(snap, () => {});
      else snap();
    });
    observer.observe(group);
    return () => observer.disconnect();
  }, [sign]);

  // Bounce in place, unless the dot is still mid-hop
  const boing = useCallback(() => {
    const dot = dotRef.current;
    if (!dot || hopRef.current?.playState === "running" || calm()) return;
    hopRef.current = dot.animate(boingKeyframes(currentPoint(dot), sign), { duration: BOING_MS });
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
