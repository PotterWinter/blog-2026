"use server";

import type { PostInput } from "@/lib/edit";
import { currentSession } from "@/lib/session";
import { deletePost, publishPost, savePost, unpublishPost, type Saved } from "@/lib/write";

// What the editor (07) calls. Each checks this device is still signed in — a server
// action is a public endpoint, the /admin guard doesn't cover it — and hands back
// either what was committed or why not, for the header's "saved" / "Not saved · Retry".

export type Result = { ok: true; saved: Saved } | { ok: false; error: string };

async function run(action: () => Promise<Saved>): Promise<Result> {
  if (!(await currentSession())) return { ok: false, error: "Signed out: sign in again to save" };
  try {
    return { ok: true, saved: await action() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't save" };
  }
}

export async function save(input: PostInput) {
  return run(() => savePost(input));
}

export async function publish(id: number) {
  return run(() => publishPost(id));
}

export async function unpublish(id: number) {
  return run(() => unpublishPost(id));
}

export async function remove(id: number) {
  return run(() => deletePost(id));
}
