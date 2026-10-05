"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ArrowCursor.module.css";

type Way = "prev" | "next";

// v4's long arrow, the pointer over anything marked data-arrow="prev" | "next": a
// carousel's halves, Previous / Next under it, the post's Previous | Next. Drawn here
// rather than as a CSS cursor so it inverts where it crosses something dark, as the dots
// do — mix-blend-mode: difference (owner, 5 Oct 69). A mouse only; one for every page.
export default function ArrowCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const [way, setWay] = useState<Way | null>(null);
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    let at: { x: number; y: number } | null = null;
    // What's under the mouse decides: an arrow, which way, or none
    const check = () => {
      const el = ref.current;
      if (!el || !at) return;
      const under = document.elementFromPoint(at.x, at.y)?.closest<HTMLElement>("[data-arrow]");
      const next = fine.matches && under ? (under.dataset.arrow as Way) : null;
      setWay(next);
      el.style.transform = `translate(${at.x - 32}px, ${at.y - 22}px)`;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      at = { x: e.clientX, y: e.clientY };
      check();
    };
    const leave = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      at = null;
      setWay(null);
    };
    // The page scrolled under a still mouse: what's under it now
    const scrolled = () => requestAnimationFrame(check);
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerout", leave);
    window.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerout", leave);
      window.removeEventListener("scroll", scrolled);
    };
  }, []);
  return (
    <div ref={ref} className={styles.arrow} data-on={way ?? undefined} aria-hidden="true">
      {/* v4's arrow, thinner, its tail longer and its head bigger — half as big again,
          then a quarter more (owner, 5 Oct 69): 2px line, 64 long, the head 22.5 deep
          and 41 tall */}
      <svg viewBox="0 0 32 22" width="64" height="44" fill="none" stroke="currentColor" strokeWidth="1">
        <path d={way === "prev" ? "M32 11H2M12.25 0.6875 1 11l11.25 10.3125" : "M0 11h30M19.75 0.6875 31 11l-11.25 10.3125"} />
      </svg>
    </div>
  );
}
