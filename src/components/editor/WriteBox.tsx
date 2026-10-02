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
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { docToMd, mdToDoc } from "@/lib/richtext";
import { useHoverTip } from "../admin/useHoverTip";
import {
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
import PostBody from "../post/PostBody";
import styles from "./Editor.module.css";

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

const titleOf = (info: string) => /title="([^"]*)"/.exec(info)?.[1] ?? "";

function CodeView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const info = String(node.attrs.info ?? "");
  const lang = info.split(/\s+/)[0] ?? "";
  const output = lang === "output" || lang === "console";
  const lines = node.textContent.split("\n").length;
  return (
    <NodeViewWrapper className={`${postStyles.code} ${styles.writeCode}`}>
      <div className={postStyles.codeBar} contentEditable={false}>
        <span>{output ? "Output" : titleOf(info) || (lang ? `snippet.${lang}` : "snippet")}</span>
        <input
          className={styles.writeInfo}
          value={info}
          onChange={(e) => updateAttributes({ info: e.target.value })}
          placeholder='ts title="search.ts"'
          aria-label="Language and file name"
          spellCheck={false}
        />
        <span>
          {lines} {lines === 1 ? "line" : "lines"}
        </span>
        {/* An Output frame joined under this one (two frames in a row always join, on
            the page too): what a run of it printed (EDITOR-SPEC "attach") */}
        {!output && (
          <button
            type="button"
            className={styles.writeAttach}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const pos = getPos();
              if (pos == null) return;
              const at = pos + node.nodeSize;
              const next = editor.state.doc.nodeAt(at);
              if (next?.type.name === "codeBlock") return void editor.commands.focus(at + 1);
              editor
                .chain()
                .insertContentAt(at, { type: "codeBlock", attrs: { info: "output" } })
                .focus(at + 1)
                .run();
            }}
          >
            + Output
          </button>
        )}
      </div>
      <pre className={postStyles.term}>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  );
}

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

function RawView({ node, selected }: NodeViewProps) {
  const src = String(node.attrs.src ?? "");
  return (
    <NodeViewWrapper
      className={styles.writeRaw}
      data-selected={selected || undefined}
      contentEditable={false}
    >
      <span className={styles.writeRawTag}>{kindOf(src)} · edit in Raw .md for now</span>
      <PostBody markdown={src} bare />
    </NodeViewWrapper>
  );
}

// ---------- toolbar ----------

type Tool = {
  label: ReactNode;
  icon?: ReactNode; // on the bar over an iPhone's keyboard, where it reads as iOS
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

const icon = (d: string) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
const ICONS = {
  quote: icon(
    "M10 7H6.5A1.5 1.5 0 0 0 5 8.5V12h5V7Zm0 5c0 3-1.5 4.5-4 5M19 7h-3.5A1.5 1.5 0 0 0 14 8.5V12h5V7Zm0 5c0 3-1.5 4.5-4 5",
  ),
  note: icon("M5 5h14v14H5zM8.5 9.5h7M8.5 12.5h7M8.5 15.5h4"),
  code: icon("m9 7-5 5 5 5M15 7l5 5-5 5"),
  link: icon(
    "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  ),
  table: icon("M4 5h16v14H4zM4 10h16M4 14.5h16M12 10v9"),
  done: icon("M4 8h16M4 12h16M7 16h10M9 19.5l3 2 3-2"),
};

// The link popover lives in WriteBox; the toolbar, the bar over a selection and ⌘K
// reach it through here
const linkOpeners = new WeakMap<TiptapEditor, () => void>();

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
    label: <i>I</i>,
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
    icon: ICONS.quote,
    keys: "⇧⌘.",
    run: (e) => e.chain().focus().toggleBlockquote().run(),
    on: (e) => e.isActive("blockquote"),
  },
  {
    label: "Note",
    name: "Note box",
    icon: ICONS.note,
    keys: "⌥⌘N",
    run: (e) => e.chain().focus().toggleWrap("note").run(),
    on: (e) => e.isActive("note"),
  },
  {
    label: "<>",
    name: "Code — words selected: inline · nothing selected: a code block",
    icon: ICONS.code,
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
    icon: ICONS.link,
    keys: "⌘K",
    run: (e) => linkOpeners.get(e)?.(),
    on: (e) => e.isActive("link"),
  },
  {
    label: "Table",
    name: "Table — Tab moves cell to cell",
    icon: ICONS.table,
    keys: "/table",
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(),
    on: (e) => e.isActive("table"),
  },
  "|",
  { label: "Image", name: "Image — comes with 5.3e", keys: "⇧⌘I", run: () => {} },
  { label: "Clip", name: "Clip — comes with 5.3e", keys: "⇧⌘M", run: () => {} },
  { label: "YouTube", name: "YouTube — comes with 5.3e", keys: "⇧⌘Y", run: () => {} },
];

// Keys from EDITOR-SPEC that Tiptap doesn't give already
const Keys = Extension.create({
  name: "keys",
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-0": () => (plain(this.editor), true),
      "Mod-k": () => (linkOpeners.get(this.editor)?.(), true),
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

function Toolbar({ editor, dock = false }: { editor: TiptapEditor; dock?: boolean }) {
  const zone = useRef<HTMLDivElement>(null);
  useHoverTip(zone);
  // Re-drawn as the caret moves, so the buttons show what it's in
  const on = useEditorState({
    editor,
    // Lit only while you're in the text: unfocused, the caret's place means nothing
    selector: ({ editor: e }) =>
      TOOLS.map((t) => (t !== "|" && t.on && e.isFocused ? t.on(e) : false)),
  });
  return (
    <div
      ref={zone}
      className={dock ? styles.dockTools : styles.writeTools}
      role="toolbar"
      aria-label="Format"
    >
      {TOOLS.map((t, i) =>
        t === "|" ? (
          !dock && <span key={i} className={styles.writeSep} />
        ) : dock && t.name.includes("comes") ? null : (
          <button
            key={t.name}
            type="button"
            className={dock ? styles.dockTool : styles.writeTool}
            data-on={on[i] || undefined}
            data-tip={dock ? undefined : `${t.name} · ${t.keys}`}
            aria-label={t.name}
            aria-pressed={on[i]}
            disabled={t.name.includes("comes")}
            // Keep the caret (and the selection, and the keyboard) in the text
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => t.run(editor)}
          >
            {(dock && t.icon) || t.label}
          </button>
        ),
      )}
    </div>
  );
}

// A touch screen (iPhone, iPad): the toolbar rides on top of the keyboard while you're
// typing, as in Notes, instead of in the row up the page (owner, 2 Oct 69)
const coarse = "(pointer: coarse)";
function useTouch() {
  return useSyncExternalStore(
    (on) => {
      const m = window.matchMedia(coarse);
      m.addEventListener("change", on);
      return () => m.removeEventListener("change", on);
    },
    () => window.matchMedia(coarse).matches,
    () => false,
  );
}

// Shown while the keyboard is up for the text, and gone with it, at the top of what's
// on screen (owner, 2 Oct 69: first it sat on the keys, as in Notes — Safari's own
// bars came between, and with the keyboard up the page's sticky WRITE / RAW row slid
// away). The visual viewport is what's on screen above the keyboard; the bar follows
// its top as the page scrolls. The keyboard counts as up when that's well short of the
// screen; an iPad with its own keyboard plugged in has none on screen, and no bar.
function KeyboardDock({ editor }: { editor: TiptapEditor }) {
  const [focused, setFocused] = useState(false);
  const [keys, setKeys] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let hide = 0;
    // A tap on the bar takes the focus for a moment: hide only if it doesn't come back
    const focus = () => {
      clearTimeout(hide);
      setFocused(true);
    };
    const blur = () => {
      clearTimeout(hide);
      hide = window.setTimeout(() => setFocused(false), 150);
    };
    editor.on("focus", focus);
    editor.on("blur", blur);
    return () => {
      clearTimeout(hide);
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
    place();
    vv.addEventListener("resize", place);
    vv.addEventListener("scroll", place);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", place);
      vv.removeEventListener("scroll", place);
    };
  }, [focused, keys]);
  if (!focused) return null;
  return createPortal(
    <div ref={barRef} className={styles.dock} data-shown={keys || undefined}>
      <Toolbar editor={editor} dock />
      <button
        type="button"
        className={styles.dockDone}
        aria-label="Hide the keyboard"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.commands.blur()}
      >
        {ICONS.done}
      </button>
    </div>,
    document.body,
  );
}

export default function WriteBox({
  body,
  onChange,
  reset,
  modeSwitch,
  targets,
}: {
  body: string;
  onChange: (body: string) => void;
  // Changes when the body changed under you (a save put the images' paths in): the
  // editor reads it again
  reset: number;
  modeSwitch: ReactNode; // WRITE / RAW .MD, first in the sticky row
  targets: LinkTarget[]; // what Link's To field searches
}) {
  // The blank line(s) between the frontmatter and the text, kept as the file had them
  const leadRef = useRef(/^\n*/.exec(body)![0]);
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
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader.extend({ content: "paragraph" }),
      TableCell.extend({ content: "paragraph" }),
      Source,
      Keys,
    ],
    content: mdToDoc(body),
    editorProps: {
      handleKeyDown: (_view, e) => keyRef.current(e),
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
        // Not a form: iOS offers "AutoFill Contact" over the keyboard otherwise
        autocomplete: "off",
      },
    },
    onUpdate: ({ editor: e }) => onChangeRef.current(`${leadRef.current}${docToMd(e.getJSON())}\n`),
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
    return () => void linkOpeners.delete(editor);
  }, [editor]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Read again after a reset
  const seenRef = useRef(reset);
  useEffect(() => {
    if (!editor || reset === seenRef.current) return;
    seenRef.current = reset;
    leadRef.current = /^\n*/.exec(body)![0];
    editor.commands.setContent(mdToDoc(body), { emitUpdate: false });
  }, [editor, reset, body]);

  const touch = useTouch();
  return (
    <>
      <div className={styles.tools}>
        {modeSwitch}
        {editor && !touch && <Toolbar editor={editor} />}
      </div>
      {editor && touch && <KeyboardDock editor={editor} />}
      {editor && !touch && !link && (
        <BubbleBar editor={editor} onLink={() => setLink(linkAt(editor))} />
      )}
      {editor && <TableBar editor={editor} />}
      {editor && link && (
        <LinkPopover editor={editor} edit={link} targets={targets} onClose={() => setLink(null)} />
      )}
      {editor && slash && !link && (
        <SlashMenu editor={editor} slash={slash} pick={pick} onPick={setPick} onRun={runSlash} />
      )}
      <div className={`${postStyles.body} ${styles.write}`}>
        <EditorContent editor={editor} />
      </div>
    </>
  );
}
