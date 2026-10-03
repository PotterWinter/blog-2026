"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { anchorOffset, type Anchor } from "./anchor";
import type { ClipMap } from "@/lib/clips";
import type { ForReaders, Post } from "@/lib/content";
import ContentsRail from "../post/ContentsRail";
import postStyles from "../post/Post.module.css";
import PostBody from "../post/PostBody";
import { PostNavStub } from "../post/PostNav";
import PostHeader from "../post/PostHeader";
import ProjectEnd from "../post/ProjectEnd";
import styles from "./Editor.module.css";

// 07P Preview (5.3g): the post as the site will show it — the same header, body and
// contents rail as 04 / 04B — drawn from what's in the editor right now, unsaved edits
// and a cover still waiting for Save included. It takes the editor's place in the same
// tab (the editor stays as it was underneath); Close or Esc brings the editor back
// (owner, 2 Oct 69). Only the signed-in admin gets here, and nothing is committed.
export default function Preview({
  post,
  coverUrl,
  entering,
  onIn,
  onClose,
  clips,
  anchor,
  leaving,
  onOut,
  titles,
}: {
  titles: Record<string, string>; // the site's posts by address (a link by address alone)
  leaving: number | null; // sliding off to the right, held at this height (see Editor)
  onOut: () => void; // ...and it's gone
  anchor: Anchor | null; // where you were in WRITE: it opens there
  post: ForReaders<Post>;
  coverUrl?: string; // a cover picked but not saved: shown from memory
  entering: boolean; // sliding in over the editor (see Editor)
  onIn: () => void; // ...and it's in
  onClose: () => void;
  clips: ClipMap; // saved ones by path, waiting ones as "clip:<key>"
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Where you were writing, at the height it sat (anchor.ts): while it slides in, held
  // over the screen, its own scroll; once in, the page's — before the frame is drawn,
  // so the swap from one to the other never shows. Images above it come in after (the
  // cover, figures) and push it down: it's put back each time the page grows, until
  // you move it yourself — it opened at the top and then jumped (owner, 3 Oct 69).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || leaving != null) return;
    // From RAW, or nothing to find: the top
    if (!anchor) return void (entering || window.scrollTo({ top: 0, behavior: "instant" }));
    const place = () => {
      const off = anchorOffset(root, anchor) ?? 0;
      if (entering) root.scrollTop = off;
      else window.scrollTo({ top: root.getBoundingClientRect().top + window.scrollY + off, behavior: "instant" });
    };
    place();
    const grows = new ResizeObserver(place);
    grows.observe(root.querySelector("main") ?? root);
    const yours = () => grows.disconnect();
    const events = ["wheel", "touchstart", "keydown", "mousedown"] as const;
    for (const e of events) window.addEventListener(e, yours, { passive: true, once: true });
    const done = window.setTimeout(yours, 3000);
    return () => {
      grows.disconnect();
      clearTimeout(done);
      for (const e of events) window.removeEventListener(e, yours);
    };
  }, [entering, anchor, leaving]);
  // Leaving: held over the screen at the height you'd read to, then off to the right.
  // Swiped away already (a phone), it's off the screen: gone at once.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || leaving == null) return;
    if (root.style.transform) return onOut();
    root.scrollTop = leaving;
    const pages = [document.documentElement, document.body];
    pages.forEach((el) => (el.style.overflowX = "clip"));
    const late = window.setTimeout(onOut, 700);
    return () => {
      clearTimeout(late);
      pages.forEach((el) => (el.style.overflowX = ""));
    };
  }, [leaving, onOut]);
  // Sliding in, it starts a screen's width to the right: html and body clip sideways
  // meanwhile, or iOS Safari zooms out to fit the wider page (as in the swipe below)
  useEffect(() => {
    if (!entering) return;
    const pages = [document.documentElement, document.body];
    pages.forEach((el) => (el.style.overflowX = "clip"));
    // In anyway if the slide never reports its end (a tab in the background doesn't run it)
    const late = window.setTimeout(onIn, 700);
    return () => {
      clearTimeout(late);
      pages.forEach((el) => (el.style.overflowX = ""));
    };
  }, [entering, onIn]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  // Phones: swipe right to put it away, from anywhere on the page — Safari's own Back
  // swipe also closes it, but only from the very edge (owner, 2 Oct 69: pull-down was
  // tried and dropped). The page follows the finger; let go past a third of the width,
  // or with a flick, and it slides off to the right and closes; short of that it
  // springs back. Not from the left edge (that's Safari's), nor on things that move
  // sideways themselves: the contents rail, a carousel, code, tables. Only here — the
  // editor and the site don't swipe.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !window.matchMedia("(pointer: coarse)").matches) return;
    let start: { x: number; y: number; t: number } | null = null;
    let sideways: boolean | null = null;
    let dx = 0;
    let gone = false;
    // Moved right, the page pokes out past the screen's edge, and iOS Safari zooms out
    // to fit the wider page (owner, 2 Oct 69: "it shrinks to the whole page first").
    // While it's off centre, html and body clip sideways — clip, not hidden, which would
    // stop sticky things sticking — so the page is never wider than the screen.
    const pages = [document.documentElement, document.body];
    let unclip = 0;
    const clip = (on: boolean) => {
      clearTimeout(unclip);
      pages.forEach((el) => (el.style.overflowX = on ? "clip" : ""));
    };
    const slide = (x: number, ease: boolean) => {
      if (x) clip(true);
      root.style.transition = ease ? "transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
      root.style.transform = x ? `translateX(${x}px)` : "";
      if (!x) unclip = window.setTimeout(() => clip(false), ease ? 300 : 0); // back home
    };
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      const target = e.target as Element;
      if (gone || e.touches.length > 1 || t.clientX < 30 || target.closest("nav, pre, table, [data-swipe-own]")) return;
      start = { x: t.clientX, y: t.clientY, t: e.timeStamp };
      sideways = null;
      dx = 0;
    };
    const move = (e: TouchEvent) => {
      if (!start || gone) return;
      const t = e.touches[0];
      const x = t.clientX - start.x;
      const y = t.clientY - start.y;
      if (sideways == null && Math.hypot(x, y) > 10) sideways = x > 0 && Math.abs(x) > Math.abs(y) * 1.2;
      if (!sideways) return;
      e.preventDefault(); // the page doesn't scroll while it's being swiped away
      dx = Math.max(0, x);
      slide(dx, false);
    };
    const up = (e: TouchEvent) => {
      if (!start || !sideways || gone) {
        start = null;
        return;
      }
      const flick = dx / Math.max(1, e.timeStamp - start.t) > 0.6;
      start = null;
      if (dx > window.innerWidth / 3 || flick) {
        gone = true;
        slide(window.innerWidth, true);
        window.setTimeout(onClose, 260);
      } else slide(0, true);
    };
    root.addEventListener("touchstart", down, { passive: true });
    root.addEventListener("touchmove", move, { passive: false });
    root.addEventListener("touchend", up);
    root.addEventListener("touchcancel", up);
    return () => {
      clip(false);
      root.removeEventListener("touchstart", down);
      root.removeEventListener("touchmove", move);
      root.removeEventListener("touchend", up);
      root.removeEventListener("touchcancel", up);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      className={styles.preview}
      data-entering={entering || undefined}
      data-leaving={leaving != null || undefined}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        if (leaving != null) onOut();
        else onIn();
      }}
      // Links in the post to the site's own pages would leave the editor and what's
      // unsaved: Back to Blog / Projects closes the preview instead (owner, 2 Oct 69), the
      // rest stay put. Links out, and the contents rail, still work
      onClickCapture={(e) => {
        const a = (e.target as Element).closest("a");
        const href = a?.getAttribute("href") ?? "";
        if (!href.startsWith("/")) return;
        e.preventDefault();
        e.stopPropagation(); // the page-transition link never hears it
        if (href === "/" || href === "/project") onClose();
      }}
    >
      <div className={styles.previewBar}>
        <span className="label">Preview</span>
        <span className={styles.previewNote}>as it will look · unsaved edits included · not on the site</span>
        <button type="button" className={styles.link} onClick={onClose}>
          Close
        </button>
      </div>
      <main data-post>
        <div className={postStyles.railZone}>
          <PostHeader post={post} coverUrl={coverUrl} />
          <PostBody markdown={post.body} clips={clips} titles={titles} />
          {/* Placed once it's in, gone as it leaves: held over the editor, the page's
              height and scroll aren't the preview's, and the rail measures both */}
          {!entering && leaving == null && <ContentsRail />}
        </div>
        {/* The post's end: Previous | Next, words only, nothing to press — so you see
            where it stops (owner, 3 Oct 69) */}
        {post.section === "project" ? <ProjectEnd /> : <PostNavStub />}
      </main>
    </div>
  );
}
