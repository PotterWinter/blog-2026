import "server-only";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidateTag } from "next/cache";
import { BRANCH, LOCAL_DIR, localIndex, REPO } from "./content";
import { placeWaiting, renumbered, takenCodes, planDelete, planPublish, planSave, planUnpublish, type Change, type Plan, type PostInput } from "./edit.ts";
import { clipKey, clipsIn, isClip, MEDIA_JSON, parseClips, placeClips, type ClipMap, type WaitingClip } from "./clips.ts";
import { placeUploads, type Pending } from "./media";
import { newCode, readIndex, type ContentIndex, type IndexEntry } from "./schema.ts";

// The admin's writes (5.3b). Each action is one commit to the content repo holding the
// .md and index.json together, so the list and the post never disagree. On GitHub that's
// the Git Data API — a tree of the changed files on top of the branch's last commit, a
// commit, then the branch moved to it. If the branch moved first (another save, an edit
// on GitHub), the move is refused: read again, work the change out again, try again.
// In dev (CONTENT_DIR) the files are written straight into the folder, whose list is
// built from the .md files, so index.json isn't written there.

const TOKEN = process.env.GITHUB_TOKEN ?? "";
const TRIES = 3;

async function github<T>(route: string, init?: { method: string; body: unknown }): Promise<{ status: number; data: T }> {
  const res = await fetch(`https://api.github.com/repos/${REPO}${route}`, {
    method: init?.method ?? "GET",
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: init && JSON.stringify(init.body),
  });
  const data = (await res.json().catch(() => null)) as T;
  return { status: res.status, data };
}

const fail = (what: string, status: number): never => {
  throw new Error(`GitHub ${status} ${what} (${REPO})`);
};

// A file as it is at one commit, null if it isn't there
async function readAt(sha: string, file: string): Promise<string | null> {
  const { status, data } = await github<{ content: string }>(`/contents/${file}?ref=${sha}`);
  if (status === 404) return null;
  if (status !== 200) fail(`reading ${file}`, status);
  return Buffer.from(data.content, "base64").toString("utf8");
}

type Reader = {
  index: () => Promise<ContentIndex>;
  file: (file: string) => Promise<string | null>;
  exists: (file: string) => Promise<boolean>;
};

// Saves close together fold into one commit (owner, 4 Oct 69: twenty "Edit #3" in a
// row said nothing): a save whose last commit reads the same — "Edit #3" after
// "Edit #3", "Draft #3" after "Draft #3" — under 30 minutes ago replaces it instead of
// adding one. Its time is this save's, Revisions doesn't climb. Publish, Unpublish and
// Delete always stand alone. Someone else's commit on top: a new one, as before.
const FOLD_MS = 30 * 60 * 1000;
type Head = { message: string; parents: { sha: string }[]; committer: { date: string } };
const action = (message: string) => / · ((Edit|Draft) #\d+)$/.exec(message)?.[1] ?? null;

function foldsInto(head: Head, plan: Plan, now: number): boolean {
  const same = action(plan.message);
  return !!same && action(head.message) === same && head.parents.length === 1 && now - Date.parse(head.committer.date) <= FOLD_MS;
}

// Read, work out, commit — and on GitHub, again from the top if the branch moved
async function commit<P extends Plan>(
  work: (read: Reader) => Promise<P>,
  { fold = false }: { fold?: boolean } = {},
): Promise<{ plan: P; sha: string | null }> {
  if (LOCAL_DIR) {
    const dir = LOCAL_DIR;
    const plan = await work({
      index: localIndex,
      file: async (file) => {
        const { readFile } = await import("node:fs/promises");
        return readFile(path.join(dir, file), "utf8").catch(() => null);
      },
      exists: async (file) => {
        const { access } = await import("node:fs/promises");
        return access(path.join(dir, file)).then(
          () => true,
          () => false,
        );
      },
    });
    for (const change of plan.changes) {
      const target = path.join(dir, change.path);
      if (change.base64 != null) {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(change.base64, "base64"));
      } else if (change.text == null) await rm(target, { force: true });
      else {
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, change.text);
      }
    }
    return { plan, sha: null };
  }

  if (!TOKEN) throw new Error("GITHUB_TOKEN isn't set: nothing can be saved");
  for (let attempt = 1; ; attempt++) {
    const ref = await github<{ object: { sha: string } }>(`/git/ref/heads/${BRANCH}`);
    if (ref.status !== 200) fail("reading the branch", ref.status);
    const head = ref.data.object.sha;
    const parent = await github<Head & { tree: { sha: string } }>(`/git/commits/${head}`);
    if (parent.status !== 200) fail("reading the last commit", parent.status);

    const plan = await work({
      index: async () => readIndex(await readAt(head, "index.json")),
      file: (file) => readAt(head, file),
      exists: async (file) => (await github(`/contents/${file}?ref=${head}`)).status === 200,
    });
    // Folding: on top of what the last commit holds, in its place
    const folding = fold && foldsInto(parent.data, plan, Date.now());
    if (folding && plan.entry) {
      const entry = { ...plan.entry, revisions: Math.max(1, plan.entry.revisions - 1) };
      plan.entry = entry;
      plan.index = { ...plan.index, posts: plan.index.posts.map((p) => (p.id === entry.id ? entry : p)) };
    }
    const changes: Change[] = [
      ...plan.changes,
      { path: "index.json", text: JSON.stringify(plan.index, null, 2) + "\n" },
    ];

    // A binary file (an image) goes up as a blob of its own first; text goes in the tree
    const blobs = new Map<string, string>();
    for (const c of changes.filter((c) => c.base64 != null)) {
      const blob = await github<{ sha: string }>("/git/blobs", {
        method: "POST",
        body: { content: c.base64, encoding: "base64" },
      });
      if (blob.status !== 201) fail(`uploading ${c.path}`, blob.status);
      blobs.set(c.path, blob.data.sha);
    }
    const tree = await github<{ sha: string }>("/git/trees", {
      method: "POST",
      body: {
        base_tree: parent.data.tree.sha,
        tree: changes.map((c) =>
          blobs.has(c.path)
            ? { path: c.path, mode: "100644", type: "blob", sha: blobs.get(c.path) }
            : c.text == null
              ? { path: c.path, mode: "100644", type: "blob", sha: null }
              : { path: c.path, mode: "100644", type: "blob", content: c.text },
        ),
      },
    });
    if (tree.status !== 201) fail("writing the files", tree.status);
    const made = await github<{ sha: string }>("/git/commits", {
      method: "POST",
      body: { message: plan.message, tree: tree.data.sha, parents: folding ? [parent.data.parents[0].sha] : [head] },
    });
    if (made.status !== 201) fail("making the commit", made.status);
    // A fold moves the branch sideways, which takes force: only if it's still where it
    // was read (anything since → start over, and that comes out a new commit)
    if (folding) {
      const now = await github<{ object: { sha: string } }>(`/git/ref/heads/${BRANCH}`);
      if (now.status !== 200 || now.data.object.sha !== head) {
        if (attempt === TRIES) fail("moving the branch", 422);
        continue;
      }
    }
    const moved = await github(`/git/refs/heads/${BRANCH}`, {
      method: "PATCH",
      body: { sha: made.data.sha, force: folding },
    });
    if (moved.status === 200) return { plan, sha: made.data.sha };
    // 422: not a fast-forward — someone committed since we read. Start over from theirs.
    if (moved.status !== 422 || attempt === TRIES) fail("moving the branch", moved.status);
  }
}

// Lists and the post's own page show the change at once (the hour-long cache is for
// reads; a write clears what it touched)
export function refresh(slugs: string[]) {
  revalidateTag("index", { expire: 0 });
  revalidateTag("media", { expire: 0 });
  for (const slug of slugs) revalidateTag(`post:${slug}`, { expire: 0 });
}

// A dev server writing to the real repo: the live site has its own cache, which the
// line above doesn't reach — so it's asked to clear the same things (/api/revalidate).
// Needs REVALIDATE_SECRET here and on Vercel. If it fails the save still stands; the
// live site catches up within the hour, and the editor says so.
const LIVE_URL = process.env.LIVE_URL || "https://blog-2026-vercel.vercel.app";

// Settings › Clear cache (5.5): everything read from the content repo, read again —
// here, and on the live site when this is dev on the real repo
export async function clearCache(): Promise<string | undefined> {
  refreshAll();
  return refreshLive("all");
}

export function refreshAll() {
  revalidateTag("content", { expire: 0 });
}

async function refreshLive(slugs: string[] | "all"): Promise<string | undefined> {
  if (process.env.NODE_ENV !== "development" || LOCAL_DIR) return;
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return "Live site not told (no REVALIDATE_SECRET) · shows within the hour";
  try {
    const res = await fetch(`${LIVE_URL}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify(slugs === "all" ? { all: true } : { slugs }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return `Live site said ${res.status} · shows within the hour`;
  } catch {
    return "Live site didn't answer · shows within the hour";
  }
}

// entry: the post as the index now has it (null once deleted) · uploads: where the
// images sent with a save went ("upload:cover" → "media/2026/003-cover.webp")
export type Saved = {
  id: number;
  slug: string;
  message: string;
  sha: string | null;
  entry: IndexEntry | null;
  uploads?: Record<string, string>;
  live?: string; // dev on the real repo: why the live site wasn't refreshed, if it wasn't
};

const done = async ({ plan, sha }: { plan: Plan; sha: string | null }, id: number): Promise<Saved> => {
  refresh(plan.slugs);
  const live = await refreshLive(plan.slugs);
  return { id, slug: plan.entry?.slug ?? plan.slugs[0], message: plan.message, sha, entry: plan.entry, live };
};

// With the images picked since the last save (5.4): they're committed with the post,
// and where the post says "upload:<key>" it now says their path.
// Clips (5.4d) were sent up to Blob just before (the editor does it): their posters are among the images (same key), and
// "clip:<key>" becomes the clip's own path — the poster's, ending .mp4 — with its
// media.json entry in the same commit. A clip of this post's its text no longer points
// at loses its entry and its poster here, and its file in Blob once the commit is in.
export async function savePost(input: PostInput, pending: Pending[] = [], clips: WaitingClip[] = []): Promise<Saved> {
  let placed: Record<string, string> = {};
  let gone: string[] = [];
  const result = await commit(async (read) => {
    const index = await read.index();
    const now = new Date();
    const before = input.id == null ? null : index.posts.find((p) => p.id === input.id);
    // Its code names its new images, so it's settled first (a new post's is made here)
    const code = before?.code ?? newCode(takenCodes(index));
    const { changes, paths } = await placeUploads(pending, code, read.exists, now);
    placed = paths;
    const previous = before ? ((await read.file(before.file)) ?? "") : "";
    const clipPaths = Object.fromEntries(
      clips.flatMap((c) => (paths[`upload:${c.key}`] ? [[c.key, paths[`upload:${c.key}`].replace(/\.webp$/, `.${c.url.split(".").pop()}`)]] : [])),
    );
    // The cover may be a clip as well (owner, 4 Oct 69): "clip:cover-x" → its path
    const cover = input.cover && placeClips(placeWaiting(input.cover, paths), clipPaths, "");
    const body = placeClips(placeWaiting(input.body, paths, "../"), clipPaths);
    const plan = planSave(index, { ...input, cover, body }, now, previous, code);

    // media.json: this save's clips in, the ones its text let go of out
    const map: ClipMap = parseClips(await read.file(MEDIA_JSON));
    const was = JSON.stringify(map);
    for (const c of clips) {
      const at = clipPaths[c.key];
      if (!at) continue;
      const { url, bytes, seconds, width, height } = c;
      map[at] = { url, bytes, seconds, width, height, poster: paths[`upload:${c.key}`] };
    }
    const kept = clipsIn(body);
    if (cover && isClip(cover)) kept.add(clipKey(cover));
    const removed: Change[] = [];
    gone = [];
    for (const at of clipsIn(previous)) {
      if (kept.has(at) || !map[at]) continue;
      removed.push({ path: map[at].poster, text: null });
      gone.push(map[at].url);
      delete map[at];
    }
    const media: Change[] = JSON.stringify(map) === was ? [] : [{ path: MEDIA_JSON, text: JSON.stringify(map, null, 2) + "\n" }];
    return { ...plan, changes: [...changes, ...plan.changes, ...removed, ...media] };
  }, { fold: true });
  if (gone.length) await dropClips(gone);
  return { ...(await done(result, result.plan.entry!.id)), uploads: placed };
}

// Out of Blob, after the commit that stopped pointing at them. A failure leaves a file
// nobody links to — it costs space, not a broken page — so the save still stands.
export async function dropClips(urls: string[]) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(urls);
  } catch (error) {
    console.error("Clips left in Blob:", urls, error);
  }
}

async function withFile(id: number, read: Reader) {
  const index = await read.index();
  const entry = index.posts.find((p) => p.id === id);
  if (!entry) throw new Error(`No post #${id}`);
  const file = await read.file(entry.file);
  if (file == null) throw new Error(`${entry.file} is missing`);
  return { index, file };
}

export async function publishPost(id: number): Promise<Saved> {
  const result = await commit(async (read) => {
    const { index, file } = await withFile(id, read);
    return planPublish(index, id, file, new Date());
  });
  return done(result, id);
}

export async function unpublishPost(id: number): Promise<Saved> {
  const result = await commit(async (read) => {
    const { index, file } = await withFile(id, read);
    return planUnpublish(index, id, file, new Date());
  });
  return done(result, id);
}

// Its clips go with it (owner, 4 Oct 69 — they stayed in Blob): those its text and its
// cover point at, named for it (<code>- or <id>-, as its own images are), lose their
// media.json entry and their poster in the same commit, and their file in Blob after it
export async function deletePost(id: number): Promise<Saved> {
  let gone: string[] = [];
  const result = await commit(async (read) => {
    const { index, file } = await withFile(id, read);
    // The posts after it in its section move down a number, in the same commit
    const later = await Promise.all(
      renumbered(index, id).map(async (entry) => {
        const text = await read.file(entry.file);
        if (text == null) throw new Error(`${entry.file} is missing`);
        return { entry, text };
      }),
    );
    const plan = planDelete(index, id, new Date(), file, later);

    const post = index.posts.find((p) => p.id === id)!;
    const names = [String(id).padStart(3, "0"), ...(post.code ? [post.code] : [])].join("|");
    const own = new RegExp(`^media/\\d{4}/(?:${names})-`);
    const map: ClipMap = parseClips(await read.file(MEDIA_JSON));
    const removed: Change[] = [];
    gone = [];
    for (const at of clipsIn(file)) {
      if (!map[at] || !own.test(at)) continue;
      removed.push({ path: map[at].poster, text: null });
      gone.push(map[at].url);
      delete map[at];
    }
    if (!removed.length) return plan;
    const taken = new Set(plan.changes.map((c) => c.path));
    return {
      ...plan,
      changes: [
        ...plan.changes,
        ...removed.filter((c) => !taken.has(c.path)),
        { path: MEDIA_JSON, text: JSON.stringify(map, null, 2) + "\n" },
      ],
    };
  });
  if (gone.length) await dropClips(gone);
  return done(result, id);
}
