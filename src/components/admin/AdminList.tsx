"use client";

import { memo, useEffect, useRef } from "react";
import { postIssues } from "@/lib/checks";
import { shortDate } from "@/lib/format";
import type { IndexEntry } from "@/lib/schema";
import { categories, projectCategories } from "@/lib/site";
import { SortHead } from "../home/PostList";
import type { Sort } from "./FilterPanel";
import styles from "./Admin.module.css";

type Props = {
  posts: IndexEntry[];
  selected: number | null; // post id
  sort: Sort | null; // null = No. high → low, no head marked
  onSort: (sort: Sort) => void;
  onSelect: (id: number | null) => void; // null = nothing selected
  onOpen: (id: number) => void;
};

const categoryLabel = (slug: string) =>
  [...categories, ...projectCategories].find((c) => c.slug === slug)?.label ?? slug;

// v4's Cat. column: two letters, "Engineering" → "EN". The project pair would both be
// "DE", so they get their own; the full name shows on hover
const SHORT: Record<string, string> = { development: "DV", design: "DS" };
const categoryShort = (slug: string) => SHORT[slug] ?? categoryLabel(slug).slice(0, 2).toUpperCase();

// v4 springs, per 60fps frame: the grey bar and the dot .16 / .64, the dot's size .22 / .68
type Spring = { x: number; v: number; to: number };
const step = (s: Spring, pull: number, damp: number) => {
  s.v = (s.v + (s.to - s.x) * pull) * damp;
  s.x += s.v;
};
const moving = (s: Spring, eps = 0.05) => Math.abs(s.to - s.x) > eps || Math.abs(s.v) > eps;

// 06B list (v4 data-peekzone): No. · Title + file · Status · Cat. · Date, a row a post.
// Works like the cards: a click (or ↑ ↓) selects — a grey bar springs to the row and a
// dot takes the place of its number — a click on the selected row lets it go, Enter or
// a double-click "opens" (the bar goes black, the text white and steps in 14px). Title
// and Date sort, as the Filter panel's Sort does.
export default function AdminList({ posts, selected, sort, onSort, onSelect, onOpen }: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const aimRef = useRef<(snap?: boolean) => void>(() => {});
  const pressRef = useRef<() => void>(() => {});

  useEffect(() => {
    const zone = zoneRef.current;
    const bar = barRef.current;
    const dot = dotRef.current;
    if (!zone || !bar || !dot) return;
    const by: Spring = { x: 0, v: 0, to: 0 };
    const bh: Spring = { x: 0, v: 0, to: 0 };
    const dx: Spring = { x: 0, v: 0, to: 0 };
    const dy: Spring = { x: 0, v: 0, to: 0 };
    const ds: Spring = { x: 0, v: 0, to: 0 };
    let press = 1;
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      raf = 0;
      // As many 60fps steps as the time that passed: dropped frames don't slow it
      const steps = last ? Math.min(4, Math.max(1, Math.round((now - last) / (1000 / 60)))) : 1;
      last = now;
      for (let i = 0; i < steps; i++) {
        step(by, 0.16, 0.64);
        step(bh, 0.16, 0.64);
        step(dx, 0.16, 0.64);
        step(dy, 0.16, 0.64);
        step(ds, 0.22, 0.68);
      }
      bar.style.transform = `translateY(${by.x.toFixed(2)}px)`;
      bar.style.height = `${Math.max(0, bh.x).toFixed(2)}px`;
      // The dot stretches along its path while it moves, up to 25%
      const squash = Math.min(0.25, Math.hypot(dx.v, dy.v) / 60);
      const angle = Math.atan2(dy.v, dx.v);
      const s = Math.max(0, ds.x);
      dot.style.transform =
        `translate(${dx.x.toFixed(2)}px, ${dy.x.toFixed(2)}px) rotate(${angle.toFixed(3)}rad) ` +
        `scale(${(s * (1 + squash)).toFixed(3)}, ${(s * (1 - squash)).toFixed(3)})`;
      if (moving(by) || moving(bh) || moving(dx) || moving(dy) || moving(ds, 0.002)) {
        raf = requestAnimationFrame(tick);
      } else {
        last = 0;
      }
    };
    const go = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    aimRef.current = (snap) => {
      const row = zone.querySelector<HTMLElement>("[data-sel]");
      if (!row) {
        bar.style.opacity = "0";
        ds.to = 0;
        go();
        return;
      }
      const no = row.firstElementChild as HTMLElement;
      by.to = row.offsetTop;
      bh.to = row.offsetHeight;
      dx.to = no.offsetLeft + 4;
      dy.to = row.offsetTop + no.offsetTop + no.offsetHeight / 2;
      ds.to = press;
      // Arriving from nothing: the bar appears in place, the dot grows where it lands
      if (snap || bar.style.opacity !== "1") {
        Object.assign(by, { x: by.to, v: 0 });
        Object.assign(bh, { x: bh.to, v: 0 });
        Object.assign(dx, { x: dx.to, v: 0 });
        Object.assign(dy, { x: dy.to, v: 0 });
      }
      bar.style.opacity = "1";
      go();
    };
    // Opening: the dot gives a little (.7) and comes back
    pressRef.current = () => {
      press = 0.7;
      ds.to = press;
      go();
      window.setTimeout(() => {
        press = 1;
        if (ds.to) ds.to = 1;
        go();
      }, 170);
    };

    const onResize = () => aimRef.current(true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Follow the selection (and the page of rows changing under it)
  useEffect(() => aimRef.current(), [selected, posts]);

  const open = (id: number) => {
    const bar = barRef.current;
    const row = zoneRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (!bar || !row) return;
    bar.setAttribute("data-open", "");
    row.setAttribute("data-open", "");
    pressRef.current();
    window.setTimeout(() => {
      bar.removeAttribute("data-open");
      row.removeAttribute("data-open");
    }, 1250);
    onOpen(id);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!posts.length) return;
    const k = posts.findIndex((p) => p.id === selected);
    if (e.key === "Enter") {
      if (k < 0) return;
      e.preventDefault();
      open(posts[k].id);
      return;
    }
    if (e.key === "Escape" && k >= 0) {
      onSelect(null);
      return;
    }
    const d = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    // Nothing selected yet: the arrows start at the first row
    const next = posts[k < 0 ? 0 : Math.max(0, Math.min(posts.length - 1, k + d))].id;
    onSelect(next);
    zoneRef.current?.querySelector(`[data-id="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  // Clicks are read off the list (which row, by data-id), so the rows take no callbacks
  // and memo skips all but the two that change on a move
  const rowAt = (e: React.MouseEvent) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>("[data-id]")?.dataset.id;
    return id ? Number(id) : null;
  };

  return (
    <div className={styles.list}>
      <div className={`${styles.listGrid} ${styles.listHead}`}>
        {/* Every head sorts, as 01B's: nothing pressed = No. high → low and no arrow; the first
            press low → high (↓: 001, A, Draft, oldest), again the other way (owner, 2 Oct 69) */}
        <SortHead
          label="No."
          on={sort === "no" || sort === "no-r"}
          up={sort === "no-r"}
          onClick={() => onSort(sort === "no" ? "no-r" : "no")}
          phones
        />
        <SortHead
          label="Title"
          on={sort === "az" || sort === "za"}
          up={sort === "za"}
          onClick={() => onSort(sort === "az" ? "za" : "az")}
          phones
        />
        <span className={styles.wide}>
          <SortHead
            label="Status"
            on={sort === "status" || sort === "status-r"}
            up={sort === "status-r"}
            onClick={() => onSort(sort === "status" ? "status-r" : "status")}
          />
        </span>
        <span className={styles.wide}>
          <SortHead
            label="Cat."
            on={sort === "cat" || sort === "cat-r"}
            up={sort === "cat-r"}
            onClick={() => onSort(sort === "cat" ? "cat-r" : "cat")}
          />
        </span>
        <span className={styles.wide}>
          <SortHead
            label="Date"
            on={sort === "new" || sort === "old"}
            up={sort === "new"}
            onClick={() => onSort(sort === "old" ? "new" : "old")}
          />
        </span>
      </div>
      <div
        ref={zoneRef}
        className={styles.rows}
        tabIndex={0}
        onKeyDown={onKey}
        onClick={(e) => {
          const id = rowAt(e);
          if (id != null) onSelect(id === selected ? null : id);
        }}
        onDoubleClick={(e) => {
          const id = rowAt(e);
          if (id != null) open(id);
        }}
        aria-label="Posts"
      >
        <span ref={barRef} className={styles.bar} aria-hidden="true" />
        <span ref={dotRef} className={styles.rowDot} aria-hidden="true" />
        {posts.map((p) => (
          <Row key={p.id} p={p} selected={p.id === selected} />
        ))}
      </div>
    </div>
  );
}

const Row = memo(function Row({ p, selected }: { p: IndexEntry; selected: boolean }) {
  const draft = p.status === "draft";
  return (
    <article
      className={`${styles.listGrid} ${styles.row}`}
      data-id={p.id}
      data-sel={selected || undefined}
    >
      <span className={styles.rowNo}>{String(p.id).padStart(3, "0")}</span>
      <span className={styles.tcol}>
        <span className={styles.rowTitle} data-issues={postIssues(p).length > 0 || undefined}>
          {p.title}
        </span>
        <span className={styles.rowFile}>{p.slug}.md</span>
      </span>
      <span className={styles.rowStatus} data-draft={draft || undefined}>
        {draft ? "Draft" : "Published"}
      </span>
      <span className={`label ${styles.rowCat}`} title={categoryLabel(p.category)}>
        {categoryShort(p.category)}
      </span>
      <span className="label">{shortDate(p.publishedAt)}</span>
    </article>
  );
});
