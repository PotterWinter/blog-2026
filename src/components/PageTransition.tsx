"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ReactNode, RefObject } from "react";
import styles from "./PageTransition.module.css";

const PANEL_MS = 500;
const PANEL_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)"; // --ease-panel
const COUNT_MS = 900; // loader: 0 → 90% while the next page loads
const FINISH_MS = 250; // loader: the last stretch to 100% once it has loaded
const GIVE_UP_MS = 8000; // still not there (a server error, a dev rebuild): load it the old way

type PageTransitionApi = {
  target: string | null; // where we're headed while the panel is up
  go: ((href: string) => void) | null; // null only outside the provider (it wraps every page)
  ready: boolean; // the page is (or is about to be) visible: no panel, or it's dropping
  round: number; // bumps when the current page is pressed again — see PageSlot
};

const Context = createContext<PageTransitionApi>({ target: null, go: null, ready: true, round: 0 });

export function usePageTransition() {
  return useContext(Context);
}

type Loader = {
  frame: RefObject<number>;
  progress: RefObject<number>;
  line: RefObject<HTMLSpanElement | null>;
  count: RefObject<HTMLSpanElement | null>;
};

function drawLoader(loader: Loader, percent: number) {
  loader.progress.current = percent;
  if (loader.count.current) loader.count.current.textContent = `${Math.round(percent)}%`;
  if (loader.line.current) loader.line.current.style.transform = `scaleX(${percent / 100})`;
}

// Count the loader from one percent to another, one animation frame at a time
function countTo(loader: Loader, to: number, ms: number, ease: (t: number) => number) {
  return new Promise<void>((resolve) => {
    cancelAnimationFrame(loader.frame.current);
    const from = loader.progress.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      drawLoader(loader, from + (to - from) * ease(t));
      if (t < 1) loader.frame.current = requestAnimationFrame(tick);
      else resolve();
    };
    loader.frame.current = requestAnimationFrame(tick);
  });
}

export default function PageTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const progress = useRef(0);
  const frame = useRef(0);
  const [target, setTarget] = useState<string | null>(null);
  const [covered, setCovered] = useState(false);
  const [round, setRound] = useState(0);
  const [isPending, startTransition] = useTransition();
  const giveUp = useRef(0);

  // The loader is drawn straight into the DOM every frame, not through state,
  // so counting doesn't re-render the whole page underneath
  const loader = useMemo(() => ({ frame, progress, line: lineRef, count: countRef }), []);

  // 1. Raise the panel while the loader starts counting, 2. only then swap (or reload) the page under it
  const go = async (href: string) => {
    const panel = panelRef.current;
    if (!panel || target !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }
    setTarget(href);
    router.prefetch(href);
    panel.style.visibility = "visible";
    drawLoader(loader, 0);
    countTo(loader, 90, COUNT_MS, (t) => 1 - (1 - t) ** 3); // eases out, saves 10% for "loaded"
    await panel.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], {
      duration: PANEL_MS,
      easing: PANEL_EASE,
      fill: "forwards",
    }).finished;
    setCovered(true);
    // Never leave the loader stuck at 90%: if the new page hasn't arrived by now, do a
    // plain full-page load instead. Cleared as soon as it arrives.
    giveUp.current = window.setTimeout(() => window.location.assign(href), GIVE_UP_MS);
    if (href === pathname) {
      // Same page pressed again: a fresh start, not a cached one. Fresh content from the
      // server, the page's own state reset (filters, page number — PageSlot remounts it),
      // a clean URL and the top of the page, all while the panel covers it.
      window.scrollTo({ top: 0, behavior: "instant" });
      startTransition(() => {
        setRound((r) => r + 1);
        if (window.location.search) router.push(href);
        else router.refresh();
      });
    } else {
      startTransition(() => router.push(href));
    }
  };

  // 3. The new page is on screen under the panel: finish at 100%, then drop the panel back down
  const arrived = covered && !isPending && pathname === target;
  useEffect(() => {
    const panel = panelRef.current;
    if (!arrived || !panel) return;
    clearTimeout(giveUp.current);
    countTo(loader, 100, FINISH_MS, (t) => t)
      .then(
        () =>
          panel.animate([{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], {
            duration: PANEL_MS,
            easing: PANEL_EASE,
            fill: "forwards",
          }).finished,
      )
      .then(() => {
        panel.getAnimations().forEach((animation) => animation.cancel());
        panel.style.visibility = "";
        setCovered(false);
        setTarget(null);
      });
  }, [arrived, loader]);

  return (
    <Context value={{ target, go, ready: target === null || arrived, round }}>
      {children}
      <div ref={panelRef} className={styles.panel} aria-hidden="true">
        <div className={styles.loader}>
          <span className={styles.name}>Korn Natthanat</span>
          <span className={styles.track}>
            <span ref={lineRef} className={styles.line} />
          </span>
          <span ref={countRef} className={styles.count}>
            0%
          </span>
        </div>
      </div>
    </Context>
  );
}
