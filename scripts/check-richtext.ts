// WRITE's markdown ↔ document round trip (lib/richtext), over every post in a folder:
//   npm run check-richtext [-- ../blog-content/posts]
// exact = opened and written back unchanged, byte for byte
// same  = written fresh (no remembered source) and still the same markdown tree
import { readdirSync, readFileSync } from "node:fs";
import type { JSONContent } from "@tiptap/core";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { docToMd, mdToDoc } from "../src/lib/richtext.ts";

// The markdown tree without where each node sat in the file
const strip = (n: unknown): unknown => {
  if (Array.isArray(n)) return n.map(strip);
  if (n && typeof n === "object") {
    return Object.fromEntries(
      Object.entries(n)
        .filter(([k]) => k !== "position" && k !== "spread")
        .map(([k, v]) => [k, strip(v)]),
    );
  }
  return n;
};
const ast = (md: string) =>
  JSON.stringify(
    strip(fromMarkdown(md, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })),
  );
// Forget the source each block remembers (raw blocks keep theirs: it's all they are)
const dropSrc = (n: JSONContent): JSONContent => ({
  ...n,
  attrs:
    n.attrs &&
    Object.fromEntries(Object.entries(n.attrs).filter(([k]) => k !== "src" || n.type === "raw")),
  content: n.content?.map(dropSrc),
});

const dir = process.argv[2] ?? "fixtures/content/posts";
let exact = 0,
  same = 0,
  bad = 0,
  raws = 0,
  blocks = 0;
for (const f of readdirSync(dir)) {
  const body = readFileSync(`${dir}/${f}`, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "");
  const doc = mdToDoc(body);
  blocks += doc.content!.length;
  raws += doc.content!.filter((b) => b.type === "raw").length;
  if (docToMd(doc) === body.replace(/\s+$/, "").replace(/^\s+/, "")) exact++;
  else {
    console.log("NOT EXACT", f);
  }
  const fresh = docToMd(dropSrc(doc));
  if (ast(fresh) === ast(body)) same++;
  else {
    bad++;
    console.log("DIFFERS", f);
    if (bad < 2) {
      const a = fresh.split("\n"),
        b = body.split("\n");
      for (let i = 0; i < Math.max(a.length, b.length); i++)
        if (a[i] !== b[i]) {
          console.log(" orig:", JSON.stringify(b[i]));
          console.log(" new :", JSON.stringify(a[i]));
          break;
        }
    }
  }
}
console.log({ exact, same, bad, blocks, raws });
