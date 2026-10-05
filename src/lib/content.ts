import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { coverClip, MEDIA_JSON, parseClips, type ClipEntry, type ClipMap } from "./clips.ts";
import {
  buildIndex,
  postUrl,
  readIndex,
  sourceSlug,
  splitFrontmatter,
  toMeta,
  type ContentIndex,
  type IndexEntry,
  type PostMeta,
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
export const LOCAL_DIR = process.env.CONTENT_DIR
  ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.CONTENT_DIR)
  : null;
// The repo isn't a secret, so it has a default; the variable can point elsewhere
export const REPO = process.env.CONTENT_REPO || "PotterWinter/blog-content-2026";
export const BRANCH = process.env.CONTENT_BRANCH ?? "main";
const TOKEN = process.env.GITHUB_TOKEN ?? "";
// The live site and a dev server each keep their own cache, and a save clears only the
// cache of the one that saved — so dev on the real repo would show the live site's
// edits up to an hour late. Dev checks again after 10 seconds instead (owner, 2 Oct 69).
export const CONTENT_TTL = process.env.NODE_ENV === "development" ? 10 : 3600;

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

// ---------- clips (5.4d) ----------
// Where each clip a post names really is (lib/clips): read with the posts, cleared with
// them when a save changes it
export async function getClips(): Promise<ClipMap> {
  return parseClips(await readText(MEDIA_JSON, ["media"]));
}

// The tags kept in index.json, for Tags › Manage (ContentIndex.tags)
export async function getTagList(): Promise<string[]> {
  return (await getIndex()).tags;
}

// ---------- posts ----------

export async function localIndex(): Promise<ContentIndex> {
  let names: string[];
  try {
    names = await readdir(path.join(LOCAL_DIR!, "posts"));
  } catch {
    return { nextId: 1, tags: [], posts: [] };
  }
  const files = await Promise.all(
    names
      .filter((name) => name.endsWith(".md"))
      .map(async (name) => {
        const text = (await readText(`posts/${name}`, []))!;
        return { slug: sourceSlug(name, text), text, file: `posts/${name}` };
      }),
  );
  // Built from the files each time; what they can't give back — the kept tags, a nextId
  // already ahead — comes from the folder's index.json, when it has one (commit() writes
  // it once there are tags)
  const kept = readIndex(await readText("index.json", []));
  return buildIndex(files, kept.nextId, kept.tags);
}

async function getIndex(): Promise<ContentIndex> {
  if (LOCAL_DIR) return localIndex();
  return readIndex(await readText("index.json", ["index"]));
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
  // The file comes from the index ("posts/037-<slug>.md"); a post not in it yet (edited
  // on GitHub) may still be at the old place, "posts/<slug>.md"
  const entry = (await getIndex()).posts.find((p) => p.slug === slug);
  const text = await readText(entry?.file ?? `posts/${slug}.md`, [`post:${slug}`]);
  if (text == null) return null;
  const { data, body } = splitFrontmatter(text, slug);
  return { ...toMeta(data, slug), body };
}

// ---------- what reaches readers ----------
// The public pages hand their posts to the browser, so everything the index knows would
// be in the page's data. The id (the content's key), the file it's in, the last commit
// message ("Edit #3") and the like stay on the server (owner, 2 Oct 69): readers get the
// post as it reads, its address and its counts.
// coverClip: a cover that's a clip, where it is (media.json) — the cards play it too
export type ForReaders<T extends PostMeta = PostMeta> = Omit<T, "id" | "file" | "lastCommit" | "revisions" | "createdAt"> & {
  coverClip?: ClipEntry;
};

export function forReaders<T extends PostMeta>(post: T): ForReaders<T> {
  const shown: Record<string, unknown> = { ...post };
  for (const key of ["id", "file", "lastCommit", "revisions", "createdAt"]) delete shown[key];
  return shown as ForReaders<T>;
}

// Highest number first (owner, 2 Oct 69): the order they went out in, newest on top —
// the same order as by publish date, since both are set on the first publish
// A clip cover comes with its entry, so a card can play it (owner, 4 Oct 69)
export async function getPublished(section: IndexEntry["section"]) {
  const [posts, clips] = await Promise.all([getPosts({ section }), getClips()]);
  return posts
    .sort((a, b) => (b.no ?? 0) - (a.no ?? 0))
    .map((p) => {
      const clip = coverClip(p.cover, clips);
      return clip ? { ...forReaders(p), coverClip: clip } : forReaders(p);
    });
}

// Every published post's title by its address (/posts/<code>, and its old slug one):
// a post linked by its address alone reads as its title (PostBody)
export async function getPostTitles(): Promise<Record<string, string>> {
  const posts = await getPosts();
  return Object.fromEntries(posts.flatMap((p) => [[postUrl(p), p.title], [postUrl({ ...p, code: null }), p.title]]));
}

// A published post by its address (/posts/<code>), in its own section. A slug — an
// address from before codes (until 2 Oct 69) — moves to the code while it's still the
// post's own slug; a post with no code yet is served at its slug.
export async function findPublished(
  section: IndexEntry["section"],
  param: string,
): Promise<{ post: Post } | { moved: string } | null> {
  const posts = await getPosts({ section });
  const entry = posts.find((p) => p.code === param) ?? posts.find((p) => !p.code && p.slug === param);
  if (entry) {
    const post = await getPost(entry.slug);
    return post ? { post } : null;
  }
  const old = posts.find((p) => p.slug === param);
  return old ? { moved: postUrl(old) } : null;
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

// Every file under media/ and its size ("media/2026/x.webp" → bytes), for the editor's
// Checks (5.3f: Files, Image size). GitHub: one request for the whole tree, cached and
// cleared with the media.
export async function getMediaFiles(): Promise<Record<string, number>> {
  if (LOCAL_DIR) {
    const { stat } = await import("node:fs/promises");
    const out: Record<string, number> = {};
    const walk = async (dir: string) => {
      const names = await readdir(path.join(LOCAL_DIR!, dir), { withFileTypes: true }).catch(() => []);
      for (const n of names) {
        const file = `${dir}/${n.name}`;
        if (n.isDirectory()) await walk(file);
        else out[file] = (await stat(path.join(LOCAL_DIR!, file))).size;
      }
    };
    await walk("media");
    return out;
  }
  const res = await fetch(`https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
    },
    next: { revalidate: CONTENT_TTL, tags: ["content", "media"] },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} listing ${REPO}`);
  const { tree } = (await res.json()) as { tree: { path: string; type: string; size?: number }[] };
  return Object.fromEntries(tree.filter((t) => t.type === "blob" && t.path.startsWith("media/")).map((t) => [t.path, t.size ?? 0]));
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

// A media file's history (08 Media, History): the commit that added it and when. A file
// is added once and never changed (a new upload is a new name), so its oldest commit.
// null in dev on fixtures (no git) or if GitHub doesn't answer.
export async function getMediaHistory(file: string): Promise<{ added: string; sha: string } | null> {
  if (LOCAL_DIR || !/^media\/[\w./-]+$/.test(file)) return null;
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/commits?sha=${BRANCH}&path=${encodeURIComponent(file)}&per_page=100`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
      },
      next: { revalidate: CONTENT_TTL, tags: ["content", "media"] },
    },
  );
  if (!res.ok) return null;
  const list = (await res.json()) as { sha: string; commit: { committer: { date: string } } }[];
  const first = list.at(-1);
  return first ? { added: first.commit.committer.date, sha: first.sha.slice(0, 7) } : null;
}

// Writing (the admin) is lib/write.ts: one commit per save through the Git Data API.
