"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomButton } from "./Lightbox";
import styles from "./Post.module.css";

export type Slide = { src: string; alt: string; caption: string };

const pad = (n: number) => String(n).padStart(2, "0");

// 04 carousel (v4 _slider): one image in view, sliding 0.7s; the caption and "01 / 04"
// under it, then Previous · Next. ← → step it once it has focus.
// By finger, as the Photos app (owner, 3 Oct 69): the images follow it; let go past a
// fifth of the width, or with a flick, and it steps (0.35s), short of that it springs
// back. Up and down still scroll the page.
// Round and round, by finger and by button alike (owner, 4 Oct 69): the last slide
// leads on to the first and back. The track holds a copy of the last before the first
// and of the first after the last; arriving on a copy, it's swapped for the real one
// where it stands, unseen.
// With a mouse, the image's own halves step it too, out to the screen's edges: the
// pointer becomes the long arrow Previous / Next have (ArrowCursor, inverting over dark
// as the dots do), left back, right on (owner, 5 Oct 69). Not while the contents rail is
// open, which the mouse crosses the right side to reach: then only Previous / Next under
// it (Post.module.css .half).
export default function Carousel({ slides, ratio }: { slides: Slide[]; ratio: string }) {
  const n = slides.length;
  const loops = n > 1;
  const track = loops ? [slides[n - 1], ...slides, slides[0]] : slides;
  const [at, setAt] = useState(loops ? 1 : 0); // on the track, copies counted
  const k = loops ? (at - 1 + n) % n : 0; // the slide shown
  const trackRef = useRef<HTMLDivElement>(null);
  // The halves reach from the image out to the page's edges, and so does a finger's
  // swipe — beside a narrow 4:5 image too, not on the image alone (owner, 5 Oct 69).
  // How far, measured here: from the image (--out-*), from the column (--edge-*)
  const wrapRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    const fig = figRef.current;
    if (!wrap || !fig || !loops) return;
    const measure = () => {
      const page = document.documentElement.clientWidth;
      const r = wrap.getBoundingClientRect();
      wrap.style.setProperty("--out-l", `${Math.max(0, r.left)}px`);
      wrap.style.setProperty("--out-r", `${Math.max(0, page - r.right)}px`);
      const f = fig.getBoundingClientRect();
      fig.style.setProperty("--edge-l", `${Math.max(0, f.left)}px`);
      fig.style.setProperty("--edge-r", `${Math.max(0, page - f.right)}px`);
    };
    measure();
    const seen = new ResizeObserver(measure);
    seen.observe(document.documentElement);
    return () => seen.disconnect();
  }, [loops]);
  // Mid-step onto a copy: nothing more till it's swapped
  const onCopy = loops && (at === 0 || at === n + 1);
  const go = (d: number) => {
    if (!loops || onCopy) return;
    setAt((a) => a + d);
  };
  const drag = useRef<{ x: number; y: number; t: number; dx: number; sideways: boolean | null } | null>(null);
  // Where the track sits: the slide, less the finger's pull while it's down
  const place = (dx: number, ease: string | null) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = ease ?? "none";
    el.style.transform = `translateX(calc(${-at * 100}% + ${dx}px))`;
  };
  // Landed on a copy: the real slide in its place, with no slide to it
  const settle = () => {
    const el = trackRef.current;
    if (!el) return;
    if (at === 0 || at === n + 1) {
      el.style.transition = "none";
      setAt(at === 0 ? n : 1);
      requestAnimationFrame(() => requestAnimationFrame(() => (el.style.transition = "")));
    } else el.style.transition = "";
  };

  return (
    <figure
      ref={figRef}
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
        className={styles.swipe}
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
          if (!d.sideways || onCopy) return;
          // One slide alone: nowhere to go, so it drags heavy
          d.dx = loops ? dx : dx / 3;
          place(d.dx, null);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d?.sideways) return;
          const width = stageRef.current?.clientWidth ?? e.currentTarget.clientWidth;
          const speed = d.dx / Math.max(1, e.timeStamp - d.t);
          const step = Math.abs(d.dx) > width / 5 || (Math.abs(speed) > 0.5 && Math.abs(d.dx) > 20) ? (d.dx < 0 ? 1 : -1) : 0;
          const ease = "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)";
          if (step && loops && !onCopy) {
            const el = trackRef.current;
            if (el) el.style.transition = ease;
            setAt(at + step);
          } else place(0, ease);
        }}
        onPointerCancel={() => {
          drag.current = null;
          place(0, "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)");
        }}
      >
        <div
          ref={wrapRef}
          className={styles.stageWrap}
          // ⤢ only while the mouse is on the image itself: the halves reach out to the
          // screen's edges, so hovering them isn't hovering the image (owner, 6 Oct 69)
          onMouseMove={(e) => {
            const r = stageRef.current?.getBoundingClientRect();
            const on = !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
            if (on !== (e.currentTarget.dataset.over != null)) e.currentTarget.toggleAttribute("data-over", on);
          }}
          onMouseLeave={(e) => e.currentTarget.removeAttribute("data-over")}
        >
          <div ref={stageRef} className={styles.stage}>
            <div
              ref={trackRef}
              className={styles.track}
              style={{ transform: `translateX(${-at * 100}%)` }}
              // A step by button or key: the CSS slide (0.7s) again, after a finger's own
              onTransitionEnd={(e) => {
                if (e.target === e.currentTarget) settle();
              }}
            >
              {track.map((s, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- sizes come from the file
                <img
                  key={s.src + i}
                  src={s.src}
                  alt={s.alt}
                  loading="lazy"
                  aria-hidden={i !== at || undefined}
                  draggable={false}
                  data-zoom="" // a tap opens it (Lightbox); a swipe doesn't click
                  data-caption={s.caption} // its own, not the figure's (that holds "01 / 04")
                />
              ))}
            </div>
          </div>
          {loops && (
            <>
              {([-1, 1] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={d < 0 ? styles.half : `${styles.half} ${styles.halfNext}`}
                  data-arrow={d < 0 ? "prev" : "next"}
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => go(d)}
                />
              ))}
            </>
          )}
          {/* With a mouse the image's halves step it; it opens from its corner (ZoomButton) */}
          <ZoomButton {...slides[k]} />
        </div>
      </div>
      <figcaption className={styles.slideCaption} aria-live="polite">
        <span>{slides[k].caption}</span>
        <span className={styles.slideCount}>
          {pad(k + 1)} / {pad(n)}
        </span>
      </figcaption>
      <div className={styles.slideNav}>
        <button type="button" className="label" data-arrow="prev" onClick={() => go(-1)} aria-label="Previous image">
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
        <button type="button" className="label" data-arrow="next" onClick={() => go(1)} aria-label="Next image">
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
