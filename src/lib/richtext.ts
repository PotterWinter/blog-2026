import type { JSONContent } from "@tiptap/core";
import type { Blockquote, Nodes, PhrasingContent, Root, RootContent, Table } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import { isClip } from "./clips.ts";

// WRITE (5.3d): a post's markdown body ↔ the Tiptap document the editor shows.
//
// Every top-level block keeps the markdown it came from (`src`). Written back, a block
// that still says the same as its source gives that source back exactly, so opening a
// post in WRITE and typing in one paragraph changes that paragraph in the .md and
// nothing else (no list markers or spacing rewritten everywhere).
//
// Blocks WRITE can't edit yet — images and their layouts, tables, YouTube, HTML — come
// in as `raw` blocks: shown as the post shows them, written back untouched (5.3e makes
// them editable).

const parse = (md: string) =>
  fromMarkdown(md, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });

const write = (node: RootContent | Root) =>
  toMarkdown(node.type === "root" ? node : { type: "root", children: [node] }, {
    extensions: [gfmToMarkdown()],
    bullet: "-",
    emphasis: "*",
    strong: "*",
    fence: "`",
    rule: "-",
    listItemIndent: "one",
  }).replace(/\n+$/, "");

// "> [!NOTE]" (GitHub's alert syntax, as PostBody reads it)
const ALERT = /^\[!(\w+)\][ \t]*\n?/;

type Marks = NonNullable<JSONContent["marks"]>;

// ---------- markdown → document ----------

// Inline content, or null when there's something WRITE can't show as text (an image,
// inline HTML, a footnote): the whole block is then kept raw
function inline(nodes: PhrasingContent[], marks: Marks = []): JSONContent[] | null {
  const out: JSONContent[] = [];
  for (const n of nodes) {
    const add = (m: Marks[number]) =>
      inline((n as { children: PhrasingContent[] }).children, [...marks, m]);
    let more: JSONContent[] | null;
    switch (n.type) {
      case "text":
        // A soft line break inside a paragraph reads as a space on the page
        if (n.value)
          out.push({
            type: "text",
            text: n.value.replace(/\n/g, " "),
            ...(marks.length ? { marks } : {}),
          });
        continue;
      case "inlineCode":
        out.push({ type: "text", text: n.value, marks: [...marks, { type: "code" }] });
        continue;
      case "break":
        out.push({ type: "hardBreak" });
        continue;
      case "strong":
        more = add({ type: "bold" });
        break;
      case "emphasis":
        more = add({ type: "italic" });
        break;
      case "delete":
        more = add({ type: "strike" });
        break;
      case "link":
        // [](/posts/<code>): a post linked by its address alone. WRITE shows its title
        // as the link's words, ordinary text (an uneditable piece tripped the iPhone's
        // caret — owner, 4 Oct 69); written back the same way while they still read
        // as the title, so a renamed post's links follow
        if (!n.children.length && POST_HREF.test(n.url)) {
          out.push({ type: "text", text: titleAt(n.url) ?? n.url, marks: [...marks, { type: "link", attrs: { href: n.url, title: null } }] });
          continue;
        }
        more = add({ type: "link", attrs: { href: n.url, title: n.title ?? null } });
        break;
      default:
        return null;
    }
    if (!more) return null;
    out.push(...more);
  }
  return out;
}

// The site's own post or project, by its address
export const POST_HREF = /^\/(posts|project)\/[a-z0-9-]+\/?$/;
// Their titles by address, for the conversion running now (mdToDoc / docToMd)
let titlesNow: Record<string, string> = {};
const titleAt = (href: string): string | undefined => titlesNow[href.replace(/\/$/, "")];

const youTube = /^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/|youtu\.be\/)/;

// ---------- images (5.3e) ----------
// A figure: one image, or several laid out by the comment above them (PostBody):
// <!-- two 4:5 --> <!-- two 16:10 --> <!-- carousel --> <!-- carousel 4:5 -->
// <!-- fit height --> <!-- full -->. None = single, the column's width.
export type FigureImage = { src: string; alt: string; caption: string };
export type Layout = "single" | "fit height" | "full" | "two" | "carousel";
const LAYOUT = /^<!--\s*(two|carousel|fit height|full)(?:\s+(4:5|16:10))?\s*-->$/;

// A paragraph that's only images (each on its own line), or null
function imagesOf(n: RootContent): FigureImage[] | null {
  if (n.type !== "paragraph") return null;
  const images: FigureImage[] = [];
  for (const c of n.children) {
    if (c.type === "image") images.push({ src: c.url, alt: c.alt ?? "", caption: c.title ?? "" });
    else if (c.type !== "text" || c.value.trim()) return null;
  }
  return images.length ? images : null;
}

const figure = (layout: Layout, ratio: string, images: FigureImage[]): JSONContent => ({
  type: "figure",
  attrs: { layout, ratio, images },
});

export function figureMd(layout: Layout, ratio: string, images: FigureImage[]): string {
  const lines = images
    .filter((i) => i.src)
    .map((i) => {
      const alt = i.alt.replace(/([\\[\]])/g, "\\$1");
      const title = i.caption ? ` "${i.caption.replace(/(["\\])/g, "\\$1")}"` : "";
      return `![${alt}](${i.src}${title})`;
    });
  // A block put in with no image picked yet: nothing in the .md
  if (!lines.length) return "";
  if (layout === "single") return lines.join("\n\n");
  return [`<!-- ${layout}${ratio ? ` ${ratio}` : ""} -->`, ...lines].join("\n");
}

// One block of the body, or null = keep it raw
function block(n: RootContent): JSONContent | null {
  switch (n.type) {
    case "paragraph": {
      // One image on its own: a single figure (several with no layout: kept raw); one
      // clip (an .mp4 / .webm, written as an image is) its own block (5.4d)
      const images = imagesOf(n);
      if (images?.length === 1 && isClip(images[0].src)) return { type: "clip", attrs: { ...images[0] } };
      if (images) return images.length === 1 && !images.some((i) => isClip(i.src)) ? figure("single", "", images) : null;
      // A paragraph that's only a YouTube link is the video on the page:
      // [caption](youtube link) — a block of its own (5.3e)
      const only = n.children.length === 1 ? n.children[0] : null;
      if (only?.type === "link" && youTube.test(only.url)) {
        if (!only.children.every((c) => c.type === "text")) return null; // styled words: raw
        const caption = only.children.map((c) => (c.type === "text" ? c.value : "")).join("");
        return { type: "youtube", attrs: { url: only.url, caption } };
      }
      const content = inline(n.children);
      return content && { type: "paragraph", content };
    }
    case "heading": {
      if (n.depth !== 2 && n.depth !== 3) return null;
      const content = inline(n.children);
      return content && { type: "heading", attrs: { level: n.depth }, content };
    }
    case "blockquote":
      return quote(n);
    case "list": {
      const items: JSONContent[] = [];
      for (const item of n.children) {
        if (item.checked != null) return null; // task lists: not on the site
        const content: JSONContent[] = [];
        for (const c of item.children) {
          const b = block(c);
          if (!b) return null;
          content.push(b);
        }
        items.push({ type: "listItem", content });
      }
      return n.ordered
        ? { type: "orderedList", attrs: { start: n.start ?? 1 }, content: items }
        : { type: "bulletList", content: items };
    }
    case "code":
      // The fence's whole info string ("ts title=\"search.ts\"", "output attach") is kept
      // as it was typed
      return {
        type: "codeBlock",
        attrs: { info: [n.lang, n.meta].filter(Boolean).join(" ") },
        content: n.value ? [{ type: "text", text: n.value }] : [],
      };
    case "thematicBreak":
      return { type: "horizontalRule" };
    case "table":
      return table(n);
    default:
      return null;
  }
}

// A table: its first row the head; each cell one paragraph of inline text. The
// columns' alignment (|:---|) is kept on the table.
function table(n: Table): JSONContent | null {
  const rows: JSONContent[] = [];
  for (const [r, row] of n.children.entries()) {
    const cells: JSONContent[] = [];
    for (const cell of row.children) {
      const content = inline(cell.children);
      if (!content) return null;
      cells.push({
        type: r === 0 ? "tableHeader" : "tableCell",
        content: [{ type: "paragraph", ...(content.length ? { content } : {}) }],
      });
    }
    rows.push({ type: "tableRow", content: cells });
  }
  return { type: "table", attrs: { align: n.align ?? [] }, content: rows };
}

// A quote, or a note when its first line is "[!NOTE]"
function quote(n: Blockquote): JSONContent | null {
  const first = n.children[0];
  const lead = first?.type === "paragraph" ? first.children[0] : null;
  const match = lead?.type === "text" ? ALERT.exec(lead.value) : null;
  let children = n.children;
  if (match && first?.type === "paragraph" && lead?.type === "text") {
    const rest = lead.value.slice(match[0].length);
    const para = {
      ...first,
      children: rest
        ? [{ ...lead, value: rest }, ...first.children.slice(1)]
        : first.children.slice(1),
    };
    children = para.children.length ? [para, ...n.children.slice(1)] : n.children.slice(1);
  }
  const content: JSONContent[] = [];
  for (const c of children) {
    const b = block(c);
    if (!b) return null;
    content.push(b);
  }
  if (!content.length) content.push({ type: "paragraph" });
  return match
    ? { type: "note", attrs: { kind: match[1].toUpperCase() }, content }
    : { type: "blockquote", content };
}

export function mdToDoc(md: string, titles: Record<string, string> = {}): JSONContent {
  titlesNow = titles;
  const tree = parse(md);
  const content: JSONContent[] = [];
  const kids = tree.children;
  const slice = (from: Nodes, to: Nodes = from) =>
    md.slice(from.position!.start.offset!, to.position!.end.offset!);
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    // A layout comment and the images under it are one block
    const next = kids[i + 1];
    if (n.type === "html" && /^<!--/.test(n.value) && next?.type === "paragraph") {
      const layout = LAYOUT.exec(n.value.trim());
      const found = imagesOf(next);
      const images = found?.some((i) => isClip(i.src)) ? null : found; // clips aren't laid out…
      const src = slice(n, next);
      // …but one may be Full (owner, 4 Oct 69): <!-- full --> over it, as over an image
      if (layout?.[1] === "full" && found?.length === 1 && isClip(found[0].src)) {
        content.push({ type: "clip", attrs: { ...found[0], layout: "full", source: src } });
        i += 1;
        continue;
      }
      content.push(
        layout && images
          ? { ...figure(layout[1] as Layout, layout[2] ?? "", images), attrs: { layout: layout[1], ratio: layout[2] ?? "", images, src } }
          : { type: "raw", attrs: { src } },
      );
      i += 1;
      continue;
    }
    const b = block(n);
    content.push(
      b
        ? // (a clip's src is its file: its markdown is kept as `source`)
          { ...b, attrs: { ...b.attrs, [b.type === "clip" ? "source" : "src"]: slice(n) } }
        : { type: "raw", attrs: { src: slice(n) } },
    );
  }
  if (!content.length) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

// ---------- document → markdown ----------

function phrasing(nodes: JSONContent[] = []): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  for (const n of nodes) {
    if (n.type === "hardBreak") {
      out.push({ type: "break" });
      continue;
    }
    // A post's link reading as its title (or its bare address): its address alone again
    const only = n.marks?.length === 1 ? n.marks[0] : null;
    const href = only?.type === "link" ? String(only.attrs?.href ?? "") : "";
    if (n.type === "text" && POST_HREF.test(href) && !only?.attrs?.title && (n.text === titleAt(href) || n.text === href)) {
      out.push({ type: "link", url: href, title: null, children: [] });
      continue;
    }
    if (n.type !== "text" || !n.text) continue;
    const marks = n.marks ?? [];
    const code = marks.some((m) => m.type === "code");
    let node: PhrasingContent = code
      ? { type: "inlineCode", value: n.text }
      : { type: "text", value: n.text };
    // Innermost first: italic inside bold inside a link
    for (const m of [...marks].reverse()) {
      if (m.type === "bold") node = { type: "strong", children: [node] };
      else if (m.type === "italic") node = { type: "emphasis", children: [node] };
      else if (m.type === "strike") node = { type: "delete", children: [node] };
      else if (m.type === "link")
        node = {
          type: "link",
          url: m.attrs?.href ?? "",
          title: m.attrs?.title ?? null,
          children: [node],
        };
    }
    out.push(node);
  }
  return merge(out);
}

// Neighbours wrapped the same way share one wrapper: **one two**, not **one****two**
type Parent = Extract<PhrasingContent, { children: unknown }>;
function merge(nodes: PhrasingContent[]): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    const same =
      last &&
      "children" in last &&
      "children" in n &&
      last.type === n.type &&
      (n.type !== "link" || (last.type === "link" && last.url === n.url && last.title === n.title));
    if (same) (last as Parent).children.push(...((n as Parent).children as never[]));
    else out.push(n);
  }
  for (const n of out)
    if ("children" in n) (n as Parent).children = merge((n as Parent).children) as never;
  return out;
}

function toMdast(n: JSONContent): RootContent {
  const kids = (n.content ?? []).map(toMdast);
  switch (n.type) {
    case "paragraph":
      return { type: "paragraph", children: phrasing(n.content) };
    case "heading":
      return {
        type: "heading",
        depth: n.attrs?.level === 3 ? 3 : 2,
        children: phrasing(n.content),
      };
    case "blockquote":
      return { type: "blockquote", children: kids as Blockquote["children"] };
    case "bulletList":
    case "orderedList":
      return {
        type: "list",
        ordered: n.type === "orderedList",
        start: n.type === "orderedList" ? (n.attrs?.start ?? 1) : null,
        spread: false,
        children: kids as never,
      };
    case "listItem":
      return { type: "listItem", spread: false, children: kids as never };
    case "codeBlock": {
      const info = String(n.attrs?.info ?? "").trim();
      const [lang, ...meta] = info.split(/\s+/);
      return {
        type: "code",
        lang: lang || null,
        meta: meta.join(" ") || null,
        value: (n.content ?? []).map((t) => t.text ?? "").join(""),
      };
    }
    case "horizontalRule":
      return { type: "thematicBreak" };
    case "table": {
      const rows = n.content ?? [];
      const width = Math.max(1, ...rows.map((r) => r.content?.length ?? 0));
      const align = (n.attrs?.align as Table["align"]) ?? [];
      return {
        type: "table",
        align: Array.from({ length: width }, (_, i) => align?.[i] ?? null),
        children: rows.map((row) => ({
          type: "tableRow",
          children: Array.from({ length: width }, (_, i) => ({
            type: "tableCell",
            // A cell is one line in markdown: its paragraphs run on, a space between
            children: phrasing(
              (row.content?.[i]?.content ?? []).flatMap((p, k) => [
                ...(k ? [{ type: "text", text: " " }] : []),
                ...(p.content ?? []),
              ]),
            ),
          })),
        })),
      };
    }
    default:
      // note / raw never get here (written in blockMd)
      return { type: "html", value: "" };
  }
}

const canon = new Map<string, string>();
// What a block's source turns into when read in and written straight back
function canonical(src: string): string {
  let c = canon.get(src);
  if (c === undefined) {
    const doc = mdToDoc(src);
    c = (doc.content ?? []).map((b) => blockMd(b, false)).join("\n\n");
    canon.set(src, c);
  }
  return c;
}

export function youtubeMd(url: string, caption: string): string {
  if (!url.trim()) return "";
  const text = caption.replace(/([\\[\]])/g, "\\$1");
  return `[${text}](${url.trim()})`;
}

function blockMd(n: JSONContent, keep = true): string {
  if (n.type === "raw") return String(n.attrs?.src ?? "");
  let md: string;
  if (n.type === "clip") {
    const layout = n.attrs?.layout === "full" ? "full" : "single";
    md = figureMd(layout, "", [{ src: n.attrs?.src ?? "", alt: n.attrs?.alt ?? "", caption: n.attrs?.caption ?? "" }]);
    const src = keep ? n.attrs?.source : null;
    return src && canonical(src) === md ? src : md;
  }
  if (n.type === "youtube") {
    md = youtubeMd(n.attrs?.url ?? "", n.attrs?.caption ?? "");
    const src = keep ? n.attrs?.src : null;
    return src && canonical(src) === md ? src : md;
  }
  if (n.type === "figure") {
    md = figureMd(n.attrs?.layout ?? "single", n.attrs?.ratio ?? "", n.attrs?.images ?? []);
    const src = keep ? n.attrs?.src : null;
    return src && canonical(src) === md ? src : md;
  }
  if (n.type === "note") {
    const inner = (n.content ?? []).map((c) => blockMd(c, false)).join("\n\n");
    const kind = String(n.attrs?.kind ?? "NOTE");
    md = [`[!${kind}]`, ...inner.split("\n")].map((l) => (l ? `> ${l}` : ">")).join("\n");
  } else md = write(toMdast(n));
  // Unchanged since it was read: its source as it was typed
  const src = keep ? n.attrs?.src : null;
  if (src && canonical(src) === md) return src;
  return md;
}

export function docToMd(doc: JSONContent, titles: Record<string, string> = {}): string {
  titlesNow = titles;
  return (doc.content ?? [])
    .filter((b) => !(b.type === "paragraph" && !b.content?.length))
    .map((b) => blockMd(b))
    .filter(Boolean) // a figure with every image taken out
    .join("\n\n");
}
