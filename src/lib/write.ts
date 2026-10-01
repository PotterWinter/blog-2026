import "server-only";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidateTag } from "next/cache";
import { BRANCH, LOCAL_DIR, localIndex, REPO } from "./content";
import { placeWaiting, planDelete, planPublish, planSave, planUnpublish, type Change, type Plan, type PostInput } from "./edit.ts";
import { placeUploads, type Pending } from "./media";
import { readIndex, type ContentIndex, type IndexEntry } from "./schema.ts";

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

// Read, work out, commit — and on GitHub, again from the top if the branch moved
async function commit<P extends Plan>(work: (read: Reader) => Promise<P>): Promise<{ plan: P; sha: string | null }> {
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
    const parent = await github<{ tree: { sha: string } }>(`/git/commits/${head}`);
    if (parent.status !== 200) fail("reading the last commit", parent.status);

    const plan = await work({
      index: async () => readIndex(await readAt(head, "index.json")),
      file: (file) => readAt(head, file),
      exists: async (file) => (await github(`/contents/${file}?ref=${head}`)).status === 200,
    });
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
      body: { message: plan.message, tree: tree.data.sha, parents: [head] },
    });
    if (made.status !== 201) fail("making the commit", made.status);
    const moved = await github(`/git/refs/heads/${BRANCH}`, {
      method: "PATCH",
      body: { sha: made.data.sha, force: false },
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
  for (const slug of slugs) revalidateTag(`post:${slug}`, { expire: 0 });
}

// A dev server writing to the real repo: the live site has its own cache, which the
// line above doesn't reach — so it's asked to clear the same things (/api/revalidate).
// Needs REVALIDATE_SECRET here and on Vercel. If it fails the save still stands; the
// live site catches up within the hour, and the editor says so.
const LIVE_URL = process.env.LIVE_URL || "https://blog-2026-vercel.vercel.app";

async function refreshLive(slugs: string[]): Promise<string | undefined> {
  if (process.env.NODE_ENV !== "development" || LOCAL_DIR) return;
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return "Live site not told (no REVALIDATE_SECRET) · shows within the hour";
  try {
    const res = await fetch(`${LIVE_URL}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ slugs }),
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
// and where the post says "upload:<key>" it now says their path
export async function savePost(input: PostInput, pending: Pending[] = []): Promise<Saved> {
  let placed: Record<string, string> = {};
  const result = await commit(async (read) => {
    const index = await read.index();
    const now = new Date();
    const { changes, paths } = await placeUploads(pending, input.id ?? index.nextId, read.exists, now);
    placed = paths;
    const before = input.id == null ? null : index.posts.find((p) => p.id === input.id);
    const previous = before ? ((await read.file(before.file)) ?? "") : "";
    const cover = input.cover && placeWaiting(input.cover, paths);
    const plan = planSave(index, { ...input, cover, body: placeWaiting(input.body, paths, "../") }, now, previous);
    return { ...plan, changes: [...changes, ...plan.changes] };
  });
  return { ...(await done(result, result.plan.entry!.id)), uploads: placed };
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

export async function deletePost(id: number): Promise<Saved> {
  const result = await commit(async (read) => {
    const { index, file } = await withFile(id, read);
    return planDelete(index, id, new Date(), file);
  });
  return done(result, id);
}
