import type { ReactNode } from "react";
import styles from "./Header.module.css";
import TransitionLink from "./TransitionLink";

// className: extra styling for one kind of page (the admin's wraps its menu on phones)
export default function Header({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header className={className ? `${styles.header} ${className}` : styles.header}>
      <TransitionLink href="/" className={styles.mark}>
        <span className={styles.window}>
          <span className={styles.line}>Code by Korn Natthanat</span>
        </span>
      </TransitionLink>
      {children}
    </header>
  );
}