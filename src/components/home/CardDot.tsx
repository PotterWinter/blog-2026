"use client";

import { useEffect, useRef } from "react";
import { buzz } from "@/lib/buzz";
import styles from "./PostGrid.module.css";

// Spring pull / damping per frame, straight from v4 (_coverDotIn): the dot travels
// between cards, stretching along its path, and bounces a little as it lands.
const PULL = 0.16;
const DAMP = 0.64;
const SCALE = [0.22, 0.68] as const;
const DOT = 8;
// Crossing the 2px gap (or the row air) between two cards shouldn't hide the dot
const GRACE_MS = 90;
// Phones: the card being read is the last one whose top has scrolled above this line
// (a share of the screen height, from the top)
const LINE = 0.5;
// px a card's top must pass the line before the choice moves, so a scroll left
// resting right on it doesn't flicker between two cards
const HOLD = 8;

type Props = { phase: "out" | "in" | null };

// 01 grid: one black dot sits in front of a card's category, and the category steps
// right to make room (the card gets data-dot; CSS does the rest). Moving to another
// card the dot travels there on a spring; with no card it shrinks away.
// - Mouse: the hovered card.
// - Phone (< 768 and touch, one column): no hover, so the dot follows the scroll —
//   the card whose top has passed the middle of the screen (as 01B's rows do).
// Lives beside the grid (not in it) so the grid's nth-child rules and page swap don't
// see it; its parent is the positioned box it moves in.
export default function CardDot({ phase }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const hideRef = useRef<() => void>(() => {});
  const trackRef = useRef<() => void>(() => {});

  useEffect(() => {
    const dot = ref.current;
    const box = dot?.parentElement;
    if (!dot || !box) return;
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const phone = window.matchMedia("(max-width: 767px) and (pointer: coarse)");

    const S = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, s: 0, vs: 0, ts: 0 };
    let press = 1;
    let raf = 0;
    let card: HTMLElement | null = null;
    let hideTimer = 0;

    const tick = () => {
      raf = 0;
      S.vx = (S.vx + (S.tx - S.x) * PULL) * DAMP;
      S.x += S.vx;
      S.vy = (S.vy + (S.ty - S.y) * PULL) * DAMP;
      S.y += S.vy;
      S.vs = (S.vs + (S.ts * press - S.s) * SCALE[0]) * SCALE[1];
      S.s += S.vs;
      // Stretch along the direction of travel, more the faster it goes
      const squash = Math.min(0.25, Math.hypot(S.vx, S.vy) / 60);
      const angle = Math.atan2(S.vy, S.vx);
      const s = Math.max(0, S.s);
      dot.style.transform =
        `translate(${S.x.toFixed(2)}px, ${S.y.toFixed(2)}px) rotate(${angle.toFixed(3)}rad) ` +
        `scale(${(s * (1 + squash)).toFixed(3)}, ${(s * (1 - squash)).toFixed(3)})`;
      if (
        Math.abs(S.tx - S.x) > 0.05 ||
        Math.abs(S.ty - S.y) > 0.05 ||
        Math.abs(S.vx) + Math.abs(S.vy) > 0.05 ||
        Math.abs(S.ts * press - S.s) > 0.002 ||
        Math.abs(S.vs) > 0.002
      )
        raf = requestAnimationFrame(tick);
    };
    const run = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    // The dot's centre: 4px into where the label starts (less any step aside still
    // easing out), halfway down it. Layout offsets, not the drawn box, so a card still
    // rising in with its reveal or page swap doesn't pull the dot off its place.
    const dock = (next: HTMLElement, label: HTMLElement) => {
      const stepped = parseFloat(getComputedStyle(label).marginLeft) || 0;
      return [
        next.offsetLeft + label.offsetLeft - stepped + DOT / 2,
        next.offsetTop + label.offsetTop + label.offsetHeight / 2,
      ];
    };

    const enter = (next: HTMLElement) => {
      clearTimeout(hideTimer);
      if (next === card) return;
      const label = next.querySelector<HTMLElement>("[data-card-label]");
      if (!label) return;
      card?.removeAttribute("data-dot");
      const [x, y] = dock(next, label);
      // Coming from nothing it appears in place; from another card it travels
      if (S.s < 0.05) Object.assign(S, { x, y, vx: 0, vy: 0 });
      Object.assign(S, { tx: x, ty: y, ts: 1 });
      card = next;
      card.setAttribute("data-dot", "");
      run();
    };
    // Something above the card changed height (the card the dot just left letting its
    // long tags back onto one line, a reveal, a resize): the label has moved, so move
    // the dot with it — at once, not on the spring.
    const redock = () => {
      const label = card?.querySelector<HTMLElement>("[data-card-label]");
      if (!card || !label) return;
      const [x, y] = dock(card, label);
      S.x += x - S.tx;
      S.y += y - S.ty;
      Object.assign(S, { tx: x, ty: y });
      run();
    };
    const hide = () => {
      clearTimeout(hideTimer);
      S.ts = 0;
      card?.removeAttribute("data-dot");
      card = null;
      run();
    };
    hideRef.current = hide;

    const onOver = (e: PointerEvent) => {
      if (!pointer.matches || e.pointerType !== "mouse") return;
      const next = (e.target as Element).closest<HTMLElement>("[data-card]");
      if (next && box.contains(next)) enter(next);
    };
    // Touch fires pointerout / pointerleave as the finger lifts: only the mouse leaves
    const onOut = (e: PointerEvent) => {
      if (!card || e.pointerType !== "mouse" || phone.matches) return;
      const to = e.relatedTarget as Node | null;
      if (to && card.contains(to)) return;
      clearTimeout(hideTimer);
      hideTimer = window.setTimeout(hide, GRACE_MS);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && !phone.matches) hide();
    };
    const onDown = (e: PointerEvent) => {
      if (!card || !(e.target as Element).closest("[data-card]")) return;
      press = 0.7;
      run();
    };
    const onUp = () => {
      if (press === 1) return;
      press = 1;
      run();
    };

    // Phones: follow the scroll
    const track = () => {
      if (!phone.matches) return;
      const cards = [...box.querySelectorAll<HTMLElement>("[data-card]")];
      const b = box.getBoundingClientRect();
      const line = window.innerHeight * LINE;
      // Where each card's top sits on screen, from the layout (ignores the reveal)
      const top = (c: HTMLElement) => b.top + c.offsetTop;
      const pick = (edge: number) => {
        let k = -1;
        cards.forEach((c, i) => {
          if (top(c) <= edge) k = i;
        });
        return k;
      };
      const now = card ? cards.indexOf(card) : -1;
      const k =
        now < 0
          ? pick(line - HOLD)
          : Math.min(Math.max(now, pick(line - HOLD)), pick(line + HOLD));
      // None above the line yet, or the whole grid scrolled away above: no dot
      if (k < 0 || b.bottom < 0) {
        if (card) hide();
        return;
      }
      if (cards[k] === card) return;
      // A move from one card to the next (not the dot first appearing): a tick
      if (card) buzz();
      enter(cards[k]);
    };
    trackRef.current = track;
    let queued = 0;
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(() => ((queued = 0), track()));
    };
    // Crossing into or out of phone mode starts clean
    const onModeChange = () => {
      hide();
      track();
    };

    box.addEventListener("pointerover", onOver);
    box.addEventListener("pointerout", onOut);
    box.addEventListener("pointerleave", onLeave);
    box.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    phone.addEventListener("change", onModeChange);
    const resized = new ResizeObserver(() => {
      redock();
      track();
    });
    resized.observe(box);
    track();
    return () => {
      box.removeEventListener("pointerover", onOver);
      box.removeEventListener("pointerout", onOut);
      box.removeEventListener("pointerleave", onLeave);
      box.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      phone.removeEventListener("change", onModeChange);
      resized.disconnect();
      clearTimeout(hideTimer);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(queued);
    };
  }, []);

  // The cards leave with a page change: let go, as if the pointer had left. The next
  // set is in place from "in": a phone picks its card again.
  useEffect(() => {
    if (phase === "out") hideRef.current();
    else trackRef.current();
  }, [phase]);

  return <span ref={ref} className={styles.dot} aria-hidden />;
}
