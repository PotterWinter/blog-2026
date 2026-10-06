"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Lightbox.module.css";
import postStyles from "./Post.module.css";

type Shot = { src: string; alt: string; caption: string };

// An image in a post, opened on its own over the page (owner, 5 Oct 69): with a mouse
// from the ⤢ in its corner only (shown while the mouse is over the image — the image
// itself keeps the plain pointer, and a carousel's halves step it); a finger taps the
// image. Black around it, its caption under it; × / Esc / a press beside it
// closes it. On a phone the fingers zoom it (the page's own pinch) and a pull down
// closes it; with a mouse a press on it shows it larger — the file's own pixels, or
// twice the fit — and the image follows the mouse to show the rest.
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
  const [shot, setShot] = useState<Shot | null>(null);
  const [big, setBig] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [pull, setPull] = useState(0);

  useEffect(() => {
    const post = hereRef.current?.parentElement;
    if (!post) return;
    const open = (e: MouseEvent) => {
      const el = (e.target as Element).closest<HTMLElement>("[data-zoom]");
      if (!el || !post.contains(el) || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const img = el instanceof HTMLImageElement ? el : null;
      if (img && matchMedia("(hover: hover) and (pointer: fine)").matches) return; // a mouse: the ⤢
      const src = el.dataset.zoom || img?.currentSrc || img?.src;
      if (!src) return;
      e.preventDefault();
      setBig(false);
      setShot({
        src,
        alt: el.dataset.alt ?? img?.alt ?? "",
        caption: el.dataset.caption ?? el.closest("figure")?.querySelector("figcaption")?.textContent ?? "",
      });
    };
    post.addEventListener("click", open);
    return () => post.removeEventListener("click", open);
  }, []);

  // Open: the page stays still under it; Esc closes
  useEffect(() => {
    if (!shot) return;
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && setShot(null);
    window.addEventListener("keydown", key);
    return () => {
      root.style.overflow = was;
      window.removeEventListener("keydown", key);
    };
  }, [shot]);

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

  // A pull down, one finger, page not pinched: past 90px it closes
  const touch = useRef<{ y: number } | null>(null);

  if (!shot) return <span ref={hereRef} hidden />;
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
            if (e.target === e.currentTarget) setShot(null);
          }}
          onTouchStart={(e) => {
            const zoomed = (window.visualViewport?.scale ?? 1) > 1.01;
            touch.current = e.touches.length === 1 && !zoomed ? { y: e.touches[0].clientY } : null;
          }}
          onTouchMove={(e) => {
            if (!touch.current || e.touches.length !== 1) return;
            setPull(Math.max(0, e.touches[0].clientY - touch.current.y));
          }}
          onTouchEnd={() => {
            if (touch.current && pull > 90) setShot(null);
            touch.current = null;
            setPull(0);
          }}
        >
          <button type="button" className={styles.close} onClick={() => setShot(null)} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 2l12 12M14 2 2 14" />
            </svg>
          </button>
          <figure className={styles.figure} style={pull ? { transform: `translateY(${pull}px)`, opacity: 1 - pull / 400 } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element -- the file itself, full size */}
            <img
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
            {shot.caption && !big && <figcaption className={styles.caption}>{shot.caption}</figcaption>}
          </figure>
        </div>,
        document.body,
      )}
    </>
  );
}
