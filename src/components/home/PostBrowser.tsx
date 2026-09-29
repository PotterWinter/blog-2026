"use client";

import { useState } from "react";
import type { PostMeta } from "@/lib/content";
import type { CategorySlug } from "@/lib/site";
import CategoryFilter from "./CategoryFilter";

type Props = {
  posts: PostMeta[];
  initialCategory: CategorySlug | null;
};

// Everything under the hero on 01: the filters and the posts they narrow down.
// Filtering happens in the browser (the whole index is small), and the choice is kept
// in the URL (/?category=math) so a filtered view can be shared or reloaded.
export default function PostBrowser({ posts, initialCategory }: Props) {
  const [category, setCategory] = useState(initialCategory);

  const counts: Record<string, number> = {};
  for (const post of posts) counts[post.category] = (counts[post.category] ?? 0) + 1;
  const shown = category ? posts.filter((p) => p.category === category) : posts;

  const choose = (next: CategorySlug | null) => {
    setCategory(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("category", next);
    else url.searchParams.delete("category");
    // Update the address bar only: no navigation, no page transition, no scroll
    window.history.replaceState(null, "", url);
  };

  return (
    <>
      <CategoryFilter value={category} counts={counts} onChange={choose} />
      {/* Temporary list until the grid (3.2d) */}
      <ul style={{ padding: "0 var(--page-x) 104px", listStyle: "none" }}>
        {shown.map((post) => (
          <li key={post.slug}>
            {post.publishedAt} · {post.category} · {post.title} · [{post.tags.join(", ")}]
          </li>
        ))}
      </ul>
    </>
  );
}
