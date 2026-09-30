"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { postIssues } from "@/lib/checks";
import { shortDate } from "@/lib/format";
import type { IndexEntry } from "@/lib/schema";
import { categories, projectCategories } from "@/lib/site";
import styles from "./Admin.module.css";

type Props = {
  posts: IndexEntry[];
  selected: number | null; // post id
  columns: number; // for ↑ ↓
  onSelect: (id: number) => void;
  onOpen: (id: number) => void;
};

const categoryLabel = (slug: string) =>
  [...categories, ...projectCategories].find((c) => c.slug === slug)?.label ?? slug;

export const publicUrl = (p: IndexEntry) => (p.section === "project" ? `/project/${p.slug}` : `/posts/${p.slug}`);

// 06 cards (v4 .acard). A click (or the arrow keys) selects: a grey box springs over to
// the card (v4 _gAim: .08 pull, .74 damping, 6px round it) and a dot pushes its number
// aside. Enter or a double-click "opens": the box goes black and the card's text white
// for a moment — the editor takes over there in 5.3.
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
    const tick = () => {
      raf = 0;
      for (const k of keys) {
        const v = `v${k}` as `v${K}`;
        const t = `t${k}` as `t${K}`;
        B[v] = (B[v] + (B[t] - B[k]) * 0.08) * 0.74;
        B[k] += B[v];
      }
      box.style.transform = `translate(${B.x.toFixed(1)}px, ${B.y.toFixed(1)}px)`;
      box.style.width = `${Math.max(0, B.w).toFixed(1)}px`;
      box.style.height = `${Math.max(0, B.h).toFixed(1)}px`;
      if (keys.some((k) => Math.abs(B[`t${k}`] - B[k]) > 0.1 || Math.abs(B[`v${k}`]) > 0.05)) {
        raf = requestAnimationFrame(tick);
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
    const k = Math.max(0, posts.findIndex((p) => p.id === selected));
    if (e.key === "Enter") {
      e.preventDefault();
      open(posts[k].id);
      return;
    }
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[e.key];
    if (!d) return;
    e.preventDefault();
    onSelect(posts[Math.max(0, Math.min(posts.length - 1, k + d))].id);
  };

  return (
    <div ref={gridRef} className={styles.cards} tabIndex={0} onKeyDown={onKey} aria-label="Posts">
      <span ref={boxRef} className={styles.aim} aria-hidden="true" />
      {posts.map((p, i) => {
        const issues = postIssues(p).length > 0;
        return (
          <article
            key={p.id}
            className={styles.card}
            data-id={p.id}
            data-gsel={p.id === selected || undefined}
            data-reveal
            data-d={Math.min(i, 8) * 30}
            onClick={() => onSelect(p.id)}
            onDoubleClick={() => open(p.id)}
          >
            <span className={styles.cardCover}>
              {p.cover && (
                <Image src={`/${p.cover}`} alt="" fill sizes="(min-width: 1280px) 300px, 45vw" className={styles.cover} />
              )}
            </span>
            <span className={styles.cardTop}>
              <span className={styles.no}>{String(p.id).padStart(3, "0")}</span>
              <span className="label" data-draft={p.status === "draft" || undefined}>
                {p.status === "draft" ? "Draft" : "Published"}
              </span>
            </span>
            <span className={styles.cardTitle} data-issues={issues || undefined}>
              {p.title}
            </span>
            <span className={styles.cardMeta}>
              <span className="label">{categoryLabel(p.category)}</span>
              <span className="label">{shortDate(p.publishedAt)}</span>
              <span className={styles.cardActs}>
                <Link href={`/admin/posts/${p.slug}`} onClick={(e) => e.stopPropagation()}>
                  Edit
                </Link>
                {p.status === "draft" ? (
                  <span aria-disabled="true" title="Publishing comes with the editor (5.3)">
                    Publish
                  </span>
                ) : (
                  <a href={publicUrl(p)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                    View
                  </a>
                )}
              </span>
            </span>
          </article>
        );
      })}
    </div>
  );
}
