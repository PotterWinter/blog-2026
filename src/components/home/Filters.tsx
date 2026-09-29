"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import type { PostMeta } from "@/lib/content";
import styles from "./Filters.module.css";
import SearchPanel from "./SearchPanel";

// The rest of the 01 filter row (after the categories) and the tags panel under it.

// turns = how many times it has been pressed; odd = open
export function TagsToggle({ turns, onToggle }: { turns: number; onToggle: () => void }) {
  const open = turns % 2 === 1;
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-expanded={open}
      aria-controls="tags-panel"
      onClick={onToggle}
    >
      Tags
      {/* A plus that turns into a minus and back. The upright bar always turns clockwise,
          another quarter each press (v4), so closing doesn't spin it backwards. */}
      <span className={styles.sign} aria-hidden="true">
        <span />
        <span style={{ rotate: `${90 + turns * 90}deg` }} />
      </span>
    </button>
  );
}

export function SearchBox({
  value,
  total,
  results,
  onChange,
  onOpen,
  children,
}: {
  value: string;
  total: number;
  results: PostMeta[]; // every match, best first, for the panel
  onChange: (value: string) => void;
  onOpen: (post: PostMeta) => void;
  children?: ReactNode; // what sits after the box: GRID / LIST
}) {
  // Engaged = the panel may show. With a mouse it ends when the box loses focus. On a
  // touch screen it outlasts the keyboard: putting the keyboard away (or scrolling the
  // results, which does that for you) leaves the results up to browse; a tap anywhere
  // outside the box and panel closes them.
  const [engaged, setEngaged] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const open = engaged && value.trim() !== "" && picked === null;

  useEffect(() => {
    if (!engaged) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setEngaged(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [engaged]);
  const showPanel = open || picked !== null;

  // Choosing a row plays the v4 pick (ink bar, nudge, dot hop), then opens the post
  const pick = (index: number) => {
    const post = results[index];
    if (!post || picked !== null) return;
    setPicked(index);
    window.setTimeout(() => {
      setPicked(null);
      setEngaged(false);
      (document.activeElement as HTMLElement | null)?.blur();
      onOpen(post);
    }, 700);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!results.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next = (active + step + results.length) % results.length;
      setActive(next);
      // The list scrolls past about six rows: keep the chosen one in view
      requestAnimationFrame(() =>
        document.getElementById(`search-results-${next}`)?.scrollIntoView({ block: "nearest" }),
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      setEngaged(false);
    }
  };

  return (
    <div className={styles.right}>
      <div
        ref={wrapRef}
        className={styles.searchWrap}
        // Scrolling the results on a phone puts the keyboard away, to make room
        onTouchMove={(e) => {
          if ((e.target as Element).closest('[role="listbox"]')) inputRef.current?.blur();
        }}
      >
        <label className={styles.search}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 13 13"
            fill="none"
            strokeWidth="1.3"
            aria-hidden="true"
          >
            <circle cx="5.5" cy="5.5" r="4" />
            <path d="M8.6 8.6 12 12" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            className={styles.input}
            placeholder={`Search ${total} posts`}
            aria-label="Search posts"
            role="combobox"
            aria-expanded={open}
            aria-controls="search-results"
            aria-activedescendant={open && results.length ? `search-results-${active}` : undefined}
            value={value}
            onChange={(e) => {
              setActive(0);
              onChange(e.target.value);
            }}
            onFocus={() => setEngaged(true)}
            // With a mouse, losing focus closes (a beat later, so a click on a result
            // still lands); on touch the panel stays until a tap outside
            onBlur={() => {
              if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
                window.setTimeout(() => setEngaged(false), 120);
              }
            }}
            onKeyDown={onKeyDown}
          />
        </label>
        <SearchPanel
          id="search-results"
          open={showPanel}
          query={value}
          results={results}
          active={active}
          picked={picked}
          onHover={setActive}
          onPick={pick}
        />
      </div>
      {children}
    </div>
  );
}

export type View = "grid" | "list";

// GRID / LIST: a capsule with an ink pill that slides to the chosen side and takes its
// width (v4 _segs: 390ms, no bounce). The labels are white with a difference blend, so
// each one reads ink on paper and white on the pill.
export function ViewToggle({ value, onChange }: { value: View; onChange: (view: View) => void }) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<Record<View, HTMLButtonElement | null>>({ grid: null, list: null });

  useLayoutEffect(() => {
    const pill = pillRef.current;
    const item = itemRefs.current[value];
    if (!pill || !item) return;
    const place = () => {
      pill.style.transform = `translateX(${item.offsetLeft}px)`;
      pill.style.width = `${item.offsetWidth}px`;
    };
    place();
    // First placement is instant; from then on the pill glides
    if (!pill.dataset.ready) requestAnimationFrame(() => (pill.dataset.ready = ""));
    // The web font arriving changes the label widths
    const observer = new ResizeObserver(place);
    observer.observe(item);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div className={styles.views} role="group" aria-label="View">
      <span ref={pillRef} className={styles.pill} aria-hidden="true" />
      {(["grid", "list"] as const).map((view) => (
        <button
          key={view}
          ref={(el) => {
            itemRefs.current[view] = el;
          }}
          type="button"
          className={styles.view}
          aria-pressed={view === value}
          onClick={() => view !== value && onChange(view)}
        >
          {view}
        </button>
      ))}
    </div>
  );
}

type TagsPanelProps = {
  open: boolean;
  // count = posts with this tag in the chosen category; 0 = none there, so it's greyed out
  tags: { name: string; count: number }[];
  selected: string[];
  matching: number;
  total: number;
  onToggleTag: (name: string) => void;
  onClear: () => void;
};

export function TagsPanel({
  open,
  tags,
  selected,
  matching,
  total,
  onToggleTag,
  onClear,
}: TagsPanelProps) {
  const summary = selected.length
    ? `${selected.join(" · ")} — ${matching} ${matching === 1 ? "post" : "posts"}`
    : `none — showing all ${total} posts`;

  return (
    // Opens by growing its one grid row from 0fr to 1fr, so no height is measured in JS.
    // inert while closed: its buttons can't be tabbed to when you can't see them.
    <div id="tags-panel" className={styles.panel} data-open={open || undefined} inert={!open}>
      <div className={styles.clip}>
        <div className={styles.content}>
          <div className={styles.head}>
            <span className="label">Selected</span>
            <span className={styles.summary}>{summary}</span>
            <button type="button" className={`label ${styles.clear}`} onClick={onClear}>
              Clear all
            </button>
          </div>
          <div className={styles.tags}>
            {tags.map((tag) => (
              <button
                key={tag.name}
                type="button"
                className={styles.tag}
                aria-pressed={selected.includes(tag.name)}
                disabled={tag.count === 0}
                onClick={() => onToggleTag(tag.name)}
              >
                <span className={styles.box} aria-hidden="true" />
                {tag.name}
                <span className={styles.count}>{tag.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
