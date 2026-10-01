import "server-only";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidateTag } from "next/cache";
import { BRANCH, LOCAL_DIR, localIndex, REPO } from "./content";
import { planDelete, planPublish, planSave, planUnpublish, type Change, type Plan, type PostInput } from "./edit.ts";
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

type Reader = { index: () => Promise<ContentIndex>; file: (file: string) => Promise<string | null> };

// Read, work out, commit — and on GitHub, again from the top if the branch moved
async function commit(work: (read: Reader) => Promise<Plan>): Promise<{ plan: Plan; sha: string | null }> {
  if (LOCAL_DIR) {
    const dir = LOCAL_DIR;
    const plan = await work({
      index: localIndex,
      file: async (file) => {
        const { readFile } = await import("node:fs/promises");
        return readFile(path.join(dir, file), "utf8").catch(() => null);
      },
    });
    for (const change of plan.changes) {
      const target = path.join(dir, change.path);
      if (change.text == null) await rm(target, { force: true });
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
    });
    const changes: Change[] = [
      ...plan.changes,
      { path: "index.json", text: JSON.stringify(plan.index, null, 2) + "\n" },
    ];

    const tree = await github<{ sha: string }>("/git/trees", {
      method: "POST",
      body: {
        base_tree: parent.data.tree.sha,
        tree: changes.map((c) =>
          c.text == null
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
function refresh(slugs: string[]) {
  revalidateTag("index", { expire: 0 });
  for (const slug of new Set(slugs)) revalidateTag(`post:${slug}`, { expire: 0 });
}

const slugOf = (change: Change) => change.path.replace(/^posts\/|\.md$/g, "");

// entry: the post as the index now has it (null once deleted)
export type Saved = { id: number; slug: string; message: string; sha: string | null; entry: IndexEntry | null };

const done = ({ plan, sha }: { plan: Plan; sha: string | null }, id: number): Saved => {
  refresh(plan.changes.map(slugOf));
  return { id, slug: plan.entry?.slug ?? slugOf(plan.changes[0]), message: plan.message, sha, entry: plan.entry };
};

export async function savePost(input: PostInput): Promise<Saved> {
  const result = await commit(async (read) => planSave(await read.index(), input, new Date()));
  return done(result, result.plan.entry!.id);
}

async function withFile(id: number, read: Reader) {
  const index = await read.index();
  const entry = index.posts.find((p) => p.id === id);
  if (!entry) throw new Error(`No post #${id}`);
  const file = await read.file(`posts/${entry.slug}.md`);
  if (file == null) throw new Error(`posts/${entry.slug}.md is missing`);
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
  const result = await commit(async (read) => planDelete(await read.index(), id, new Date()));
  return done(result, id);
}
