"use client";

import { useEffect, useRef, useState } from "react";
import type { PostMeta } from "@/lib/content";
import type { CategorySlug } from "@/lib/site";
import CategoryFilter from "./CategoryFilter";
import Pager from "./Pager";
import PostCard from "./PostCard";
import gridStyles from "./PostGrid.module.css";

const PER_PAGE = 12;

type Props = {
  posts: PostMeta[];
  initialCategory: CategorySlug | null;
  initialPage: number;
};

// Everything under the hero on 01: the filters, the grid and the pager.
// Filtering and paging happen in the browser (the whole index is small), and the
// choice is kept in the URL (/?category=math&page=2) so a view can be shared.
export default function PostBrowser({ posts, initialCategory, initialPage }: Props) {
  const [category, setCategory] = useState(initialCategory);
  const [page, setPage] = useState(initialPage);
  const filterRef = useRef<HTMLDivElement>(null);
  const pagedRef = useRef(false);

  const counts: Record<string, number> = {};
  for (const post of posts) counts[post.category] = (counts[post.category] ?? 0) + 1;
  const matching = category ? posts.filter((p) => p.category === category) : posts;
  const pages = Math.max(1, Math.ceil(matching.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = matching.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  // Update the address bar only: no navigation, no page transition, no scroll
  const remember = (nextCategory: CategorySlug | null, nextPage: number) => {
    const url = new URL(window.location.href);
    if (nextCategory) url.searchParams.set("category", nextCategory);
    else url.searchParams.delete("category");
    if (nextPage > 1) url.searchParams.set("page", String(nextPage));
    else url.searchParams.delete("page");
    window.history.replaceState(null, "", url);
  };

  const chooseCategory = (next: CategorySlug | null) => {
    setCategory(next);
    setPage(1);
    remember(next, 1);
  };

  const choosePage = (next: number) => {
    setPage(next);
    remember(category, next);
    pagedRef.current = true;
  };

  // After a new page of cards is on screen: if the filter row has scrolled away above,
  // glide back to it (v4). Done after render, once the page has its new height —
  // measuring before would aim at a spot the shorter last page can't reach.
  useEffect(() => {
    if (!pagedRef.current) return;
    pagedRef.current = false;
    const row = filterRef.current;
    if (!row || row.getBoundingClientRect().top >= 0) return;
    window.scrollTo({ top: row.getBoundingClientRect().top + window.scrollY - 62, behavior: "smooth" });
  }, [page]);

  return (
    <>
      <div ref={filterRef}>
        <CategoryFilter value={category} counts={counts} onChange={chooseCategory} />
      </div>
      {shown.length > 0 ? (
        <div className={gridStyles.grid}>
          {shown.map((post, i) => (
            <PostCard key={post.slug} post={post} delay={(i % 3) * 70} />
          ))}
        </div>
      ) : (
        <p className={gridStyles.empty}>Nothing here yet.</p>
      )}
      <div style={{ paddingBottom: 104 }}>
        <Pager
          page={current}
          pages={pages}
          from={matching.length ? (current - 1) * PER_PAGE + 1 : 0}
          to={(current - 1) * PER_PAGE + shown.length}
          total={matching.length}
          onChange={choosePage}
        />
      </div>
    </>
  );
}
