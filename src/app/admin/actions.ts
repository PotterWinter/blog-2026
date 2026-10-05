"use server";

import type { WaitingClip } from "@/lib/clips";
import type { PostInput } from "@/lib/edit";
import { getMediaHistory } from "@/lib/content";
import { currentSession } from "@/lib/session";
import { prepareUpload, type Pending, type Prepped } from "@/lib/media";
import { deletePost, dropClips, publishPost, savePost, unpublishPost, type Saved } from "@/lib/write";

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

// pending: the images picked since the last save, committed with it (5.4)
// clips: the ones picked since the last save, sent up to Blob just before (5.4d)
export async function save(input: PostInput, pending: Pending[] = [], clips: WaitingClip[] = []) {
  return run(() => savePost(input, pending, clips));
}

// Clips the editor sent up to Blob for a save that then didn't happen: out again, so
// nothing stays there that no post names. Only files of this store's clips/ folder.
export async function discardClips(urls: string[]) {
  if (!(await currentSession())) return;
  const ours = urls.filter((u) => /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/clips\/[a-z0-9-]+\.(mp4|webm)$/i.test(u));
  if (ours.length) await dropClips(ours);
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

// An image picked in the editor (5.4): form fields role ("cover" | "image") and file.
// Made a WebP and handed back to wait for Save — nothing is committed here.
export type UploadResult = { ok: true; image: Prepped } | { ok: false; error: string };

const MAX_UPLOAD = 4 * 1024 * 1024;

export async function upload(form: FormData): Promise<UploadResult> {
  if (!(await currentSession())) return { ok: false, error: "Signed out: sign in again to upload" };
  const role = form.get("role") === "cover" ? "cover" : "image";
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return { ok: false, error: "Not an image" };
  if (file.size > MAX_UPLOAD) return { ok: false, error: "Over 4 MB — too big to send" };
  try {
    return { ok: true, image: await prepareUpload(file.name, Buffer.from(await file.arrayBuffer()), role) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't read the image" };
  }
}

// 08 Media: when a file came in, and in which commit (asked when it's selected)
export async function mediaHistory(file: string) {
  if (!(await currentSession())) return null;
  return getMediaHistory(file);
}
