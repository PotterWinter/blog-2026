import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";

// Step 3 reads posts from a folder on disk. Step 4 swaps this for the GitHub API;
// everything that imports from here keeps working because the shapes stay the same.
const CONTENT_DIR = path.resolve(process.cwd(), process.env.CONTENT_DIR ?? "../blog-content");

export type PostLink = { label: string; url: string };

export type PostMeta = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  section: "blog" | "project";
  category: string;
  tags: string[];
  cover: string | null; // "media/2026/x.webp", relative to the content root
  coverAlt: string;
  status: "draft" | "published";
  publishedAt: string; // "2026-09-29"
  updatedAt: string;
  // project only
  role: string | null;
  year: string | null;
  links: PostLink[];
};

export type Post = PostMeta & { body: string };

// Split "---\n<yaml>\n---\n<markdown>" into its two halves
function splitFrontmatter(file: string, slug: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(file);
  if (!match) throw new Error(`posts/${slug}.md: missing the --- frontmatter --- block`);
  return { data: parse(match[1]) as Record<string, unknown>, body: match[2] };
}

// Check each field against the schema from step 0, so a typo in a .md file
// fails loudly with the file name instead of rendering "undefined" somewhere.
function toMeta(data: Record<string, unknown>, slug: string): PostMeta {
  const where = `posts/${slug}.md`;
  const text = (key: string, optional = false): string => {
    const value = data[key];
    if (value == null && optional) return "";
    if (typeof value !== "string" || value === "") throw new Error(`${where}: "${key}" must be text`);
    return value;
  };
  const oneOf = <T extends string>(key: string, allowed: readonly T[]): T => {
    const value = text(key);
    if (!allowed.includes(value as T)) {
      throw new Error(`${where}: "${key}" must be ${allowed.join(" or ")}`);
    }
    return value as T;
  };
  const date = (key: string): string => {
    const value = text(key);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${where}: "${key}" must look like 2026-09-29`);
    return value;
  };

  const id = data.id;
  if (typeof id !== "number" || !Number.isInteger(id)) throw new Error(`${where}: "id" must be a whole number`);
  const tags = data.tags ?? [];
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== "string")) {
    throw new Error(`${where}: "tags" must be a list like [react, css]`);
  }
  const links = (data.links ?? []) as PostLink[];
  if (!Array.isArray(links) || links.length > 3) throw new Error(`${where}: "links" takes up to 3`);

  const cover = text("cover", true);
  return {
    id,
    slug,
    title: text("title"),
    excerpt: text("excerpt"),
    section: oneOf("section", ["blog", "project"] as const),
    category: text("category"),
    tags: tags as string[],
    // In the .md the path is relative to the post ("../media/…"), so Obsidian can show it
    cover: cover ? cover.replace(/^\.\.\//, "") : null,
    coverAlt: text("coverAlt", true),
    status: oneOf("status", ["draft", "published"] as const),
    publishedAt: date("publishedAt"),
    updatedAt: date("updatedAt"),
    role: text("role", true) || null,
    year: text("year", true) || null,
    links,
  };
}

async function readPost(slug: string): Promise<Post> {
  const file = await readFile(path.join(CONTENT_DIR, "posts", `${slug}.md`), "utf8");
  const { data, body } = splitFrontmatter(file, slug);
  return { ...toMeta(data, slug), body };
}

async function readMeta(slug: string): Promise<PostMeta> {
  const file = await readFile(path.join(CONTENT_DIR, "posts", `${slug}.md`), "utf8");
  return toMeta(splitFrontmatter(file, slug).data, slug);
}

async function listSlugs(): Promise<string[]> {
  try {
    const files = await readdir(path.join(CONTENT_DIR, "posts"));
    return files.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
  } catch {
    // No content folder (e.g. on Vercel before step 4): an empty site, not a crash
    return [];
  }
}

// Newest first. Drafts stay out unless asked for (the admin will).
export async function getPosts({
  section,
  drafts = false,
}: { section?: PostMeta["section"]; drafts?: boolean } = {}): Promise<PostMeta[]> {
  const posts = await Promise.all((await listSlugs()).map(readMeta));
  return posts
    .filter((p) => (drafts || p.status === "published") && (!section || p.section === section))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id);
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null; // never let a slug walk out of posts/
  try {
    return await readPost(slug);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
