"use server";

import type { PostInput } from "@/lib/edit";
import { currentSession } from "@/lib/session";
import { prepareUpload, type Pending, type Prepped } from "@/lib/media";
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

// pending: the images picked since the last save, committed with it (5.4)
export async function save(input: PostInput, pending: Pending[] = []) {
  return run(() => savePost(input, pending));
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
