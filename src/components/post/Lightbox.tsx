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
// count under the caption (owner, 6 Oct 69). The images slide, as the carousel's do: a
// finger pulls them along, a step glides (owner, 13 Oct 69 — they swapped in place). A PDF's pages are a set too (PdfCard): drawn
// one by one, so the set is read again whenever it changes while open (13 Oct 69).
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

// The track: the panes 40px apart, a step's slide as a finger's on the carousel (0.35s)
const GAP = 40;
const SLIDE_MS = 350;
const SLIDE = `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;

export default function Lightbox() {
  const hereRef = useRef<HTMLSpanElement>(null);
  // The images it can show (one, or a carousel's set) and which is shown
  const [open, setOpen] = useState<{ list: Shot[]; at: number; from: HTMLElement | null } | null>(null);
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
      const from = el.closest<HTMLElement>("[data-slides]");
      const set = from?.dataset.slides;
      const list = set ? (JSON.parse(set) as Shot[]) : [one];
      const href = (s: string) => new URL(s, location.href).href;
      const at = Math.max(0, list.findIndex((s) => s.src && href(s.src) === href(src)));
      setOpen({ list, at, from });
    };
    post.addEventListener("click", onClick);
    return () => post.removeEventListener("click", onClick);
  }, []);

  const close = () => setOpen(null);
  // The images on a track — the one before, this one, the one after — moved by a finger
  // (dx) and slid to the next on a step; landed, the set moves on and the track is
  // back in the middle, unseen
  const trackRef = useRef<HTMLDivElement>(null);
  const sliding = useRef(false);
  const place = (dx: number, ease: string | null, to = 0) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = ease ?? "none";
    el.style.transform = `translateX(calc(${-1 - to} * (100% + ${GAP}px) + ${dx}px))`;
  };
  const step = (d: number) => {
    if (!many || sliding.current) return;
    setBig(false);
    if (imgRef.current) imgRef.current.style.transform = "";
    sliding.current = true;
    place(0, SLIDE, d);
    window.setTimeout(() => {
      setOpen((o) => o && { ...o, at: (o.at + d + o.list.length) % o.list.length });
      place(0, null);
      sliding.current = false;
    }, SLIDE_MS);
  };

  // A set that fills in while open (a PDF's pages): read again as it changes
  const from = open?.from ?? null;
  useEffect(() => {
    if (!from) return;
    const seen = new MutationObserver(() => {
      const set = from.dataset.slides;
      if (set) setOpen((o) => o && { ...o, list: JSON.parse(set) as Shot[] });
    });
    seen.observe(from, { attributes: true, attributeFilter: ["data-slides"] });
    return () => seen.disconnect();
  }, [from]);

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

  // One finger, page not pinched: sideways pulls a set along and steps it (past a fifth
  // of the screen, or a flick), down closes (past 90px). The first few px decide which.
  const touch = useRef<{ x: number; y: number; t: number; dx: number; side: boolean | null } | null>(null);

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
              e.touches.length === 1 && !zoomed && !sliding.current
                ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp, dx: 0, side: null }
                : null;
          }}
          onTouchMove={(e) => {
            const t = touch.current;
            if (!t || e.touches.length !== 1) return;
            const dx = e.touches[0].clientX - t.x;
            const dy = e.touches[0].clientY - t.y;
            if (t.side == null && Math.hypot(dx, dy) > 8) t.side = Math.abs(dx) > Math.abs(dy);
            if (t.side && many) {
              t.dx = dx;
              place(dx, null);
            } else if (t.side === false) setPull(Math.max(0, dy));
          }}
          onTouchEnd={(e) => {
            const t = touch.current;
            const speed = t ? t.dx / Math.max(1, e.timeStamp - t.t) : 0;
            if (t?.side && many) {
              if (Math.abs(t.dx) > innerWidth / 5 || (Math.abs(speed) > 0.5 && Math.abs(t.dx) > 20)) {
                // From where the finger left it, on to the next
                const d = t.dx < 0 ? 1 : -1;
                sliding.current = true;
                place(0, SLIDE, d);
                window.setTimeout(() => {
                  setOpen((o) => o && { ...o, at: (o.at + d + o.list.length) % o.list.length });
                  place(0, null);
                  sliding.current = false;
                }, SLIDE_MS);
              } else place(0, SLIDE);
            } else if (t?.side === false && pull > 90) close();
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
            <div className={styles.view}>
              <div
                ref={trackRef}
                className={styles.track}
                // In the middle: the one shown, its neighbours either side, out of sight
                style={{ gap: GAP, transform: many ? `translateX(calc(-1 * (100% + ${GAP}px)))` : undefined }}
              >
                {(many ? [-1, 0, 1] : [0]).map((o) => {
                  const i = (open.at + o + open.list.length) % open.list.length;
                  const s = open.list[i];
                  return (
                    <div key={o} className={styles.pane} aria-hidden={o !== 0 || undefined}>
                      {/* A PDF page not drawn yet: nothing (an <img> with no file showed its
                          alt and a broken-image mark), till it is */}
                      {!s.src ? null : (
                      // eslint-disable-next-line @next/next/no-img-element -- the file itself, full size
                      <img
                        ref={o === 0 ? imgRef : undefined}
                        src={s.src}
                        alt={o === 0 ? s.alt : ""}
                        className={styles.img}
                        draggable={false}
                        data-big={(o === 0 && big) || undefined}
                        onClick={
                          o === 0
                            ? (e) => {
                                if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
                                const next = !big;
                                setBig(next);
                                if (next) look(e.clientX, e.clientY);
                                else e.currentTarget.style.transform = "";
                              }
                            : undefined
                        }
                        onMouseMove={o === 0 ? (e) => big && look(e.clientX, e.clientY) : undefined}
                      />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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
