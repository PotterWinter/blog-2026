"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, useEffect, useRef } from "react";
import { postIssues } from "@/lib/checks";
import { postNo, shortDate } from "@/lib/format";
import type { IndexEntry } from "@/lib/schema";
import { categories, projectCategories } from "@/lib/site";
import styles from "./Admin.module.css";

type Props = {
  posts: IndexEntry[];
  selected: number | null; // post id
  columns: number; // for ↑ ↓
  onSelect: (id: number | null) => void; // null = nothing selected
  onOpen: (id: number) => void;
};

const categoryLabel = (slug: string) =>
  [...categories, ...projectCategories].find((c) => c.slug === slug)?.label ?? slug;

export const publicUrl = (p: IndexEntry) => (p.section === "project" ? `/project/${p.slug}` : `/posts/${p.slug}`);

// 06 cards (v4 .acard). A click (or the arrow keys) selects: a grey box springs over to
// the card (v4 _gAim: .08 pull, .74 damping, 6px round it) and a dot pushes its number
// aside. A click on the selected card lets it go (owner, 1 Oct 69). Enter or a
// double-click "opens": the box goes black and the card's text white for a moment —
// the editor takes over there in 5.3.
export default function AdminCards({ posts, selected, columns, onSelect, onOpen }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  const aimRef = useRef<(el: HTMLElement, snap?: boolean) => void>(() => {});

  // The grey box
  useEffect(() => {
    const grid = gridRef.current;
    const box = boxRef.current;
    if (!grid || !box) return;
    const P = 6;
    const B = { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0, tx: 0, ty: 0, tw: 0, th: 0 };
    type K = "x" | "y" | "w" | "h";
    const keys: K[] = ["x", "y", "w", "h"];
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = 0;
      // v4's spring is tuned per 60fps frame. A slow frame (Safari busy, dev mode) runs
      // as many of those steps as the time that passed, so dropped frames don't turn
      // the box into slow motion (owner, 1 Oct 69)
      const steps = last ? Math.min(4, Math.max(1, Math.round((now - last) / (1000 / 60)))) : 1;
      last = now;
      for (let s = 0; s < steps; s++) {
        for (const k of keys) {
          const v = `v${k}` as `v${K}`;
          const t = `t${k}` as `t${K}`;
          B[v] = (B[v] + (B[t] - B[k]) * 0.08) * 0.74;
          B[k] += B[v];
        }
      }
      box.style.transform = `translate(${B.x.toFixed(1)}px, ${B.y.toFixed(1)}px)`;
      box.style.width = `${Math.max(0, B.w).toFixed(1)}px`;
      box.style.height = `${Math.max(0, B.h).toFixed(1)}px`;
      if (keys.some((k) => Math.abs(B[`t${k}`] - B[k]) > 0.1 || Math.abs(B[`v${k}`]) > 0.05)) {
        raf = requestAnimationFrame(tick);
      } else {
        last = 0; // at rest: the next move starts fresh, not from the idle gap
      }
    };
    aimRef.current = (el, snap) => {
      B.tx = el.offsetLeft - P;
      B.ty = el.offsetTop - P;
      B.tw = el.offsetWidth + P * 2;
      B.th = el.offsetHeight + P * 2;
      if (snap || box.style.opacity !== "1") {
        Object.assign(B, { x: B.tx, y: B.ty, w: B.tw, h: B.th, vx: 0, vy: 0, vw: 0, vh: 0 });
      }
      box.style.opacity = "1";
      if (!raf) raf = requestAnimationFrame(tick);
    };
    // Cards move when the window resizes: jump the box to its card
    const onResize = () => {
      const el = grid.querySelector<HTMLElement>("[data-gsel]");
      if (el) aimRef.current(el, true);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Follow the selection (and the page of cards changing under it)
  useEffect(() => {
    const el = gridRef.current?.querySelector<HTMLElement>("[data-gsel]");
    if (el) aimRef.current(el);
    else if (boxRef.current) boxRef.current.style.opacity = "0";
  }, [selected, posts]);

  const open = (id: number) => {
    const box = boxRef.current;
    const card = gridRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (!box || !card) return;
    box.setAttribute("data-open", "");
    card.setAttribute("data-gopen", "");
    card.animate([{ transform: "scale(1)" }, { transform: "scale(.985)" }, { transform: "scale(1)" }], {
      duration: 300,
      easing: "cubic-bezier(.34,1.5,.5,1)",
    });
    window.setTimeout(() => {
      box.removeAttribute("data-open");
      card.removeAttribute("data-gopen");
    }, 1250);
    onOpen(id);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!posts.length) return;
    const k = posts.findIndex((p) => p.id === selected);
    if (e.key === "Enter") {
      if (k < 0) return;
      e.preventDefault();
      open(posts[k].id);
      return;
    }
    if (e.key === "Escape" && k >= 0) {
      onSelect(null);
      return;
    }
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[e.key];
    if (!d) return;
    e.preventDefault();
    // Nothing selected yet: the arrows start at the first card
    const next = posts[k < 0 ? 0 : Math.max(0, Math.min(posts.length - 1, k + d))].id;
    onSelect(next);
    // Keep it in view: the page follows a row at a time (smooth, from <html>'s
    // scroll-behavior), clear of the header by the card's scroll-margin
    gridRef.current?.querySelector(`[data-id="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  // Clicks are read off the grid (which card, by data-id) so the cards take no
  // callbacks and memo can skip all but the two that change on a move — every card
  // re-rendering on each arrow key made a held key judder (owner, 1 Oct 69)
  const cardAt = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("a")) return null; // Edit / View go where they go
    const id = t.closest<HTMLElement>("[data-id]")?.dataset.id;
    return id ? Number(id) : null;
  };

  return (
    <div
      ref={gridRef}
      className={styles.cards}
      tabIndex={0}
      onKeyDown={onKey}
      onClick={(e) => {
        const id = cardAt(e);
        if (id != null) onSelect(id === selected ? null : id);
      }}
      onDoubleClick={(e) => {
        const id = cardAt(e);
        if (id != null) open(id);
      }}
      aria-label="Posts"
    >
      <span ref={boxRef} className={styles.aim} aria-hidden="true" />
      {posts.map((p) => (
        <Card key={p.id} p={p} selected={p.id === selected} />
      ))}
    </div>
  );
}

const Card = memo(function Card({ p, selected }: { p: IndexEntry; selected: boolean }) {
  return (
    <article
      className={styles.card}
      data-id={p.id}
      data-gsel={selected || undefined}
    >
      <span className={styles.cardCover}>
        {p.cover && (
          <Image src={`/${p.cover}`} alt="" fill sizes="(min-width: 1280px) 300px, 45vw" className={styles.cover} />
        )}
      </span>
      <span className={styles.cardTop}>
        <span className={styles.no}>{postNo(p, true)}</span>
        <span className="label" data-draft={p.status === "draft" || undefined}>
          {p.status === "draft" ? "Draft" : "Published"}
        </span>
      </span>
      <span className={styles.cardTitle} data-issues={postIssues(p).length > 0 || undefined}>
        {p.title}
      </span>
      <span className={styles.cardMeta}>
        <span className="label">{categoryLabel(p.category)}</span>
        <span className="label">{shortDate(p.publishedAt)}</span>
        <span className={styles.cardActs}>
          <Link href={`/admin/posts/${p.slug}`}>Edit</Link>
          {p.status === "draft" ? (
            <span aria-disabled="true" title="Publishing comes with the editor (5.3)">
              Publish
            </span>
          ) : (
            <a href={publicUrl(p)} target="_blank" rel="noopener">
              View
            </a>
          )}
        </span>
      </span>
    </article>
  );
});
