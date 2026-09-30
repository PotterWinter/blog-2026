import type { ReactNode } from "react";
import styles from "./Hero.module.css";

type Props = {
  first: string; // "Hello, I am"
  second: string; // "Korn."
  intro: ReactNode;
};

// Page hero (01 home, 02 Project), per the v4 frames:
//   < 1024   the two words, with the intro on the next line
//   1024+    the intro beside them on the same line
//   1280+    the three-column grid
export default function Hero({ first, second, intro }: Props) {
  return (
    <section className={styles.hero}>
      <h1 className={styles.title}>
        <span className={styles.word} data-reveal>
          {first}
        </span>{" "}
        <span className={styles.word} data-reveal data-d="90">
          {second}
        </span>
      </h1>
      {/* Below 1024, forces the intro onto its own line. flex-basis 100% alone isn't
          enough: max-width 640 lets the intro squeeze in beside the words at ~800–1000px. */}
      {/* 768–1023: stands in for the right half, so the second word centres in the
          space between the first and the middle of the page (as it does beside the
          intro from 1024) */}
      <span className={styles.half} aria-hidden="true" />
      <span className={styles.break} aria-hidden="true" />
      <p className={styles.intro} data-reveal data-d="160">
        {intro}
      </p>
    </section>
  );
}

// Phrases that read badly split across lines are kept whole
export function Keep({ children }: { children: ReactNode }) {
  return <span className={styles.keep}>{children}</span>;
}
