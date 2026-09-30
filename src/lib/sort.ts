import type { PostMeta } from "./content";
import { categories } from "./site";

// The 01B column heads, one rule for all four:
//   nothing picked (null)  newest first — the grid's order, no head marked
//   first press            that column low → high: NO 001 first, A–Z, oldest first (↓)
//   press again            the other way ("-desc", ↑)
// So the first press always changes what's on screen.
export const SORT_KEYS = ["no", "title", "category", "date"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type Sort = SortKey | `${SortKey}-desc`;

export const isSort = (value: string | undefined): value is Sort =>
  SORT_KEYS.some((key) => value === key || value === `${key}-desc`);

const categoryLabel = (slug: string) => categories.find((c) => c.slug === slug)?.label ?? slug;

const text = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

// Each column, low → high
const ORDERS: Record<SortKey, (a: PostMeta, b: PostMeta) => number> = {
  no: (a, b) => a.id - b.id,
  title: (a, b) => text(a.title, b.title),
  category: (a, b) => text(categoryLabel(a.category), categoryLabel(b.category)),
  date: (a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id - b.id,
};

// Posts arrive newest first, and ties keep that order (sort is stable, and "-desc"
// flips the comparison, not the list), so posts in one category stay newest first
export function sortPosts(posts: PostMeta[], sort: Sort | null) {
  if (!sort) return posts;
  const [key, desc] = sort.split("-") as [SortKey, string | undefined];
  const order = ORDERS[key];
  return [...posts].sort((a, b) => (desc ? -order(a, b) : order(a, b)));
}

// The press on a head: low → high first, then back and forth
export const nextSort = (current: Sort | null, key: SortKey): Sort =>
  current === key ? `${key}-desc` : key;
