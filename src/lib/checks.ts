import { isClip } from "./clips.ts";
import type { PostLink, PostMeta } from "./schema.ts";

// The details pane's Checks (v4 06): the same list for every post, a black square when
// fine, red when it needs attention. Cover, Excerpt and Alt text (and Role for a
// project) come from the index; the rest need the post's body, its files and their
// sizes, which only the editor has (5.3f) — the hub shows them as not checked (ok: null).
export type Check = { label: string; ok: boolean | null; note: string; tip: string };

// What it reads of a post: the editor passes the form as it stands
type Checked = Pick<PostMeta, "cover" | "coverAlt" | "excerpt" | "section" | "role">;

// What the editor knows about the files and links the text points at (5.3f).
// undefined = still finding out (grey, "checking"); null = not there.
export type Seen = {
  body: string;
  title: string;
  links: PostLink[]; // the page's own links (Live site, GitHub…)
  file: (src: string) => { bytes: number } | null | undefined;
  link: (href: string) => "ok" | "broken" | undefined;
};

export const IMAGE_MAX = 500 * 1024;
const CLIP_MAX = 5 * 1024 * 1024;

// The text as prose: code (fenced and `inline`) left out — a TODO or a [x](y) there is
// an example, not the post's own
function prose(body: string) {
  let fenced = false;
  return body
    .split("\n")
    .filter((line) => {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        return false;
      }
      return !fenced;
    })
    .join("\n")
    .replace(/`[^`\n]*`/g, "");
}

const IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+"[^"]*")?\s*\)/g;
const LINK = /(?<!!)\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+"[^"]*")?\s*\)/g;
const YOUTUBE = /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//;

// "../media/2026/abc-photo.webp" → "abc-photo.webp", for the tip
const named = (src: string) => src.split("/").pop() || src;
// The first three, then how many more
const list = (items: string[]) => {
  const shown = items.slice(0, 3).join(", ");
  return items.length > 3 ? `${shown} +${items.length - 3}` : shown;
};
const size = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export function postChecks(p: Checked, seen?: Seen): Check[] {
  const later = (label: string, tip: string): Check => ({ label, ok: null, note: "in editor", tip });
  const excerptNote = !p.excerpt ? "missing" : p.excerpt.length > 200 ? `${p.excerpt.length} chars` : "";
  const text = seen ? prose(seen.body) : "";
  const images = [...text.matchAll(IMAGE)].map(([, alt, src]) => ({ alt: alt.trim(), src }));
  const noAlt = images.filter((i) => !i.alt).map((i) => named(i.src));
  if (p.cover && !p.coverAlt) noAlt.unshift("cover");

  const out: Check[] = [
    { label: "Cover", ok: !!p.cover, note: p.cover ? "" : "missing", tip: "Post has a cover image" },
    { label: "Excerpt", ok: !excerptNote, note: excerptNote, tip: "Short summary under the title · 200 characters at most" },
    {
      label: "Alt text",
      ok: !noAlt.length,
      note: noAlt.length === 1 && noAlt[0] === "cover" ? "cover" : noAlt.length ? `${noAlt.length} missing` : "",
      tip: noAlt.length ? `No description: ${list(noAlt)}` : "Every image has a description",
    },
  ];
  if (p.section === "project") {
    out.push({ label: "Role", ok: !!p.role, note: p.role ? "" : "empty", tip: "What you did on the project" });
  }
  if (!seen) {
    return out.concat([
      later("Links", "Every link has text and a target · none open to 404"),
      later("Files", "Every image and clip referenced exists"),
      later("Image size", "No image over 500 KB"),
      later("Video size", "No clip over 5 MB"),
      later("TODO", "No TODO or TK left in the text"),
    ]);
  }

  // ---------- Links ----------
  // Unfinished: [](to) or [text]() — the spec lets both stand while writing. A YouTube
  // block is a link alone on its line; its caption may be empty.
  const lines = new Set(text.split("\n").map((l) => l.trim()));
  const unfinished: string[] = [];
  const hrefs: string[] = [];
  for (const [whole, words, href] of text.matchAll(LINK)) {
    const block = YOUTUBE.test(href) && lines.has(whole);
    if (!href || (!words.trim() && !block)) unfinished.push(words.trim() || href);
    if (href) hrefs.push(href);
  }
  for (const l of seen.links) {
    if (l.url) hrefs.push(l.url);
    else unfinished.push(l.label || "page link");
  }
  const answers = hrefs.map((href) => ({ href, state: seen.link(href) }));
  const broken = [...new Set(answers.filter((a) => a.state === "broken").map((a) => a.href.replace(/^https?:\/\//, "")))];
  const asking = answers.some((a) => a.state === undefined);
  const linkNotes = [unfinished.length && `${unfinished.length} unfinished`, broken.length && `${broken.length} broken`].filter(Boolean);
  out.push({
    label: "Links",
    ok: linkNotes.length ? false : asking ? null : true,
    note: linkNotes.length ? linkNotes.join(" · ") : asking ? "checking" : "",
    tip:
      [unfinished.length && `Unfinished: ${list(unfinished)}`, broken.length && `Open to nothing: ${list(broken)}`]
        .filter(Boolean)
        .join(" · ") || "Every link has text and a target · none open to 404",
  });

  // ---------- Files, sizes ----------
  // The cover and every image and clip in the text. One elsewhere on the web
  // (https://…) isn't ours to check.
  const srcs = [...new Set([...(p.cover ? [p.cover] : []), ...images.map((i) => i.src)])].filter((s) => s && !/^https?:/.test(s));
  const found = srcs.map((src) => ({ src, file: seen.file(src), clip: isClip(src) }));
  const missing = found.filter((f) => f.file === null).map((f) => named(f.src));
  const unsure = found.some((f) => f.file === undefined);
  const over = (clip: boolean) =>
    found.flatMap((f) => (f.clip === clip && f.file && f.file.bytes > (clip ? CLIP_MAX : IMAGE_MAX) ? [`${named(f.src)} ${size(f.file.bytes)}`] : []));
  const bigImages = over(false);
  const bigClips = over(true);
  const state = (bad: number) => (bad ? false : unsure ? null : true);
  out.push(
    {
      label: "Files",
      ok: state(missing.length),
      note: missing.length ? `${missing.length} missing` : unsure ? "checking" : "",
      tip: missing.length ? `Not in the repo: ${list(missing)}` : "Every image and clip referenced exists",
    },
    {
      label: "Image size",
      ok: state(bigImages.length),
      note: bigImages.length ? `${bigImages.length} over 500 KB` : unsure ? "checking" : "",
      tip: bigImages.length ? `Over 500 KB: ${list(bigImages)}` : "No image over 500 KB",
    },
    {
      label: "Video size",
      ok: state(bigClips.length),
      note: bigClips.length ? `${bigClips.length} over 5 MB` : unsure ? "checking" : "",
      tip: bigClips.length ? `Over 5 MB: ${list(bigClips)}` : "No clip over 5 MB",
    },
  );

  // ---------- TODO ----------
  // TODO / TK in capitals as whole words — in the title and the prose, not in code
  const todos = [...`${seen.title}\n${text}`.matchAll(/\b(TODO|TK)\b/g)].length;
  out.push({
    label: "TODO",
    ok: !todos,
    note: todos ? `${todos} left` : "",
    tip: todos ? `${todos} TODO or TK still in the text · ⌘F finds them` : "No TODO or TK left in the text",
  });
  return out;
}

// The ones that need fixing — 06's "issues" filter and the red card titles
export const postIssues = (p: Checked) => postChecks(p).filter((c) => c.ok === false);
