"use client";

import { useEffect, useMemo, useState } from "react";
import { postIssues } from "@/lib/checks";
import type { IndexEntry } from "@/lib/schema";
import { categories, projectCategories } from "@/lib/site";
import { ViewToggle, type View } from "../home/Filters";
import AdminCards from "./AdminCards";
import Details from "./Details";
import FilterPanel, { type Picks, type Sort } from "./FilterPanel";
import styles from "./Admin.module.css";

type Status = "all" | "published" | "draft";
export type RepoHead = { repo: string; branch: string; sha: string; date: string } | null;

const PER_PAGE = 24;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad2 = (n: number) => String(n).padStart(2, "0");
const month = (p: IndexEntry) => p.publishedAt.slice(0, 7); // "2026-09"

const minutesAgo = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

// 06 (v4): "Publishing" with the total, New post, a strip of counts, then All ·
// Published · Draft, Filter, search over every post (not just the page shown — the
// mock's was), GRID / LIST; the cards 24 to a page beside the selected post's details,
// and the content repo's latest commit at the foot.
export default function Hub({ posts, head }: { posts: IndexEntry[]; head: RepoHead }) {
  const [status, setStatus] = useState<Status>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("grid");
  const [filterOpen, setFilterOpen] = useState(false);
  const [picks, setPicks] = useState<Picks>({ cat: [], mon: [], iss: false });
  const [sort, setSort] = useState<Sort>("new");
  // Page and selection are remembered for one listing; change what's listed and they
  // start again (page 1, the first card) without an extra render
  const [paging, setPaging] = useState({ key: "", page: 1 });
  const [picked, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [columns, setColumns] = useState(3);

  const counts = useMemo(() => {
    const published = posts.filter((p) => p.status === "published").length;
    return {
      all: posts.length,
      published,
      draft: posts.length - published,
      // Until the media list (08) exists: covers plus images in the posts
      images: posts.reduce((n, p) => n + p.images + (p.cover ? 1 : 0), 0),
      tags: new Set(posts.flatMap((p) => p.tags)).size,
    };
  }, [posts]);

  // The filter panel's months: the latest year with a post
  const year = posts.reduce((y, p) => (p.publishedAt.slice(0, 4) > y ? p.publishedAt.slice(0, 4) : y), "");
  const issueIds = useMemo(() => new Set(posts.filter((p) => postIssues(p).length).map((p) => p.id)), [posts]);

  // Every filter but one (the one whose counts are being worked out)
  const passes = (p: IndexEntry, skip?: "cat" | "mon" | "iss") => {
    const q = query.trim().toLowerCase();
    return (
      (status === "all" || p.status === status) &&
      (!q || `${p.title} ${p.excerpt} ${p.tags.join(" ")}`.toLowerCase().includes(q)) &&
      (skip === "cat" || !picks.cat.length || picks.cat.includes(p.category)) &&
      (skip === "mon" || !picks.mon.length || picks.mon.includes(month(p))) &&
      (skip === "iss" || !picks.iss || issueIds.has(p.id))
    );
  };

  const shown = useMemo(() => {
    const list = posts.filter((p) => passes(p));
    const byDate = (a: IndexEntry, b: IndexEntry) => a.publishedAt.localeCompare(b.publishedAt) || a.id - b.id;
    if (sort === "new") list.sort((a, b) => byDate(b, a));
    if (sort === "old") list.sort(byDate);
    if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "za") list.sort((a, b) => b.title.localeCompare(a.title));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, status, query, picks, sort, issueIds]);

  const categoryOptions = [...categories, ...projectCategories]
    .filter((c) => posts.some((p) => p.category === c.slug))
    .map((c) => ({ value: c.slug, label: c.label, n: posts.filter((p) => p.category === c.slug && passes(p, "cat")).length }));
  const monthOptions = MONTHS.map((label, i) => {
    const value = `${year}-${pad2(i + 1)}`;
    return { value, label, n: posts.filter((p) => month(p) === value && passes(p, "mon")).length };
  });
  const issueCount = posts.filter((p) => issueIds.has(p.id) && passes(p, "iss")).length;

  const listKey = JSON.stringify([status, query, picks, sort]);
  const page = paging.key === listKey ? paging.page : 1;
  const setPage = (n: number) => setPaging({ key: listKey, page: n });
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const pageItems = shown.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Always a card selected: the one picked while it's on the page, else the first
  const selected = pageItems.some((p) => p.id === picked) ? picked : (pageItems[0]?.id ?? null);
  const current = posts.find((p) => p.id === selected) ?? null;

  // How many cards to a row, for ↑ ↓ (3 from 1280, else 2)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const set = () => setColumns(mq.matches ? 3 : 2);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  const sortedBy = { new: "newest first", old: "oldest first", az: "title A–Z", za: "title Z–A" }[sort];

  const pills: { value: Status; label: string; n: number }[] = [
    { value: "all", label: "All", n: counts.all },
    { value: "published", label: "Published", n: counts.published },
    { value: "draft", label: "Draft", n: counts.draft },
  ];

  return (
    <main className={styles.hub}>
      <div className={styles.top}>
        <h1 className={styles.title} data-reveal>
          Publishing<span className={styles.sup}>{counts.all}</span>
        </h1>
        <button type="button" className={styles.newPost} data-reveal data-d="140">
          New post
        </button>
      </div>

      <dl className={styles.stats} data-reveal>
        <div className={styles.stat}>
          <dt className="label">Published</dt>
          <dd>{counts.published}</dd>
        </div>
        <div className={styles.stat}>
          <dt className="label">Drafts</dt>
          <dd>{pad2(counts.draft)}</dd>
        </div>
        <div className={styles.stat}>
          <dt className="label">Images</dt>
          <dd>{counts.images}</dd>
        </div>
        <div className={styles.stat}>
          <dt className="label">
            <span className={styles.wide}>Tags in use</span>
            <span className={styles.narrow}>Tags</span>
          </dt>
          <dd>{counts.tags}</dd>
        </div>
      </dl>

      <div className={styles.controls} data-reveal>
        {pills.map((p) => (
          <button
            key={p.value}
            type="button"
            className={styles.pill}
            data-on={status === p.value || undefined}
            onClick={() => setStatus(p.value)}
          >
            {p.label} <span className={styles.pillN}>{p.n}</span>
          </button>
        ))}
        <button
          type="button"
          className={styles.filterToggle}
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((o) => !o)}
        >
          Filter
          <span className={styles.plus} aria-hidden="true" />
        </button>
        {/* Phones: search, Filter and GRID / LIST go to a row of their own */}
        <span className={styles.break} aria-hidden="true" />
        <label className={styles.search}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
            <circle cx="5.5" cy="5.5" r="4" />
            <path d="M8.6 8.6 12 12" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${counts.all} posts`}
            aria-label="Search posts"
          />
        </label>
        <div className={styles.viewToggle}>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      <FilterPanel
        open={filterOpen}
        categories={categoryOptions}
        issues={issueCount}
        year={year}
        months={monthOptions}
        picks={picks}
        sort={sort}
        onPicks={setPicks}
        onSort={setSort}
      />

      <div className={styles.body}>
        <div className={styles.split}>
          {view === "grid" ? (
            <AdminCards
              posts={pageItems}
              selected={selected}
              columns={columns}
              onSelect={(id) => {
                setSelected(id);
                setSheet(true);
              }}
              onOpen={(id) => setSelected(id)}
            />
          ) : (
            <p className={styles.soon}>The list view (06B) comes next.</p>
          )}
          <Details post={current} sheetOpen={sheet} onClose={() => setSheet(false)} />
        </div>

        <div className={styles.pager}>
          <span className={styles.mono}>
            {shown.length
              ? `Showing ${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, shown.length)} of ${shown.length} · sorted by ${sortedBy}`
              : "Nothing matches"}
          </span>
          {pages > 1 && (
            <div className={styles.pages}>
              <button type="button" className={styles.pagePill} disabled={page === 1} onClick={() => setPage(page - 1)}>
                <svg viewBox="0 0 26 14" width="1.3em" height="0.7em" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" aria-hidden="true" style={{ transform: "scaleX(-1)" }}>
                  <path vectorEffect="non-scaling-stroke" d="M0 7h24M19 1.5 25 7l-6 5.5" />
                </svg>{" "}
                Prev
              </button>
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={styles.pageNo}
                  data-on={page === i + 1 || undefined}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button type="button" className={styles.pagePill} disabled={page === pages} onClick={() => setPage(page + 1)}>
                Next{" "}
                <svg viewBox="0 0 26 14" width="1.3em" height="0.7em" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" aria-hidden="true">
                  <path vectorEffect="non-scaling-stroke" d="M0 7h24M19 1.5 25 7l-6 5.5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* v4 .term: the content repo this admin writes to, and how fresh it is */}
      <footer className={styles.term}>
        {head ? (
          <>
            <span>{head.repo}</span>
            <span className={styles.termDim}>
              {head.branch} · {head.sha}
            </span>
            <span className={styles.termDim}>last commit {minutesAgo(head.date)}</span>
          </>
        ) : (
          <span>fixtures/content · local</span>
        )}
      </footer>
    </main>
  );
}
