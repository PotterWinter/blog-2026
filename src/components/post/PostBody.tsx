import type { ReactNode } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import FitImage from "./FitImage";
import TableScroll from "./TableScroll";
import TransitionLink from "../TransitionLink";
import { clipKey, isClip, type ClipMap } from "@/lib/clips";
import Carousel from "./Carousel";
import Clip from "./Clip";
import CodeBlock from "./CodeBlock";
import styles from "./Post.module.css";
import YouTube from "./YouTube";

// The video id from a youtube.com/watch?v=, youtu.be/ or /shorts/ link; null if the
// link isn't YouTube
export function youTubeId(href: string): string | null {
  const m =
    /^https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)([\w-]{11})/.exec(
      href,
    ) ?? /^https?:\/\/youtu\.be\/([\w-]{11})/.exec(href);
  return m ? m[1] : null;
}

// "The shape of the problem" → "the-shape-of-the-problem" (Thai letters kept), so
// headings can be linked to and listed by the contents rail
export function headingId(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9฀-๿]+/g, "-")
    .replace(/^-|-$/g, "");
}

// A table's columns, each wide enough that its longest cell takes at most 3 lines —
// left to the browser, a phone squeezed a sentence to a word a line (owner, 4 Oct 69).
// Short ones (≤ 12 letters) keep their own width; none past 22 letters wide, so a long
// sentence may run longer rather than take the screen. Wider than the column in all:
// the table scrolls sideways (TableScroll). Given as --w1…--w8 on the table, the least
// width of each column's cells (Post.module.css) — a <col>'s width the browser treated
// as a wish, and squeezed anyway.
const LINES = 3;
// Letters as they stand on screen: Thai vowels and tone marks above and below a letter
// share its place ("ที่นี่" is 2, not 6)
const graphemes = new Intl.Segmenter("th", { granularity: "grapheme" });
const letters = (text: string) => [...graphemes.segment(text)].length;
type Hast = { type: string; tagName?: string; value?: string; children?: Hast[] };
const hastText = (n: Hast): string => (n.type === "text" ? (n.value ?? "") : (n.children ?? []).map(hastText).join(""));
function columnWidths(table?: Hast): (string | null)[] {
  const rows: Hast[] = [];
  const walk = (n: Hast) => (n.tagName === "tr" ? rows.push(n) : (n.children ?? []).forEach(walk));
  if (table) walk(table);
  const longest: number[] = [];
  for (const row of rows) {
    (row.children ?? [])
      .filter((c) => c.tagName === "td" || c.tagName === "th")
      .forEach((c, i) => (longest[i] = Math.max(longest[i] ?? 0, letters(hastText(c).trim()))));
  }
  return longest.map((n) => (n > 12 ? `${Math.min(22, Math.ceil(n / LINES))}ch` : null));
}

const textOf = (node: ReactNode): string =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(textOf).join("")
      : node && typeof node === "object" && "props" in node
        ? textOf((node.props as { children?: ReactNode }).children)
        : "";

// In the .md, media paths are relative to the post ("../media/2026/x.webp") so Obsidian
// can show them; on the site they're served from /media/…
const mediaSrc = (src: string) => src.replace(/^(\.\.\/)+/, "/");

type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
};

// An HTML comment on the line above the images picks their layout (EDITOR-SPEC):
// <!-- two 4:5 --> <!-- two 16:10 --> <!-- carousel --> <!-- carousel 4:5 -->
// <!-- fit height --> <!-- full -->. None = each image on its own, the column's width.
const LAYOUT = /^<!--\s*(two|carousel|fit height|full)(?:\s+(4:5|16:10))?\s*-->$/;

// Turns "comment + the paragraph of images under it" into one <div data-layout>,
// which PostBody's div renderer draws
function remarkImageLayouts() {
  return (tree: MdNode) => {
    const kids = tree.children ?? [];
    for (let i = 0; i < kids.length - 1; i++) {
      const match = kids[i].type === "html" ? LAYOUT.exec(kids[i].value?.trim() ?? "") : null;
      const next = kids[i + 1];
      if (!match || next.type !== "paragraph") continue;
      const images = (next.children ?? []).filter((c) => c.type === "image");
      const other = (next.children ?? []).filter(
        (c) => c.type !== "image" && !(c.type === "text" && !c.value?.trim()),
      );
      if (!images.length || other.length) continue;
      next.children = images;
      next.data = {
        hName: "div",
        hProperties: { dataLayout: match[1].replace(" ", "-"), dataRatio: match[2] ?? "" },
      };
      kids.splice(i, 1);
      i -= 1;
    }
  };
}

// "> [!NOTE] …" (GitHub's alert syntax) → a quote tagged data-alert="note", with the
// marker taken out of the text. [!TIP], [!WARNING]… work the same, labelled with their word.
function remarkAlerts() {
  const walk = (node: MdNode) => {
    if (node.type === "blockquote") {
      const lead = node.children?.[0]?.children?.[0];
      const match = lead?.type === "text" ? /^\[!(\w+)\][ \t]*\n?/.exec(lead.value ?? "") : null;
      if (lead && match) {
        lead.value = lead.value!.slice(match[0].length);
        node.data = { ...node.data, hProperties: { dataAlert: match[1].toLowerCase() } };
      }
    }
    node.children?.forEach(walk);
  };
  return walk;
}

// 04 body: the markdown in one 880px column, styled per v4. Code blocks, YouTube,
// heading "#" links and the contents rail come in 3.3b / 3.3c.
// `bare`: just the content, for a block of it shown inside WRITE's own column
// `clips`: where each clip the post names really is (media.json; lib/clips)
export default function PostBody({
  markdown,
  bare = false,
  clips = {},
  titles = {},
}: {
  markdown: string;
  bare?: boolean;
  clips?: ClipMap;
  titles?: Record<string, string>; // the site's posts by address: [](/posts/<code>) reads as its title
}) {
  const content = (
    <Markdown
      remarkPlugins={[remarkGfm, remarkAlerts, remarkImageLayouts]}
      // The editor's Preview shows images and clips still waiting for Save
      urlTransform={(url) => (/^(clip|upload):/.test(url) ? url : defaultUrlTransform(url))}
      components={{
        h2: ({ children }) => <h2 id={headingId(textOf(children))}>{children}</h2>,
        h3: ({ children }) => <h3 id={headingId(textOf(children))}>{children}</h3>,
        a: ({ href = "", children }) => {
          const external = /^https?:\/\//.test(href);
          // A link to another page of the site plays the page transition
          if (href.startsWith("/")) {
            // Its address alone ([](/posts/<code>)): the post's title, as it is now
            const words = textOf(children) ? children : (titles[href.replace(/\/$/, "")] ?? href);
            return (
              <TransitionLink href={href} className={styles.link}>
                {words}
              </TransitionLink>
            );
          }
          return (
            <a
              href={href}
              className={styles.link}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {children}
              {external && (
                <svg
                  viewBox="0 0 20 20"
                  width="0.65em"
                  height="0.65em"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="square"
                  aria-hidden="true"
                  className={styles.out}
                >
                  <path vectorEffect="non-scaling-stroke" d="M1 19 18.5 1.5M10.5 1.5h8v8" />
                </svg>
              )}
            </a>
          );
        },
        ul: ({ children }) => <ul className={styles.ul}>{children}</ul>,
        // The marker takes the first column; everything the item holds (text, code,
        // links) stays together in the second
        li: ({ children }) => (
          <li>
            <div>{children}</div>
          </li>
        ),
        // Markers read 01, 02, … (CSS counter)
        ol: ({ children, start }) => (
          <ol
            className={styles.ol}
            style={start ? { counterReset: `item ${start - 1}` } : undefined}
          >
            {children}
          </ol>
        ),
        // An image on its own line is a figure, not a paragraph (a figure inside a
        // <p> isn't valid HTML)
        // A paragraph that is only an image is a figure; one that is only a YouTube
        // link is the video ([caption](youtube link "3:32")). Neither may sit in a <p>.
        p: ({ node, children }) => {
          const only = node?.children.length === 1 ? node.children[0] : null;
          const onlyImages = node?.children.every(
            (c) =>
              (c.type === "element" && c.tagName === "img") ||
              (c.type === "text" && !c.value.trim()),
          );
          if (onlyImages) return <>{children}</>;
          if (only?.type === "element" && only.tagName === "a") {
            const id = youTubeId(String(only.properties.href ?? ""));
            if (id) {
              return (
                <YouTube
                  id={id}
                  caption={textOf(children)}
                  duration={only.properties.title ? String(only.properties.title) : undefined}
                />
              );
            }
          }
          return <p>{children}</p>;
        },
        // A quote marked by remarkAlerts is the v4 Note box; any other is a pull quote
        blockquote: ({ node, children }) => {
          const alert = node?.properties.dataAlert;
          if (!alert) return <blockquote>{children}</blockquote>;
          return (
            <aside className={styles.note}>
              <span className="label">{String(alert)}</span>
              <div>{children}</div>
            </aside>
          );
        },
        // Fenced code: the v4 frame (inline code stays as it is)
        pre: ({ node }) => {
          const code = node?.children[0];
          if (code?.type !== "element" || code.tagName !== "code") return null;
          const lang = String(
            (code.properties.className as string[] | undefined)?.[0] ?? "",
          ).replace(/^language-/, "");
          const meta = String((code.data as { meta?: string } | undefined)?.meta ?? "");
          const text = code.children.map((c) => ("value" in c ? c.value : "")).join("");
          return <CodeBlock lang={lang} meta={meta} code={text} />;
        },
        table: ({ node, children }) => (
          <TableScroll>
            <table
              style={Object.fromEntries(
                columnWidths(node).flatMap((w, i) => (w && i < 8 ? [[`--w${i + 1}`, w]] : [])),
              )}
            >
              {children}
            </table>
          </TableScroll>
        ),
        // Images laid out by a <!-- … --> comment (remarkImageLayouts)
        div: ({ node, children }) => {
          const layout = String(node?.properties.dataLayout ?? "");
          if (!layout) return <div>{children}</div>;
          const ratio = String(node?.properties.dataRatio ?? "");
          const images = (node?.children ?? []).flatMap((c) =>
            c.type === "element" && c.tagName === "img"
              ? [
                  {
                    src: mediaSrc(String(c.properties.src ?? "")),
                    alt: String(c.properties.alt ?? ""),
                    caption: String(c.properties.title ?? c.properties.alt ?? ""),
                  },
                ]
              : [],
          );
          if (layout === "carousel") return <Carousel slides={images} ratio={ratio} />;
          if (layout === "two") {
            return (
              <div className={styles.two} data-ratio={ratio || "4:5"}>
                {images.slice(0, 2).map((img) => (
                  <figure key={img.src}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- sizes come from the file */}
                    <img src={img.src} alt={img.alt} loading="lazy" />
                    {img.caption && <figcaption>{img.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            );
          }
          // full: one image, filling the frame. "fit height" (no longer offered, 4 Oct 69)
          // reads as Fit. A clip may be Full too (owner, 4 Oct 69).
          const [img] = images;
          const first = (node?.children ?? []).find((c) => c.type === "element" && c.tagName === "img");
          const raw = first?.type === "element" ? String(first.properties.src ?? "") : "";
          if (layout === "full" && images.length === 1 && isClip(raw)) {
            // its caption is its title only (an image's falls back to its alt)
            const title = first?.type === "element" ? first.properties.title : undefined;
            return <Clip entry={clips[clipKey(raw)] ?? clips[raw]} alt={img.alt} caption={title ? String(title) : undefined} full />;
          }
          if (layout !== "full") {
            return (
              <figure className={styles.figure}>
                <FitImage src={img.src} alt={img.alt} />
                {img.caption && <figcaption>{img.caption}</figcaption>}
              </figure>
            );
          }
          return (
            <figure className={`${styles.figure} ${styles.full}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- sizes come from the file */}
              <img src={img.src} alt={img.alt} loading="lazy" />
              {img.caption && <figcaption>{img.caption}</figcaption>}
            </figure>
          );
        },
        // A clip (.mp4 / .webm) is written as an image is; media.json says where it is
        img: ({ src, alt, title }) =>
          isClip(String(src ?? "")) ? (
            <Clip
              entry={clips[clipKey(String(src))] ?? clips[String(src)]}
              alt={alt ?? ""}
              caption={title ?? undefined}
            />
          ) : (
            <figure className={styles.figure}>
              <FitImage src={mediaSrc(String(src ?? ""))} alt={alt ?? ""} />
              {title && <figcaption>{title}</figcaption>}
            </figure>
          ),
      }}
    >
      {markdown}
    </Markdown>
  );
  if (bare) return content;
  return (
    <div className={styles.body}>
      <article className={styles.prose}>{content}</article>
    </div>
  );
}
