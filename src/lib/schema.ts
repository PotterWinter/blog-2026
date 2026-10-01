import { parse } from "yaml";
import { countWords, readMinutes } from "./words.ts";

// The shape of the content: a post's frontmatter, checked, and the index built from all
// of them. No server-only or Node imports, so scripts/rebuild-index.ts can use it too.

// A project's link (04B): up to 3. `preview` is a screenshot of where it goes, shown
// beside the links on hover; without one the cover stands in.
export type PostLink = { label: string; url: string; preview: string | null };

export type PostMeta = {
  id: number; // primary key: given when the post is made (drafts too), never reused, not shown
  code: string | null; // its address, /posts/<code> (postUrl)
  // The number readers see: counted per section, given on the first publish (the
  // section's highest + 1), kept through unpublish / publish. null = a draft never
  // published. Decided 1 Oct 69 → notes/content.md
  no: number | null;
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
    if ((value == null || value === "") && optional) return "";
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
  const status = oneOf("status", ["draft", "published"] as const);
  if (data.no != null && (typeof data.no !== "number" || !Number.isInteger(data.no) || data.no < 1)) {
    throw new Error(`${where}: "no" must be a whole number from 1`);
  }
  // Written before "no" existed: a published post's number was its id
  const no = (data.no as number | undefined) ?? (status === "published" ? id : null);
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
  if (data.code != null && (typeof data.code !== "string" || !CODE.test(data.code))) {
    throw new Error(`${where}: "code" must be 8 of a–z and 0–9`);
  }
  return {
    id,
    code: (data.code as string | undefined) ?? null,
    no,
    slug,
    title: text("title"),
    // May be empty: a draft saves before it has one (Checks flags it)
    excerpt: text("excerpt", true),
    section: oneOf("section", ["blog", "project"] as const),
    category: text("category"),
    tags: tags as string[],
    // In the .md the path is relative to the post ("../media/…"), so Obsidian can show it
    cover: cover ? cover.replace(/^\.\.\//, "") : null,
    coverAlt: text("coverAlt", true),
    status,
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
  file: string; // "posts/037-editor-test.md" (older files: "posts/<slug>.md")
  createdAt: string; // first commit of the .md
  revisions: number; // commits that touched it
  words: number;
  readMinutes: number;
  // What's in the body, for the admin (06 counts, the details pane)
  images: number;
  videos: number;
  codeBlocks: number;
  bytes: number; // size of the .md
  lastCommit: string | null; // "a1b2c3d · 2026-09-30T14:16:21+07:00", from git
};

// Images and clips are both ![](…) lines; a clip is .mp4 / .webm / .mov. Code blocks are
// fenced (```), "output" frames included.
const VIDEO = /\.(mp4|webm|mov)(\s|\)|")/i;
export function contentCounts(body: string) {
  const media = body.match(/!\[[^\]]*\]\([^)]*\)/g) ?? [];
  const videos = media.filter((m) => VIDEO.test(m)).length;
  const fences = body.match(/^```/gm)?.length ?? 0;
  return { images: media.length - videos, videos, codeBlocks: Math.floor(fences / 2) };
}

// nextId: the id a new post gets; never lowered, so an id is never used twice
export type ContentIndex = { nextId: number; posts: IndexEntry[] };

// index.json as read from the repo. One written before "no" existed has none: a
// published post's number was its id (as toMeta reads such a .md)
export function readIndex(text: string | null): ContentIndex {
  if (!text) return { nextId: 1, posts: [] };
  const index = JSON.parse(text) as ContentIndex;
  for (const p of index.posts) {
    p.no ??= p.status === "published" ? p.id : null;
    p.file ??= `posts/${p.slug}.md`; // before files were numbered
  }
  return index;
}

// Its address on the site: /posts/<code>, eight random letters and digits given on its
// first save and kept in its frontmatter (owner, 2 Oct 69). Not the slug — it follows
// the title — nor the number (No. 2), which a delete moves down to close the gap, nor
// the id: the id is the content's key and readers shouldn't learn it or count through
// it. A random code says nothing about either, so a saved link opens the same post or,
// once it's gone, the 404 page. A post saved before codes has none until its next save;
// until then its address is its slug.
export const postUrl = (p: { section: PostMeta["section"]; code: string | null; slug: string }) =>
  `/${p.section === "project" ? "project" : "posts"}/${p.code ?? p.slug}`;

export const CODE = /^[a-z0-9]{8}$/;

// Eight of a–z and 0–9 from the platform's random source (36⁸ ≈ 2.8 trillion)
export function newCode(taken: Set<string>): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const code = [...bytes].map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
    if (!taken.has(code)) return code;
  }
}

// Where a post lives: its id first, so the folder lists in the order posts were made
// (GitHub, Finder, Obsidian), and a slug change keeps its place (owner, 1 Oct 69).
// 3 digits; past 999 they simply get longer.
export const postFile = (id: number, slug: string) => `posts/${String(id).padStart(3, "0")}-${slug}.md`;

// A file's slug: its name without ".md" and without the id in front ("037-x.md" → "x"),
// read against the id in its frontmatter so a slug that starts with a number
// ("2026-review.md") isn't cut
export function sourceSlug(name: string, text: string): string {
  const base = name.replace(/\.md$/, "");
  const id = /^id:\s*(\d+)\s*$/m.exec(text)?.[1];
  const prefix = id && `${id.padStart(3, "0")}-`;
  return prefix && base.startsWith(prefix) ? base.slice(prefix.length) : base;
}

export type SourceFile = {
  slug: string;
  text: string;
  file?: string; // its path; "posts/<slug>.md" when not given
  // From git, when the folder is a repo; otherwise the publish date and 1
  createdAt?: string;
  revisions?: number;
  lastCommit?: string;
};

// One .md checked and summarised for the index
export function indexEntry({ slug, text, file, createdAt, revisions, lastCommit }: SourceFile): IndexEntry {
  const { data, body } = splitFrontmatter(text, slug);
  const meta = toMeta(data, slug);
  const words = countWords(body);
  return {
    ...meta,
    file: file ?? `posts/${slug}.md`,
    createdAt: createdAt ?? `${meta.publishedAt}T00:00:00+07:00`,
    revisions: revisions ?? 1,
    words,
    readMinutes: readMinutes(words),
    ...contentCounts(body),
    bytes: new TextEncoder().encode(text).length,
    lastCommit: lastCommit ?? null,
  };
}

// Every .md checked and summarised, newest id first. Throws on a bad file or two posts
// sharing an id (or a section's number), naming the file.
export function buildIndex(files: SourceFile[], previousNextId = 1): ContentIndex {
  const seen = new Map<number, string>();
  const seenNo = new Map<string, string>();
  const posts = files.map((file): IndexEntry => {
    const slug = file.slug;
    const meta = indexEntry(file);
    const twin = seen.get(meta.id);
    if (twin) throw new Error(`posts/${slug}.md: id ${meta.id} is already used by posts/${twin}.md`);
    seen.set(meta.id, slug);
    if (meta.no != null) {
      const key = `${meta.section} ${meta.no}`;
      const same = seenNo.get(key);
      if (same) throw new Error(`posts/${slug}.md: ${meta.section} no ${meta.no} is already posts/${same}.md`);
      seenNo.set(key, slug);
    }
    return meta;
  });
  posts.sort((a, b) => b.id - a.id);
  const top = posts.length ? posts[0].id : 0;
  return { nextId: Math.max(previousNextId, top + 1), posts };
}

// ---------- writing a post back ----------
// The .md the admin writes: the same fields in the same order as the hand-written ones,
// strings in double quotes (JSON's quoting is valid YAML, Thai left as it is), slugs and
// dates bare. Paths go back to being relative to the post ("../media/…") for Obsidian.

const quote = (value: string) => JSON.stringify(value);
const bare = (value: string) => (/^[a-z0-9][a-z0-9-]*$/.test(value) ? value : quote(value));

export function toMarkdown(meta: PostMeta, body: string): string {
  const lines = [`id: ${meta.id}`];
  if (meta.code) lines.push(`code: ${meta.code}`);
  if (meta.no != null) lines.push(`no: ${meta.no}`);
  lines.push(
    `title: ${quote(meta.title)}`,
    `excerpt: ${quote(meta.excerpt)}`,
    `section: ${meta.section}`,
    `category: ${bare(meta.category)}`,
    `tags: [${meta.tags.map(bare).join(", ")}]`,
  );
  if (meta.cover) lines.push(`cover: ../${meta.cover}`);
  if (meta.coverAlt) lines.push(`coverAlt: ${quote(meta.coverAlt)}`);
  lines.push(`status: ${meta.status}`, `publishedAt: ${meta.publishedAt}`, `updatedAt: ${meta.updatedAt}`);
  if (meta.role) lines.push(`role: ${quote(meta.role)}`);
  if (meta.year) lines.push(`year: ${quote(meta.year)}`);
  if (meta.links.length) {
    lines.push("links:");
    for (const link of meta.links) {
      lines.push(`  - label: ${quote(link.label)}`, `    url: ${link.url}`);
      if (link.preview) lines.push(`    preview: ../${link.preview}`);
    }
  }
  return `---\n${lines.join("\n")}\n---\n${body}`;
}
