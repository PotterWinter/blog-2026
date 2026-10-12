"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useContext, useRef, useState } from "react";
import { fileSize } from "@/lib/format";
import styles from "./Editor.module.css";
import { ImagesContext, ownDrops, ownTaps, selectOnPress } from "./WriteFigure";

// A PDF block (owner, 12 Oct 69 — papers and book notes in Reading): its first page as
// the card on the page shows it, Replace on it; under it File, Title, Caption. The file
// goes up to Vercel Blob on Save (held in the editor until then), its first page into
// git, as a clip's does (lib/clips). Written as an image is: ![title](….pdf "caption").
export const PdfBlock = Node.create({
  name: "pdf",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      src: { default: "", rendered: false }, // "pdf:<key>" until Save, then its path
      alt: { default: "", rendered: false }, // the card's title
      caption: { default: "", rendered: false },
      source: { default: null, rendered: false, keepOnSplit: false }, // its markdown as read
    };
  },
  parseHTML() {
    return [{ tag: "div[data-pdf]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-pdf": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PdfView, ownDrops);
  },
});

const posterUrl = (poster: string) => (/^(https?:|blob:)/.test(poster) ? poster : `/${poster}`);

function PdfView(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props;
  const ctx = useContext(ImagesContext);
  const src = String(node.attrs.src ?? "");
  const entry = ctx?.clip(src);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const name = src
    .replace(/^pdf:/, "")
    .replace(/^.*\//, "")
    .replace(/\.pdf$/, "");
  const replace = async (file?: File) => {
    if (!file || !ctx) return;
    setBusy(true);
    const next = await ctx.addPdf(file);
    setBusy(false);
    // A new PDF with no title yet takes its file's name
    if (next) updateAttributes({ src: next, ...(node.attrs.alt ? {} : { alt: file.name.replace(/\.pdf$/i, "") }) });
  };
  // A file dragged over: the box says what letting go does (as the Image block does)
  const [over, setOver] = useState(false);
  const files = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");
  const drag = {
    onDragOver: (e: React.DragEvent) => {
      if (!files(e) || busy) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Element | null)) setOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!files(e)) return;
      e.preventDefault();
      setOver(false);
      const file = [...e.dataTransfer.files].find((f) => f.type === "application/pdf");
      if (!busy) void replace(file);
    },
  };
  const reading = "Reading the PDF…";
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
      <span className={styles.figLegend}>PDF</span>
      {!src ? (
        // Put in empty from the toolbar or "/"; its file is picked here, as a clip's is
        <div className={styles.figShow}>
          <button
            type="button"
            className={styles.figAdd}
            data-over={over || undefined}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? reading : over ? "Drop to add" : "+ Add PDF"}
          </button>
        </div>
      ) : (
        <div className={styles.figTile} data-over={over || undefined}>
          {entry ? (
            <div className={styles.pdfPreview}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a blob: or repo path */}
              <img src={posterUrl(entry.poster)} alt="" />
            </div>
          ) : (
            <div className={styles.ytBox}>
              <span className={styles.ytEmpty}>{busy ? reading : "PDF not found in media.json"}</span>
            </div>
          )}
          <span className={styles.figPills}>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? reading : "Replace"}
            </button>
          </span>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          void replace(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <span className={styles.clipHint}>
        PDF · max 50 MB · a card on the page: its first page, Open and Download · goes up to Vercel Blob on Save, its
        first page in git
      </span>
      <div className={styles.figImage}>
        {src && (
          <label className={styles.figRow}>
            <span className="label">File</span>
            <span className={styles.figName}>{name}</span>
            <span className={styles.figMeta}>
              {entry ? `${fileSize(entry.bytes)} · ${entry.pages ?? "?"} pages` : ""}
            </span>
          </label>
        )}
        <label className={styles.figRow}>
          <span className="label">Title</span>
          <input
            value={String(node.attrs.alt ?? "")}
            onChange={(e) => updateAttributes({ alt: e.target.value })}
            placeholder="The paper or book, as the card names it"
          />
        </label>
        <label className={styles.figRow}>
          <span className="label">Caption</span>
          <input
            className={styles.figCaption}
            value={String(node.attrs.caption ?? "")}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            placeholder="Optional · authors, venue, year"
          />
        </label>
      </div>
    </NodeViewWrapper>
  );
}
