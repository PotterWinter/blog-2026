"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { createContext, useContext, useRef, useState } from "react";
import type { ClipEntry } from "@/lib/clips";
import type { FigureImage, Layout } from "@/lib/richtext";
import Segmented from "../Segmented";
import styles from "./Editor.module.css";

// 5.3e Image block (v4 07 "IMAGE"): the images as the post lays them out, each with
// Replace / Remove on it; under them SINGLE · TWO · CAROUSEL and that layout's options,
// then each image's File, Alt text and Caption. Written to the .md as PostBody reads it
// (lib/richtext figureMd).

// What the block needs from the editor: where an image can be seen before it's saved,
// uploading a picked file, renaming one still waiting for Save
export type Images = {
  url: (src: string) => string;
  // A waiting image: its name (typed over here), size; null once it's committed
  waiting: (src: string) => { name: string; width: number; height: number } | null;
  add: (files: File[]) => Promise<string[]>; // → "upload:<key>" each
  rename: (src: string, typed: string) => void;
  // Clips (5.4d): where one is ("clip:<key>" waiting, or its saved path), and uploading one
  clip: (src: string) => ClipEntry | undefined;
  // → "clip:<key>"; the cover's poster is named "cover-<name>" as a cover image is
  addClip: (file: File, role?: "cover" | "image") => Promise<string | null>;
};
export const ImagesContext = createContext<Images | null>(null);

// A press on a block (not on its fields or buttons) selects it: its border goes black
// and the bar to delete it rises (WriteMenus BlockBar)
// A block's own controls — its layout buttons, its fields — are its own: the editor
// leaves their presses alone. It took them too: a press on FIT selected the block, put
// the caret in, and up came the phone's keyboard, the page sliding to it (owner,
// 4 Oct 69). For each block's node view.
export const ownControls = {
  stopEvent: ({ event }: { event: Event }) =>
    event.target instanceof Element && !!event.target.closest("input, textarea, select, button, label"),
};

// A finger on a block's button (FIT, FULL, Two, Replace…): on iOS, the lift focuses the
// editor around it — up came the keyboard, the page sliding to the caret (owner, 4 Oct
// 69; stopEvent alone didn't stop it). A tap — not a scroll — is answered here instead:
// the lift held back, the button pressed. As the toolbar's buttons are (WriteBox).
const tapStart = new WeakMap<Element, { x: number; y: number }>();
export const ownTaps = {
  onTouchStart: (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (e.touches.length === 1) tapStart.set(e.currentTarget, { x: t.clientX, y: t.clientY });
    else tapStart.delete(e.currentTarget);
  },
  onTouchEnd: (e: React.TouchEvent) => {
    const start = tapStart.get(e.currentTarget);
    tapStart.delete(e.currentTarget);
    const button = (e.target as Element).closest("button");
    if (!start || !button || button.disabled || !e.currentTarget.contains(button)) return;
    const t = e.changedTouches[0];
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) return;
    e.preventDefault();
    button.click();
  },
};

// ...and files dragged onto a block are its own too (the Image and Clip blocks take them
// in): the editor would put them in a new block beside it
export const ownDrops = {
  stopEvent: ({ event }: { event: Event }) =>
    ownControls.stopEvent({ event }) ||
    (event instanceof DragEvent && !!event.dataTransfer?.types.includes("Files")),
};

export function selectOnPress(e: React.MouseEvent, props: Pick<NodeViewProps, "editor" | "getPos">) {
  if ((e.target as Element).closest("input, button, textarea, select, a")) return;
  const pos = props.getPos();
  if (pos == null) return;
  e.preventDefault();
  props.editor.commands.setNodeSelection(pos);
}

const LAYOUTS: Record<"single" | "two" | "carousel", { value: string; label: string }[]> = {
  single: [
    { value: "single", label: "Fit" },
    { value: "full", label: "Full" },
  ],
  two: [
    { value: "4:5", label: "4:5" },
    { value: "16:10", label: "16:10" },
  ],
  // 4:5 first, as for Two (owner, 4 Oct 69); 16:10 is still the default
  carousel: [
    { value: "4:5", label: "4:5" },
    { value: "", label: "16:10" },
  ],
};

// What each layout is, and the size to upload for it (EDITOR-SPEC)
const hint = (layout: Layout, ratio: string) =>
  layout === "single"
    ? "Fit · touches the column's width or the tallest height, whole · upload ≥ 1760 px wide"
    : layout === "fit height"
      ? "Fit · touches the column's width or the tallest height, whole"
      : layout === "full"
        ? "Full · fills the column at the tallest height, cropped to it · upload ≥ 1760 px wide"
        : layout === "two"
          ? `Two up · upload ${ratio === "16:10" ? "864 × 540" : "864 × 1080"} (${ratio || "4:5"})`
          : `Carousel · one slide at a time · upload ${ratio === "4:5" ? "896 × 1120" : "1760 × 1100"}`;

export const Figure = Node.create({
  name: "figure",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      layout: { default: "single", rendered: false },
      ratio: { default: "", rendered: false },
      images: { default: [], rendered: false },
      src: { default: null, rendered: false, keepOnSplit: false },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-figure]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-figure": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureView, ownDrops);
  },
});

function FigureView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const ctx = useContext(ImagesContext);
  const layout = node.attrs.layout as Layout;
  const ratio = String(node.attrs.ratio ?? "");
  const images = (node.attrs.images ?? []) as FigureImage[];
  const kind = layout === "two" ? "two" : layout === "carousel" ? "carousel" : "single";
  const fileRef = useRef<HTMLInputElement>(null);
  // Which slot a picked file goes to: an index to replace, or -1 to add
  const [slot, setSlot] = useState(-1);
  const [busy, setBusy] = useState(false);

  const setImages = (next: FigureImage[]) => {
    if (!next.length) deleteNode();
    else updateAttributes({ images: next });
  };
  const edit = (i: number, patch: Partial<FigureImage>) =>
    setImages(images.map((im, k) => (k === i ? { ...im, ...patch } : im)));
  const pick = (at: number) => {
    setSlot(at);
    fileRef.current?.click();
  };
  // Picked or dropped: into slot `at` (replacing it), or -1 added — as many as there's
  // room for
  const room = kind === "two" ? images.length < 2 : kind === "carousel" || !images.length;
  const put = async (files: File[], at: number) => {
    const space = kind === "carousel" ? files.length : (kind === "two" ? 2 : 1) - images.length;
    const take = files.filter((f) => f.type.startsWith("image/")).slice(0, at >= 0 ? 1 : space);
    if (!ctx || !take.length) return;
    setBusy(true);
    const srcs = await ctx.add(take);
    setBusy(false);
    if (!srcs.length) return;
    if (at >= 0) edit(at, { src: srcs[0] });
    else setImages([...images, ...srcs.map((src) => ({ src, alt: "", caption: "" }))]);
  };
  const picked = (files: File[]) => put(files, slot);

  // A file dragged over the block: where it would land lights up — a slot to replace,
  // or the add box (owner, 4 Oct 69: "ready for it before you let go")
  const [over, setOver] = useState<number | null>(null);
  const target = (e: React.DragEvent) => {
    const t = (e.target as Element).closest<HTMLElement>("[data-slot]");
    if (t) return Number(t.dataset.slot);
    return room ? -1 : kind === "two" ? 1 : 0; // full: the last one gives way
  };
  const files = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");
  const drag = {
    onDragOver: (e: React.DragEvent) => {
      if (!files(e) || busy) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setOver(target(e));
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Element | null)) setOver(null);
    },
    onDrop: (e: React.DragEvent) => {
      if (!files(e)) return;
      e.preventDefault();
      setOver(null);
      if (!busy) void put([...e.dataTransfer.files], target(e));
    },
  };
  const setKind = (k: string) => {
    // The ratio goes along between Two and Carousel, so switching back and forth keeps
    // it; from one image, 4:5 (owner, 4 Oct 69). Written as each says it: Two's "" is
    // 4:5, Carousel's "" is 16:10.
    const now = kind === "two" ? ratio || "4:5" : kind === "carousel" ? ratio || "16:10" : "4:5";
    // Two keeps the first two; going back to one keeps the first
    if (k === "single")
      updateAttributes({ layout: "single", ratio: "", images: images.slice(0, 1) });
    else if (k === "two")
      updateAttributes({ layout: "two", ratio: now, images: images.slice(0, 2) });
    else updateAttributes({ layout: "carousel", ratio: now === "16:10" ? "" : "4:5" });
  };
  const option = kind === "single" ? layout : ratio;
  const setOption = (v: string) =>
    kind === "single" ? updateAttributes({ layout: v, ratio: "" }) : updateAttributes({ ratio: v });

  const tile = (im: FigureImage, i: number) => (
    <div key={i} className={styles.figTile} data-slot={i} data-over={over === i || undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a preview, its own size */}
      <img src={ctx?.url(im.src) ?? im.src} alt={im.alt} />
      <span className={styles.figPills}>
        <button type="button" onClick={() => pick(i)}>
          Replace
        </button>
        <button
          type="button"
          data-danger
          onClick={() => setImages(images.filter((_, k) => k !== i))}
        >
          Remove
        </button>
      </span>
    </div>
  );

  return (
    <NodeViewWrapper
      className={styles.fig}
      data-selected={selected || undefined}
      data-over={over != null || undefined}
      contentEditable={false}
      {...ownTaps}
      {...drag}
    >
      <span className={styles.figLegend}>{kind === "carousel" ? "Carousel" : "Image"}</span>
      <div className={styles.figShow} data-layout={layout} data-ratio={ratio || undefined}>
        {images.map(tile)}
        {room && (
          <button
            type="button"
            className={styles.figAdd}
            data-over={over === -1 || undefined}
            disabled={busy}
            onClick={() => pick(-1)}
          >
            {busy
              ? "Uploading…"
              : over === -1
                ? "Drop to add"
                : kind === "carousel"
                  ? "+ Add slide"
                  : "+ Add image"}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple={slot < 0}
        hidden
        onChange={(e) => {
          void picked([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      <div className={styles.figControls}>
        <Segmented
          label="Layout"
          options={[
            { value: "single", label: "Single" },
            { value: "two", label: "Two" },
            { value: "carousel", label: "Carousel" },
          ]}
          value={kind}
          onChange={setKind}
        />
        <Segmented label="Fit" options={LAYOUTS[kind]} value={option} onChange={setOption} />
        <span className={styles.figHint}>{hint(layout, ratio)}</span>
      </div>
      <div className={styles.figFields} data-cols={kind === "two" ? 2 : 1}>
        {images.map((im, i) => (
          <ImageFields
            key={i}
            image={im}
            n={kind === "carousel" ? i + 1 : null}
            onChange={(p) => edit(i, p)}
          />
        ))}
      </div>
    </NodeViewWrapper>
  );
}

function ImageFields({
  image,
  n,
  onChange,
}: {
  image: FigureImage;
  n: number | null; // a carousel's slide number
  onChange: (patch: Partial<FigureImage>) => void;
}) {
  const ctx = useContext(ImagesContext);
  const waiting = ctx?.waiting(image.src) ?? null;
  const name = image.src.replace(/^.*\//, "").replace(/\.webp$/, "");
  const [typed, setTyped] = useState<string | null>(null);
  return (
    <div className={styles.figImage}>
      <label className={styles.figRow}>
        <span className="label">{n ? `Slide ${n}` : "File"}</span>
        {waiting ? (
          // Named before Save (5.4b): typed here, settled when you leave the field
          <input
            value={typed ?? waiting.name}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={() => {
              if (typed != null && typed !== waiting.name) ctx?.rename(image.src, typed);
              setTyped(null);
            }}
            spellCheck={false}
          />
        ) : (
          <span className={styles.figName}>{name}</span>
        )}
        <span className={styles.figMeta}>
          .webp{waiting ? ` ${waiting.width} × ${waiting.height}` : ""}
        </span>
      </label>
      <label className={styles.figRow}>
        <span className="label">Alt text</span>
        <input
          value={image.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="Describe the image for screen readers"
        />
      </label>
      <label className={styles.figRow}>
        <span className="label">Caption</span>
        <input
          className={styles.figCaption}
          value={image.caption}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder="Optional · shown under the image"
        />
      </label>
    </div>
  );
}
