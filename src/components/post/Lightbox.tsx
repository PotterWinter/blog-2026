"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Lightbox.module.css";
import postStyles from "./Post.module.css";

type Shot = { src: string; alt: string; caption: string };

// An image in a post, opened on its own over the page (owner, 5 Oct 69): with a mouse
// from the ⤢ in its corner only (shown while the mouse is over the image — the image
// itself keeps the plain pointer, and a carousel's halves step it); a finger taps the
// image twice (owner, 6 Oct 69 — once opened it while scrolling past). Black around it, its caption under it; × / Esc / a press beside it
// closes it. On a phone the fingers zoom it (the page's own pinch) and a pull down
// closes it; with a mouse a press on it shows it larger — the file's own pixels, or
// twice the fit — and the image follows the mouse to show the rest.
// Opened from a carousel it holds the whole set: ← → (keys, the arrows at its sides, a
// finger's sideways swipe) step through it, round and round as the carousel does, the
// count under the caption (owner, 6 Oct 69).
// It listens on the post it sits in, for anything marked data-zoom: an <img> (its own
// src, alt and figure's caption) or a button naming them (data-zoom, data-alt,
// data-caption). The editor's WRITE box has none of this.
// ⤢ : the corner of an image, for a mouse (Post.module.css .zoom)
export function ZoomButton({ src, alt, caption }: Shot) {
  return (
    <button type="button" className={postStyles.zoom} data-zoom={src} data-alt={alt} data-caption={caption} aria-label="Open image">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path className={postStyles.zoomOut} d="M8.5 1.5h4v4M12.5 1.5 8 6" />
        <path className={postStyles.zoomIn} d="M5.5 12.5h-4v-4M1.5 12.5 6 8" />
      </svg>
    </button>
  );
}

export default function Lightbox() {
  const hereRef = useRef<HTMLSpanElement>(null);
  // The images it can show (one, or a carousel's set) and which is shown
  const [open, setOpen] = useState<{ list: Shot[]; at: number } | null>(null);
  const [big, setBig] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [pull, setPull] = useState(0);
  const shot = open ? open.list[open.at] : null;
  const many = !!open && open.list.length > 1;

  useEffect(() => {
    const post = hereRef.current?.parentElement;
    if (!post) return;
    // A finger's first tap on an image, waiting for its second
    let tapped: { el: Element; at: number } | null = null;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element).closest<HTMLElement>("[data-zoom]");
      if (!el || !post.contains(el) || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const img = el instanceof HTMLImageElement ? el : null;
      if (img && matchMedia("(hover: hover) and (pointer: fine)").matches) return; // a mouse: the ⤢
      if (img) {
        // A finger: the second tap on the same image within 350ms
        const now = e.timeStamp;
        const twice = tapped?.el === img && now - tapped.at < 350;
        tapped = twice ? null : { el: img, at: now };
        if (!twice) return;
      }
      const src = el.dataset.zoom || img?.currentSrc || img?.src;
      if (!src) return;
      e.preventDefault();
      setBig(false);
      const one: Shot = {
        src,
        alt: el.dataset.alt ?? img?.alt ?? "",
        caption: el.dataset.caption ?? el.closest("figure")?.querySelector("figcaption")?.textContent ?? "",
      };
      // A carousel's image: its whole set, starting at this one
      const set = el.closest<HTMLElement>("[data-slides]")?.dataset.slides;
      const list = set ? (JSON.parse(set) as Shot[]) : [one];
      const href = (s: string) => new URL(s, location.href).href;
      const at = Math.max(0, list.findIndex((s) => href(s.src) === href(src)));
      setOpen({ list, at });
    };
    post.addEventListener("click", onClick);
    return () => post.removeEventListener("click", onClick);
  }, []);

  const close = () => setOpen(null);
  const step = (d: number) => {
    if (!many) return;
    setBig(false);
    if (imgRef.current) imgRef.current.style.transform = "";
    setOpen((o) => o && { ...o, at: (o.at + d + o.list.length) % o.list.length });
  };

  // Open: the page stays still under it; Esc closes, ← → step a set
  const isOpen = !!open;
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowLeft") stepRef.current(-1);
      if (e.key === "ArrowRight") stepRef.current(1);
    };
    window.addEventListener("keydown", key);
    return () => {
      root.style.overflow = was;
      window.removeEventListener("keydown", key);
    };
  }, [isOpen]);

  // Larger, with a mouse: how much (the file's own pixels on this screen, at least
  // twice the fit), and where — the side the mouse is toward
  const look = (x: number, y: number) => {
    const img = imgRef.current;
    if (!img) return;
    const fitW = img.clientWidth;
    const fitH = img.clientHeight;
    const scale = Math.max(2, img.naturalWidth / devicePixelRatio / fitW);
    const spareX = Math.max(0, (fitW * scale - innerWidth) / 2);
    const spareY = Math.max(0, (fitH * scale - innerHeight) / 2);
    const tx = (0.5 - x / innerWidth) * 2 * spareX;
    const ty = (0.5 - y / innerHeight) * 2 * spareY;
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  // One finger, page not pinched: sideways steps a set (past 50px), down closes (past
  // 90px). The first few px decide which.
  const touch = useRef<{ x: number; y: number; dx: number; side: boolean | null } | null>(null);

  if (!open || !shot) return <span ref={hereRef} hidden />;
  const arrow = (d: -1 | 1) => (
    <button
      type="button"
      className={d < 0 ? styles.prev : styles.next}
      onClick={() => step(d)}
      aria-label={d < 0 ? "Previous image" : "Next image"}
    >
      <svg viewBox="0 0 26 14" width="26" height="14" aria-hidden="true">
        <path d={d < 0 ? "M26 7H2M7 1.5 1 7l6 5.5" : "M0 7h24M19 1.5 25 7l-6 5.5"} />
      </svg>
    </button>
  );
  return (
    <>
      <span ref={hereRef} hidden />
      {createPortal(
        <div
          className={styles.box}
          role="dialog"
          aria-modal="true"
          aria-label={shot.alt || "Image"}
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          onTouchStart={(e) => {
            const zoomed = (window.visualViewport?.scale ?? 1) > 1.01;
            touch.current =
              e.touches.length === 1 && !zoomed ? { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, side: null } : null;
          }}
          onTouchMove={(e) => {
            const t = touch.current;
            if (!t || e.touches.length !== 1) return;
            const dx = e.touches[0].clientX - t.x;
            const dy = e.touches[0].clientY - t.y;
            if (t.side == null && Math.hypot(dx, dy) > 8) t.side = Math.abs(dx) > Math.abs(dy);
            if (t.side) t.dx = dx;
            else if (t.side === false) setPull(Math.max(0, dy));
          }}
          onTouchEnd={() => {
            const t = touch.current;
            if (t?.side && many && Math.abs(t.dx) > 50) step(t.dx < 0 ? 1 : -1);
            else if (t?.side === false && pull > 90) close();
            touch.current = null;
            setPull(0);
          }}
        >
          <button type="button" className={styles.close} onClick={close} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 2l12 12M14 2 2 14" />
            </svg>
          </button>
          {many && arrow(-1)}
          <figure className={styles.figure} style={pull ? { transform: `translateY(${pull}px)`, opacity: 1 - pull / 400 } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the file itself, full size */}
            <img
              key={shot.src}
              ref={imgRef}
              src={shot.src}
              alt={shot.alt}
              className={styles.img}
              data-big={big || undefined}
              onClick={(e) => {
                if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
                const next = !big;
                setBig(next);
                if (next) look(e.clientX, e.clientY);
                else e.currentTarget.style.transform = "";
              }}
              onMouseMove={(e) => big && look(e.clientX, e.clientY)}
            />
            {!big && (shot.caption || many) && (
              <figcaption className={styles.caption}>
                {shot.caption}
                {many && (
                  <span className={styles.count}>
                    {String(open.at + 1).padStart(2, "0")} / {String(open.list.length).padStart(2, "0")}
                  </span>
                )}
              </figcaption>
            )}
          </figure>
          {many && arrow(1)}
        </div>,
        document.body,
      )}
    </>
  );
}
