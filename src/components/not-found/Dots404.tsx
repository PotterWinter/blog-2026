"use client";

import { useEffect, useRef } from "react";
import styles from "./NotFound.module.css";

// Pull toward the pointer within this radius (px), and a soft ring inside it so the
// dots gather round the pointer instead of collapsing onto it
const REACH = 150;
const RING = 26;

type Dot = { hx: number; hy: number; x: number; y: number; vx: number; vy: number };

// 10 · "404" drawn in dots (v4 _dots404one): the digits are set in the display face on
// a hidden canvas, sampled on a staggered grid, and each sample becomes a dot that
// sways about its home and is drawn toward the pointer. Dots rise 40px into place on
// load. Grid step 15px, 12 below 800 wide, 7 below 500 (v4: 9, which left the phone's
// thin strokes two dots wide and the 4's tails zigzagging 2-1-2-1); dot = step / 5 radius.
export default function Dots404() {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = boxRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let radius = 3;
    let dots: Dot[] = [];
    let mx = -9e3;
    let my = -9e3;
    let inside = false;
    let visible = true;
    let raf = 0;
    let frames = 0;
    let stopped = false;
    const t0 = performance.now();

    // The backing store follows screen pixels, so the dots stay round and sharp
    const fitResolution = () => {
      const next = Math.min(4, Math.max(1, window.devicePixelRatio || 1));
      if (Math.abs(next - dpr) > 0.05 || canvas.width !== Math.round(W * next)) {
        dpr = next;
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
    };

    const build = () => {
      W = box.offsetWidth;
      H = box.offsetHeight;
      if (!W || !H) return;
      fitResolution();
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const g = off.getContext("2d", { willReadFrequently: true })!;
      const family = getComputedStyle(box).fontFamily;
      // As tall as the box, narrowed to 92% of its width when it would spill over
      let size = H * 1.05;
      g.font = `400 ${size}px ${family}`;
      const width = g.measureText("404").width;
      if (width > W * 0.92) size *= (W * 0.92) / width;
      g.font = `400 ${size}px ${family}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("404", W / 2, H / 2 + size * 0.04);
      const step = W < 500 ? 7 : W < 800 ? 12 : 15;
      radius = step / 5;
      const px = g.getImageData(0, 0, W, H).data;
      const alpha = (x: number, y: number) =>
        x < 0 || y < 0 || x >= W || y >= H ? 0 : px[((Math.floor(y) * W + Math.floor(x)) << 2) + 3];
      const old = dots;
      dots = [];
      for (let y = step / 2; y < H; y += step) {
        // Every other row shifts half a step: a staggered grid
        for (let x = step / 2 + (Math.floor(y / step) % 2) * (step / 2); x < W; x += step) {
          if (alpha(x, y) > 140) {
            dots.push({ hx: x, hy: y, x, y: still ? y : y + 40, vx: 0, vy: 0 });
          }
        }
      }
      // Drop stray samples: a sharp corner of a digit (the last 4's spur where the
      // diagonal meets the bar) can leave a dot hanging off the shape. Such a dot sits
      // on the glyph's edge (not all of 0.3 step around it is ink) and touches at most
      // two others (on the staggered grid a dot's neighbours sit within 1.12 steps).
      const near = step * 1.15;
      const reach = step * 0.3;
      const onEdge = (d: Dot) =>
        [
          [reach, 0],
          [-reach, 0],
          [0, reach],
          [0, -reach],
        ].some(([dx, dy]) => alpha(d.hx + dx, d.hy + dy) <= 40);
      const neighbours = (d: Dot) =>
        dots.filter((e) => e !== d && Math.hypot(e.hx - d.hx, e.hy - d.hy) < near).length;
      // Only on the coarse 15px grid, where the spur shows up; on the finer grids the
      // same test clips the ends of the 4's tails and bar instead
      if (step === 15) dots = dots.filter((d) => !(onEdge(d) && neighbours(d) <= 2));
      // A resize keeps the dots where they are and lets them travel to the new shape
      if (old.length) {
        dots.forEach((d, i) => {
          const q = old[i % old.length];
          d.x = q.x;
          d.y = q.y;
        });
      }
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = getComputedStyle(box).color;
      ctx.beginPath();
      for (const d of dots) {
        const speed = Math.min(1, Math.hypot(d.vx, d.vy) / 9);
        const r = radius - speed * radius * 0.3; // a touch smaller while moving fast
        ctx.moveTo(d.x + r, d.y);
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    };

    const tick = (now: number) => {
      raf = 0;
      if (!visible || stopped) return;
      if (++frames % 20 === 0) fitResolution();
      const t = (now - t0) / 1000;
      for (const d of dots) {
        // A slow travelling sway on both axes, like the hero
        const phase = d.hx * 0.006 + d.hy * 0.004;
        const tx = d.hx + Math.sin(t * 1.1 + phase) * 5 + Math.sin(t * 0.47 + d.hy * 0.011) * 3;
        const ty = d.hy + Math.cos(t * 0.9 + phase * 1.3) * 6;
        let ax = (tx - d.x) * 0.045;
        let ay = (ty - d.y) * 0.045;
        if (inside) {
          const dx = mx - d.x;
          const dy = my - d.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < REACH) {
            const f = Math.pow(1 - dist / REACH, 1.6);
            ax += (dx / dist) * f * 1.4;
            ay += (dy / dist) * f * 1.4;
            if (dist < RING) {
              ax -= (dx / dist) * 1.6;
              ay -= (dy / dist) * 1.6;
            }
          }
        }
        d.vx = (d.vx + ax) * 0.86;
        d.vy = (d.vy + ay) * 0.86;
        d.x += d.vx;
        d.y += d.vy;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (still) draw();
      else if (!raf) raf = requestAnimationFrame(tick);
    };

    const place = (e: PointerEvent) => {
      const r = box.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      inside = true;
    };
    const leave = () => (inside = false);
    box.addEventListener("pointermove", place);
    box.addEventListener("pointerenter", place);
    box.addEventListener("pointerleave", leave);
    box.addEventListener("pointercancel", leave);

    const resized = new ResizeObserver(() => {
      if (Math.abs(box.offsetWidth - W) > 2 || Math.abs(box.offsetHeight - H) > 2) {
        build();
        start();
      }
    });
    resized.observe(box);
    // Off screen: stop drawing until it's back
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    seen.observe(box);

    // The digits are drawn in the display face, so wait for fonts before sampling
    document.fonts.ready.then(() => {
      if (stopped) return;
      build();
      start();
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      resized.disconnect();
      seen.disconnect();
      box.removeEventListener("pointermove", place);
      box.removeEventListener("pointerenter", place);
      box.removeEventListener("pointerleave", leave);
      box.removeEventListener("pointercancel", leave);
    };
  }, []);

  return (
    <div ref={boxRef} className={styles.dots}>
      <canvas ref={canvasRef} role="img" aria-label="404" />
    </div>
  );
}
