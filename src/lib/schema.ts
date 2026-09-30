import { parse } from "yaml";
import { countWords, readMinutes } from "./words.ts";

// The shape of the content: a post's frontmatter, checked, and the index built from all
// of them. No server-only or Node imports, so scripts/rebuild-index.ts can use it too.

// A project's link (04B): up to 3. `preview` is a screenshot of where it goes, shown
// beside the links on hover; without one the cover stands in.
export type PostLink = { label: string; url: string; preview: string | null };

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
export function splitFrontmatter(file: string, slug: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(file);
  if (!match) throw new Error(`posts/${slug}.md: missing the --- frontmatter --- block`);
  return { data: parse(match[1]) as Record<string, unknown>, body: match[2] };
}

// Check each field against the schema from step 0, so a typo in a .md file
// fails loudly with the file name instead of rendering "undefined" somewhere.
export function toMeta(data: Record<string, unknown>, slug: string): PostMeta {
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
  const rawLinks = data.links ?? [];
  if (!Array.isArray(rawLinks) || rawLinks.length > 3) {
    throw new Error(`${where}: "links" takes up to 3`);
  }
  const links = rawLinks.map((link, i): PostLink => {
    const { label, url, preview } = (link ?? {}) as Record<string, unknown>;
    const at = `${where}: links[${i}]`;
    if (typeof label !== "string" || label === "" || label.length > 24) {
      throw new Error(`${at}: "label" must be text, up to 24 characters`);
    }
    if (typeof url !== "string" || !/^https:\/\//.test(url)) {
      throw new Error(`${at}: "url" must be a full https:// link`);
    }
    if (preview != null && typeof preview !== "string") throw new Error(`${at}: "preview" must be a path`);
    return { label, url, preview: preview ? preview.replace(/^\.\.\//, "") : null };
  });

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

// ---------- index.json ----------
// What the lists need of every post, in one file (content repo root), so a list page is
// one request instead of one per post. The admin writes it in the same commit as the
// .md it changes; scripts/rebuild-index.ts rebuilds it from the .md files when needed.

export type IndexEntry = PostMeta & {
  createdAt: string; // first commit of the .md
  revisions: number; // commits that touched it
  words: number;
  readMinutes: number;
};

// nextId: the id a new post gets; never lowered, so an id is never used twice
export type ContentIndex = { nextId: number; posts: IndexEntry[] };

export type SourceFile = {
  slug: string;
  text: string;
  // From git, when the folder is a repo; otherwise the publish date and 1
  createdAt?: string;
  revisions?: number;
};

// Every .md checked and summarised, newest id first. Throws on a bad file or two posts
// sharing an id, naming the file.
export function buildIndex(files: SourceFile[], previousNextId = 1): ContentIndex {
  const seen = new Map<number, string>();
  const posts = files.map(({ slug, text, createdAt, revisions }): IndexEntry => {
    const { data, body } = splitFrontmatter(text, slug);
    const meta = toMeta(data, slug);
    const twin = seen.get(meta.id);
    if (twin) throw new Error(`posts/${slug}.md: id ${meta.id} is already used by posts/${twin}.md`);
    seen.set(meta.id, slug);
    const words = countWords(body);
    return {
      ...meta,
      createdAt: createdAt ?? `${meta.publishedAt}T00:00:00+07:00`,
      revisions: revisions ?? 1,
      words,
      readMinutes: readMinutes(words),
    };
  });
  posts.sort((a, b) => b.id - a.id);
  const top = posts.length ? posts[0].id : 0;
  return { nextId: Math.max(previousNextId, top + 1), posts };
}
