import "server-only";
import { IMAGE_MAX } from "./checks.ts";
import { CLIP_MAX, clipKey, isClip } from "./clips.ts";
import { getClips, getMediaFiles, getPost, getPosts } from "./content.ts";
import type { IndexEntry } from "./schema.ts";

// 08 Media (5.4c): every file the content holds — the images in media/ and the clips in
// media.json — with where each is used. Nothing is uploaded or deleted here: a file
// comes in and goes out with the post that names it, on Save (owner, 4 Oct 69: media
// follows the last save, nothing is left over). "Unused" is a check that this held — a
// file only an edit made outside the admin (on GitHub) could leave behind.

export type MediaUse = {
  title: string;
  slug: string;
  status: IndexEntry["status"];
  as: "cover" | "image" | "clip" | "preview"; // a project link's screenshot: no alt
  alt: string;
};

export type MediaItem = {
  path: string; // "media/2026/<code>-name.webp", or a clip's "….mp4" (its key in media.json)
  kind: "image" | "clip";
  bytes: number;
  // A clip: where it plays from, its first frame (a WebP in media/, not listed apart),
  // its size and length
  url?: string;
  poster?: string;
  width?: number;
  height?: number;
  seconds?: number;
  uses: MediaUse[];
  over: boolean; // an image over 500 KB, a clip over 5 MB
  noAlt: boolean; // used somewhere with no alt text
};

const IMAGE = /\.(webp|jpe?g|png|gif|avif|svg)$/i;
// ![alt](../media/… "caption") — the alt with its \] escapes undone
const EMBED = /!\[((?:\\.|[^\]\\])*)\]\(\s*<?((?:\.\.\/)*\/?media\/[^\s)>]+)>?(?:\s+"(?:\\.|[^"\\])*")?\s*\)/g;

export async function getMediaLibrary(): Promise<MediaItem[]> {
  const [files, clips, posts] = await Promise.all([getMediaFiles(), getClips(), getPosts({ drafts: true })]);

  const uses = new Map<string, MediaUse[]>();
  const add = (src: string, use: MediaUse) => {
    const key = clipKey(src);
    uses.set(key, [...(uses.get(key) ?? []), use]);
  };
  await Promise.all(
    posts.map(async (entry) => {
      const post = await getPost(entry.slug);
      if (!post) return;
      const of = { title: post.title || "Untitled", slug: post.slug, status: entry.status };
      if (post.cover) add(post.cover, { ...of, as: "cover", alt: post.coverAlt });
      for (const link of post.links) if (link.preview) add(link.preview, { ...of, as: "preview", alt: "" });
      for (const [, alt, src] of post.body.matchAll(EMBED)) {
        add(src, { ...of, as: isClip(src) ? "clip" : "image", alt: alt.replace(/\\(.)/g, "$1") });
      }
    }),
  );

  const noAlt = (list: MediaUse[]) => list.some((u) => u.as !== "preview" && !u.alt.trim());
  const posters = new Set(Object.values(clips).map((c) => c.poster));
  const images: MediaItem[] = Object.entries(files)
    .filter(([path]) => IMAGE.test(path) && !posters.has(path))
    .map(([path, bytes]) => {
      const list = uses.get(path) ?? [];
      return { path, kind: "image", bytes, uses: list, over: bytes > IMAGE_MAX, noAlt: noAlt(list) };
    });
  const videos: MediaItem[] = Object.entries(clips).map(([path, c]) => {
    const list = uses.get(path) ?? [];
    return {
      path,
      kind: "clip",
      bytes: c.bytes,
      url: c.url,
      poster: c.poster,
      width: c.width,
      height: c.height,
      seconds: c.seconds,
      uses: list,
      over: c.bytes > CLIP_MAX,
      noAlt: noAlt(list),
    };
  });
  // Newest year first, then by name — a post's files sit together under its code
  return [...images, ...videos].sort((a, b) => {
    const year = (p: string) => /media\/(\d{4})\//.exec(p)?.[1] ?? "";
    return year(b.path).localeCompare(year(a.path)) || a.path.localeCompare(b.path);
  });
}
