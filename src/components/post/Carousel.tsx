"use client";

import { useRef, useState } from "react";
import styles from "./Post.module.css";

export type Slide = { src: string; alt: string; caption: string };

const pad = (n: number) => String(n).padStart(2, "0");

// 04 carousel (v4 _slider): one image in view, sliding 0.7s; the caption and "01 / 04"
// under it, then Previous · Next. Loops at both ends. ← → step it once it has focus.
// By finger, as the Photos app (owner, 3 Oct 69): the images follow it; let go past a
// fifth of the width, or with a flick, and it steps (0.35s), short of that it springs
// back; past the first or last it drags heavy. Up and down still scroll the page.
export default function Carousel({ slides, ratio }: { slides: Slide[]; ratio: string }) {
  const [k, setK] = useState(0);
  const n = slides.length;
  const go = (d: number) => setK((i) => (i + d + n) % n);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; t: number; dx: number; sideways: boolean | null } | null>(null);
  // Where the track sits: the slide, less the finger's pull while it's down
  const place = (dx: number, ease: string | null) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = ease ?? "none";
    track.style.transform = `translateX(calc(${-k * 100}% + ${dx}px))`;
  };

  return (
    <figure
      className={styles.carousel}
      data-ratio={ratio || undefined}
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
    >
      <div
        className={styles.stage}
        data-swipe-own // its own sideways swipe: the editor's Preview leaves it alone
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, dx: 0, sideways: null };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          // The first few px decide: sideways is ours, up and down is the page's
          if (d.sideways == null && Math.hypot(dx, e.clientY - d.y) > 6) {
            d.sideways = Math.abs(dx) > Math.abs(e.clientY - d.y);
            if (d.sideways) e.currentTarget.setPointerCapture(e.pointerId);
          }
          if (!d.sideways) return;
          // Heavy past the ends
          const edge = (k === 0 && dx > 0) || (k === n - 1 && dx < 0);
          d.dx = edge ? dx / 3 : dx;
          place(d.dx, null);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d?.sideways) return;
          const width = e.currentTarget.clientWidth;
          const speed = d.dx / Math.max(1, e.timeStamp - d.t);
          const step = Math.abs(d.dx) > width / 5 || (Math.abs(speed) > 0.5 && Math.abs(d.dx) > 20) ? (d.dx < 0 ? 1 : -1) : 0;
          const ease = "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)";
          // Past the ends it springs back (no looping by finger: the photo app doesn't)
          const next = k + step;
          if (step && next >= 0 && next < n) {
            const track = trackRef.current;
            if (track) track.style.transition = ease;
            setK(next);
          } else place(0, ease);
        }}
        onPointerCancel={() => {
          drag.current = null;
          place(0, "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)");
        }}
      >
        <div
          ref={trackRef}
          className={styles.track}
          style={{ transform: `translateX(${-k * 100}%)` }}
          // A step by button or key: the CSS slide (0.7s) again, after a finger's own
          onTransitionEnd={(e) => (e.currentTarget.style.transition = "")}
        >
          {slides.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- sizes come from the file
            <img
              key={s.src + i}
              src={s.src}
              alt={s.alt}
              loading="lazy"
              aria-hidden={i !== k || undefined}
              draggable={false}
            />
          ))}
        </div>
      </div>
      <figcaption className={styles.slideCaption} aria-live="polite">
        <span>{slides[k].caption}</span>
        <span className={styles.slideCount}>
          {pad(k + 1)} / {pad(n)}
        </span>
      </figcaption>
      <div className={styles.slideNav}>
        <button type="button" className="label" onClick={() => go(-1)} aria-label="Previous image">
          <svg
            viewBox="0 0 26 14"
            width="1.3em"
            height="0.7em"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path vectorEffect="non-scaling-stroke" d="M26 7H2M7 1.5 1 7l6 5.5" />
          </svg>{" "}
          Previous
        </button>
        <button type="button" className="label" onClick={() => go(1)} aria-label="Next image">
          Next{" "}
          <svg
            viewBox="0 0 26 14"
            width="1.3em"
            height="0.7em"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path vectorEffect="non-scaling-stroke" d="M0 7h24M19 1.5 25 7l-6 5.5" />
          </svg>
        </button>
      </div>
    </figure>
  );
}
