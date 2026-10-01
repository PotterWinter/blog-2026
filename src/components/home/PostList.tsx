"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { PostMeta } from "@/lib/content";
import { buzz } from "@/lib/buzz";
import { postNo, shortDate } from "@/lib/format";
import { categories } from "@/lib/site";
import TransitionLink from "../TransitionLink";
import { nextSort, type Sort } from "@/lib/sort";
import styles from "./PostList.module.css";

const DOT = 8;
const COVER_H = 112; // the preview panel's cover: 224 × 112, 2:1 like every cover
const CARD_H = 110; // the phone card's cover: 220 × 110
const CARD_MIN_H = CARD_H + 14 * 1.4 + 18; // with a one-line excerpt (14px / 1.4, 8 + 10 padding)
// px a row boundary must pass the phone card's line before switching (the card's
// height is fixed, so this only has to absorb a scroll left resting on a boundary)
const HOLD = 8;
// Where the phone card comes to rest below the last row (more than HOLD, so the last
// row can clear its line there)
const REST = 12;
// Over the last this-many rows of scroll before the card comes to rest, the one-row
// gap between the chosen row and the card closes, so the last rows still get their turn
const CLOSE_ROWS = 4;
// Rows of space between the chosen row and the phone card while it's pinned
const GAP_ROWS = 2;

const EXCERPT_OUT_MS = 110;
// Spring pull / damping per frame. Tighter than v4 (.16 / .64, strip .13 / .72), which
// felt a beat behind the mouse in use — the owner's call, 30 Sep 69. The dot and panel
// now reach 80% of the way in 4 frames and settle in ~200ms (v4: 6 frames, ~300ms).
const FOLLOW = [0.45, 0.45] as const;
const STRIP = [0.35, 0.5] as const;

type Props = {
  posts: PostMeta[];
  phase: "out" | "in" | null;
  direction: number;
  sort: Sort | null;
  onSort: (sort: Sort) => void;
};

// A column head that sorts (v4 06B). Reads as the plain grey label it was; once
// pressed it turns ink and an arrow hangs beside it: down = low → high (NO 001, A,
// oldest first), turned over = the other way. Only the head in use has one. Also the
// admin list's heads (06B), which sort on phones too.
export function SortHead({
  label,
  on,
  up,
  onClick,
  phones = false,
}: {
  label: string;
  on: boolean;
  up: boolean;
  onClick: () => void;
  phones?: boolean;
}) {
  return (
    <button
      type="button"
      className={`label ${styles.sortHead}`}
      data-on={on || undefined}
      aria-label={`Sort by ${label.toLowerCase()}`}
      aria-pressed={on}
      // Phones keep the one plain Title head: no sorting there (01B)
      onClick={() => (phones || !window.matchMedia("(max-width: 767px)").matches) && onClick()}
    >
      {label}
      <span className={styles.arrow} data-up={up || undefined} aria-hidden="true">
        <svg
          viewBox="0 0 14 26"
          width="0.55em"
          height="1em"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="square"
        >
          <path vectorEffect="non-scaling-stroke" d="M7 0v24M1.5 19 7 25l5.5-6" />
        </svg>
      </span>
    </button>
  );
}

// A spring stepped once per frame, as v4 does it: pull toward the target, then damp
type Spring = { x: number; v: number; to: number };
const step = (s: Spring, pull: number, damp: number) => {
  s.v = (s.v + (s.to - s.x) * pull) * damp;
  s.x += s.v;
};
const moving = (s: Spring, eps = 0.05) => Math.abs(s.to - s.x) > eps || Math.abs(s.v) > eps;

// 01B list view: NO · Title · Category · Tags · Date, one row per post.
// With a mouse (768 up), hovering a row dims the others, a dot takes the place of its
// number and follows from row to row on a spring, and a panel beside the title shows
// the cover and excerpt (v4 "C · panel"): the covers are stacked in a strip that
// springs to the row's one, and the excerpt swaps with a blur (out 110ms, in 260ms).
// Below 768 the preview is a card pinned to the bottom of the screen instead (cover +
// excerpt), and the dot sits in the left margin. With a mouse the card follows the
// hovered row. On a real phone (touch) there's no hover, so the list follows the scroll:
// the chosen row is the one GAP_ROWS rows above the card's top edge (room to read it),
// and the dot and card spring to it, the other rows dim, and (Android) the phone gives a
// light tick. At the end of the list the card rests just below the last row (REST), above
// the pager, and the last row gets its turn as the card settles.
export default function PostList({ posts, phase, direction, sort, onSort }: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const excerptRef = useRef<HTMLParagraphElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardStripRef = useRef<HTMLDivElement>(null);
  const cardExcerptRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const zone = zoneRef.current!;
    const dot = dotRef.current!;
    const panel = panelRef.current!;
    const strip = stripRef.current!;
    const excerpt = excerptRef.current!;
    const card = cardRef.current!;
    const cardStrip = cardStripRef.current!;
    const cardExcerpt = cardExcerptRef.current!;
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const narrow = window.matchMedia("(max-width: 767px)");
    // A real phone: narrow and touch. A narrow window on a computer still hovers.
    const phone = window.matchMedia("(max-width: 767px) and (pointer: coarse)");

    const dx: Spring = { x: 0, v: 0, to: 0 };
    const dy: Spring = { x: 0, v: 0, to: 0 };
    const ds: Spring = { x: 0, v: 0, to: 0 }; // dot scale
    const py: Spring = { x: 0, v: 0, to: 0 }; // panel top
    const sy: Spring = { x: 0, v: 0, to: 0 }; // cover strip
    const cy: Spring = { x: 0, v: 0, to: 0 }; // the phone card's cover strip
    let row: HTMLElement | null = null;
    let press = 1;
    let raf = 0;
    let settleUntil = 0;
    const swapTimers = new Map<HTMLElement, number>();

    // Where things belong for the current row, in the zone's coordinates
    const aim = () => {
      // The row left with a page change: let go, as if the pointer had left
      if (row && !row.isConnected) {
        row = null;
        zone.removeAttribute("data-hover");
        panel.removeAttribute("data-on");
      }
      if (!row) return;
      const z = zone.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      if (narrow.matches) {
        // In the left margin, level with the middle of the row. Layout offsets, not
        // the drawn box, so a row still rising in with its reveal doesn't pull the dot.
        dx.to = -8;
        dy.to = row.offsetTop + row.offsetHeight / 2;
        return;
      }
      const no = (row.firstElementChild as HTMLElement).getBoundingClientRect();
      const title = (row.children[1] as HTMLElement).getBoundingClientRect();
      dx.to = no.left - z.left + DOT / 2;
      dy.to = no.top - z.top + no.height / 2;
      panel.style.left = `${Math.round(title.left - z.left + title.width * 0.6)}px`;
      py.to = r.top - z.top + r.height / 2 - 70;
    };

    const tick = () => {
      raf = 0;
      aim();
      step(dx, ...FOLLOW);
      step(dy, ...FOLLOW);
      ds.to = row ? press : 0;
      step(ds, 0.3, 0.55);
      step(py, ...FOLLOW);
      step(sy, ...STRIP);
      step(cy, ...STRIP);
      // The dot stretches along its path while it's moving, up to 25%
      const squash = Math.min(0.25, Math.hypot(dx.v, dy.v) / 60);
      const angle = Math.atan2(dy.v, dx.v);
      const s = Math.max(0, ds.x);
      dot.style.transform =
        `translate(${dx.x.toFixed(2)}px, ${dy.x.toFixed(2)}px) rotate(${angle.toFixed(3)}rad) ` +
        `scale(${(s * (1 + squash)).toFixed(3)}, ${(s * (1 - squash)).toFixed(3)})`;
      panel.style.transform = `translate3d(0, ${Math.round(py.x)}px, 0)`;
      strip.style.transform = `translate3d(0, ${Math.round(sy.x)}px, 0)`;
      cardStrip.style.transform = `translate3d(0, ${Math.round(cy.x)}px, 0)`;
      if (
        performance.now() < settleUntil ||
        moving(dx) ||
        moving(dy) ||
        moving(ds, 0.002) ||
        moving(py) ||
        moving(sy) ||
        moving(cy)
      ) {
        raf = requestAnimationFrame(tick);
      }
    };
    const run = () => {
      settleUntil = performance.now() + 600;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    // The phone card's excerpt box takes the height of its text (1–3 lines), eased so
    // the card grows and shrinks instead of jumping
    const fitHeight = (excerpt: HTMLElement, instant: boolean) => {
      if (excerpt !== cardExcerpt) return;
      const from = excerpt.style.height;
      excerpt.style.height = "auto";
      const to = `${excerpt.offsetHeight}px`;
      excerpt.style.height = instant ? to : from || to;
      if (!instant) {
        void excerpt.offsetHeight; // commit `from`, so the change to `to` transitions
        excerpt.style.height = to;
      }
    };

    const swapExcerpt = (excerpt: HTMLElement, text: string, instant: boolean) => {
      if (excerpt.dataset.text === text) return;
      excerpt.dataset.text = text;
      clearTimeout(swapTimers.get(excerpt));
      excerpt.getAnimations().forEach((a) => a.cancel());
      if (instant) {
        excerpt.textContent = text;
        fitHeight(excerpt, true);
        return;
      }
      excerpt.animate(
        [
          { opacity: 1, filter: "blur(0px)", transform: "none" },
          { opacity: 0, filter: "blur(3px)", transform: "translateY(-3px)" },
        ],
        { duration: EXCERPT_OUT_MS, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
      );
      const timer = window.setTimeout(() => {
        excerpt.textContent = text;
        fitHeight(excerpt, false);
        excerpt.getAnimations().forEach((a) => a.cancel());
        excerpt.animate(
          [
            { opacity: 0, filter: "blur(3px)", transform: "translateY(4px)" },
            { opacity: 1, filter: "blur(0px)", transform: "none" },
          ],
          { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      }, EXCERPT_OUT_MS);
      swapTimers.set(excerpt, timer);
    };

    const enter = (next: HTMLElement) => {
      if (!pointer.matches || phone.matches || next === row) return;
      const fresh = !row;
      row?.removeAttribute("data-on");
      row = next;
      row.setAttribute("data-on", "");
      zone.setAttribute("data-hover", "");
      const index = Number(row.dataset.index);
      aim();
      // Coming in from outside: the dot grows where it is, the panel appears in place
      if (ds.x < 0.05) {
        dx.x = dx.to;
        dy.x = dy.to;
        dx.v = dy.v = 0;
      }
      if (narrow.matches) {
        // The pinned card shows the hovered row
        cy.to = -index * CARD_H;
        if (fresh) {
          cy.x = cy.to;
          cy.v = 0;
        }
        swapExcerpt(cardExcerpt, row.dataset.excerpt ?? "", fresh);
        card.setAttribute("data-on", "");
      } else {
        sy.to = -index * COVER_H;
        if (fresh) {
          py.x = py.to;
          py.v = 0;
          sy.x = sy.to;
          sy.v = 0;
        }
        swapExcerpt(excerpt, row.dataset.excerpt ?? "", fresh);
        panel.setAttribute("data-on", "");
      }
      run();
    };

    const leave = () => {
      if (phone.matches) return;
      row?.removeAttribute("data-on");
      row = null;
      zone.removeAttribute("data-hover");
      panel.removeAttribute("data-on");
      card.removeAttribute("data-on");
      run();
    };

    // Phones: pick the row GAP_ROWS rows above the pinned card, closing to the row just
    // above it as the card comes to rest (see `gap`)
    let cardShown = false;
    const track = () => {
      if (!phone.matches) return;
      const z = zone.getBoundingClientRect();
      const inView = z.bottom > 0 && z.top < window.innerHeight;
      if (!inView) {
        card.removeAttribute("data-on");
        cardShown = false;
        if (row) {
          row.removeAttribute("data-on");
          zone.removeAttribute("data-hover");
          row = null;
          run();
        }
        return;
      }
      const rows = [...zone.querySelectorAll<HTMLElement>("[data-index]")];
      const last = rows.at(-1);
      if (!last) return;
      // At rest: last row · REST · card · pager. The 14px below the card matches the
      // last row's own padding under its text, so the space reads the same above
      // the cover and below the excerpt.
      card.style.margin = `${REST}px auto 14px`;
      // The line the rows are measured against: where the card's top would be if its
      // excerpt were one line. Taken from the card's bottom (the pinned edge), so it
      // stays put while the card's real height follows the excerpt — a line that moved
      // with it would flip the choice back and forth.
      const line = card.getBoundingClientRect().bottom - CARD_MIN_H;
      // Where each row sits in the layout (offsets ignore the reveal's 22px rise)
      const bottom = (r: HTMLElement) => z.top + r.offsetTop + r.offsetHeight;
      // The chosen row is the last one whose bottom is `gap` above the card. While the
      // card is pinned the gap is GAP_ROWS rows (room to read the row). As the card nears
      // its resting place REST px under the last row, the gap shrinks to 0, so every
      // row down to the last one gets picked before the card stops.
      const rowH = rows[0].offsetHeight;
      const toRest = Math.max(0, bottom(last) + REST - line);
      const gap = GAP_ROWS * rowH * Math.min(1, toRest / (CLOSE_ROWS * rowH));
      const pick = (edge: number) => {
        let k = 0;
        rows.forEach((r, i) => {
          if (bottom(r) <= edge + 1) k = i;
        });
        return k;
      };
      // Hysteresis: a row boundary has to pass the line by HOLD px before the choice
      // moves, so a scroll left resting right on a boundary doesn't flicker between rows
      const now = row ? rows.indexOf(row) : -1;
      const down = pick(line - gap - HOLD);
      const up = pick(line - gap + HOLD);
      const k = now < 0 ? pick(line - gap) : Math.min(Math.max(now, down), up);
      card.setAttribute("data-on", "");
      const next = rows[k];
      if (!next || (next === row && cardShown)) return;
      // A move from one row to the next (not the card first appearing): a tick
      if (row && cardShown) buzz();
      row?.removeAttribute("data-on");
      row = next;
      // The other rows dim, as on hover
      row.setAttribute("data-on", "");
      zone.setAttribute("data-hover", "");
      aim();
      // Arriving: the dot grows in place and the card shows the right cover at once
      if (ds.x < 0.05) {
        dx.x = dx.to;
        dy.x = dy.to;
        dx.v = dy.v = 0;
      }
      cy.to = -k * CARD_H;
      swapExcerpt(cardExcerpt, next.dataset.excerpt ?? "", !cardShown);
      if (!cardShown) {
        cy.x = cy.to;
        cy.v = 0;
        cardShown = true;
      }
      run();
    };
    let queued = 0;
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(() => ((queued = 0), track()));
    };
    // Crossing 768 switches between hover and scroll: start clean
    const onModeChange = () => {
      row?.removeAttribute("data-on");
      row = null;
      cardShown = false;
      zone.removeAttribute("data-hover");
      panel.removeAttribute("data-on");
      card.removeAttribute("data-on");
      card.style.margin = "";
      run();
      track();
    };

    const onOver = (e: PointerEvent) => {
      const next = (e.target as Element).closest<HTMLElement>("[data-index]");
      if (next && zone.contains(next)) enter(next);
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest("[data-index]")) return;
      press = 0.7;
      run();
    };
    const onUp = () => {
      if (press === 1) return;
      press = 1;
      run();
    };

    zone.addEventListener("pointerover", onOver);
    zone.addEventListener("pointerleave", leave);
    zone.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    narrow.addEventListener("change", onModeChange);
    phone.addEventListener("change", onModeChange);
    // A new page of rows (or the reveal moving them) shifts things without a scroll
    const resized = new ResizeObserver(onScroll);
    resized.observe(zone);
    track();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      narrow.removeEventListener("change", onModeChange);
      phone.removeEventListener("change", onModeChange);
      resized.disconnect();
      cancelAnimationFrame(queued);
      zone.removeEventListener("pointerover", onOver);
      zone.removeEventListener("pointerleave", leave);
      zone.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      cancelAnimationFrame(raf);
      swapTimers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const label = (slug: string) => categories.find((c) => c.slug === slug)?.label ?? slug;

  return (
    <div ref={zoneRef} className={styles.zone}>
      <div className={styles.head}>
        <SortHead
          label="No"
          on={sort === "no" || sort === "no-desc"}
          up={sort === "no-desc"}
          onClick={() => onSort(nextSort(sort, "no"))}
        />
        <SortHead
          label="Title"
          on={sort === "title" || sort === "title-desc"}
          up={sort === "title-desc"}
          onClick={() => onSort(nextSort(sort, "title"))}
        />
        <SortHead
          label="Category"
          on={sort === "category" || sort === "category-desc"}
          up={sort === "category-desc"}
          onClick={() => onSort(nextSort(sort, "category"))}
        />
        <span className="label">Tags</span>
        <SortHead
          label="Date"
          on={sort === "date" || sort === "date-desc"}
          up={sort === "date-desc"}
          onClick={() => onSort(nextSort(sort, "date"))}
        />
      </div>
      <div
        data-swap
        data-phase={phase ?? undefined}
        style={{ "--dir": direction } as CSSProperties}
      >
        {posts.map((post, i) => (
          <TransitionLink
            key={post.slug}
            href={`/posts/${post.slug}`}
            className={styles.row}
            data-index={i}
            data-excerpt={post.excerpt}
            data-reveal={phase !== "in" || undefined}
            data-d={phase !== "in" ? i * 40 : undefined}
            style={{ "--i": i } as CSSProperties}
          >
            <span className={styles.no}>{postNo(post)}</span>
            <span className={styles.main}>
              <span className={styles.titleRow}>
                <span className={styles.title}>{post.title}</span>
                {/* Phones: the NO column is gone; it sits top right, over the date */}
                <span className={`label ${styles.subNo}`}>{postNo(post)}</span>
              </span>
              {/* Category and tags (and the date on phones) under the title, below 1024 */}
              <span className={styles.sub}>
                <span className="label">{label(post.category)}</span>
                {post.tags.length > 0 && (
                  <span className={styles.subTags}>{post.tags.join(", ")}</span>
                )}
                <span className={`label ${styles.subDate}`}>{shortDate(post.publishedAt)}</span>
              </span>
            </span>
            <span className={`label ${styles.category}`}>{label(post.category)}</span>
            <span className={styles.tags}>{post.tags.join(", ")}</span>
            <span className={`label ${styles.date}`}>{shortDate(post.publishedAt)}</span>
          </TransitionLink>
        ))}
      </div>
      <span ref={dotRef} className={styles.dot} aria-hidden="true" />
      <div ref={panelRef} className={styles.panel} aria-hidden="true">
        <div className={styles.cover}>
          <div ref={stripRef} className={styles.strip}>
            {posts.map((post) => (
              <div key={post.slug} className={styles.frame}>
                {post.cover && (
                  <Image
                    src={`/${post.cover}`}
                    alt=""
                    fill
                    sizes="224px"
                    className={styles.image}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <p ref={excerptRef} className={styles.excerpt} />
      </div>
      <div ref={cardRef} className={styles.card} aria-hidden="true">
        <div className={styles.cardCover}>
          <div ref={cardStripRef} className={styles.strip}>
            {posts.map((post) => (
              <div key={post.slug} className={styles.cardFrame}>
                {post.cover && (
                  <Image
                    src={`/${post.cover}`}
                    alt=""
                    fill
                    sizes="220px"
                    className={styles.image}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <p ref={cardExcerptRef} className={styles.cardExcerpt} />
      </div>
    </div>
  );
}
