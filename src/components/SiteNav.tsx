"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import styles from "./SiteNav.module.css";

const DOT = 8;

const items = [
  { href: "/", label: "Blog", match: (p: string) => p === "/" || p.startsWith("/posts/") },
  {
    href: "/project",
    label: "Project",
    match: (p: string) => p === "/project" || p.startsWith("/projects/"),
  },
  { href: "/about", label: "About", match: (p: string) => p === "/about" },
];

// Where the dot rests once the slots finish animating: the active slot's left edge,
// minus the width of any earlier slot that is still collapsing.
function restingPoint(links: (HTMLAnchorElement | null)[], active: number) {
  const link = links[active]!;
  let x = link.offsetLeft;
  for (let i = 0; i < active; i++) {
    const slot = links[i]?.firstElementChild as HTMLElement | null | undefined;
    x -= slot?.offsetWidth ?? 0;
  }
  const y = link.offsetTop + link.offsetHeight / 2 - DOT / 2;
  return { x, y };
}

export default function SiteNav() {
  const pathname = usePathname();
  const active = items.findIndex((item) => item.match(pathname));

  const dotRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useLayoutEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;

    const place = () => {
      if (active === -1) {
        delete dot.dataset.ready;
        return;
      }
      const { x, y } = restingPoint(linkRefs.current, active);
      dot.style.transform = `translate(${x}px, ${y}px)`;
      dot.dataset.ready = "";
    };

    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active]);

  return (
    <nav className={styles.nav}>
      {items.map((item, i) => (
        <Link
          key={item.href}
          href={item.href}
          ref={(el) => {
            linkRefs.current[i] = el;
          }}
          className={styles.item}
          aria-current={i === active ? "page" : undefined}
        >
          <span className={styles.slot} />
          {item.label}
        </Link>
      ))}
      <span ref={dotRef} className={styles.dot} aria-hidden="true" />
    </nav>
  );
}