"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteNav.module.css";
import { usePageTransition } from "./PageTransition";
import { Dot, Slot } from "./travel-dot/TravelDot";
import { pressHandlers, useTravelDot } from "./travel-dot/useTravelDot";

const items = [
  { href: "/", label: "Blog", match: (p: string) => p === "/" || p.startsWith("/posts/") },
  {
    href: "/project",
    label: "Project",
    match: (p: string) => p === "/project" || p.startsWith("/project/"),
  },
  { href: "/about", label: "About", match: (p: string) => p === "/about" },
];

export default function SiteNav() {
  const pathname = usePathname();
  // While the panel is up, the dot already points at where we're going
  const { target, go } = usePageTransition();
  const active = items.findIndex((item) => item.match(target ?? pathname));
  // The nav sits at the top edge, so its dot hops downward
  const { dotRef, itemRef, boing } = useTravelDot(active, "down");

  return (
    <nav className={styles.nav}>
      {items.map((item, i) => (
        <Link
          key={item.href}
          href={item.href}
          ref={itemRef(i)}
          className={styles.item}
          aria-current={i === active ? "page" : undefined}
          data-active={i === active || undefined}
          onNavigate={(e) => {
            if (!go) return;
            e.preventDefault();
            // Blog is also "active" on /posts/…, so compare the actual page, not the item.
            // Same page: bounce in place while the panel reloads it.
            if (item.href === (target ?? pathname)) boing();
            go(item.href);
          }}
          {...pressHandlers}
        >
          <Slot />
          {item.label}
        </Link>
      ))}
      <Dot ref={dotRef} solid />
    </nav>
  );
}
