// Site-wide settings. Step 5 moves these into site.json in the content repo so the
// admin Settings page (09) can edit them; until then they live here.

// Posts per page on the home grid / list. Every choice divides into both 2 and 3
// columns, so a full page never ends on a short row.
export const perPageChoices = [6, 12, 18, 24] as const;
export const postsPerPage: (typeof perPageChoices)[number] = 12;

export const categories = [
  { slug: "engineering", label: "Engineering" },
  { slug: "math", label: "Math" },
  { slug: "reading", label: "Reading" },
  { slug: "private", label: "Private" },
] as const;

// The Private category (owner, 10 Oct 69): its posts show on the blog only to a device
// that's signed in to the admin (seesPrivate) — to anyone else they don't exist (404).
// Their images under /media aren't locked (owner's call): the file names start with
// the post's random code.
export const PRIVATE = "private";

export const isPrivate = (post: { category: string }) => post.category === PRIVATE;

// 02 Project filter, in this order (no "All": one category shows at a time)
export const projectCategories = [
  { slug: "development", label: "Development" },
  { slug: "design", label: "Design" },
] as const;

export type ProjectCategory = (typeof projectCategories)[number]["slug"];

export function isProjectCategory(value: unknown): value is ProjectCategory {
  return projectCategories.some((c) => c.slug === value);
}

export type CategorySlug = (typeof categories)[number]["slug"];

export function isCategory(value: unknown): value is CategorySlug {
  return categories.some((c) => c.slug === value);
}
