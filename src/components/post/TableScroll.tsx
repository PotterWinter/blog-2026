"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import styles from "./Post.module.css";

// A table wider than the column scrolls sideways in its own frame — and says so: a thin
// bar under it, its thumb as wide as the share in view, there all the time (the
// iPhone shows a scrollbar only while it moves, so a cut-off column read as cut off —
// owner, 4 Oct 69). No bar when it fits. Drag the table, or the bar.
export default function TableScroll({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ size: number; at: number } | null>(null);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const over = box.scrollWidth - box.clientWidth;
      setBar(over > 1 ? { size: box.clientWidth / box.scrollWidth, at: box.scrollLeft / over } : null);
    };
    measure();
    const seen = new ResizeObserver(measure);
    seen.observe(box);
    if (box.firstElementChild) seen.observe(box.firstElementChild);
    box.addEventListener("scroll", measure, { passive: true });
    return () => {
      seen.disconnect();
      box.removeEventListener("scroll", measure);
    };
  }, []);
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = boxRef.current;
    const track = e.currentTarget;
    if (!box) return;
    const go = (x: number) => {
      const r = track.getBoundingClientRect();
      box.scrollLeft = ((x - r.left) / r.width) * box.scrollWidth - box.clientWidth / 2;
    };
    go(e.clientX);
    track.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => go(m.clientX);
    const up = () => {
      track.removeEventListener("pointermove", move);
      track.removeEventListener("pointerup", up);
    };
    track.addEventListener("pointermove", move);
    track.addEventListener("pointerup", up);
  };
  return (
    <div className={styles.tableWrap}>
      <div ref={boxRef} className={styles.tableScroll}>
        {children}
      </div>
      {bar && (
        <div className={styles.tableBarTrack} onPointerDown={drag} aria-hidden="true">
          <span
            className={styles.tableBarThumb}
            style={{ width: `${bar.size * 100}%`, left: `${bar.at * (1 - bar.size) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
