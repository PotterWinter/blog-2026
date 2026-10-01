"use client";

import { useRef, useSyncExternalStore } from "react";
import type { Check } from "@/lib/checks";
import { commitMessage, toRaw } from "@/lib/edit";
import { longDate, postNo } from "@/lib/format";
import { contentCounts, type IndexEntry } from "@/lib/schema";
import { countWords, readMinutes } from "@/lib/words";
import { useHoverTip } from "../admin/useHoverTip";
import type { Form } from "./Editor";
import styles from "./Editor.module.css";

// v4 07's row under the fields: Commit · Post · Content (counted live from the text) ·
// Checks (live too; Publish with issues asks twice)
export default function MetaRow({
  form,
  file,
  entry,
  checks,
  published,
}: {
  form: Form;
  file: string;
  entry: IndexEntry | null;
  checks: Check[];
  published: boolean;
}) {
  // Counted in the browser only: Intl.Segmenter splits text a little differently in Node
  // and in each browser (253 words on the server, 250 in Chrome), so a count made on
  // the server wouldn't match the page it lands on
  const inBrowser = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const words = inBrowser ? countWords(form.body) : (entry?.words ?? 0);
  const counts = contentCounts(form.body);
  const bytes = new TextEncoder().encode(toRaw(form)).length;
  const bad = checks.filter((c) => c.ok === false).length;
  const tipRef = useRef<HTMLDivElement>(null);
  useHoverTip(tipRef);

  // "2026-10-01T20:33:45+07:00" → "1 Oct 2026 · 20:33:45"
  const stamp = (iso: string) => `${longDate(iso.slice(0, 10))} · ${iso.slice(11, 19)}`;

  return (
    <div className={styles.meta}>
      <dl className={styles.facts}>
        <dt className={`label ${styles.factsHead}`} title="Written for you · date, time, action and post number">
          Commit
        </dt>
        <dt className="label">Message</dt>
        <dd className={styles.mono}>
          {entry ? commitMessage(new Date(), published ? "Edit" : "Draft", entry.id).replace(/ \d\d:\d\d:\d\d/, " …") : "Draft #new"}
        </dd>
        <dt className="label">Last commit</dt>
        <dd className={styles.mono}>{entry?.lastCommit ?? "—"}</dd>
        <dt className="label">Created</dt>
        <dd className={styles.mono}>{entry ? stamp(entry.createdAt) : "on the first save"}</dd>
        <dt className="label">Path</dt>
        <dd className={styles.mono}>{file}</dd>
      </dl>
      <dl className={styles.facts}>
        <dt className={`label ${styles.factsHead}`}>Post</dt>
        <dt className="label">ID</dt>
        <dd className={styles.mono}>{entry ? `#${entry.id}` : "given on save"}</dd>
        <dt className="label">No.</dt>
        <dd className={styles.mono}>{entry?.no != null ? postNo(entry, true) : "given on publish"}</dd>
        <dt className="label">Status</dt>
        <dd className={published ? styles.published : styles.draft}>{published ? "Published" : "Draft"}</dd>
        <dt className="label">Published</dt>
        <dd className={styles.mono}>{entry?.no != null ? longDate(entry.publishedAt) : "— not yet"}</dd>
        <dt className="label">Edited</dt>
        <dd className={styles.mono}>{entry ? longDate(entry.updatedAt) : "—"}</dd>
        <dt className="label">Revisions</dt>
        <dd className={styles.mono}>{entry?.revisions ?? 0}</dd>
        <dt className="label">Size</dt>
        <dd className={styles.mono}>{bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`} · .md only</dd>
      </dl>
      <dl className={styles.facts}>
        <dt className={`label ${styles.factsHead}`} title="Counted live from the text">
          Content
        </dt>
        <dt className="label">Words</dt>
        <dd>{words.toLocaleString("en")}</dd>
        <dt className="label">Read time</dt>
        <dd>{readMinutes(words)} min</dd>
        <dt className="label">Images</dt>
        <dd>{counts.images}</dd>
        <dt className="label">Videos</dt>
        <dd>{counts.videos}</dd>
        <dt className="label">Code</dt>
        <dd>{counts.codeBlocks}</dd>
      </dl>
      <div ref={tipRef} className={styles.checks} data-bad={bad || undefined}>
        <span className={styles.checksHead}>
          <span className="label" data-tip="Should be clear before publishing · hover each item">
            Checks
          </span>
          <span className={styles.mono}>{bad ? `${bad} ${bad > 1 ? "issues" : "issue"}` : "All clear"}</span>
        </span>
        {checks.map((c) => (
          <span key={c.label} className={styles.check} data-state={c.ok === false ? "bad" : c.ok ? "ok" : "later"} data-tip={c.tip}>
            <span className={styles.checkBox} aria-hidden="true" />
            <span>
              {c.label}
              {c.note && <span className={styles.checkNote}>{c.note}</span>}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
