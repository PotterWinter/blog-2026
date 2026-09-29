import styles from "./Hero.module.css";

// 01 hero, per the v4 frames:
//   < 1024   "Hello, I am Korn." with the intro on the next line
//   1024+    the intro beside it on the same line
//   1280+    the three-column grid
export default function Hero() {
  return (
    <section className={styles.hero}>
      <h1 className={styles.title}>
        <span className={styles.word} data-reveal>
          Hello, I am
        </span>{" "}
        <span className={styles.word} data-reveal data-d="90">
          Korn.
        </span>
      </h1>
      {/* Below 1024, forces the intro onto its own line. flex-basis 100% alone isn't
          enough: max-width 640 lets the intro squeeze in beside the words at ~800–1000px. */}
      <span className={styles.break} aria-hidden="true" />
      {/* Phrases that read badly split across lines are kept whole with .keep */}
      <p className={styles.intro} data-reveal data-d="160">
        I graduated in architecture, <span className={styles.keep}>ended up</span> building
        software, and write here about how things are{" "}
        <span className={styles.keep}>put together.</span> This is{" "}
        <span className={styles.keep}>a notebook,</span>{" "}
        <span className={styles.keep}>not a publication.</span> Posts go up when something breaks
        and <span className={styles.keep}>I finally understand why.</span>
      </p>
    </section>
  );
}
