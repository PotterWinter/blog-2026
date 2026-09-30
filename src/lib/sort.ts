import type { PostMeta } from "./content";
import { categories } from "./site";

// The 01B column heads: NO, title, category or date; each flips when pressed again
// ("-asc" / "-desc" mark the second press). null = nothing picked yet: NO from 001
// up, with no head marked.
export type Sort =
  "no" | "no-desc" | "title" | "title-desc" | "category" | "category-desc" | "date" | "date-asc";
export const SORTS: Sort[] = [
  "no",
  "no-desc",
  "title",
  "title-desc",
  "category",
  "category-desc",
  "date",
  "date-asc",
];

export const isSort = (value: string | undefined): value is Sort => SORTS.includes(value as Sort);

const categoryLabel = (slug: string) => categories.find((c) => c.slug === slug)?.label ?? slug;

const text = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
const ORDERS: Record<string, (a: PostMeta, b: PostMeta) => number> = {
  no: (a, b) => a.id - b.id,
  title: (a, b) => text(a.title, b.title),
  category: (a, b) => text(categoryLabel(a.category), categoryLabel(b.category)),
  date: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
};

// Ties keep the order the posts arrive in (newest first): sort is stable, and the
// flipped order flips only the key, so posts in one category stay newest first
export function sortPosts(posts: PostMeta[], sort: Sort | null) {
  const [key, flip] = (sort ?? "no").split("-");
  const order = ORDERS[key];
  return [...posts].sort((a, b) => (flip ? -order(a, b) : order(a, b)));
}
