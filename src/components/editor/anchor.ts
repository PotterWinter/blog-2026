// Preview opens where you were writing (owner, 3 Oct 69), not at the post's top: the
// first passage of text — or image — showing in WRITE, and how far down the screen it
// sat, are found again in the preview (text by its words, an image by its file name)
// and put back at that height. Not found (an edit the preview reads differently) → the
// heading above it; none → the top.

export type Anchor = { key: string; nth: number; top: number; heading: string | null };

// Text blocks, and images. A block's own controls (an image's fields, a code frame's
// bar) sit in contenteditable="false" parts and aren't the post's words.
const BLOCKS = "h2, h3, p, li, pre code, img";
const words = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 48);
// An image by its file: "…/media/2026/3wlpdn76-photo.webp" → "img:3wlpdn76-photo.webp"
// (WRITE shows a picked one from memory, blob:…, which the preview has too)
const keyOf = (el: Element) => {
  if (el instanceof HTMLImageElement) return `img:${(el.getAttribute("src") ?? "").split(/[?#]/)[0].split("/").pop()}`;
  return el.querySelector("p") ? "" : words(el);
};
const counts = (el: Element) => {
  const key = keyOf(el);
  if (key.startsWith("img:")) return key.length > 4;
  return key.length >= 3 && !el.closest('[contenteditable="false"]');
};

// Below the rows that stick to the top of the editor (as the contents rail allows)
const UNDER = 96;

export function anchorIn(root: Element | null): Anchor | null {
  if (!root) return null;
  const blocks = [...root.querySelectorAll(BLOCKS)].filter(counts);
  const at = blocks.findIndex((el) => el.getBoundingClientRect().bottom > UNDER);
  if (at < 0) return null;
  const el = blocks[at];
  const key = keyOf(el);
  const nth = blocks.slice(0, at).filter((b) => keyOf(b) === key).length;
  // The heading above it, by the id the post page gives it ("w-" in WRITE)
  const heads = [...root.querySelectorAll("h2[id], h3[id]")].filter(
    (h) => h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING || h === el,
  );
  const heading = heads.at(-1)?.id.replace(/^w-/, "") ?? null;
  // Below the screen (an image block's fields filled it, taller in WRITE than on the
  // page): halfway down instead, what's above it in view
  const seen = Math.max(UNDER, el.getBoundingClientRect().top);
  const top = seen > window.innerHeight ? window.innerHeight * 0.5 : seen;
  return { key, nth, top, heading };
}

// Where to scroll the preview's page so the passage sits as it did: a distance from the
// top of `root`'s content, or null for the top
export function anchorOffset(root: Element, anchor: Anchor | null): number | null {
  if (!anchor) return null;
  const found = [...root.querySelectorAll(BLOCKS)].filter((el) => keyOf(el) === anchor.key)[anchor.nth];
  const target = found ?? (anchor.heading ? root.querySelector(`[id="${CSS.escape(anchor.heading)}"]`) : null);
  if (!target) return null;
  const top = target.getBoundingClientRect().top - root.getBoundingClientRect().top;
  return Math.max(0, top - (found ? anchor.top : UNDER));
}
