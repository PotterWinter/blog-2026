import type { IndexEntry } from "./schema.ts";

// What 06's "issues" filter and the details pane's Checks list. From the index alone
// for now; the editor (5.3) adds the rest of EDITOR-SPEC's checks (links, files, image
// and clip sizes, TODO), which need the post's body.
export type Issue = { label: string; note: string };

export function postIssues(p: IndexEntry): Issue[] {
  const out: Issue[] = [];
  if (!p.cover) out.push({ label: "Cover", note: "none" });
  else if (!p.coverAlt) out.push({ label: "Alt text", note: "cover" });
  if (p.excerpt.length > 200) out.push({ label: "Excerpt", note: `${p.excerpt.length} chars` });
  if (p.section === "project" && !p.role) out.push({ label: "Role", note: "empty" });
  return out;
}
