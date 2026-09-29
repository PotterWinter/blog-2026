import type { ReactNode } from "react";
import styles from "./Header.module.css";
import TransitionLink from "./TransitionLink";

export default function Header({ children }: { children: ReactNode }) {
  return (
    <header className={styles.header}>
      <TransitionLink href="/" className={styles.mark}>
        <span className={styles.window}>
          <span className={styles.line}>Code by Korn Natthanat</span>
        </span>
      </TransitionLink>
      {children}
    </header>
  );
}