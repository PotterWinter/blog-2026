"use client";

import { useEffect, useRef } from "react";
import styles from "./About.module.css";

// Spring toward the pointer (v4 _projTrack, as a cursor): a little behind, so the
// badge trails and stretches along its path, squashing as it's pressed
const FOLLOW = 0.34;

// An 82px black badge that takes the place of the mouse pointer over its parent row
// (v4 .dlbadge): "View" on the CV row, "Email" on the email row. Mouse only — on touch
// the row is just a link.
export default function CursorBadge({ label }: { label: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const badge = ref.current!;
    const row = badge.parentElement!;
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let mx = 0;
    let my = 0;
    let x = 0;
    let y = 0;
    let s = 0; // scale, sprung toward ts
    let sv = 0;
    let ts = 0;
    let stretch = 0;
    let angle = 0;
    let on = false;
    let raf = 0;
    const W = 82;

    const tick = () => {
      raf = 0;
      const px = x;
      const py = y;
      x += (mx - W / 2 - x) * FOLLOW;
      y += (my - W / 2 - y) * FOLLOW;
      sv = sv * 0.74 + (ts - s) * 0.16;
      s += sv;
      const vx = x - px;
      const vy = y - py;
      const speed = Math.hypot(vx, vy);
      stretch += (Math.min(0.42, speed / 55) - stretch) * 0.3;
      if (speed > 0.6) angle = (Math.atan2(vy, vx) * 180) / Math.PI;
      badge.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${Math.max(0, s).toFixed(3)})`;
      badge.style.setProperty("--ang", `${angle.toFixed(1)}deg`);
      badge.style.setProperty("--jx", (1 + stretch - sv * 1.2).toFixed(3));
      badge.style.setProperty("--jy", (1 - stretch * 0.55 + sv * 1.2).toFixed(3));
      const moving =
        Math.abs(mx - W / 2 - x) > 0.3 ||
        Math.abs(s - ts) > 0.005 ||
        Math.abs(sv) > 0.002 ||
        stretch > 0.005;
      if (on || moving) raf = requestAnimationFrame(tick);
    };
    const run = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const move = (e: PointerEvent) => {
      if (!pointer.matches || e.pointerType !== "mouse") return;
      const r = row.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      if (!on) {
        on = true;
        ts = 1;
        // Arrives where the pointer is, growing from nothing
        x = mx - W / 2;
        y = my - W / 2;
        row.setAttribute("data-badge", "");
      }
      run();
    };
    const leave = () => {
      if (!on) return;
      on = false;
      ts = 0;
      row.removeAttribute("data-badge");
      run();
    };
    const down = () => {
      if (!on) return;
      ts = 0.78;
      run();
    };
    const up = () => {
      if (!on) return;
      ts = 1;
      run();
    };

    row.addEventListener("pointermove", move);
    row.addEventListener("pointerleave", leave);
    row.addEventListener("pointerdown", down);
    row.addEventListener("pointerup", up);
    return () => {
      row.removeEventListener("pointermove", move);
      row.removeEventListener("pointerleave", leave);
      row.removeEventListener("pointerdown", down);
      row.removeEventListener("pointerup", up);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <span ref={ref} className={styles.badge} aria-hidden="true">
      {label}
    </span>
  );
}
