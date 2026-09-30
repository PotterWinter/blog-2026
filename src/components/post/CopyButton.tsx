"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./Post.module.css";

// v4's copy pill: "⧉ Copy" → "✓ Copied" for 1.6s. The ⧉ drops out as a ✓ rises in,
// the "y" slips up and away and "ied" rises in letter by letter.
export default function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No clipboard (insecure context): the tick still shows the press registered
    }
    clearTimeout(timer.current);
    setDone(true);
    timer.current = window.setTimeout(() => setDone(false), 1600);
  };

  return (
    <button
      type="button"
      className={styles.copy}
      data-done={done || undefined}
      onClick={copy}
      aria-label={done ? "Copied" : "Copy code"}
    >
      <span className={styles.copyWord} aria-hidden="true">
        <span className={styles.copySym}>
          <span className={styles.copyIcon}>⧉</span>
          <span className={styles.copyTick}>
            <svg
              width="10"
              height="8"
              viewBox="0 0 10 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="square"
            >
              <path d="M1.2 4.2l2.6 2.6L8.8 1.4" />
            </svg>
          </span>
        </span>
        <span className={styles.ch}>Cop</span>
        <span className={`${styles.ch} ${styles.chY}`}>y</span>
        {["i", "e", "d"].map((c, i) => (
          <span
            key={c}
            className={`${styles.ch} ${styles.chL}`}
            style={{ "--i": i } as CSSProperties}
          >
            {c}
          </span>
        ))}
      </span>
    </button>
  );
}
