"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { type Check, postChecks } from "@/lib/checks";
import { longDate } from "@/lib/format";
import type { IndexEntry } from "@/lib/schema";
import { categories, projectCategories } from "@/lib/site";
import { publicUrl } from "./AdminCards";
import styles from "./Admin.module.css";
import { useHoverTip } from "./useHoverTip";

type Props = { post: IndexEntry | null; sheetOpen: boolean; onClose: () => void };

const categoryLabel = (slug: string) =>
  [...categories, ...projectCategories].find((c) => c.slug === slug)?.label ?? slug;

// "2026-09-29T14:16:21+07:00" → "29 Sep 2026 · 14:16"
const stamp = (iso: string) => {
  const [d, t] = iso.split("T");
  return t ? `${longDate(d)} · ${t.slice(0, 5)}` : longDate(d);
};

const size = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

// 06 details pane (v4 data-dpane): the selected post — cover, title and excerpt, its
// Checks (red, when anything's wrong), then Post, Dates, Content and File, and the
// actions. Beside the cards from 1024; below that a sheet that rises from the bottom
// when a card is tapped (v4 _sheets). Publish / Unpublish / Delete come with the
// editor (5.3): they write the .md and index.json in one commit.
export default function Details({ post, sheetOpen, onClose }: Props) {
  const paneRef = useRef<HTMLElement>(null);

  // Beside the cards (1024 up) the details can be cut off two ways, and then the cover
  // takes a click (data-lift, a tip under the mouse says what it does) that scrolls the
  // page just enough to show them whole (owner, 1 Oct 69):
  // - down: the page sits above the pane, its rule below the header and the details
  //   running off the bottom. The page scrolls down until the pane's rule lands on the
  //   header's bottom line — the two read as one.
  // - up: at the end of the list the column's end has pushed the details up under the
  //   header. The page scrolls up the little it takes for them to sit at their place.
  // In between they're whole already, and the cover does nothing.
  const lift = (): number => {
    const pane = paneRef.current;
    const body = pane?.querySelector<HTMLElement>("[data-pane-scroll]");
    const header = document.querySelector("header");
    if (!pane || !body || !header || !window.matchMedia("(min-width: 1024px)").matches) return 0;
    const line =
      header.getBoundingClientRect().bottom -
      parseFloat(getComputedStyle(header).borderBottomWidth);
    const below = pane.getBoundingClientRect().top - line;
    // Rounded away from zero: the page scrolls in whole pixels, and a fraction short the
    // two rules show side by side; a fraction past, the pane's tucks under the header's
    if (below > 1) return Math.ceil(below);
    const pushed = body.getBoundingClientRect().top - parseFloat(getComputedStyle(body).top);
    if (pushed < -1) return Math.floor(pushed);
    return 0;
  };
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    let raf = 0;
    const mark = () => {
      raf = 0;
      const by = lift();
      pane.toggleAttribute("data-lift", by !== 0);
      const cover = pane.querySelector<HTMLElement>("[data-cover]");
      if (by)
        cover?.setAttribute(
          "data-tip",
          by > 0 ? "Scroll down to see it all" : "Scroll up to see it all",
        );
      else cover?.removeAttribute("data-tip");
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(mark);
    };
    mark();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      cancelAnimationFrame(raf);
    };
    // A new post's details: a new cover, and maybe a different height
  }, [post?.id]);
  // The sheet (below 1024): a finger pulls it down from its top (the bar, or the
  // details scrolled to their start) and it follows; let go past a third of the way, or
  // with a flick, and it closes, else it springs back. The page behind dims, and a tap
  // there closes it too (owner, 1 Oct 69).
  const scrimRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const pane = paneRef.current;
    const scrim = scrimRef.current;
    if (!pane || !scrim) return;
    const sheet = window.matchMedia("(max-width: 1023px)");
    let y0 = 0;
    let t0 = 0;
    let dy = 0;
    let from = -1; // the scroll the touch began at; -1 = not following
    let dragging = false;
    const start = (e: TouchEvent) => {
      if (!sheet.matches || !pane.hasAttribute("data-open")) return;
      y0 = e.touches[0].clientY;
      t0 = performance.now();
      dy = 0;
      dragging = false;
      from = pane.scrollTop;
    };
    const move = (e: TouchEvent) => {
      if (from < 0) return;
      dy = e.touches[0].clientY - y0;
      // Only a pull down from the very top; anything else scrolls the details
      if (!dragging && (from > 0 || dy <= 4)) {
        if (dy < 0 || from > 0) from = -1;
        return;
      }
      dragging = true;
      e.preventDefault();
      pane.style.transition = "none";
      pane.style.transform = `translateY(${Math.max(0, dy)}px)`;
      scrim.style.transition = "none";
      scrim.style.opacity = String(Math.max(0, 1 - dy / pane.offsetHeight));
    };
    const end = () => {
      if (!dragging) {
        from = -1;
        return;
      }
      const flick = dy / Math.max(1, performance.now() - t0) > 0.6;
      pane.style.transition = "";
      scrim.style.transition = "";
      scrim.style.opacity = "";
      if (dy > pane.offsetHeight / 3 || (flick && dy > 30)) {
        // Carried on down from where the finger left it; the inline place goes once
        // it's there, so the next open starts clean
        pane.style.transform = "translateY(100%)";
        closeRef.current();
        window.setTimeout(() => (pane.style.transform = ""), 500);
      } else {
        pane.style.transform = "";
      }
      from = -1;
      dragging = false;
    };
    pane.addEventListener("touchstart", start, { passive: true });
    pane.addEventListener("touchmove", move, { passive: false });
    pane.addEventListener("touchend", end);
    pane.addEventListener("touchcancel", end);
    return () => {
      pane.removeEventListener("touchstart", start);
      pane.removeEventListener("touchmove", move);
      pane.removeEventListener("touchend", end);
      pane.removeEventListener("touchcancel", end);
    };
  }, []);

  // Each post's details start from the top (the sheet keeps its scroll otherwise)
  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0;
  }, [post?.id]);

  // While the sheet is up, only the sheet scrolls: the page behind stays put, with a
  // mouse wheel or the page's scrollbar too (owner, 1 Oct 69). Not when the window is
  // wide enough for the pane to sit beside the cards again.
  useEffect(() => {
    const sheet = window.matchMedia("(max-width: 1023px)");
    const root = document.documentElement;
    const apply = () => (root.style.overflow = sheetOpen && sheet.matches ? "hidden" : "");
    apply();
    sheet.addEventListener("change", apply);
    return () => {
      sheet.removeEventListener("change", apply);
      root.style.overflow = "";
    };
  }, [sheetOpen]);

  const onCover = () => {
    const by = lift();
    if (by) window.scrollBy({ top: by, behavior: "smooth" });
  };

  return (
    <>
      <div
        ref={scrimRef}
        className={styles.scrim}
        data-open={sheetOpen || undefined}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Just its top rule until a card is selected; then the details are held at the right,
       as tall as they need up to the window (scrolling inside past that), and stopped by
       the pager's rule at the end */}
      <aside
        ref={paneRef}
        className={styles.pane}
        data-open={sheetOpen || undefined}
        aria-label="Post details"
      >
        <div className={styles.sheetBar}>
          <span className="label">Details</span>
          <button
            type="button"
            className={styles.sheetClose}
            aria-label="Close details"
            onClick={onClose}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              aria-hidden="true"
            >
              <path d="M1 1l12 12M13 1 1 13" />
            </svg>
          </button>
        </div>
        {post && (
          <div className={styles.paneBody} key={post.id} data-pane-scroll>
            <Cover src={post.cover} onClick={onCover} />
            <div className={styles.paneHead}>
              <span className={styles.paneTitle}>{post.title}</span>
              <span className={styles.paneExcerpt}>{post.excerpt}</span>
            </div>

            {/* Edit and View right under the title, where a pick lands (v4 had them at the
              foot, out of sight once the details scroll); Unpublish / Delete stay at the
              foot, away from them (owner, 1 Oct 69) */}
            <div className={styles.paneActs}>
              <Link href={`/admin/posts/${post.slug}`} className={styles.btnm}>
                Edit post
              </Link>
              {post.status === "draft" ? (
                <button
                  type="button"
                  className={styles.btnl}
                  aria-disabled="true"
                  title="Comes with the editor (5.3)"
                >
                  Publish
                </button>
              ) : (
                <a href={publicUrl(post)} target="_blank" rel="noopener" className={styles.btnl}>
                  View
                </a>
              )}
            </div>

            <Checks checks={postChecks(post)} />

            <dl className={styles.facts}>
              <dt className={`label ${styles.factsHead}`}>Post</dt>
              <dt className="label">Status</dt>
              <dd className={styles.status} data-draft={post.status === "draft" || undefined}>
                {post.status === "draft" ? "Draft" : "Published"}
              </dd>
              <dt className="label">Category</dt>
              <dd>{categoryLabel(post.category)}</dd>
              <dt className="label">{post.section === "project" ? "Stack" : "Tags"}</dt>
              <dd className={styles.mono}>{post.tags.join(", ") || "—"}</dd>
            </dl>
            <dl className={styles.facts}>
              <dt className={`label ${styles.factsHead}`}>Dates</dt>
              <dt className="label">Created</dt>
              <dd className={styles.mono}>{stamp(post.createdAt)}</dd>
              <dt className="label">Published</dt>
              <dd className={styles.mono}>
                {post.status === "draft" ? "Not yet" : longDate(post.publishedAt)}
              </dd>
              <dt className="label">Edited</dt>
              <dd className={styles.mono}>{longDate(post.updatedAt)}</dd>
            </dl>
            <dl className={styles.facts}>
              <dt className={`label ${styles.factsHead}`}>Content</dt>
              <dt className="label">Words</dt>
              <dd>{post.words.toLocaleString("en")}</dd>
              <dt className="label">Read time</dt>
              <dd>{post.readMinutes} min</dd>
              <dt className="label">Images</dt>
              <dd>{post.images}</dd>
              <dt className="label">Videos</dt>
              <dd>{post.videos}</dd>
              <dt className="label">Code blocks</dt>
              <dd>{post.codeBlocks}</dd>
            </dl>
            <dl className={styles.facts}>
              <dt className={`label ${styles.factsHead}`}>File</dt>
              <dt className="label">Size</dt>
              <dd>{size(post.bytes)}</dd>
              <dt className="label">Last commit</dt>
              <dd className={styles.mono}>{post.lastCommit ?? "—"}</dd>
              <dt className="label">Revisions</dt>
              <dd>{post.revisions}</dd>
              <dt className="label">Path</dt>
              <dd className={styles.mono}>posts/{post.slug}.md</dd>
            </dl>

            <div className={styles.danger}>
              {post.status === "draft" ? (
                <span
                  className={styles.delete}
                  aria-disabled="true"
                  title="Comes with the editor (5.3)"
                >
                  Delete draft
                </span>
              ) : (
                <span
                  className={styles.unpublish}
                  aria-disabled="true"
                  title="Comes with the editor (5.3)"
                >
                  Unpublish
                </span>
              )}
              <span className={styles.dangerNote}>
                {post.status === "draft" ? "drafts only" : "published posts can’t be deleted"}
              </span>
            </div>
            <span className={styles.hint}>
              Click or arrow keys to select · Enter or double-click to open
            </span>
          </div>
        )}
      </aside>
    </>
  );
}

// Checks (v4 data-dp-iss): every check, with what it means on hover
function Checks({ checks }: { checks: Check[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useHoverTip(ref);
  const bad = checks.filter((c) => c.ok === false).length;
  return (
    <div ref={ref} className={styles.checks} data-bad={bad || undefined}>
      <span className={styles.checksHead}>
        <span className="label" data-tip="Should be clear before publishing · hover each item">
          Checks
        </span>
        <span className={styles.mono}>
          {bad ? `${bad} ${bad > 1 ? "issues" : "issue"}` : "All clear"}
        </span>
      </span>
      <div className={styles.checksList}>
        {[0, 1].map((col) => (
          <div key={col} className={styles.checksCol}>
            {checks
              .filter((_, i) => i % 2 === col)
              .map((c) => (
                <span
                  key={c.label}
                  className={styles.check}
                  data-state={c.ok === false ? "bad" : c.ok ? "ok" : "later"}
                  data-tip={c.tip}
                >
                  <span className={styles.checkBox} aria-hidden="true" />
                  <span className={styles.checkText}>
                    {c.label}
                    {c.note && <span className={styles.checkNote}>{c.note}</span>}
                  </span>
                </span>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// The cover, with its hover tip (set by Details while a click would scroll the page)
function Cover({ src, onClick }: { src: string | null; onClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useHoverTip(ref);
  return (
    <div ref={ref} className={styles.paneCover} data-cover onClick={onClick}>
      {src && <Image src={`/${src}`} alt="" fill sizes="320px" className={styles.cover} />}
    </div>
  );
}
