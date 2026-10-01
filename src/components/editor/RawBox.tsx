"use client";

import { useLayoutEffect, useRef, useState } from "react";
import styles from "./Editor.module.css";

// RAW .MD (v4 07 rawbox): the post as its .md in a dark box, file name and line count
// on a grey bar, Copy. Typing changes the fields above as soon as the text reads as a
// post; while it doesn't (a frontmatter line half typed), what's wrong shows under the
// bar and the fields wait. The fields changing update the text — unless you're in it.
export default function RawBox({ file, text, onChange }: { file: string; text: string; onChange: (text: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null); // what's typed, while in the box
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const value = draft ?? text;

  // Grows with the text: the page scrolls, not the box
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
  }, [value]);

  const type = (next: string) => {
    setDraft(next);
    try {
      onChange(next);
      setProblem(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message.replace(/^posts\/[^:]+: /, "") : "Not a post yet");
    }
  };

  return (
    <div className={styles.raw}>
      <div className={styles.rawBar}>
        <span className={styles.mono}>{file}</span>
        <span className={styles.mono}>Markdown · {value.split("\n").length} lines</span>
        <button
          type="button"
          className={styles.copy}
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1400);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {problem && <p className={styles.rawProblem}>{problem} · the fields wait until it reads as a post</p>}
      <textarea
        ref={areaRef}
        className={styles.rawText}
        value={value}
        spellCheck={false}
        onFocus={() => setDraft(text)}
        onChange={(e) => type(e.target.value)}
        onBlur={() => {
          // Leaving with the text unreadable keeps it on screen to fix; otherwise the
          // box goes back to following the fields
          if (!problem) setDraft(null);
        }}
        aria-label="Markdown"
      />
    </div>
  );
}
