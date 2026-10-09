"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ForReaders } from "@/lib/content";
import { postUrl } from "@/lib/schema";
import { categories, postsPerPage, PRIVATE, type CategorySlug } from "@/lib/site";
import { sortPosts, type Sort } from "@/lib/sort";
import CardDot from "./CardDot";
import CategoryFilter from "./CategoryFilter";
import { usePageTransition } from "../PageTransition";
import { SearchBox, TagsPanel, TagsToggle, ViewToggle } from "./Filters";
import type { View } from "./Filters";
import Pager from "./Pager";
import PostCard from "./PostCard";
import PostList from "./PostList";
import gridStyles from "./PostGrid.module.css";

const PER_PAGE = postsPerPage;
// Page change (v4): the cards leave (180ms), the next set arrives from 220ms, and once
// the pager dot has landed the window glides back up to the filter row (640ms).
const SWAP_MS = 220;
const DOT_LANDS_MS = 450; // the pager dot's glide (410ms) plus a beat
const GLIDE_MS = 640; // v4, for a screen or two; longer trips (a phone's one-column grid)
const GLIDE_MAX_MS = 1400; // take longer, so the page never whips past in a blur

export type BrowseState = {
  category: CategorySlug | null;
  tags: string[];
  query: string;
  page: number;
  view: View;
  sort: Sort | null;
};

type Props = {
  posts: ForReaders[];
  initial: BrowseState;
};

// Does a post pass every filter? Category AND (any selected tag) AND the search words.
function matches(post: ForReaders, { category, tags, query }: BrowseState) {
  if (category && post.category !== category) return false;
  if (tags.length && !post.tags.some((t) => tags.includes(t))) return false;
  if (query) {
    const haystack = [post.title, post.excerpt, post.category, ...post.tags]
      .join(" ")
      .toLowerCase();
    // Every word must appear somewhere: "row locks" finds "Postgres row locks, illustrated"
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => haystack.includes(word));
  }
  return true;
}

// Keep the view in the address bar (/?category=math&tags=react,css&q=grid&page=2&view=list)
// so it can be shared or reloaded. Only the URL changes: no navigation, no transition,
// no scroll.
function remember({ category, tags, query, page, view, sort }: BrowseState) {
  const url = new URL(window.location.href);
  const set = (key: string, value: string | null) =>
    value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
  set("category", category);
  set("tags", tags.length ? tags.join(",") : null);
  set("q", query.trim() || null);
  set("page", page > 1 ? String(page) : null);
  set("view", view === "list" ? "list" : null);
  set("sort", sort);
  window.history.replaceState(null, "", url);
}

// Scroll the window to `top` on an ease-in-out curve. Done by hand rather than with
// scroll-behavior: smooth, whose speed differs between browsers and which Safari
// sometimes skips, making the page jump.
function glideTo(top: number) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo({ top, behavior: "instant" });
    return;
  }
  const from = window.scrollY;
  const ms = Math.min(GLIDE_MAX_MS, Math.max(GLIDE_MS, Math.abs(top - from) * 0.35));
  const start = performance.now();
  const ease = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    window.scrollTo({ top: from + (top - from) * ease(t), behavior: "instant" });
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Everything under the hero on 01: the filters, the grid (or the 01B list) and the pager.
// Filtering happens in the browser — the whole index is small, so search covers every
// post, not just the 12 on screen.
export default function PostBrowser({ posts, initial }: Props) {
  const [state, setState] = useState(initial);
  // Presses of the Tags toggle (odd = open); starts open if the URL picked tags
  const [tagTurns, setTagTurns] = useState(initial.tags.length > 0 ? 1 : 0);
  const filterRef = useRef<HTMLDivElement>(null);
  // The grid lags the pager by a beat while the cards swap: state.page moves the pager
  // dot at once, gridPage follows when the old cards have left.
  const [gridPage, setGridPage] = useState(initial.page);
  // Same for GRID / LIST: the pill moves at once, the posts swap a beat later
  const [shownView, setShownView] = useState(initial.view);
  // And for a new order: the arrow turns at once, the posts swap a beat later
  const [shownSort, setShownSort] = useState(initial.sort);
  const [phase, setPhase] = useState<"out" | "in" | null>(null);
  const [direction, setDirection] = useState(1); // 1 = forward (NEXT), -1 = back
  const timers = useRef<number[]>([]);

  // Category counts are totals over every post; tag counts are within the chosen
  // category (0 = that tag isn't used there)
  const categoryCounts: Record<string, number> = { all: posts.length };
  const tagCounts: Record<string, number> = {};
  for (const post of posts) {
    categoryCounts[post.category] = (categoryCounts[post.category] ?? 0) + 1;
    for (const tag of post.tags) tagCounts[tag] ??= 0;
    if (state.category && post.category !== state.category) continue;
    for (const tag of post.tags) tagCounts[tag] += 1;
  }
  const allTags = Object.keys(tagCounts)
    .sort()
    .map((name) => ({ name, count: tagCounts[name] }));
  const tagsIn = (category: CategorySlug | null) =>
    new Set(posts.filter((p) => !category || p.category === category).flatMap((p) => p.tags));

  // The column heads sort the 01B list only; the grid has no heads, and is always
  // newest first (the order the posts arrive in)
  const filtered = posts.filter((post) => matches(post, state));
  const matching = shownView === "list" ? sortPosts(filtered, shownSort) : filtered;
  // The search panel jumps to any post, whatever the category / tags on screen
  // Posts whose title holds every word come first, then ones matched on excerpt / tags
  const words = state.query.toLowerCase().split(/\s+/).filter(Boolean);
  const inTitle = (post: ForReaders) => words.every((w) => post.title.toLowerCase().includes(w));
  const quickResults = words.length
    ? posts
        .filter((post) => matches(post, { ...state, category: null, tags: [] }))
        .sort((a, b) => Number(inTitle(b)) - Number(inTitle(a)))
    : []; // every match — the panel shows about six and scrolls for the rest
  const { go } = usePageTransition();
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const current = Math.min(state.page, pages);
  const gridCurrent = Math.min(gridPage, pages);
  const shown = matching.slice((gridCurrent - 1) * PER_PAGE, gridCurrent * PER_PAGE);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  // Any filter change starts again from page 1, straight away
  const update = (change: Partial<BrowseState>) => {
    const next = { ...state, page: 1, ...change };
    clearTimers();
    setState(next);
    setGridPage(1);
    setShownSort(next.sort);
    setPhase(null);
    remember(next);
  };

  // A new order starts again from page 1, swapping the posts like GRID ↔ LIST
  const sortBy = (sort: Sort) => {
    const next = { ...state, sort, page: 1 };
    clearTimers();
    setState(next);
    remember(next);
    setDirection(0);
    setPhase("out");
    timers.current.push(
      window.setTimeout(() => {
        setShownSort(sort);
        setGridPage(1);
        setPhase("in");
      }, SWAP_MS),
    );
  };

  // GRID ↔ LIST: the same page of posts leaves and comes back in the other layout
  const switchView = (view: View) => {
    const next = { ...state, view };
    clearTimers();
    setState(next);
    remember(next);
    setDirection(0);
    setPhase("out");
    timers.current.push(
      window.setTimeout(() => {
        setShownView(view);
        setGridPage(next.page);
        setPhase("in");
      }, SWAP_MS),
    );
  };

  const turnPage = (page: number) => {
    const next = { ...state, page };
    clearTimers();
    setState(next);
    remember(next);
    setDirection(page > current ? 1 : -1);
    setPhase("out");
    timers.current.push(
      window.setTimeout(() => {
        setGridPage(page);
        setPhase("in");
      }, SWAP_MS),
      // If the filter row has scrolled away above, bring it back into view
      window.setTimeout(() => {
        const row = filterRef.current;
        if (row && row.getBoundingClientRect().top < 0) {
          glideTo(row.getBoundingClientRect().top + window.scrollY - 62);
        }
      }, DOT_LANDS_MS),
    );
  };

  const toggleTag = (name: string) =>
    update({
      tags: state.tags.includes(name)
        ? state.tags.filter((t) => t !== name)
        : [...state.tags, name],
    });

  return (
    <>
      <div ref={filterRef}>
        <CategoryFilter
          options={[
            { value: null, label: "All", count: categoryCounts.all },
            // Private only when this device was handed its posts (signed in, seesPrivate)
            ...categories
              .filter((c) => c.slug !== PRIVATE || categoryCounts[c.slug])
              .map((c) => ({
                value: c.slug,
                label: c.label,
                count: categoryCounts[c.slug] ?? 0,
              })),
          ]}
          value={state.category}
          // Picked tags that the new category doesn't use are dropped, not left stuck on
          onChange={(category) =>
            update({ category, tags: state.tags.filter((t) => tagsIn(category).has(t)) })
          }
        >
          <TagsToggle turns={tagTurns} onToggle={() => setTagTurns((n) => n + 1)} />
          <SearchBox
            value={state.query}
            total={posts.length}
            results={quickResults}
            onChange={(query) => update({ query })}
            onOpen={(post) => go?.(postUrl(post))}
          >
            <ViewToggle value={state.view} onChange={switchView} />
          </SearchBox>
        </CategoryFilter>
        <TagsPanel
          open={tagTurns % 2 === 1}
          tags={allTags}
          selected={state.tags}
          matching={matching.length}
          total={posts.length}
          onToggleTag={toggleTag}
          onClear={() => update({ tags: [] })}
        />
      </div>
      {shown.length === 0 ? (
        <p className={gridStyles.empty}>Nothing matches.</p>
      ) : shownView === "list" ? (
        <PostList
          posts={shown}
          phase={phase}
          direction={direction}
          sort={state.sort}
          onSort={sortBy}
        />
      ) : (
        <div className={gridStyles.box}>
          <div
            className={gridStyles.grid}
            data-swap
            data-phase={phase ?? undefined}
            style={{ "--dir": direction } as CSSProperties}
          >
            {shown.map((post, i) => (
              <PostCard
                key={post.slug}
                post={post}
                delay={(i % 3) * 70}
                // Cards that arrive with a page change play the page-in instead
                reveal={phase !== "in"}
                order={i}
              />
            ))}
          </div>
          <CardDot phase={phase} />
        </div>
      )}
      <div style={{ paddingBottom: 104 }}>
        <Pager
          page={current}
          pages={pages}
          from={matching.length ? (current - 1) * PER_PAGE + 1 : 0}
          to={(current - 1) * PER_PAGE + shown.length}
          total={matching.length}
          onChange={turnPage}
        />
      </div>
    </>
  );
}
