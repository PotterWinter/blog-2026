"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
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
}: {
  value: string;
  total: number;
  results: PostMeta[]; // best matches for the panel
  onChange: (value: string) => void;
  onOpen: (post: PostMeta) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const open = focused && value.trim() !== "" && picked === null;
  const showPanel = open || picked !== null;

  // Choosing a row plays the v4 pick (ink bar, nudge, dot hop), then opens the post
  const pick = (index: number) => {
    const post = results[index];
    if (!post || picked !== null) return;
    setPicked(index);
    window.setTimeout(() => {
      setPicked(null);
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
      setActive((a) => (a + step + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      setFocused(false);
    }
  };

  return (
    <div className={styles.right}>
      <label className={styles.search}>
        <svg width="12" height="12" viewBox="0 0 13 13" fill="none" strokeWidth="1.3" aria-hidden="true">
          <circle cx="5.5" cy="5.5" r="4" />
          <path d="M8.6 8.6 12 12" />
        </svg>
        <input
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
          onFocus={() => setFocused(true)}
          // A beat before closing, so a click on a result still lands
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
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

export function TagsPanel({ open, tags, selected, matching, total, onToggleTag, onClear }: TagsPanelProps) {
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
