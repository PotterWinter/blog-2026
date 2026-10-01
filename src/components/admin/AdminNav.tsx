"use client";

import { usePathname } from "next/navigation";
import TransitionLink from "../TransitionLink";
import SignOut from "../login/SignOut";
import styles from "./Admin.module.css";

const items = [
  { href: "/admin", label: "Posts", match: (p: string) => p === "/admin" || p.startsWith("/admin/posts") },
  { href: "/admin/media", label: "Media", match: (p: string) => p.startsWith("/admin/media") },
  { href: "/admin/settings", label: "Settings", match: (p: string) => p.startsWith("/admin/settings") },
];

// The admin's header (v4 06–09): "Admin", then Posts · Media · Settings · Sign out with
// an ink underline under the current one and drawn in on hover (v4 .navl). On phones
// the links take a row of their own under the logo. They play the page transition, and
// the current one pressed again starts its page over (as the site's nav does).
export default function AdminNav() {
  const pathname = usePathname();
  return (
    <>
      <span className="label">Admin</span>
      <nav className={styles.nav}>
        {items.map((item) => (
          <TransitionLink
            key={item.href}
            href={item.href}
            className={styles.navLink}
            aria-current={item.match(pathname) ? "page" : undefined}
          >
            {item.label}
          </TransitionLink>
        ))}
        <SignOut className={`${styles.navLink} ${styles.signOut}`} />
      </nav>
    </>
  );
}
