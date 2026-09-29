"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import type { PointerEvent } from "react";
import styles from "./SiteNav.module.css";
import { usePageTransition } from "./PageTransition";

type Point = { x: number; y: number };

const DOT = 8;
const HOP_MS = 330;
const HOP_HEIGHT = 76;
const SETTLE_MS = 600;
const BOING_MS = 820;
const SQUASH = 0.35;
const SETTLE_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

const items = [
  { href: "/", label: "Blog", match: (p: string) => p === "/" || p.startsWith("/posts/") },
  {
    href: "/project",
    label: "Project",
    match: (p: string) => p === "/project" || p.startsWith("/projects/"),
  },
  { href: "/about", label: "About", match: (p: string) => p === "/about" },
];

// Where the dot rests once the slots finish animating: the active slot's left edge,
// minus the width of any earlier slot that is still collapsing.
function restingPoint(links: (HTMLAnchorElement | null)[], active: number): Point {
  const link = links[active]!;
  let x = link.offsetLeft;
  for (let i = 0; i < active; i++) {
    const slot = links[i]?.firstElementChild as HTMLElement | null | undefined;
    x -= slot?.offsetWidth ?? 0;
  }
  const y = link.offsetTop + link.offsetHeight / 2 - DOT / 2;
  return { x, y };
}

// Where the dot is drawn right now, even halfway through a hop.
function currentPoint(el: HTMLElement): Point {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return { x: m.m41, y: m.m42 };
}

// v4 hop: a low arc that bows downward (the nav sits at the top edge) while the dot
// stretches, then the shared landing — squash, 6px, 1.5px, rest.
function hopKeyframes(from: Point, to: Point): Keyframe[] {
  const flight = HOP_MS / (HOP_MS + SETTLE_MS);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = HOP_HEIGHT * (0.55 + Math.min(1, dist / 320) * 0.75);

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
    frame(to.x, to.y + drop, sx, sy, flight + (1 - flight) * at);
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

// Re-press on the page you're already on: the shared hop in place — dip 16px, land with a
// squash, then 6px and 1.5px settles (the same profile as the footer dot)
function boingKeyframes(at: Point): Keyframe[] {
  const frame = (drop: number, sx: number, sy: number, offset: number): Keyframe => ({
    transform: `translate(${at.x}px, ${at.y + drop}px) scale(${sx}, ${sy})`,
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

type Refs = {
  dot: HTMLSpanElement;
  links: (HTMLAnchorElement | null)[];
  hop: { current: Animation | null };
};

// Put the dot in front of the active label, hopping there when asked.
function placeDot({ dot, links, hop }: Refs, active: number, animate: boolean) {
  if (active === -1) {
    delete dot.dataset.ready;
    return;
  }
  // A zero-width nav isn't laid out yet (hidden tab, mid-reload): measure later
  if (dot.parentElement!.offsetWidth === 0) return;
  const to = restingPoint(links, active);
  const from = currentPoint(dot);

  const wasShown = dot.dataset.ready !== undefined;
  const moved = Math.hypot(to.x - from.x, to.y - from.y) > 2;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  hop.current?.cancel();
  dot.style.transform = `translate(${to.x}px, ${to.y}px)`;
  if (animate && wasShown && moved && !calm) {
    hop.current = dot.animate(hopKeyframes(from, to), { duration: HOP_MS + SETTLE_MS });
  }
  dot.dataset.ready = "";
}

export default function SiteNav() {
  const pathname = usePathname();
  // While the panel is up, the dot already points at where we're going
  const { target, go } = usePageTransition();
  const active = items.findIndex((item) => item.match(target ?? pathname));

  const dotRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const hopRef = useRef<Animation | null>(null);
  const activeRef = useRef(active);

  // Page changed: hop to the new label
  useLayoutEffect(() => {
    activeRef.current = active;
    if (!dotRef.current) return;
    placeDot({ dot: dotRef.current, links: linkRefs.current, hop: hopRef }, active, true);
  }, [active]);

  // Header resized (window, a scrollbar appearing, shown again): snap into place.
  // Mid-hop, let the hop land first — the dot lives in nav space, so the nav sliding
  // sideways doesn't move its target, and a second hop would read as a double bounce.
  useLayoutEffect(() => {
    const dot = dotRef.current;
    const header = dot?.parentElement?.parentElement;
    if (!dot || !header) return;
    const snap = () => placeDot({ dot, links: linkRefs.current, hop: hopRef }, activeRef.current, false);
    const observer = new ResizeObserver(() => {
      const hop = hopRef.current;
      if (hop?.playState === "running") hop.finished.then(snap, () => {});
      else snap();
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Press = pointer held down on a label, until it's released or slides off
  const release = (e: PointerEvent<HTMLAnchorElement>) => {
    delete e.currentTarget.dataset.pressed;
  };

  // Bounce in place, unless the dot is still mid-hop
  const boing = () => {
    const dot = dotRef.current;
    if (!dot || hopRef.current?.playState === "running") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    hopRef.current = dot.animate(boingKeyframes(currentPoint(dot)), { duration: BOING_MS });
  };

  return (
    <nav className={styles.nav}>
      {items.map((item, i) => (
        <Link
          key={item.href}
          href={item.href}
          ref={(el) => {
            linkRefs.current[i] = el;
          }}
          className={styles.item}
          aria-current={i === active ? "page" : undefined}
          onNavigate={(e) => {
            if (!go) return;
            e.preventDefault();
            // Blog is also "active" on /posts/…, so compare the actual page, not the item.
            // Same page: bounce in place while the panel reloads it.
            if (item.href === (target ?? pathname)) boing();
            go(item.href);
          }}
          draggable={false}
          onPointerDown={(e) => (e.currentTarget.dataset.pressed = "")}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
        >
          <span className={styles.slot} />
          {item.label}
        </Link>
      ))}
      {/* Outer span travels (transform), inner span takes the press, so it shrinks
          around its own centre instead of being pulled toward the nav's corner */}
      <span ref={dotRef} className={styles.dot} aria-hidden="true">
        <span className={styles.ink} />
      </span>
    </nav>
  );
}
