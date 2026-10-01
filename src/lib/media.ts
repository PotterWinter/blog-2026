import "server-only";

import sharp, { type OutputInfo } from "sharp";
import { bangkok, type Change } from "./edit";

// Images the admin uploads (5.4): every one becomes a WebP the site can show as it is —
// up to 2400 wide (a cover's 2400 × 1200, a full-width image on a 2× screen) and at
// most 500 KB (Checks › Image size), squeezed a step at a time to get there. Turned
// upright first (phones store photos sideways plus an EXIF note). Saved beside the
// others as media/<year>/<post id>-<name>.webp, so a folder lists by post.

const MAX_WIDTH = 2400;
const MAX_BYTES = 500 * 1024;
const QUALITIES = [82, 76, 70, 64, 58];

export type Prepared = { data: Buffer; width: number; height: number; bytes: number };

// Quality first (82 → 58); a busy image still over 500 KB at the lowest gets narrower
// (2400 → 2000 → 1600) rather than blurrier. Past that it goes as it is, and Checks
// flags it.
const WIDTHS = [MAX_WIDTH, 2000, 1600];

export async function prepareImage(input: Buffer): Promise<Prepared> {
  const upright = sharp(input, { failOn: "error" }).rotate();
  let out: { data: Buffer; info: OutputInfo } | null = null;
  for (const width of WIDTHS) {
    const resized = upright.clone().resize({ width, withoutEnlargement: true });
    for (const quality of QUALITIES) {
      out = await resized.clone().webp({ quality, effort: 5 }).toBuffer({ resolveWithObject: true });
      if (out.info.size <= MAX_BYTES) break;
    }
    if (out!.info.size <= MAX_BYTES) break;
  }
  const { data, info } = out!;
  return { data, width: info.width, height: info.height, bytes: info.size };
}

// "IMG_2041 (1).HEIC" → "img-2041-1"; nothing usable → "image"
export const mediaName = (fileName: string) =>
  fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "image";

// ---------- uploads wait for the save ----------
// An image picked in the editor is made a WebP straight away (so it can be seen, sized
// and checked) but goes nowhere yet: the editor holds it, and the post points at it as
// "upload:<key>". Save sends it along, and it's committed with the post — one commit
// for both, and an image never saved never lands in the repo (owner, 1 Oct 69).

export const UPLOAD = "upload:";

// What the editor holds and sends back: "cover-<its name>", or the image's own name
export type Pending = { key: string; base64: string };
export type Prepped = Pending & { width: number; height: number; bytes: number };

export async function prepareUpload(fileName: string, input: Buffer, role: "cover" | "image"): Promise<Prepped> {
  const image = await prepareImage(input);
  return {
    // The cover keeps its file's name too: 003-cover-img-2041.webp (owner, 2 Oct 69)
    key: role === "cover" ? `cover-${mediaName(fileName)}` : mediaName(fileName),
    base64: image.data.toString("base64"),
    width: image.width,
    height: image.height,
    bytes: image.bytes,
  };
}

const MAX_SENT = 700 * 1024; // a 500 KB WebP as base64, and some room

// Where each waiting image goes: media/<year>/<post id>-<key>.webp, -2, -3… past a name
// already taken. The files to commit, and "upload:<key>" → its path.
export async function placeUploads(pending: Pending[], postId: number, exists: (path: string) => Promise<boolean>, now: Date) {
  const year = bangkok(now).date.slice(0, 4);
  const changes: Change[] = [];
  const paths: Record<string, string> = {};
  for (const { key, base64 } of pending) {
    if (!/^[a-z0-9-]+$/.test(key) || base64.length > MAX_SENT) throw new Error(`Image "${key}" isn't one the editor made`);
    const base = `media/${year}/${String(postId).padStart(3, "0")}-${key}`;
    let path = `${base}.webp`;
    for (let n = 2; (await exists(path)) || changes.some((c) => c.path === path); n++) path = `${base}-${n}.webp`;
    changes.push({ path, text: null, base64 });
    paths[`${UPLOAD}${key}`] = path;
  }
  return { changes, paths };
}
