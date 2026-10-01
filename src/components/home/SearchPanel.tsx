"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { ForReaders } from "@/lib/content";
import { shortDate } from "@/lib/format";
import { categories } from "@/lib/site";
import styles from "./SearchPanel.module.css";

type Props = {
  id: string;
  open: boolean;
  query: string;
  results: ForReaders[];
  active: number;
  picked: number | null; // the row that was chosen (Enter / click), mid-animation
  onHover: (index: number) => void;
  onPick: (index: number) => void;
};

// Underline every typed word where it first appears in the title ("locks row" still
// marks both words in "Postgres row locks, illustrated")
function Highlight({ title, query }: { title: string; query: string }) {
  const lower = title.toLowerCase();
  const marks: [number, number][] = [];
  for (const word of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const at = lower.indexOf(word);
    if (at >= 0) marks.push([at, at + word.length]);
  }
  marks.sort((a, b) => a[0] - b[0]);
  const parts: ReactNode[] = [];
  let from = 0;
  for (const [start, end] of marks) {
    if (start < from) continue; // overlapping words: keep the first
    parts.push(title.slice(from, start));
    parts.push(
      <span key={start} className={styles.match}>
        {title.slice(start, end)}
      </span>,
    );
    from = end;
  }
  parts.push(title.slice(from));
  return <>{parts}</>;
}

// The v4 search panel under the search box: every result (about six in view, the rest
// scroll), a grey bar
// that follows the pointer or ↑↓, and on Enter the bar turns ink, the title nudges 14px
// and a white dot hops in front before the post opens.
export default function SearchPanel({
  id,
  open,
  query,
  results,
  active,
  picked,
  onHover,
  onPick,
}: Props) {
  const label = (slug: string) => categories.find((c) => c.slug === slug)?.label ?? slug;
  const bar = picked ?? active;
  const barRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);

  // Our own scroll bar, always shown while the list overflows: phones (and macOS)
  // only flash theirs during a scroll, so you couldn't tell there was more or where
  // you were. Thumb = the share of the list in view, placed by how far it's scrolled.
  useEffect(() => {
    const list = listRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!list || !track || !thumb) return;
    const paint = () => {
      const { scrollTop, scrollHeight, clientHeight } = list;
      const overflow = scrollHeight - clientHeight > 1;
      track.toggleAttribute("data-on", overflow);
      if (!overflow) return;
      const h = Math.max(24, (clientHeight * clientHeight) / scrollHeight);
      const y = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - h);
      thumb.style.height = `${h}px`;
      thumb.style.transform = `translateY(${y}px)`;
    };
    paint();
    list.addEventListener("scroll", paint, { passive: true });
    const resized = new ResizeObserver(paint);
    resized.observe(list);
    return () => {
      list.removeEventListener("scroll", paint);
      resized.disconnect();
    };
  }, [results, open]);

  // The list never runs under the phone keyboard: its height is capped by the room
  // left in the visible part of the screen, which grows when the keyboard goes away
  useEffect(() => {
    const list = listRef.current;
    const vv = window.visualViewport;
    if (!open || !list) return;
    const fit = () => {
      const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const room = bottom - list.getBoundingClientRect().top - 20;
      list.style.setProperty("--room", `${Math.max(120, Math.round(room))}px`);
    };
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    window.addEventListener("scroll", fit, { passive: true });
    return () => {
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      window.removeEventListener("scroll", fit);
    };
  }, [open]);

  // A new search starts at the top of the list
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query]);

  // One bar slides between rows (grey on hover / ↑↓, ink once picked)
  useLayoutEffect(() => {
    const el = barRef.current;
    const row = rowRefs.current[bar];
    if (!el) return;
    if (!row || !results.length) {
      el.style.opacity = "0";
      return;
    }
    el.style.opacity = "1";
    el.style.transform = `translateY(${row.offsetTop}px)`;
    el.style.height = `${row.offsetHeight}px`;
  }, [bar, results]);

  return (
    <div className={styles.panel} data-open={open || undefined}>
      <div className={styles.clip}>
        <div className={styles.inner}>
          <div className={`label ${styles.head}`}>
            <span>Results</span>
            <span>{String(results.length).padStart(2, "0")}</span>
          </div>
          <div className={styles.scroller}>
            <div
              ref={listRef}
              id={id}
              role="listbox"
              aria-label="Search results"
              className={styles.list}
            >
              <div
                ref={barRef}
                className={styles.bar}
                data-picked={picked !== null || undefined}
                aria-hidden="true"
              />
              {results.map((post, i) => (
                <div
                  key={post.slug}
                  ref={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={styles.row}
                  data-picked={i === picked || undefined}
                  style={{ animationDelay: `${i * 32}ms` }}
                  // Keep focus in the input so ↑↓ and Enter keep working
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerEnter={() => onHover(i)}
                  onClick={() => onPick(i)}
                >
                  <span className={styles.dot} aria-hidden="true" />
                  <span className={styles.title}>
                    <Highlight title={post.title} query={query.trim()} />
                  </span>
                  <span className={`label ${styles.meta}`}>
                    {label(post.category)} · {shortDate(post.publishedAt)}
                  </span>
                </div>
              ))}
              {results.length === 0 && (
                <p className={styles.empty}>Nothing yet on “{query.trim()}”.</p>
              )}
            </div>
            <span ref={trackRef} className={styles.track} aria-hidden="true">
              <span ref={thumbRef} className={styles.thumb} />
            </span>
          </div>
          <div className={`label ${styles.foot}`}>
            <span>↑↓ Select</span>
            <span>↵ Open</span>
            <span className={styles.esc}>Esc</span>
          </div>
        </div>
      </div>
    </div>
  );
}
