// Site-wide settings. Step 5 moves these into site.json in the content repo so the
// admin Settings page (09) can edit them; until then they live here.

export const categories = [
  { slug: "engineering", label: "Engineering" },
  { slug: "math", label: "Math" },
  { slug: "reading", label: "Reading" },
] as const;

export type CategorySlug = (typeof categories)[number]["slug"];

export function isCategory(value: unknown): value is CategorySlug {
  return categories.some((c) => c.slug === value);
}
