import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildIndex,
  splitFrontmatter,
  toMeta,
  type ContentIndex,
  type IndexEntry,
  type Post,
} from "./schema.ts";

export type { Post, PostLink, PostMeta, IndexEntry } from "./schema.ts";

// Where posts come from (step 4):
//   CONTENT_DIR set  a folder on this machine — dev reads fixtures/content, and the list
//                    is built from the .md files on the spot (no index.json needed)
//   otherwise        the content repo on GitHub (CONTENT_REPO, "owner/name"), read with
//                    GITHUB_TOKEN; lists come from its index.json in one request
// GitHub reads are cached for an hour. The admin (step 5) clears them the moment it
// commits (revalidateTag "content"), so the hour only matters for edits made elsewhere.
// (turbopackIgnore: the folder is for dev only, so the deploy needn't carry the project
// along in case it's read — without it, every file here was traced into the function)
const LOCAL_DIR = process.env.CONTENT_DIR
  ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.CONTENT_DIR)
  : null;
// The repo isn't a secret, so it has a default; the variable can point elsewhere
const REPO = process.env.CONTENT_REPO || "PotterWinter/blog-content-2026";
const BRANCH = process.env.CONTENT_BRANCH ?? "main";
const TOKEN = process.env.GITHUB_TOKEN ?? "";
export const CONTENT_TTL = 3600;

// One file from the content repo, null if it isn't there
async function fromGitHub(file: string, tags: string[]): Promise<Response | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${file}?ref=${BRANCH}`, {
    headers: {
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
    },
    next: { revalidate: CONTENT_TTL, tags: ["content", ...tags] },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} reading ${REPO}/${file}`);
  return res;
}

async function fromDisk(file: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(LOCAL_DIR!, file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readText(file: string, tags: string[]): Promise<string | null> {
  if (LOCAL_DIR) return (await fromDisk(file))?.toString("utf8") ?? null;
  return (await (await fromGitHub(file, tags))?.text()) ?? null;
}

// ---------- posts ----------

async function localIndex(): Promise<ContentIndex> {
  let names: string[];
  try {
    names = await readdir(path.join(LOCAL_DIR!, "posts"));
  } catch {
    return { nextId: 1, posts: [] };
  }
  const slugs = names.filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
  const files = await Promise.all(
    slugs.map(async (slug) => ({ slug, text: (await readText(`posts/${slug}.md`, []))! })),
  );
  return buildIndex(files);
}

async function getIndex(): Promise<ContentIndex> {
  if (LOCAL_DIR) return localIndex();
  const text = await readText("index.json", ["index"]);
  if (!text) return { nextId: 1, posts: [] };
  return JSON.parse(text) as ContentIndex;
}

// Newest first. Drafts stay out unless asked for (the admin will).
export async function getPosts({
  section,
  drafts = false,
}: { section?: IndexEntry["section"]; drafts?: boolean } = {}): Promise<IndexEntry[]> {
  const { posts } = await getIndex();
  return posts
    .filter((p) => (drafts || p.status === "published") && (!section || p.section === section))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id);
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null; // never let a slug walk out of posts/
  const text = await readText(`posts/${slug}.md`, [`post:${slug}`]);
  if (text == null) return null;
  const { data, body } = splitFrontmatter(text, slug);
  return { ...toMeta(data, slug), body };
}

// ---------- media ----------

const MEDIA_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

// A file from media/ (images only — clips live in Vercel Blob). null if it doesn't exist
// or the path tries to leave the media folder.
export async function getMedia(parts: string[]): Promise<{ body: ArrayBuffer; type: string } | null> {
  const type = MEDIA_TYPES[path.extname(parts.at(-1) ?? "").toLowerCase()];
  if (!type || parts.some((p) => !p || p === "." || p === ".." || p.includes("\\"))) return null;
  const file = ["media", ...parts].join("/");
  if (LOCAL_DIR) {
    const body = await fromDisk(file);
    return body && { body: new Uint8Array(body).buffer, type };
  }
  const res = await fromGitHub(file.split("/").map(encodeURIComponent).join("/"), ["media"]);
  return res && { body: await res.arrayBuffer(), type };
}

// The content repo's latest commit, for the admin's status line (06). Cached a minute.
export async function getRepoHead(): Promise<{ repo: string; branch: string; sha: string; date: string } | null> {
  if (LOCAL_DIR) return null;
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
    },
    next: { revalidate: 60, tags: ["content"] },
  });
  if (!res.ok) return null;
  const c = (await res.json()) as { sha: string; commit: { committer: { date: string } } };
  return { repo: REPO, branch: BRANCH, sha: c.sha.slice(0, 7), date: c.commit.committer.date };
}

// ---------- writing (the admin, step 5) ----------
// Every write is a commit to the content repo (on disk in dev). Read with readFresh
// first: on GitHub its sha must come back with the write, so a file changed in between
// is refused (409) instead of overwritten.

export type Fresh = { text: string; sha: string | null };

export async function readFresh(file: string): Promise<Fresh | null> {
  if (LOCAL_DIR) {
    const body = await fromDisk(file);
    return body && { text: body.toString("utf8"), sha: null };
  }
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${file}?ref=${BRANCH}`, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} reading ${REPO}/${file}`);
  const { content, sha } = (await res.json()) as { content: string; sha: string };
  return { text: Buffer.from(content, "base64").toString("utf8"), sha };
}

export async function writeContent(file: string, text: string, message: string, sha: string | null) {
  if (LOCAL_DIR) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const target = path.join(LOCAL_DIR, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
    return;
  }
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${file}`, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(text).toString("base64"),
      branch: BRANCH,
      ...(sha && { sha }),
    }),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} writing ${REPO}/${file}`);
}
