"use client";

import { createContext, useEffect, useRef, type ReactNode } from "react";
import styles from "./Admin.module.css";

// The details pane of the hub (06) and Media (08), whatever it shows: beside the list
// from 1024 — held at the right, as tall as it needs up to the window, its picture
// scrolling the page to show it whole (lift, below) — and below that a sheet that rises
// from the bottom when an item is tapped (v4 _sheets), pulled down or tapped behind to
// close. `children` draws the details; its picture takes LiftContext's click.
export const LiftContext = createContext<() => void>(() => {});

export default function PaneShell({
  label,
  itemKey,
  sheetOpen,
  onClose,
  children,
}: {
  label: string;
  itemKey: string | number | null; // what's shown (null: nothing yet)
  sheetOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
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
    // A new item's details: a new picture, and maybe a different height
  }, [itemKey]);
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

  // Each item's details start from the top (the sheet keeps its scroll otherwise)
  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0;
  }, [itemKey]);

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
        aria-label={label}
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
        {itemKey != null && <LiftContext.Provider value={onCover}>{children}</LiftContext.Provider>}
      </aside>
    </>
  );
}
