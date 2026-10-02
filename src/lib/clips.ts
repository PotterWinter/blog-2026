// Clips (5.4d, decided 29 Sep 69): short videos — MP4 / WebM, up to 5 MB, muted on
// loop — live in Vercel Blob, not in git. The .md names a clip by a path of the site's
// own, as an image is named — ![alt](../media/2026/<code>-typing.mp4 "caption") — and
// media.json in the content repo says where that path really is: the file in Blob, its
// poster (the clip's first frame, a WebP in git beside the images) and its size. Git
// stays the record of everything; moving the clips elsewhere one day is one file.
// No server-only imports: the editor and the page read these too.

export type ClipEntry = {
  url: string; // the file in Blob
  poster: string; // "media/2026/<code>-typing.webp" — its first frame
  bytes: number;
  seconds: number;
  width: number;
  height: number;
};
export type ClipMap = Record<string, ClipEntry>; // "media/2026/<code>-typing.mp4" → where it is

export const MEDIA_JSON = "media.json";
export const CLIP_MAX = 5 * 1024 * 1024;
export const CLIP_TYPES = ["video/mp4", "video/webm"];

// A clip picked in the editor and up in Blob already, its post not saved yet: the body
// says "clip:<key>" (its poster waits as the image "upload:<key>")
export const CLIP = "clip:";
export type WaitingClip = Omit<ClipEntry, "poster"> & { key: string };
const WAITING = /clip:[a-z0-9-]+/g;

export const isClip = (src: string) => src.startsWith(CLIP) || /\.(mp4|webm)$/i.test(src);
// "../media/2026/x.mp4" → "media/2026/x.mp4", the key in media.json
export const clipKey = (src: string) => src.replace(/^(\.\.\/)+/, "").replace(/^\//, "");

export const waitingClips = (text: string) =>
  new Set([...text.matchAll(WAITING)].map(([m]) => m.slice(CLIP.length)));

export const placeClips = (text: string, paths: Record<string, string>) =>
  text.replace(WAITING, (m) => {
    const path = paths[m.slice(CLIP.length)];
    return path ? `../${path}` : m;
  });

export function parseClips(text: string | null): ClipMap {
  if (!text) return {};
  try {
    const map = JSON.parse(text) as unknown;
    return map && typeof map === "object" && !Array.isArray(map) ? (map as ClipMap) : {};
  } catch {
    return {};
  }
}

// The clips a post's text points at, by their media.json key
export const clipsIn = (text: string) =>
  new Set(
    [...text.matchAll(/\]\((?:\.\.\/)*(media\/\d{4}\/[a-z0-9-]+\.(?:mp4|webm))/g)].map((m) => m[1]),
  );
