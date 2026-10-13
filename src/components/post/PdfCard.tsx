"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ClipEntry } from "@/lib/clips";
import { fileSize } from "@/lib/format";
import { loadPdfjs } from "@/lib/pdfjs";
import { ZoomButton } from "./Lightbox";
import styles from "./Post.module.css";

// A PDF in a post (owner, 12–13 Oct 69 — papers and book notes in Reading): its pages
// on a grey frame the column's width, one at a time, as large as fits (500 tall at
// most, the first page's ratio), stepped as the carousel is (Carousel): the pages
// follow a finger and slide 0.7s by button; the frame's halves with a mouse (the long
// arrow, ArrowCursor — out to the screen's edges, as the carousel's), Previous / Next by
// finger, ← →. Round and round: past the last page comes the first, and back (owner,
// 13 Oct 69). Full screen as an image is (Lightbox): ⤢ in the corner with a mouse, a
// double tap by finger, then ← → through every page.
// Under it the title and "01 / 06", then PDF · pages · size, and Open, Download at the
// right; the caption.
// Page 1 is its poster, a WebP in git beside the images: the post weighs no more for
// having a PDF. The first touch, step or ⤢ brings in pdf.js and the file from Blob
// (media.json says where; its ?download=1 sends it as a download), and every page is
// drawn here then, one after another — those around the one shown first — each a
// blank sheet until it is.
// Not an embedded PDF: Safari on the iPhone shows only its first page.
const posterSrc = (poster: string) => (/^(https?:|blob:|\/)/.test(poster) ? poster : `/${poster}`);
const pad = (n: number) => String(n).padStart(2, "0");
const SLIDE = "transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)"; // a finger's step, as Carousel's

type Doc = Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfjs>>["getDocument"]>["promise"]>;

export default function PdfCard({ entry, title, caption }: { entry?: ClipEntry; title: string; caption?: string }) {
  const n = Math.max(1, entry?.pages ?? 1);
  const url = entry?.url ?? "";
  const loops = n > 1;
  // On the track: a copy of the last page before the first and of the first after the
  // last, as Carousel's; arriving on a copy, it's swapped for the real one, unseen
  const [at, setAt] = useState(loops ? 1 : 0);
  const k = loops ? ((at - 1 + n) % n) + 1 : 1; // the page shown, 1…n
  const onCopy = loops && (at === 0 || at === n + 1);
  const [drawn, setDrawn] = useState<Record<number, string>>({}); // page → its picture
  const [failed, setFailed] = useState<Record<number, true>>({});
  const docRef = useRef<Promise<Doc> | null>(null);
  const asked = useRef(new Set<number>());
  const frameRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // One page drawn 1600 wide whatever the screen, kept: sharp full screen too — drawn
  // to the frame (×2) it was 670 on an iPhone, broken up in the Lightbox at 3× (owner,
  // 13 Oct 69)
  const draw = async (p: number) => {
    if (p < 2 || p > n || asked.current.has(p)) return;
    asked.current.add(p);
    try {
      if (!docRef.current) {
        // The whole file fetched here, then handed over as data — as the editor reads a
        // picked one. Asked to fetch it itself (getDocument({ url })), pdf.js with its
        // worker on the page sat on "Loading…" for good (13 Oct 69).
        docRef.current = Promise.all([
          loadPdfjs(),
          fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`)))),
        ]).then(([{ getDocument }, bytes]) => getDocument({ data: new Uint8Array(bytes) }).promise);
        docRef.current.catch(() => (docRef.current = null)); // a failed fetch is tried again
      }
      const doc = await docRef.current;
      const page = await doc.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const width = 1600;
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
      if (!blob) throw new Error("no picture");
      const src = URL.createObjectURL(blob);
      urls.current.push(src);
      setDrawn((d) => ({ ...d, [p]: src }));
    } catch {
      asked.current.delete(p);
      setFailed((f) => ({ ...f, [p]: true }));
    }
  };
  // Every page, once asked: those either side of p first (a step or a swipe finds them
  // drawn, round the ends), then the rest in order, one at a time
  const started = useRef(false);
  const around = (p: number) => {
    const wrap = (q: number) => ((q - 1 + n) % n) + 1;
    void draw(p);
    void draw(wrap(p + 1));
    void draw(wrap(p - 1));
    if (started.current) return;
    started.current = true;
    void (async () => {
      for (let q = 2; q <= n; q++) await draw(q);
    })();
  };

  // The halves reach from the frame out to the page's edges, as the carousel's
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !loops) return;
    const measure = () => {
      const page = document.documentElement.clientWidth;
      const r = wrap.getBoundingClientRect();
      wrap.style.setProperty("--out-l", `${Math.max(0, r.left)}px`);
      wrap.style.setProperty("--out-r", `${Math.max(0, page - r.right)}px`);
    };
    measure();
    const seen = new ResizeObserver(measure);
    seen.observe(document.documentElement);
    return () => seen.disconnect();
  }, [loops]);

  const go = (d: number) => {
    if (!loops || onCopy) return;
    setFailed({});
    setAt((a) => a + d);
    around(((k - 1 + d + n) % n) + 1);
  };

  // Where the track sits: the page, less the finger's pull while it's down
  const place = (dx: number, ease: string | null) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = ease ?? "none";
    el.style.transform = `translateX(calc(${-at * 100}% + ${dx}px))`;
  };
  // Landed on a copy: the real page in its place, with no slide to it
  const settle = () => {
    const el = trackRef.current;
    if (!el) return;
    if (at === 0 || at === n + 1) {
      el.style.transition = "none";
      setAt(at === 0 ? n : 1);
      requestAnimationFrame(() => requestAnimationFrame(() => (el.style.transition = "")));
    } else el.style.transition = "";
  };
  const drag = useRef<{ x: number; y: number; t: number; dx: number; sideways: boolean | null } | null>(null);

  if (!entry) return null;
  const ratio = entry.width && entry.height ? entry.width / entry.height : 0.707; // A4 when unknown
  const pages = entry.pages ? ` · ${entry.pages} ${entry.pages === 1 ? "page" : "pages"}` : "";
  const download = url.startsWith("blob:") ? url : `${url}?download=1`;
  const track = loops ? [n, ...Array.from({ length: n }, (_, i) => i + 1), 1] : [1];
  const pageSrc = (p: number) => (p === 1 ? posterSrc(entry.poster) : (drawn[p] ?? ""));
  // Its pages for the Lightbox, as a carousel's set: one not drawn yet is blank there
  // too, and fills in as it is (Lightbox reads this again when it changes)
  const slides = Array.from({ length: n }, (_, i) => ({ src: pageSrc(i + 1), alt: `Page ${i + 1}`, caption: title }));
  const arrow = (back: boolean) => (
    <svg viewBox="0 0 26 14" width="1.3em" height="0.7em" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" aria-hidden="true">
      <path vectorEffect="non-scaling-stroke" d={back ? "M26 7H2M7 1.5 1 7l6 5.5" : "M0 7h24M19 1.5 25 7l-6 5.5"} />
    </svg>
  );

  return (
    <figure
      ref={figRef}
      className={styles.pdf}
      data-slides={JSON.stringify(slides)}
      style={{ "--r": ratio } as CSSProperties}
      aria-roledescription={loops ? "document" : undefined}
      tabIndex={loops ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") go(-1);
        if (e.key === "ArrowRight") go(1);
      }}
    >
      <div ref={wrapRef} className={styles.pdfWrap} onPointerDown={() => loops && around(k)}>
      <div
        ref={frameRef}
        className={styles.pdfFrame}
        data-swipe-own // its own sideways swipe: the editor's Preview leaves it alone
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" || !loops) return;
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
          d.dx = dx;
          place(d.dx, null);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (!d?.sideways) return;
          const width = e.currentTarget.clientWidth;
          const speed = d.dx / Math.max(1, e.timeStamp - d.t);
          const step = Math.abs(d.dx) > width / 5 || (Math.abs(speed) > 0.5 && Math.abs(d.dx) > 20) ? (d.dx < 0 ? 1 : -1) : 0;
          if (step && !onCopy) {
            const el = trackRef.current;
            if (el) el.style.transition = SLIDE;
            go(step);
          } else place(0, SLIDE);
        }}
        onPointerCancel={() => {
          drag.current = null;
          place(0, SLIDE);
        }}
      >
        <div
          ref={trackRef}
          className={styles.pdfTrack}
          style={{ transform: `translateX(${-at * 100}%)` }}
          // A step by button or key: the CSS slide (0.7s) again, after a finger's own
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget) settle();
          }}
        >
          {track.map((p, i) => {
            const src = pageSrc(p);
            return (
              <div key={i} className={styles.pdfSlide} aria-hidden={i !== at || undefined}>
                <div className={styles.pdfPage}>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the poster, or a page drawn here
                    <img
                      src={src}
                      alt={`Page ${p}`}
                      draggable={false}
                      data-zoom="" // a finger's double tap opens it (Lightbox)
                    />
                  ) : (
                    // A blank sheet till it's drawn; a word only if it can't be
                    failed[p] && <span className={styles.pdfWait}>Can&apos;t load this page · Open it instead</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
        {loops && (
          <>
            <button type="button" className={styles.pdfHalf} data-arrow="prev" tabIndex={-1} aria-hidden="true" onClick={() => go(-1)} />
            <button
              type="button"
              className={`${styles.pdfHalf} ${styles.pdfHalfNext}`}
              data-arrow="next"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => go(1)}
            />
          </>
        )}
        {/* With a mouse, full screen from its corner; the whole document comes in for it */}
        <span className={styles.pdfZoom} onClickCapture={() => loops && around(k)}>
          <ZoomButton src={pageSrc(k) || posterSrc(entry.poster)} alt={`Page ${k}`} caption={title} />
        </span>
      </div>
      <figcaption className={styles.slideCaption} aria-live="polite">
        <span className={styles.pdfTitle}>{title || "Untitled PDF"}</span>
        {loops && (
          <span className={styles.slideCount}>
            {pad(k)} / {pad(n)}
          </span>
        )}
      </figcaption>
      {loops && (
        <div className={`${styles.slideNav} ${styles.pdfNav}`}>
          <button type="button" className="label" data-arrow="prev" onClick={() => go(-1)} aria-label="Previous page">
            {arrow(true)} Previous
          </button>
          <button type="button" className="label" data-arrow="next" onClick={() => go(1)} aria-label="Next page">
            Next {arrow(false)}
          </button>
        </div>
      )}
      <div className={styles.pdfDetails}>
        <span className={styles.pdfMeta}>
          PDF{pages} · {fileSize(entry.bytes)}
        </span>
        <a href={url} target="_blank" rel="noopener">
          Open
          <svg viewBox="0 0 20 20" width="0.7em" height="0.7em" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" d="M1 19 18.5 1.5M10.5 1.5h8v8" />
          </svg>
        </a>
        <a href={download} download>
          Download
          <svg viewBox="0 0 14 26" width="0.45em" height="0.85em" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path vectorEffect="non-scaling-stroke" d="M7 0v24M1.5 19 7 25l5.5-6" />
          </svg>
        </a>
      </div>
      {caption && <div className={styles.pdfCaption}>{caption}</div>}
    </figure>
  );
}
