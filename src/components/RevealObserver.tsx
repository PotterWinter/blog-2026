"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { usePageTransition } from "./PageTransition";

// Watches every [data-reveal] block on the page and marks it data-in when it scrolls
// into view (after its data-d delay). Waits while the transition panel covers the page,
// so the fade-up plays where you can see it, then rescans on every page change.
export default function RevealObserver() {
  const pathname = usePathname();
  const { ready } = usePageTransition();

  useEffect(() => {
    if (!ready) return;
    const timers: number[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // In view, or already scrolled past (e.g. after a jump): show it
          if (!entry.isIntersecting && entry.boundingClientRect.top > 0) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          timers.push(window.setTimeout(() => (el.dataset.in = ""), Number(el.dataset.d ?? 0)));
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll("[data-reveal]:not([data-in])").forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [pathname, ready]);

  return null;
}
