"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Waiting } from "./waiting";
import styles from "./Editor.module.css";

// RAW .MD (v4 07 rawbox): the post as its .md in a dark box, file name and line count
// on a grey bar, Copy. Typing changes the fields above as soon as the text reads as a
// post; while it doesn't (a frontmatter line half typed), what's wrong shows under the
// bar and the fields wait. The fields changing update the text — unless you're in it.
// Images (5.4b): the Image button, or a file dropped or pasted into the text, goes to
// the editor to become a WebP; what comes back lands where the cursor is.
export default function RawBox({
  file,
  text,
  onChange,
  onImages,
  reset,
  waiting,
  stem,
  onRename,
}: {
  file: string;
  text: string;
  onChange: (text: string) => void;
  onImages: (files: File[]) => Promise<string | null>;
  // Changes when the text changed under you (a save put the images' paths in): what's
  // typed gives way to it, the cursor stays as far from the end as it was
  reset: number;
  // The images in the text still waiting for Save, each with its name to type over
  waiting: Waiting[];
  stem: string;
  onRename: (key: string, typed: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null); // what's typed, while in the box
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [over, setOver] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
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
    // After an image went in: the cursor where it should be
    if (caretRef.current != null) {
      area.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
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

  // Images become their own paragraph, a blank line either side (an image inside a line
  // of text isn't a figure). One image: the cursor waits in its [alt]; several: after them.
  const addImages = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length || adding) return;
    setAdding(true);
    const md = await onImages(images);
    setAdding(false);
    const area = areaRef.current;
    if (!md || !area) return;
    const now = area.value;
    const before = now.slice(0, area.selectionStart).replace(/[ \t]+$/, "");
    const after = now.slice(area.selectionEnd).replace(/^[ \t]+/, "");
    const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const tail = after.startsWith("\n\n") ? "" : after.startsWith("\n") || after === "" ? "\n" : "\n\n";
    const at = before.length + lead.length;
    caretRef.current = md.includes("\n") ? at + md.length : at + 2;
    area.focus();
    type(before + lead + md + tail + after);
  };

  return (
    <div className={styles.raw}>
      <div className={styles.rawBar}>
        <span className={styles.mono}>{file}</span>
        <span className={styles.mono}>Markdown · {value.split("\n").length} lines</span>
        <button
          type="button"
          className={`${styles.copy} ${styles.addImage}`}
          disabled={adding}
          title="Adds images where the cursor is · or drop / paste them into the text"
          onClick={() => pickRef.current?.click()}
        >
          {adding ? "Making WebP…" : "Image"}
        </button>
        <input
          ref={pickRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = ""; // the same file again still counts
            void addImages(files);
          }}
        />
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
      {waiting.length > 0 && (
        <ul className={styles.waitingList}>
          {waiting.map((image) => (
            <li key={image.key} className={styles.waitingItem}>
              {/* eslint-disable-next-line @next/next/no-img-element -- from memory, not in the repo yet */}
              <img src={image.url} alt="" className={styles.waitingThumb} />
              <label className={styles.waitingName}>
                <span className={styles.mono}>{stem}</span>
                <input
                  className={styles.mono}
                  defaultValue={image.key}
                  size={Math.max(8, image.key.length + 1)}
                  spellCheck={false}
                  aria-label="Image file name"
                  onBlur={(e) => onRename(image.key, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.currentTarget.value = image.key;
                      e.currentTarget.blur();
                    }
                  }}
                />
                <span className={styles.mono}>.webp</span>
              </label>
              <span className={styles.mono}>
                {image.width} × {image.height} · {Math.round(image.bytes / 1024)} KB · waits for Save
              </span>
            </li>
          ))}
        </ul>
      )}
      {problem && <p className={styles.rawProblem}>{problem} · the fields wait until it reads as a post</p>}
      <textarea
        ref={areaRef}
        className={styles.rawText}
        data-over={over || undefined}
        value={value}
        spellCheck={false}
        onFocus={() => setDraft(text)}
        onChange={(e) => type(e.target.value)}
        onSelect={(e) => {
          fromEndRef.current = e.currentTarget.value.length - e.currentTarget.selectionEnd;
        }}
        onPaste={(e) => {
          // A screenshot copied: an image, not text
          const files = [...e.clipboardData.files];
          if (!files.some((f) => f.type.startsWith("image/"))) return;
          e.preventDefault();
          void addImages(files);
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return; // dragging text stays text
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setOver(false);
          void addImages([...e.dataTransfer.files]);
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
