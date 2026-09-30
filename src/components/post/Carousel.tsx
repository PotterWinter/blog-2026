"use client";

import { useRef, useState } from "react";
import styles from "./Post.module.css";

export type Slide = { src: string; alt: string; caption: string };

const pad = (n: number) => String(n).padStart(2, "0");

// 04 carousel (v4 _slider): one image in view, sliding 0.7s; the caption and "01 / 04"
// under it, then Previous · Next. Loops at both ends. ← → step it once it has focus,
// and a swipe steps it on touch.
export default function Carousel({ slides, ratio }: { slides: Slide[]; ratio: string }) {
  const [k, setK] = useState(0);
  const n = slides.length;
  const go = (d: number) => setK((i) => (i + d + n) % n);
  const start = useRef<number | null>(null);

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
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") start.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (start.current == null) return;
          const dx = e.clientX - start.current;
          start.current = null;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => (start.current = null)}
      >
        <div className={styles.track} style={{ transform: `translateX(${-k * 100}%)` }}>
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
