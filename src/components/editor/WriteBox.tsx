"use client";

import {
  Extension,
  Node,
  mergeAttributes,
  textblockTypeInputRule,
  wrappingInputRule,
} from "@tiptap/core";
import type { Editor as TiptapEditor } from "@tiptap/core";
import CodeBlock from "@tiptap/extension-code-block";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import {
  EditorContent,
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { langLabel } from "@/lib/codeLangs";
import { canonical, known, langOptions, OUTPUT, readInfo, typedName, writeInfo } from "./codeInfo";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { docToMd, mdToDoc } from "@/lib/richtext";
import { useHoverTip } from "../admin/useHoverTip";
import {
  BlockBar,
  BubbleBar,
  LinkPopover,
  SLASH as SLASH_ITEMS,
  SlashMenu,
  TableBar,
  linkAt,
  slashAt,
  slashItems,
  type LinkEdit,
  type LinkTarget,
  type Slash,
} from "./WriteMenus";
import postStyles from "../post/Post.module.css";
import ContentsRail from "../post/ContentsRail";
import PostBody, { headingId, youTubeId } from "../post/PostBody";
import styles from "./Editor.module.css";
import { clipOpeners, imageOpeners, linkOpeners } from "./openers";
import { ClipBlock } from "./WriteClip";
import { Figure, ImagesContext, selectOnPress, type Images } from "./WriteFigure";
import { YouTubeBlock } from "./WriteYouTube";

// WRITE (5.3d, v4 07): the body as the post shows it, typed into directly. Markdown
// typed at the start of a line turns into what it stands for as you type — "## " a
// heading, "> " a quote, "- " a list, "```" code, **bold**, *italic*, `code` — the
// way Obsidian's live preview does (owner, 2 Oct 69). The .md stays the source: every
// change is written back to the body (lib/richtext), and blocks WRITE can't edit yet
// (images, tables, YouTube) are shown as on the page and kept exactly as they are.

// Every block remembers the markdown it came from, so unchanged blocks are written back
// as they were typed (lib/richtext). Not carried into the new block when one is split.
const Source = Extension.create({
  name: "source",
  addGlobalAttributes() {
    return [
      {
        types: [
          "paragraph",
          "heading",
          "blockquote",
          "bulletList",
          "orderedList",
          "codeBlock",
          "horizontalRule",
          "note",
          "table",
        ],
        attributes: { src: { default: null, rendered: false, keepOnSplit: false } },
      },
    ];
  },
});

// "> [!NOTE]" — v4's note box: a grey panel with its label
const Note = Node.create({
  name: "note",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { kind: { default: "NOTE", rendered: false } };
  },
  parseHTML() {
    return [{ tag: "aside[data-note]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes(HTMLAttributes, { "data-note": "" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(NoteView);
  },
  addKeyboardShortcuts() {
    return { "Mod-Alt-n": () => this.editor.commands.toggleWrap(this.name) };
  },
  addInputRules() {
    // "[!NOTE] " at the start of a line
    return [wrappingInputRule({ find: /^\[!NOTE\]\s$/i, type: this.type })];
  },
});

function NoteView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper as="aside" className={postStyles.note}>
      <span className="label" contentEditable={false}>
        {String(node.attrs.kind).toLowerCase()}
      </span>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}

// Fenced code: the 04 frame. The fence's info string ("ts title=\"search.ts\"") is kept
// whole and editable on the grey bar.
const Code = CodeBlock.extend({
  addAttributes() {
    return { info: { default: "", rendered: false } };
  },
  addInputRules() {
    // ``` (and a language, if typed) then space or Enter
    return [
      textblockTypeInputRule({
        find: /^```([^\s`]*)[\s\n]$/,
        type: this.type,
        getAttributes: (match) => ({ info: match[1] ?? "" }),
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeView);
  },
});

// "attach" in a frame's info joins it onto the frame above (EDITOR-SPEC). Only then —
// two frames in a row with nothing said keep their gap (owner, 3 Oct 69). An Output is
// any frame with Output picked as its language; Attach ↑ joins it.

function CodeView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const info = String(node.attrs.info ?? "");
  const parts = readInfo(info);
  const code = canonical(parts.lang);
  const output = code === OUTPUT;
  const joined = parts.attach;
  const put = (next: typeof parts) => updateAttributes({ info: writeInfo(next) });
  // A frame right above: this one can join onto it
  const underCode = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const pos = getPos();
      return pos != null && e.state.doc.resolve(pos).nodeBefore?.type.name === "codeBlock";
    },
  });
  return (
    <NodeViewWrapper className={`${postStyles.code} ${styles.writeCode}`} data-attach={joined || undefined}>
      <div className={postStyles.codeBar} contentEditable={false}>
        {/* As the page's bar reads (owner, 3 Oct 69): the name first, typed in its box,
            the extension after it from the language (an Output's command, none); what it
            is at the right, picked from a list (Output last, Text for none). A name typed
            with an extension the list knows ("app.py"): the language follows on leaving
            the box. */}
        <span className={styles.writeName}>
          {/* A field (owner, 3 Oct 69): on an underline, a pencil before the
              extension; anywhere on it (the extension too) puts the caret in */}
          <label className={styles.writeField}>
          <input
            className={styles.writeInfo}
            value={parts.name}
            onChange={(e) => put({ ...parts, name: e.target.value })}
            onBlur={(e) => {
              const next = typedName(parts, e.target.value.trim());
              if (writeInfo(next) !== info) put(next);
            }}
            placeholder={output ? "command" : "name"}
            aria-label={output ? "Command that printed this" : "File name"}
            // Mono: one ch a letter, so the extension sits right after the last one
            style={{ width: `${Math.max(parts.name.length, output ? 7 : 4) + 0.5}ch` }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
          {/* A pencil: this part is typed in (owner, 3 Oct 69) */}
          <svg className={styles.writePencil} width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true">
            <path d="M8.2 1.8l2 2L4 10H2V8z" />
          </svg>
          {known(code) && <span className={styles.writeExt}>.{code}</span>}
          </label>
        </span>
        <span className={styles.writeLang}>
          <span className={styles.writeLangShown}>{langLabel(parts.lang)}</span>
          <select value={output ? OUTPUT : code} onChange={(e) => put({ ...parts, lang: e.target.value })} aria-label="Language">
            {langOptions(parts.lang).map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
            <option value={OUTPUT}>Output</option>
          </select>
        </span>
        {/* Joined onto the frame above, or not */}
        {underCode && (
          <button
            type="button"
            className={styles.writeAttach}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => put({ ...parts, attach: !joined })}
          >
            {joined ? "Detach ↓" : "Attach ↑"}
          </button>
        )}
      </div>
      <pre className={postStyles.term}>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

// Each heading gets the id the post page gives it (from its words), so the contents
// rail can find it — drawn on, never written into the .md
const HeadingIds = Extension.create({
  name: "headingIds",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (state) => {
            const marks: Decoration[] = [];
            state.doc.forEach((node, pos) => {
              if (node.type.name === "heading" && node.textContent.trim()) {
                marks.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    id: `w-${headingId(node.textContent)}`,
                  }),
                );
              }
            });
            return DecorationSet.create(state.doc, marks);
          },
        },
      }),
    ];
  },
});

// What WRITE can't edit yet: shown as the post shows it, untouched in the .md
const Raw = Node.create({
  name: "raw",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return { src: { default: "", rendered: false } };
  },
  parseHTML() {
    return [{ tag: "div[data-raw]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-raw": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(RawView);
  },
});

const kindOf = (src: string) =>
  /^<!--\s*(two|carousel|fit height|full)/.exec(src)?.[1] === "carousel"
    ? "Carousel"
    : /^<!--/.test(src)
      ? "Images"
      : /^!\[/.test(src)
        ? "Image"
        : /^\|/.test(src)
          ? "Table"
          : /youtu/.test(src)
            ? "YouTube"
            : "Block";

function RawView(props: NodeViewProps) {
  const { node, selected } = props;
  const src = String(node.attrs.src ?? "");
  return (
    <NodeViewWrapper
      className={styles.writeRaw}
      data-selected={selected || undefined}
      contentEditable={false}
      onMouseDown={(e: React.MouseEvent) => selectOnPress(e, props)}
    >
      <span className={styles.writeRawTag}>{kindOf(src)} · edit in Raw .md for now</span>
      <PostBody markdown={src} bare />
    </NodeViewWrapper>
  );
}

// ---------- toolbar ----------

// Italic: a slanted I with a thin bar top and bottom, drawn at the letters' height and
// weight (owner, 3 Oct 69) — the sans' italic I is one stroke that reads as "/", and a
// serif one looked out of place among the rest
function ItalicIcon() {
  return (
    <svg width="0.81em" height="0.75em" viewBox="0 0 13 12" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M8.5 1 4.5 11" strokeWidth="2" />
      <path d="M5 .6h7M1 11.4h7" strokeWidth="1.2" />
    </svg>
  );
}

// Undo / Redo: an arrow that comes round and points left (or right), as in most apps —
// the ↶ ↷ characters turn up and over, and read as up / down (owner, 3 Oct 69)
function TurnIcon({ redo = false }: { redo?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: "middle", transform: redo ? "scaleX(-1)" : undefined }}>
      <path d="M5.5 2 2.5 5l3 3" />
      <path d="M2.5 5h7a4 4 0 0 1 0 8H7" />
    </svg>
  );
}

type Tool = {
  label: ReactNode;
  off?: (e: TiptapEditor) => boolean; // greyed out (nothing to undo)
  name: string;
  keys: string;
  run: (e: TiptapEditor) => void;
  on?: (e: TiptapEditor) => boolean;
};

const plain = (e: TiptapEditor) => {
  const c = e.chain().focus();
  if (e.isActive("note")) c.lift("note");
  if (e.isActive("blockquote")) c.lift("blockquote");
  c.setParagraph().unsetAllMarks().run();
};

const TOOLS: (Tool | "|")[] = [
  {
    label: "T",
    name: "Plain text",
    keys: "⌥⌘0",
    run: plain,
    on: (e) =>
      e.isActive("paragraph") &&
      !e.isActive("blockquote") &&
      !e.isActive("note") &&
      !e.isActive("listItem") &&
      !e.isActive("table"),
  },
  {
    label: <b>B</b>,
    name: "Bold",
    keys: "⌘B",
    run: (e) => e.chain().focus().toggleBold().run(),
    on: (e) => e.isActive("bold"),
  },
  {
    label: <ItalicIcon />,
    name: "Italic",
    keys: "⌘I",
    run: (e) => e.chain().focus().toggleItalic().run(),
    on: (e) => e.isActive("italic"),
  },
  {
    label: "H2",
    name: "Section heading",
    keys: "⌥⌘2",
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    on: (e) => e.isActive("heading", { level: 2 }),
  },
  {
    label: "H3",
    name: "Subheading",
    keys: "⌥⌘3",
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
    on: (e) => e.isActive("heading", { level: 3 }),
  },
  {
    label: "“",
    name: "Pull quote",
    keys: "⇧⌘.",
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    on: (e) => e.isActive("blockquote"),
  },
  {
    label: "Note",
    name: "Note box",
    keys: "⌥⌘N",
    run: (e) => e.chain().focus().toggleWrap("note").run(),
    on: (e) => e.isActive("note"),
  },
  {
    label: "<>",
    name: "Code — words selected: inline · nothing selected: a code block",
    keys: "⌘E",
    run: (e) =>
      e.state.selection.empty && !e.isActive("code")
        ? e.chain().focus().toggleCodeBlock().run()
        : e.chain().focus().toggleCode().run(),
    on: (e) => e.isActive("code") || e.isActive("codeBlock"),
  },
  {
    label: "Link",
    name: "Link — to a post, or a URL",
    keys: "⌘K",
    run: (e) => linkOpeners.get(e)?.(),
    on: (e) => e.isActive("link"),
  },
  {
    label: "Table",
    name: "Table — Tab moves cell to cell",
    keys: "/table",
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    on: (e) => e.isActive("table"),
  },
  "|",
  {
    label: "Image",
    name: "Image — or drop / paste one into the text",
    keys: "⇧⌘I",
    run: (e) => imageOpeners.get(e)?.("single"),
  },
  {
    label: "Clip",
    name: "Clip — MP4 / WebM up to 5 MB, muted on loop",
    keys: "⇧⌘M",
    run: (e) => clipOpeners.get(e)?.(),
  },
  {
    label: "YouTube",
    name: "YouTube — or paste its link on an empty line",
    keys: "⇧⌘Y",
    run: (e) => e.chain().focus().insertContent({ type: "youtube" }).run(),
  },
  "|",
  {
    label: <TurnIcon />,
    name: "Undo",
    keys: "⌘Z",
    run: (e) => e.chain().focus().undo().run(),
    off: (e) => !e.can().undo(),
  },
  {
    label: <TurnIcon redo />,
    name: "Redo",
    keys: "⇧⌘Z",
    run: (e) => e.chain().focus().redo().run(),
    off: (e) => !e.can().redo(),
  },
];

// Keys from EDITOR-SPEC that Tiptap doesn't give already
const Keys = Extension.create({
  name: "keys",
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-0": () => (plain(this.editor), true),
      "Mod-k": () => (linkOpeners.get(this.editor)?.(), true),
      // A block selected: Esc lets go of it, the caret just after
      Escape: () => {
        const sel = this.editor.state.selection as { node?: unknown; to: number };
        return sel.node ? this.editor.commands.setTextSelection(sel.to) : false;
      },
      "Mod-Shift-i": () => (imageOpeners.get(this.editor)?.("single"), true),
      "Mod-Shift-m": () => (clipOpeners.get(this.editor)?.(), true),
      "Mod-Shift-y": () => this.editor.commands.insertContent({ type: "youtube" }),
      "Mod-Shift-.": () => this.editor.commands.toggleBlockquote(),
      "Mod-e": () => {
        const e = this.editor;
        return e.state.selection.empty && !e.isActive("code")
          ? e.commands.toggleCodeBlock()
          : e.commands.toggleCode();
      },
    };
  },
});

// A tap on a button keeps the keyboard up: on iOS the tap's click took the focus from
// the text, so the keyboard dropped and the page jumped at every H3 (owner, 2 Oct 69).
// The tap is acted on at touchend, and its click (and the focus move) cancelled; a
// finger that moved was scrolling the row, and does nothing.
function useTapKeepsFocus(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    let start: { x: number; y: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      start = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
    };
    const up = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const button = (e.target as Element).closest("button");
      if (!start || !button || button.disabled) return;
      if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) return;
      e.preventDefault();
      button.click();
    };
    row.addEventListener("touchstart", down, { passive: true });
    row.addEventListener("touchend", up, { passive: false });
    return () => {
      row.removeEventListener("touchstart", down);
      row.removeEventListener("touchend", up);
    };
  }, [ref]);
}

// `pill`: the phone's floating bar (FormatPill) — the same buttons, those not ready yet
// left out
function Toolbar({ editor, pill = false }: { editor: TiptapEditor; pill?: boolean }) {
  const zone = useRef<HTMLDivElement>(null);
  useHoverTip(zone);
  useTapKeepsFocus(zone);
  // Re-drawn as the caret moves, so the buttons show what it's in
  const state = useEditorState({
    editor,
    // Lit only while you're in the text: unfocused, the caret's place means nothing
    selector: ({ editor: e }) => ({
      on: TOOLS.map((t) => (t !== "|" && t.on && e.isFocused ? t.on(e) : false)),
      off: TOOLS.map((t) => (t !== "|" && t.off ? t.off(e) : false)),
    }),
  });
  return (
    <div
      ref={zone}
      className={pill ? styles.pillTools : styles.writeTools}
      role="toolbar"
      aria-label="Format"
    >
      {TOOLS.map((t, i) =>
        t === "|" ? (
          <span key={i} className={styles.writeSep} />
        ) : pill && t.name.includes("comes") ? null : (
          <button
            key={t.name}
            type="button"
            className={pill ? styles.pillTool : styles.writeTool}
            data-on={state.on[i] || undefined}
            data-tip={pill ? undefined : `${t.name} · ${t.keys}`}
            aria-label={t.name}
            aria-pressed={state.on[i]}
            disabled={t.name.includes("comes") || state.off[i]}
            // Keep the caret (and the selection, and the keyboard) in the text
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => t.run(editor)}
          >
            {t.label}
          </button>
        ),
      )}
    </div>
  );
}

// The phone's WRITE / RAW row: Undo / Redo beside them (owner, 4 Oct 69). The
// keyboard stays down: the text isn't focused for them, as it is from the format bar.
function History({ editor }: { editor: TiptapEditor }) {
  const zone = useRef<HTMLDivElement>(null);
  useTapKeepsFocus(zone);
  const can = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ undo: e.can().undo(), redo: e.can().redo() }),
  });
  return (
    <div ref={zone} className={styles.history}>
      <button
        type="button"
        className={styles.writeTool}
        aria-label="Undo"
        disabled={!can.undo}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.commands.undo()}
      >
        <TurnIcon />
      </button>
      <button
        type="button"
        className={styles.writeTool}
        aria-label="Redo"
        disabled={!can.redo}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.commands.redo()}
      >
        <TurnIcon redo />
      </button>
    </div>
  );
}

// The phone: no format row up the page. While the keyboard is up for the text, the
// format bar sits at the top of what's on screen, glass, following it as the page
// scrolls; the WRITE / RAW row steps aside meanwhile, so the two don't fight over the
// top (owner, 2 Oct 69 — tried after: bars over the keys, which Safari's own bars come
// between, and a floating Aa; this one worked best on the phone). The visual viewport
// is what's on screen above the keyboard. The keyboard counts as up when that's well
// short of the screen. No button of our own to put it away: the keyboard's own does,
// right where the thumb is (owner, 3 Oct 69).
function KeyboardTop({ editor }: { editor: TiptapEditor }) {
  const [focused, setFocused] = useState(false);
  const [keys, setKeys] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let gone = 0;
    // A tap on the bar takes the focus for a moment: let go only if it stays gone
    const focus = () => {
      clearTimeout(gone);
      setFocused(true);
    };
    const blur = () => {
      clearTimeout(gone);
      gone = window.setTimeout(() => setFocused(false), 150);
    };
    editor.on("focus", focus);
    editor.on("blur", blur);
    return () => {
      clearTimeout(gone);
      editor.off("focus", focus);
      editor.off("blur", blur);
    };
  }, [editor]);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!focused || !vv) return;
    let raf = 0;
    const place = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setKeys(window.innerHeight - vv.height * vv.scale > 150);
        const bar = barRef.current;
        if (bar) bar.style.transform = `translateY(${vv.offsetTop}px)`;
      });
    };
    // A finger moving the page: the bar fades out and comes back where it belongs once
    // the page has been still a moment (owner, 3 Oct 69). Following the scroll, it's
    // always a frame behind — Safari says where the screen went only after it went —
    // so it slid and snapped back. A scroll with no finger (Safari bringing the caret
    // into view as you type) just moves it.
    const bar = barRef.current;
    let still = 0;
    let moving = false;
    const settle = () => {
      clearTimeout(still);
      // Moved first, shown after, in the same frame: shown first, it lit up for a
      // frame where it had been before the scroll (a rare flicker, 3 Oct 69)
      still = window.setTimeout(() => {
        moving = false;
        cancelAnimationFrame(raf);
        if (!bar) return;
        bar.style.transform = `translateY(${vv.offsetTop}px)`;
        bar.removeAttribute("data-moving");
        setKeys(window.innerHeight - vv.height * vv.scale > 150);
      }, 180);
    };
    const drag = (e: TouchEvent) => {
      if (e.target instanceof Element && barRef.current?.contains(e.target)) return; // swiping along the bar
      moving = true;
      barRef.current?.setAttribute("data-moving", "");
      settle();
    };
    const scrolled = () => (moving ? settle() : place());
    place();
    vv.addEventListener("resize", place);
    vv.addEventListener("scroll", scrolled);
    window.addEventListener("scroll", scrolled, { passive: true });
    document.addEventListener("touchmove", drag, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(still);
      bar?.removeAttribute("data-moving");
      vv.removeEventListener("resize", place);
      vv.removeEventListener("scroll", scrolled);
      window.removeEventListener("scroll", scrolled);
      document.removeEventListener("touchmove", drag);
    };
  }, [focused, keys]);
  // The WRITE / RAW row steps aside while the bar is up (Editor.module.css)
  const shown = focused && keys;
  useEffect(() => {
    document.documentElement.toggleAttribute("data-keys", shown);
    return () => document.documentElement.removeAttribute("data-keys");
  }, [shown]);
  if (!focused) return null;
  return createPortal(
    <div ref={barRef} className={styles.topBar} data-shown={keys || undefined}>
      <Toolbar editor={editor} pill />
    </div>,
    document.body,
  );
}

// A touch screen (iPhone, iPad): no bar over a selection there — iOS has its own menu
function useMedia(query: string) {
  return useSyncExternalStore(
    (on) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// A click on the rail: the caret to the end of that heading, which flashes grey (the
// page glides there itself). Not by touch — the keyboard would come up over it.
function toHeading(editor: TiptapEditor, id: string) {
  const el = document.getElementById(id);
  if (!el || !editor.view.dom.contains(el)) return;
  el.animate([{ backgroundColor: "var(--surface)" }, { backgroundColor: "transparent" }], {
    duration: 900,
    easing: "ease-out",
  });
  if (window.matchMedia("(pointer: coarse)").matches) return;
  const end = editor.view.state.doc.resolve(editor.view.posAtDOM(el, 0)).end();
  editor.chain().setTextSelection(end).focus(undefined, { scrollIntoView: false }).run();
}

export default function WriteBox({
  body,
  onChange,
  reset,
  modeSwitch,
  targets,
  titles,
  images,
}: {
  body: string;
  onChange: (body: string) => void;
  // Changes when the body changed under you (a save put the images' paths in): the
  // editor reads it again
  reset: number;
  modeSwitch: ReactNode; // WRITE / RAW .MD, first in the sticky row
  targets: LinkTarget[]; // what Link's To field searches
  titles: Record<string, string>; // the site's posts' titles by address (a post linked by address)
  images: Images; // seeing, uploading and naming images (Editor)
}) {
  // The blank line(s) between the frontmatter and the text, kept as the file had them
  const leadRef = useRef(/^\n*/.exec(body)![0]);
  // Posts' titles by address: a link to one reads as its title, written back as its
  // address alone while it still does (richtext)
  const titlesRef = useRef(titles);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  // The link being made or edited, and the "/" menu (WriteMenus)
  const [link, setLink] = useState<LinkEdit | null>(null);
  const [slash, setSlash] = useState<Slash | null>(null);
  const [pick, setPick] = useState(0);
  const slashRef = useRef<{ slash: Slash | null; pick: number; shut: number }>({
    slash: null,
    pick: 0,
    shut: -1,
  });
  useEffect(() => {
    slashRef.current.slash = slash;
    slashRef.current.pick = pick;
  });
  // Where the menu was put away with Esc: it stays away for that "/"
  const readSlash = (e: TiptapEditor) => {
    const found = slashAt(e);
    const next =
      found && found.from !== slashRef.current.shut && slashItems(found.query).length
        ? found
        : null;
    setSlash(next);
    if (!next || next.query !== slashRef.current.slash?.query) setPick(0);
  };
  const keyRef = useRef<(e: KeyboardEvent) => boolean>(() => false);
  const editorRef = useRef<TiptapEditor | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        underline: false, // markdown has no underline
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { class: postStyles.link, target: null, rel: null },
        },
        bulletList: { HTMLAttributes: { class: postStyles.ul } },
        orderedList: { HTMLAttributes: { class: postStyles.ol } },
      }),
      Code,
      Note,
      Raw,
      // Cells hold one paragraph each: a markdown table's cell is one line
      // Each column at least 120px (inline min-width on the table): narrower, a phone
      // broke words mid-letter; past the column the frame scrolls sideways (owner, 4 Oct 69)
      Table.configure({ resizable: false, renderWrapper: true, cellMinWidth: 120 }),
      TableRow,
      TableHeader.extend({ content: "paragraph" }),
      TableCell.extend({ content: "paragraph" }),
      Source,
      Keys,
      HeadingIds,
      Figure,
      YouTubeBlock,
      ClipBlock,
    ],
    content: mdToDoc(body, titles),
    editorProps: {
      handleKeyDown: (_view, e) => keyRef.current(e),
      handlePaste: (view, e) => {
        // A YouTube link pasted on an empty line: the video's block
        const text = e.clipboardData?.getData("text/plain").trim() ?? "";
        const { $from, empty } = view.state.selection;
        if (
          empty &&
          youTubeId(text) &&
          $from.parent.type.name === "paragraph" &&
          !$from.parent.textContent
        ) {
          editorRef.current
            ?.chain()
            .insertContent({ type: "youtube", attrs: { url: text } })
            .run();
          return true;
        }
        const files = [...(e.clipboardData?.files ?? [])].filter((f) =>
          /^(image|video)\//.test(f.type),
        );
        if (!files.length) return false;
        void insertRef.current(files);
        return true;
      },
      handleDrop: (view, e) => {
        const files = [...(e.dataTransfer?.files ?? [])].filter((f) =>
          /^(image|video)\//.test(f.type),
        );
        if (!files.length) return false;
        e.preventDefault();
        const at = view.posAtCoords({ left: e.clientX, top: e.clientY });
        void insertRef.current(files, at?.pos);
        return true;
      },
      // A click on a link opens it in the popover: edit or remove it
      handleClick: (view, pos, e) => {
        const mark = view.state.doc
          .resolve(pos)
          .marks()
          .find((m) => m.type.name === "link");
        if (!mark || !(e.target as Element).closest("a")) return false;
        requestAnimationFrame(() => linkOpeners.get(editorRef.current!)?.());
        return false;
      },
      attributes: {
        class: `${postStyles.prose} ${styles.writeText}`,
        "aria-label": "Body",
        "data-rail-text": "", // where the contents rail reads the headings
        // Not a form: iOS offers "AutoFill Contact" over the keyboard otherwise
        autocomplete: "off",
      },
    },
    onUpdate: ({ editor: e }) => onChangeRef.current(`${leadRef.current}${docToMd(e.getJSON(), titlesRef.current)}\n`),
    onSelectionUpdate: ({ editor: e }) => readSlash(e),
    onTransaction: ({ editor: e, transaction }) => {
      if (transaction.docChanged) readSlash(e);
    },
    onBlur: () => setSlash(null),
  });
  const runSlash = (item: (typeof SLASH_ITEMS)[number]) => {
    const s = slashRef.current.slash;
    if (!editor || !s || item.later || !item.run) return;
    editor.chain().focus().deleteRange({ from: s.from, to: s.to }).run();
    item.run(editor);
    setSlash(null);
  };
  // ↑ ↓ Enter Tab Esc steer the "/" menu while it's open
  useEffect(() => {
    keyRef.current = (e: KeyboardEvent) => {
      const { slash: s, pick: p } = slashRef.current;
      if (!s) return false;
      const items = slashItems(s.query);
      const ok = items.map((it, i) => (it.later ? -1 : i)).filter((i) => i >= 0);
      if (!ok.length) return false;
      const step = (d: number) => {
        const at = ok.indexOf(p);
        setPick(ok[(at + d + ok.length) % ok.length] ?? ok[0]);
      };
      if (e.key === "ArrowDown") return (step(1), true);
      if (e.key === "ArrowUp") return (step(-1), true);
      if (e.key === "Enter" || e.key === "Tab") {
        runSlash(items[ok.includes(p) ? p : ok[0]]);
        return true;
      }
      if (e.key === "Escape") {
        slashRef.current.shut = s.from;
        setSlash(null);
        return true;
      }
      return false;
    };
  });
  useEffect(() => {
    if (!editor) return;
    linkOpeners.set(editor, () => setLink(linkAt(editor)));
    // The block goes in at the caret straight away, empty; its images are picked in it
    // (owner, 4 Oct 69 — it used to wait for a file before showing)
    imageOpeners.set(editor, (layout) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "figure",
          attrs: { layout, ratio: layout === "two" ? "4:5" : "", images: [] },
        })
        .run();
    });
    // The same for a clip: the block first, empty (owner, 4 Oct 69)
    clipOpeners.set(editor, () => {
      editor.chain().focus().insertContent({ type: "clip", attrs: { src: "" } }).run();
    });
    return () => {
      linkOpeners.delete(editor);
      imageOpeners.delete(editor);
      clipOpeners.delete(editor);
    };
  }, [editor]);

  // Images picked, dropped or pasted: uploaded (made WebP, held until Save), then one
  // Image block where the caret is — several at once become a carousel
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  });
  const insertImages = async (
    files: File[],
    at?: number,
    want: "single" | "two" | "carousel" = "single",
  ) => {
    if (!editor) return;
    // Videos: each its own Clip block, held for Save (5.4d)
    for (const file of files.filter((f) => f.type.startsWith("video/"))) {
      const src = await imagesRef.current.addClip(file);
      if (!src) continue;
      const node = { type: "clip", attrs: { src } };
      const chain = editor.chain().focus();
      (at != null ? chain.insertContentAt(at, node) : chain.insertContent(node)).run();
    }
    const picked = files.filter((f) => f.type.startsWith("image/"));
    if (!picked.length) return;
    const srcs = await imagesRef.current.add(picked);
    if (!srcs.length) return;
    const wanted = want;
    const layout = wanted !== "single" ? wanted : srcs.length > 1 ? "carousel" : "single";
    const list = (
      layout === "single" ? srcs.slice(0, 1) : layout === "two" ? srcs.slice(0, 2) : srcs
    ).map((src) => ({ src, alt: "", caption: "" }));
    const node = {
      type: "figure",
      attrs: { layout, ratio: layout === "two" ? "4:5" : "", images: list },
    };
    const chain = editor.chain().focus();
    (at != null ? chain.insertContentAt(at, node) : chain.insertContent(node)).run();
  };
  const insertRef = useRef(insertImages);
  useEffect(() => {
    insertRef.current = insertImages;
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Read again after a reset
  const seenRef = useRef(reset);
  useEffect(() => {
    if (!editor || reset === seenRef.current) return;
    seenRef.current = reset;
    leadRef.current = /^\n*/.exec(body)![0];
    editor.commands.setContent(mdToDoc(body, titlesRef.current), { emitUpdate: false });
  }, [editor, reset, body]);

  const touch = useMedia("(pointer: coarse)");
  const phone = useMedia("(max-width: 767px)");
  return (
    <>
      <div className={styles.tools}>
        {modeSwitch}
        {editor && !phone && <Toolbar editor={editor} />}
        {editor && phone && <History editor={editor} />}
      </div>
      {editor && phone && <KeyboardTop editor={editor} />}
      {editor && !touch && !link && (
        <BubbleBar editor={editor} onLink={() => setLink(linkAt(editor))} />
      )}
      {editor && <TableBar editor={editor} />}
      {editor && <BlockBar editor={editor} />}
      {editor && link && (
        <LinkPopover editor={editor} edit={link} targets={targets} titles={titles} onClose={() => setLink(null)} />
      )}
      {editor && slash && !link && (
        <SlashMenu editor={editor} slash={slash} pick={pick} onPick={setPick} onRun={runSlash} />
      )}
      {/* As on the post page: the text in its column, the contents rail at the right,
          built from the headings as they're typed (EDITOR-SPEC) */}
      <div className={`${postStyles.railZone} ${styles.writeZone}`} data-post>
        <div className={`${postStyles.body} ${styles.write}`}>
          <ImagesContext.Provider value={images}>
            <EditorContent editor={editor} />
          </ImagesContext.Provider>
        </div>
        {editor && <ContentsRail live ends={false} onJump={(id) => toHeading(editor, id)} />}
      </div>
    </>
  );
}
