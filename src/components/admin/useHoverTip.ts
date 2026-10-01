"use client";

import { type RefObject, useEffect } from "react";
import styles from "./Admin.module.css";

const MAX = 320; // wider than this, the tip wraps and its corners round off less

// v4's hover tip (dp-tip, .pname): over anything in `zone` carrying data-tip, a black
// pill follows the mouse 16px down-right, springing along (.16) and growing from half
// size (.2). Moving to another item, the pill eases to the new width while the old
// words slide up and out and the new ones in. Kept inside the pane's right side. Mouse
// only — on touch the items are just text.
export function useHoverTip(zone: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const box = zone.current;
    if (!box || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const tip = document.createElement("span");
    tip.className = styles.tip;
    tip.setAttribute("aria-hidden", "true");
    const inner = document.createElement("span");
    tip.appendChild(inner);
    document.body.appendChild(tip);

    let width = 0;
    const setText = (text: string, fresh: boolean) => {
      // The words' own width, measured off-screen in the same style
      const probe = document.createElement("span");
      probe.className = `${styles.tip} ${styles.tipProbe}`;
      probe.textContent = text;
      document.body.appendChild(probe);
      const natural = Math.ceil(probe.getBoundingClientRect().width) + 2;
      probe.remove();
      const wraps = natural > MAX;
      width = wraps ? MAX : natural;
      tip.toggleAttribute("data-wrap", wraps);
      if (fresh) {
        tip.style.transition = "none";
        tip.style.width = `${width}px`;
        inner.textContent = text;
        void tip.offsetWidth;
        tip.style.transition = "";
        return;
      }
      tip.style.width = `${width}px`;
      inner.getAnimations().forEach((a) => a.cancel());
      inner.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-30%)" }], {
        duration: 120,
        easing: "ease-in",
      }).onfinish = () => {
        inner.textContent = text;
        inner.animate([{ opacity: 0, transform: "translateY(30%)" }, { opacity: 1, transform: "none" }], {
          duration: 220,
          easing: "cubic-bezier(.2,.8,.2,1)",
        });
      };
    };

    const L = { x: 0, y: 0, tx: 0, ty: 0, s: 0, ts: 0 };
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = 0;
      // Steps of a 60fps frame, as many as the time that passed (see AdminCards' box)
      const steps = last ? Math.min(4, Math.max(1, Math.round((now - last) / (1000 / 60)))) : 1;
      last = now;
      for (let i = 0; i < steps; i++) {
        L.x += (L.tx - L.x) * 0.16;
        L.y += (L.ty - L.y) * 0.16;
        L.s += (L.ts - L.s) * 0.2;
      }
      tip.style.transform = `translate3d(${L.x.toFixed(1)}px, ${L.y.toFixed(1)}px, 0) scale(${(0.5 + L.s * 0.5).toFixed(3)})`;
      if (Math.abs(L.tx - L.x) > 0.3 || Math.abs(L.ty - L.y) > 0.3 || Math.abs(L.ts - L.s) > 0.005) {
        raf = requestAnimationFrame(tick);
      } else {
        last = 0;
      }
    };
    const go = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    let current: HTMLElement | null = null;
    const hide = () => {
      current = null;
      tip.removeAttribute("data-on");
      L.ts = 0;
      go();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const right = (box.closest("aside") ?? box).getBoundingClientRect().right;
      const place = () => {
        L.tx = Math.min(e.clientX + 16, right - width);
        L.ty = e.clientY + 16;
      };
      const item = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
      if (!item?.dataset.tip) return hide();
      if (item !== current) {
        const fresh = !current;
        current = item;
        setText(item.dataset.tip, fresh);
        place();
        // Arrives from just below, rather than flying in from where it last was
        if (fresh) Object.assign(L, { x: L.tx, y: L.ty + 18 });
      } else {
        place();
      }
      tip.setAttribute("data-on", "");
      L.ts = 1;
      go();
    };

    box.addEventListener("pointermove", move);
    box.addEventListener("pointerleave", hide);
    // The pane or the page scrolls under a still mouse: the item under it changes (or,
    // for the cover, what a click would do), so let go
    box.closest("[data-pane-scroll]")?.addEventListener("scroll", hide, { passive: true });
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerleave", hide);
      box.closest("[data-pane-scroll]")?.removeEventListener("scroll", hide);
      window.removeEventListener("scroll", hide);
      cancelAnimationFrame(raf);
      tip.remove();
    };
  }, [zone]);
}
