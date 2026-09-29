import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Header.module.css";

export default function Header({ children }: { children: ReactNode }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.mark}>
        <span className={styles.window}>
          <span className={styles.line}>Code by Korn Natthanat</span>
        </span>
      </Link>
      {children}
    </header>
  );
}