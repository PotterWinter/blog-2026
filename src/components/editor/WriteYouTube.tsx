"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { youTubeId } from "../post/PostBody";
import { YouTubePoster } from "../post/YouTube";
import styles from "./Editor.module.css";
import { ownControls, ownTaps, selectOnPress } from "./WriteFigure";

// 5.3e YouTube block: the video's poster as the post shows it (the player itself loads
// only on the page), and its Link and Caption. In the .md it's a paragraph that's only
// the link: [caption](https://youtu.be/…) (lib/richtext youtubeMd). Duration is gone
// (owner, 5 Oct 69): typed by hand, it said nothing YouTube's player doesn't.
export const YouTubeBlock = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      url: { default: "", rendered: false },
      caption: { default: "", rendered: false },
      src: { default: null, rendered: false, keepOnSplit: false },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-youtube]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-youtube": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(YouTubeView, ownControls);
  },
});

function YouTubeView(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props;
  const url = String(node.attrs.url ?? "");
  const id = youTubeId(url);
  const field = (
    key: "url" | "caption",
    label: string,
    hint: string,
    auto = false,
  ) => (
    <label className={styles.figRow}>
      <span className="label">{label}</span>
      <input
        value={String(node.attrs[key] ?? "")}
        onChange={(e) => updateAttributes({ [key]: e.target.value })}
        placeholder={hint}
        spellCheck={false}
        autoFocus={auto}
        className={key === "caption" ? styles.figCaption : undefined}
      />
    </label>
  );
  return (
    <NodeViewWrapper
      className={styles.fig}
      data-selected={selected || undefined}
      contentEditable={false}
      onMouseDown={(e: React.MouseEvent) => selectOnPress(e, props)}
      {...ownTaps}
    >
      <span className={styles.figLegend}>YouTube</span>
      <div className={styles.ytBox}>
        {id ? (
          <YouTubePoster id={id} />
        ) : (
          <span className={styles.ytEmpty}>
            {url ? "Not a YouTube link" : "Paste a YouTube link below"}
          </span>
        )}
      </div>
      <span className={styles.figHint}>
        Click-to-load on the page · nothing from YouTube loads until it&apos;s pressed
      </span>
      <div className={styles.figImage}>
        {field("url", "Link", "https://www.youtube.com/watch?v=…", !url)}
        {field("caption", "Caption", "Shown under the video")}
      </div>
    </NodeViewWrapper>
  );
}
