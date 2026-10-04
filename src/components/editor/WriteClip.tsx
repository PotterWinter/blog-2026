"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useContext, useRef, useState } from "react";
import styles from "./Editor.module.css";
import { ImagesContext, ownDrops, ownTaps, selectOnPress } from "./WriteFigure";

// 5.4d Clip block (v4 07 "CLIP"): the clip playing muted on loop as on the page, Replace
// on it; under it what a clip may be, then File, Alt text, Caption. The file is in
// Vercel Blob from the moment it's picked; the post points at it on Save (lib/clips).
export const ClipBlock = Node.create({
  name: "clip",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      src: { default: "", rendered: false }, // "clip:<key>" until Save, then its path
      alt: { default: "", rendered: false },
      caption: { default: "", rendered: false },
      source: { default: null, rendered: false, keepOnSplit: false }, // its markdown as read
    };
  },
  parseHTML() {
    return [{ tag: "div[data-clip]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-clip": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ClipView, ownDrops);
  },
});

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function ClipView(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props;
  const ctx = useContext(ImagesContext);
  const src = String(node.attrs.src ?? "");
  const entry = ctx?.clip(src);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const name = src
    .replace(/^clip:/, "")
    .replace(/^.*\//, "")
    .replace(/\.(mp4|webm)$/, "");
  const replace = async (file?: File) => {
    if (!file || !ctx) return;
    setBusy(true);
    const next = await ctx.addClip(file);
    setBusy(false);
    if (next) updateAttributes({ src: next });
  };
  // A video dragged over: the box says what letting go does (as the Image block does)
  const [over, setOver] = useState(false);
  const videos = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");
  const drag = {
    onDragOver: (e: React.DragEvent) => {
      if (!videos(e) || busy) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Element | null)) setOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!videos(e)) return;
      e.preventDefault();
      setOver(false);
      const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("video/"));
      if (!busy) void replace(file);
    },
  };
  return (
    <NodeViewWrapper
      className={styles.fig}
      data-selected={selected || undefined}
      data-over={over || undefined}
      contentEditable={false}
      onMouseDown={(e: React.MouseEvent) => selectOnPress(e, props)}
      {...ownTaps}
      {...drag}
    >
      <span className={styles.figLegend}>Clip</span>
      {!src ? (
        // Put in empty from the toolbar, "/" or ⇧⌘M; its clip is picked here (owner, 4 Oct
        // 69 — as the Image block)
        <div className={styles.figShow}>
          <button
            type="button"
            className={styles.figAdd}
            data-over={over || undefined}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Uploading…" : over ? "Drop to add" : "+ Add clip"}
          </button>
        </div>
      ) : (
        <div className={styles.figTile} data-over={over || undefined}>
          {entry ? (
            <video
              key={entry.url}
              className={styles.clipVideo}
              src={entry.url}
              poster={/^(https?:|blob:)/.test(entry.poster) ? entry.poster : `/${entry.poster}`}
              muted
              loop
              playsInline
              autoPlay
            />
          ) : (
            <div className={styles.ytBox}>
              <span className={styles.ytEmpty}>
                {busy ? "Uploading…" : "Clip not found in media.json"}
              </span>
            </div>
          )}
          <span className={styles.figPills}>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? "Uploading…" : "Replace"}
            </button>
          </span>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/webm"
        hidden
        onChange={(e) => {
          void replace(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <span className={styles.clipHint}>
        MP4 / WebM · plays muted on loop · max 5 MB · stored in Vercel Blob, its first frame in git
      </span>
      <div className={styles.figImage}>
        {src && (
          <label className={styles.figRow}>
            <span className="label">File</span>
            <span className={styles.figName}>{name}</span>
            <span className={styles.figMeta}>
              {entry
                ? `${mb(entry.bytes)} · ${entry.seconds.toFixed(1)}s · ${entry.width} × ${entry.height}`
                : ""}
            </span>
          </label>
        )}
        <label className={styles.figRow}>
          <span className="label">Alt text</span>
          <input
            value={String(node.attrs.alt ?? "")}
            onChange={(e) => updateAttributes({ alt: e.target.value })}
            placeholder="What happens in the clip, for screen readers"
          />
        </label>
        <label className={styles.figRow}>
          <span className="label">Caption</span>
          <input
            className={styles.figCaption}
            value={String(node.attrs.caption ?? "")}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            placeholder="Optional · shown under the clip"
          />
        </label>
      </div>
    </NodeViewWrapper>
  );
}
