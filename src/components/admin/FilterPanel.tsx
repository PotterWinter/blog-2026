"use client";

import { memo, useLayoutEffect, useRef } from "react";
import styles from "./Admin.module.css";

// The panel offers date and title; the list's heads (06B) sort by every column, each
// one way then the other ("-r"): No. 001 first, Status Draft first, Cat. A first.
// null = nothing picked yet: No. high → low, nothing ticked, no head marked
export type Sort = "new" | "old" | "az" | "za" | "no" | "no-r" | "status" | "status-r" | "cat" | "cat-r";
export type Picks = { cat: string[]; mon: string[]; iss: boolean };
export type Option = { value: string; label: string; n: number };

type Props = {
  open: boolean;
  categories: Option[];
  issues: number;
  year: string;
  months: Option[]; // all twelve, in order
  picks: Picks;
  sort: Sort | null;
  onPicks: (picks: Picks) => void;
  onSort: (sort: Sort) => void;
};

const SORTS: { value: Sort; label: string }[] = [
  { value: "new", label: "Newest first" },
  { value: "old", label: "Oldest first" },
  { value: "az", label: "Title A–Z" },
  { value: "za", label: "Title Z–A" },
];

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// 06 Filter panel (v4 data-af-panel): opens by easing its height (0.52s). Category and
// Health (posts with issues) and Month tick on and off, any mix; Sort picks one. Each
// count is what that tick would show, given the others.
// memo: Hub re-renders on every card selection; the panel only cares about the filters
export default memo(function FilterPanel({ open, categories, issues, year, months, picks, sort, onPicks, onSort }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    wrap.style.height = `${open ? inner.offsetHeight : 0}px`;
  }, [open, categories, months]);

  const chosen = [
    ...categories.filter((c) => picks.cat.includes(c.value)).map((c) => c.label),
    ...(picks.iss ? ["issues"] : []),
    ...months.filter((m) => picks.mon.includes(m.value)).map((m) => m.label),
  ];

  const tick = (on: boolean, label: string, n: number | null, onClick: () => void, round = false) => (
    <button type="button" className={styles.tick} data-on={on || undefined} onClick={onClick} key={label}>
      <span className={styles.box} data-round={round || undefined} />
      {label}
      {n != null && <span className={styles.tickN}>{n}</span>}
    </button>
  );

  return (
    <div ref={wrapRef} className={styles.panel} aria-hidden={!open} inert={!open}>
      <div ref={innerRef} className={styles.panelInner}>
        <div className={styles.summary}>
          <span className="label">Selected</span>
          <span className={styles.summaryText}>
            {chosen.length ? chosen.join(" · ") : "none — showing all posts"}
          </span>
          <button
            type="button"
            className={`label ${styles.clear}`}
            onClick={() => {
              onPicks({ cat: [], mon: [], iss: false });
              onSort("new");
            }}
          >
            Clear all
          </button>
        </div>
        <div className={styles.groups}>
          <div className={styles.group}>
            <span className={`label ${styles.groupLabel}`}>Category</span>
            {categories.map((c) =>
              tick(picks.cat.includes(c.value), c.label, c.n, () =>
                onPicks({ ...picks, cat: toggle(picks.cat, c.value) }),
              ),
            )}
            <span className={`label ${styles.groupLabel} ${styles.health}`}>Health</span>
            {tick(picks.iss, "issues", issues, () => onPicks({ ...picks, iss: !picks.iss }))}
          </div>
          <div className={styles.group}>
            <span className={`label ${styles.groupLabel}`}>Month · {year}</span>
            {months.slice(0, 6).map((m) =>
              tick(picks.mon.includes(m.value), m.label, m.n, () =>
                onPicks({ ...picks, mon: toggle(picks.mon, m.value) }),
              ),
            )}
          </div>
          <div className={styles.group}>
            <span className={`label ${styles.groupLabel}`}>&nbsp;</span>
            {months.slice(6).map((m) =>
              tick(picks.mon.includes(m.value), m.label, m.n, () =>
                onPicks({ ...picks, mon: toggle(picks.mon, m.value) }),
              ),
            )}
          </div>
          <div className={styles.group}>
            <span className={`label ${styles.groupLabel}`}>Sort by</span>
            {SORTS.map((s) => tick(sort === s.value, s.label, null, () => onSort(s.value), true))}
          </div>
        </div>
      </div>
    </div>
  );
});
