import type { IndexEntry } from "./schema.ts";

// The details pane's Checks (v4 06): the same list for every post, a black square when
// fine, red when it needs attention. Cover, Excerpt and Alt text (and Role for a
// project) come from the index; the rest need the post's body, file list and media
// sizes, which the editor (5.3) brings — until then they show as not checked (ok: null).
export type Check = { label: string; ok: boolean | null; note: string; tip: string };

export function postChecks(p: IndexEntry): Check[] {
  const later = (label: string, tip: string): Check => ({ label, ok: null, note: "in editor", tip });
  const excerptNote = !p.excerpt ? "missing" : p.excerpt.length > 200 ? `${p.excerpt.length} chars` : "";
  const out: Check[] = [
    { label: "Cover", ok: !!p.cover, note: p.cover ? "" : "missing", tip: "Post has a cover image" },
    { label: "Excerpt", ok: !excerptNote, note: excerptNote, tip: "Short summary under the title · 200 characters at most" },
    {
      label: "Alt text",
      ok: !p.cover || !!p.coverAlt,
      note: p.cover && !p.coverAlt ? "cover" : "",
      tip: "Every image has a description (the cover, for now)",
    },
  ];
  if (p.section === "project") {
    out.push({ label: "Role", ok: !!p.role, note: p.role ? "" : "empty", tip: "What you did on the project" });
  }
  return out.concat([
    later("Links", "Every link has text and a target · none open to 404"),
    later("Files", "Every image and clip referenced exists"),
    later("Image size", "No image over 500 KB"),
    later("Video size", "No clip over 5 MB"),
    later("TODO", "No TODO or TK left in the text"),
  ]);
}

// The ones that need fixing — 06's "issues" filter and the red card titles
export const postIssues = (p: IndexEntry) => postChecks(p).filter((c) => c.ok === false);
