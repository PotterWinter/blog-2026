import type { Editor } from "@tiptap/core";

// WRITE's popover and file picker live in WriteBox; the toolbar, the bar over a
// selection, the "/" menu and the keys reach them through these
export const linkOpeners = new WeakMap<Editor, () => void>();
export const imageOpeners = new WeakMap<Editor, (layout: "single" | "two" | "carousel") => void>();
export const clipOpeners = new WeakMap<Editor, () => void>();
