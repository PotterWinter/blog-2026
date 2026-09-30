// Site-wide settings. Step 5 moves these into site.json in the content repo so the
// admin Settings page (09) can edit them; until then they live here.

export const categories = [
  { slug: "engineering", label: "Engineering" },
  { slug: "math", label: "Math" },
  { slug: "reading", label: "Reading" },
] as const;

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
