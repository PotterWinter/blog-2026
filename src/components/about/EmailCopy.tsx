"use client";

import { useEffect, useRef, useState } from "react";
import CursorBadge from "./CursorBadge";
import styles from "./About.module.css";

// The email row in Contact: a press copies the address instead of opening a mail app
// (owner, 12 Oct 69 — mailto: did nothing for anyone without one set up). The badge
// says Copy → Copied, the ⧉ turns to a ✓ and the note under it says so for 1.6s, on
// phones too. Still a mailto: link underneath: no clipboard (or no JS) opens the mail
// app as before.
export default function EmailCopy({ email, note }: { email: string; note: string }) {
  const [done, setDone] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!navigator.clipboard) return; // let mailto: open the mail app
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      window.location.href = `mailto:${email}`;
      return;
    }
    clearTimeout(timer.current);
    setDone(true);
    timer.current = window.setTimeout(() => setDone(false), 1600);
  };

  return (
    <a className={styles.bigLink} href={`mailto:${email}`} onClick={copy} data-done={done || undefined}>
      <CursorBadge label={done ? "Copied" : "Copy"} />
      <span className={styles.bigText}>
        <span className={styles.email}>{email}</span>
        <span className={styles.arrow}>{done ? <Tick /> : <span className={styles.copyIcon}>⧉</span>}</span>
      </span>
      <span className="label" aria-live="polite">
        {done ? "Copied to clipboard" : note}
      </span>
    </a>
  );
}

// As big as the CV row's ↓ (1em tall, its 1.2 line): the code block's small tick looked
// lost beside the address (owner, 12 Oct 69)
const Tick = () => (
  <svg
    viewBox="0 0 26 26"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="square"
    aria-hidden="true"
  >
    <path vectorEffect="non-scaling-stroke" d="M1 14l8 8L25 4" />
  </svg>
);
