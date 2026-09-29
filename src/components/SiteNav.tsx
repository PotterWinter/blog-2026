import Link from "next/link";
import styles from "./SiteNav.module.css";

const items = [
  { href: "/", label: "Blog" },
  { href: "/project", label: "Project" },
  { href: "/about", label: "About" },
];

export default function SiteNav() {
  return (
    <nav className={styles.nav}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={styles.item}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}