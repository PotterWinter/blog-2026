"use client";

import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { PostMeta } from "@/lib/content";
import { shortDate } from "@/lib/format";
import { categories } from "@/lib/site";
import styles from "./SearchPanel.module.css";

type Props = {
  id: string;
  open: boolean;
  query: string;
  results: PostMeta[];
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

// The v4 search panel under the search box (1024 and up): the top results, a grey bar
// that follows the pointer or ↑↓, and on Enter the bar turns ink, the title nudges 14px
// and a white dot hops in front before the post opens.
export default function SearchPanel({ id, open, query, results, active, picked, onHover, onPick }: Props) {
  const label = (slug: string) => categories.find((c) => c.slug === slug)?.label ?? slug;
  const bar = picked ?? active;
  const barRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

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
          <div id={id} role="listbox" aria-label="Search results" className={styles.list}>
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
