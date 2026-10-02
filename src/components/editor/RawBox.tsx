"use client";

import { useLayoutEffect, useRef, useState } from "react";
import CopyButton from "../post/CopyButton";
import styles from "./Editor.module.css";

// RAW .MD (v4 07 rawbox): the post as its .md in a dark box, file name and line count
// on a grey bar, Copy. Typing changes the fields above as soon as the text reads as a
// post; while it doesn't (a frontmatter line half typed), what's wrong shows under the
// bar and the fields wait. The fields changing update the text — unless you're in it.
// Plain text only: images go in through WRITE (Tiptap, 5.3d), not here — the image
// syntaxes are too many to type by hand (owner, 2 Oct 69; the 5.4b Image button that
// was here is in git history).
export default function RawBox({
  file,
  text,
  onChange,
  reset,
}: {
  file: string;
  text: string;
  onChange: (text: string) => void;
  // Changes when the text changed under you (a save put the images' paths in): what's
  // typed gives way to it, the cursor stays as far from the end as it was
  reset: number;
}) {
  const [draft, setDraft] = useState<string | null>(null); // what's typed, while in the box
  const [problem, setProblem] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fromEndRef = useRef(0);
  const [seen, setSeen] = useState(reset);
  if (reset !== seen) {
    setSeen(reset);
    setDraft(null);
  }
  const value = draft ?? text;

  // Grows with the text: the page scrolls, not the box
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${area.scrollHeight}px`;
  }, [value]);

  // After a reset, while you're in the box: the cursor back where it was
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area || document.activeElement !== area) return;
    const at = Math.max(0, area.value.length - fromEndRef.current);
    area.setSelectionRange(at, at);
  }, [seen]);

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
        {/* The post page's Copy (⧉ → ✓, "Copy" → "Copied" letter by letter) */}
        <CopyButton text={value} label="Copy markdown" />
      </div>
      {problem && <p className={styles.rawProblem}>{problem} · the fields wait until it reads as a post</p>}
      <textarea
        ref={areaRef}
        className={styles.rawText}
        value={value}
        spellCheck={false}
        onFocus={() => setDraft(text)}
        onChange={(e) => type(e.target.value)}
        onSelect={(e) => {
          fromEndRef.current = e.currentTarget.value.length - e.currentTarget.selectionEnd;
        }}
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
