"use client";

import type { Editor as TiptapEditor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Editor.module.css";
import { clipOpeners, imageOpeners } from "./openers";

// WRITE's floating pieces (5.3d, EDITOR-SPEC): the link popover, the black bar over a
// selection, and the "/" menu. Each is drawn on the page (a portal into body) at the
// text it's about, in page coordinates, so it scrolls with the text.

// A post the To field can find: published ones, linked by their address
export type LinkTarget = { title: string; href: string; section: "blog" | "project" };

const pagePoint = (editor: TiptapEditor, pos: number) => {
  const c = editor.view.coordsAtPos(pos);
  return {
    left: c.left + window.scrollX,
    top: c.top + window.scrollY,
    bottom: c.bottom + window.scrollY,
  };
};

// Kept inside the screen's width, 12px from either edge
function useClamp(ref: React.RefObject<HTMLElement | null>, left: number, deps: unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const max = window.scrollX + document.documentElement.clientWidth - el.offsetWidth - 12;
    el.style.left = `${Math.max(window.scrollX + 12, Math.min(left, max))}px`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- placed again when what it shows changes
  }, deps);
}

// ---------- Link (⌘K) ----------

export type LinkEdit = { from: number; to: number; text: string; href: string; existing: boolean };

// The link under the caret or the selection, or the words selected (EDITOR-SPEC: Text
// defaults to the selection)
export function linkAt(editor: TiptapEditor): LinkEdit {
  const { state } = editor;
  if (editor.isActive("link")) {
    editor.commands.extendMarkRange("link");
    const { from, to } = editor.state.selection;
    return {
      from,
      to,
      text: editor.state.doc.textBetween(from, to),
      href: String(editor.getAttributes("link").href ?? ""),
      existing: true,
    };
  }
  const { from, to } = state.selection;
  return { from, to, text: state.doc.textBetween(from, to), href: "", existing: false };
}

const isUrl = (s: string) => /^(https?:\/\/|mailto:|\/)/.test(s.trim());

export function LinkPopover({
  editor,
  edit,
  targets,
  onClose,
}: {
  editor: TiptapEditor;
  edit: LinkEdit;
  targets: LinkTarget[];
  onClose: () => void;
}) {
  const [text, setText] = useState(edit.text);
  const [to, setTo] = useState(edit.href);
  const [pick, setPick] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const at = pagePoint(editor, edit.from);
  useClamp(boxRef, at.left - 12, [at.left]);

  // To: typed words search the posts (internal, same tab); a URL is taken as it is
  const query = to.trim().toLowerCase();
  const found =
    query && !isUrl(to)
      ? targets.filter((t) => t.title.toLowerCase().includes(query)).slice(0, 6)
      : [];

  useEffect(() => {
    // Text given (words were selected): straight to To
    (edit.text ? toRef.current : boxRef.current?.querySelector("input"))?.focus();
  }, [edit.text]);

  const apply = (href: string) => {
    const words = text || href;
    const chain = editor
      .chain()
      .focus()
      .insertContentAt(
        { from: edit.from, to: edit.to },
        words
          ? { type: "text", text: words, marks: href ? [{ type: "link", attrs: { href } }] : [] }
          : [],
      );
    chain.run();
    onClose();
  };
  const remove = () => {
    editor.chain().focus().setTextSelection({ from: edit.from, to: edit.to }).unsetLink().run();
    onClose();
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      editor.commands.focus();
      onClose();
    } else if (e.key === "ArrowDown" && found.length) {
      e.preventDefault();
      setPick((p) => (p + 1) % found.length);
    } else if (e.key === "ArrowUp" && found.length) {
      e.preventDefault();
      setPick((p) => (p - 1 + found.length) % found.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      apply(found.length ? found[pick].href : to.trim());
    }
  };

  // A press outside closes it, as Esc does
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [onClose]);

  return createPortal(
    <div ref={boxRef} className={styles.pop} style={{ top: at.bottom + 8 }} onKeyDown={key}>
      <label className={styles.popRow}>
        <span className="label">Text</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Underlined words"
        />
      </label>
      <label className={styles.popRow}>
        <span className="label">To</span>
        <input
          ref={toRef}
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPick(0);
          }}
          placeholder="Search posts, or paste a URL"
          spellCheck={false}
        />
      </label>
      {found.length > 0 && (
        <div className={styles.popList} role="listbox">
          {found.map((t, i) => (
            <button
              key={t.href}
              type="button"
              role="option"
              aria-selected={i === pick}
              data-on={i === pick || undefined}
              onMouseEnter={() => setPick(i)}
              onClick={() => apply(t.href)}
            >
              <span>{t.title}</span>
              <span className={styles.popHint}>{t.href}</span>
            </button>
          ))}
        </div>
      )}
      <div className={styles.popFoot}>
        <span className={styles.popHint}>
          {found.length
            ? "↑↓ · Enter links it"
            : isUrl(to) && /^https?:/.test(to)
              ? "Opens in a new tab ↗"
              : "Enter applies · Esc"}
        </span>
        {edit.existing && (
          <button type="button" className={styles.popRemove} onClick={remove}>
            Remove link
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ---------- the bar over a selection ----------

// Words selected (with a mouse): a black bar over them — B · I · Code · Link
export function BubbleBar({ editor, onLink }: { editor: TiptapEditor; onLink: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const { from, to, empty } = e.state.selection;
      const show =
        e.isFocused &&
        !empty &&
        !e.isActive("codeBlock") &&
        e.state.doc.textBetween(from, to).trim() !== "";
      return {
        show,
        from,
        to,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        code: e.isActive("code"),
        link: e.isActive("link"),
      };
    },
  });
  const barRef = useRef<HTMLDivElement>(null);
  // Not while the mouse is still dragging out the selection
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (editor.view.dom.contains(e.target as Node)) setHeld(true);
    };
    const up = () => setHeld(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointerup", up);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointerup", up);
    };
  }, [editor]);
  const a = state.show ? pagePoint(editor, state.from) : null;
  const b = state.show ? pagePoint(editor, state.to) : null;
  const mid = a && b ? (a.top === b.top ? (a.left + b.left) / 2 : a.left + 60) : 0;
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el || !a) return;
    const max = window.scrollX + document.documentElement.clientWidth - el.offsetWidth - 12;
    el.style.left = `${Math.max(window.scrollX + 12, Math.min(mid - el.offsetWidth / 2, max))}px`;
  });
  if (!state.show || held || !a) return null;
  const btn = (label: ReactNode, name: string, on: boolean, run: () => void) => (
    <button
      type="button"
      aria-label={name}
      data-on={on || undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {label}
    </button>
  );
  return createPortal(
    <div
      ref={barRef}
      className={styles.bubble}
      style={{ top: a.top - 46 }}
      role="toolbar"
      aria-label="Selection"
    >
      {btn(<b>B</b>, "Bold", state.bold, () => editor.chain().focus().toggleBold().run())}
      {btn(<i>I</i>, "Italic", state.italic, () => editor.chain().focus().toggleItalic().run())}
      {btn("Code", "Inline code", state.code, () => editor.chain().focus().toggleCode().run())}
      {btn("Link", "Link", state.link, onLink)}
    </div>,
    document.body,
  );
}

// ---------- the "/" menu ----------

type SlashItem = {
  label: string;
  hint: string;
  later?: boolean; // comes with 5.3e
  run?: (e: TiptapEditor) => void;
};

export const SLASH: SlashItem[] = [
  {
    label: "Heading",
    hint: "## · 01",
    run: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
  },
  {
    label: "Subheading",
    hint: "### · 01.1",
    run: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
  },
  { label: "Image", hint: "or drop / paste one", run: (e) => imageOpeners.get(e)?.("single") },
  { label: "Two images", hint: "side by side", run: (e) => imageOpeners.get(e)?.("two") },
  { label: "Carousel", hint: "one slide at a time", run: (e) => imageOpeners.get(e)?.("carousel") },
  { label: "Clip", hint: "MP4 / WebM · 5 MB", run: (e) => clipOpeners.get(e)?.() },
  {
    label: "YouTube",
    hint: "or paste its link",
    run: (e) => e.chain().focus().insertContent({ type: "youtube" }).run(),
  },
  { label: "Code block", hint: "```", run: (e) => e.chain().focus().setCodeBlock().run() },
  {
    label: "Quote",
    hint: "> · pull quote",
    run: (e) => e.chain().focus().setParagraph().wrapIn("blockquote").run(),
  },
  { label: "Numbered list", hint: "1.", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "Bullet list", hint: "-", run: (e) => e.chain().focus().toggleBulletList().run() },
  {
    label: "Note",
    hint: "> [!NOTE]",
    run: (e) => e.chain().focus().setParagraph().wrapIn("note").run(),
  },
  { label: "Divider", hint: "---", run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    label: "Output",
    hint: "joins the code above",
    run: (e) =>
      e.chain().focus().setCodeBlock().updateAttributes("codeBlock", { info: "output" }).run(),
  },
  {
    label: "Table",
    hint: "Tab moves cell to cell",
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(),
  },
];

export type Slash = { from: number; to: number; query: string };

// "/" typed at a line's start or after a space, and what's been typed since
export function slashAt(editor: TiptapEditor): Slash | null {
  const { selection } = editor.state;
  if (!selection.empty || editor.isActive("codeBlock")) return null;
  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
  const m = /(?:^|\s)\/([^\s/]{0,24})$/.exec(before);
  if (!m) return null;
  const to = selection.from;
  return { from: to - m[1].length - 1, to, query: m[1] };
}

export const slashItems = (query: string) => {
  const q = query.toLowerCase();
  return SLASH.filter((i) => !q || i.label.toLowerCase().includes(q));
};

export function SlashMenu({
  editor,
  slash,
  pick,
  onPick,
  onRun,
}: {
  editor: TiptapEditor;
  slash: Slash;
  pick: number;
  onPick: (i: number) => void;
  onRun: (item: SlashItem) => void;
}) {
  const items = slashItems(slash.query);
  const boxRef = useRef<HTMLDivElement>(null);
  const at = pagePoint(editor, slash.from);
  useClamp(boxRef, at.left - 10, [at.left, items.length]);
  useEffect(() => {
    boxRef.current?.querySelector("[data-on]")?.scrollIntoView({ block: "nearest" });
  }, [pick]);
  if (!items.length) return null;
  return createPortal(
    <div
      ref={boxRef}
      className={styles.slash}
      style={{ top: at.bottom + 6 }}
      role="listbox"
      aria-label="Insert"
    >
      {items.map((item, i) => (
        <button
          key={item.label}
          type="button"
          role="option"
          aria-selected={i === pick}
          data-on={i === pick || undefined}
          disabled={item.later}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onPick(i)}
          onClick={() => onRun(item)}
        >
          <span>{item.label}</span>
          <span className={styles.popHint}>{item.hint}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

// ---------- table ----------

// The caret in a table: a row of what can be done to it, just under it (in the gap
// before what follows)
export function TableBar({ editor }: { editor: TiptapEditor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e.isFocused || !e.isActive("table")) return null;
      const { $from } = e.state.selection;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === "table") return { pos: $from.before(d) };
      }
      return null;
    },
  });
  const dom = state ? (editor.view.nodeDOM(state.pos) as HTMLElement | null) : null;
  if (!state || !dom) return null;
  const r = dom.getBoundingClientRect();
  const run =
    (go: (c: ReturnType<TiptapEditor["chain"]>) => ReturnType<TiptapEditor["chain"]>) => () =>
      go(editor.chain().focus()).run();
  const btn = (label: string, action: () => void, danger = false) => (
    <button
      type="button"
      data-danger={danger || undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
    >
      {label}
    </button>
  );
  return createPortal(
    <div
      className={styles.tableBar}
      style={{ top: r.bottom + window.scrollY + 8, left: r.left + window.scrollX }}
      role="toolbar"
      aria-label="Table"
    >
      {btn(
        "+ Row",
        run((c) => c.addRowAfter()),
      )}
      {btn(
        "+ Column",
        run((c) => c.addColumnAfter()),
      )}
      {btn(
        "− Row",
        run((c) => c.deleteRow()),
      )}
      {btn(
        "− Column",
        run((c) => c.deleteColumn()),
      )}
      {btn(
        "Delete table",
        run((c) => c.deleteTable()),
        true,
      )}
    </div>,
    document.body,
  );
}

// ---------- a block selected: hold to delete, then Undo ----------

const blockName = (type: string, layout?: string) =>
  type === "figure"
    ? layout === "carousel"
      ? "Carousel"
      : "Image"
    : type === "youtube"
      ? "YouTube"
      : type === "clip"
        ? "Clip"
        : type === "horizontalRule"
          ? "Divider"
          : "Block";

const HOLD = 900; // ms the pill is held for the block to go (EDITOR-SPEC)

// EDITOR-SPEC "Removing things": a block clicked (an image, a video, a divider) is
// selected — its border black — and a black bar rises at the bottom: "Image selected ·
// Esc to deselect · × Hold to delete". Held 0.9 s, red fills the pill left to right and
// the block goes; let go early and it drains back. Pointing at the pill turns the
// block's border red. Then "Image removed · Undo ⌘Z" for 8 s.
export function BlockBar({ editor }: { editor: TiptapEditor }) {
  const picked = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const sel = e.state.selection as {
        node?: { type: { name: string }; attrs: Record<string, unknown> };
        from: number;
      };
      const node = sel.node;
      if (!node || !["figure", "youtube", "clip", "raw", "horizontalRule"].includes(node.type.name))
        return null;
      return { pos: sel.from, name: blockName(node.type.name, String(node.attrs.layout ?? "")) };
    },
  });
  const [holding, setHolding] = useState(false);
  const [gone, setGone] = useState<string | null>(null); // what was removed, for the toast
  const timer = useRef(0);
  const toastTimer = useRef(0);

  const dom = picked ? (editor.view.nodeDOM(picked.pos) as HTMLElement | null) : null;
  const danger = (on: boolean) => dom?.toggleAttribute("data-danger", on);
  const start = () => {
    if (!picked) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      danger(false);
      editor.chain().focus().deleteSelection().run();
      setGone(picked.name);
      clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setGone(null), 8000);
    }, HOLD);
  };
  const stop = () => {
    clearTimeout(timer.current);
    setHolding(false);
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(toastTimer.current);
    },
    [],
  );
  // A new selection or an edit: the toast's Undo would undo something else
  useEffect(() => {
    if (!gone) return;
    const off = () => setGone(null);
    const t = window.setTimeout(() => editor.on("update", off), 0);
    return () => {
      clearTimeout(t);
      editor.off("update", off);
    };
  }, [gone, editor]);

  if (picked) {
    return createPortal(
      <div className={styles.blockBar} role="toolbar" aria-label="Selected block">
        <span>
          {picked.name} selected · <span className={styles.blockHint}>Esc to deselect</span>
        </span>
        <button
          type="button"
          className={styles.hold}
          data-holding={holding || undefined}
          onPointerDown={(e) => {
            e.preventDefault();
            start();
          }}
          onPointerUp={stop}
          onPointerLeave={() => {
            stop();
            danger(false);
          }}
          onPointerEnter={() => danger(true)}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className={styles.holdFill} aria-hidden="true" />
          <span className={styles.holdLabel}>× Hold to delete</span>
        </button>
      </div>,
      document.body,
    );
  }
  if (gone) {
    return createPortal(
      <div className={styles.blockBar} role="status">
        <span>{gone} removed</span>
        <button
          type="button"
          className={styles.undo}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            editor.chain().focus().undo().run();
            setGone(null);
          }}
        >
          Undo ⌘Z
        </button>
      </div>,
      document.body,
    );
  }
  return null;
}
