"use client";

import Image from "next/image";
import Link from "next/link";
import { useContext, useRef } from "react";
import { still } from "@/lib/clips";
import { type Check, postChecks } from "@/lib/checks";
import { longDate } from "@/lib/format";
import type { IndexEntry } from "@/lib/schema";
import { categories, projectCategories } from "@/lib/site";
import { publicUrl } from "./AdminCards";
import PaneShell, { LiftContext } from "./PaneShell";
import styles from "./Admin.module.css";
import { useHoverTip } from "./useHoverTip";

type Props = { post: IndexEntry | null; sheetOpen: boolean; onClose: () => void };

const categoryLabel = (slug: string) =>
  [...categories, ...projectCategories].find((c) => c.slug === slug)?.label ?? slug;

// "2026-09-29T14:16:21+07:00" → "29 Sep 2026 · 14:16"
const stamp = (iso: string) => {
  const [d, t] = iso.split("T");
  return t ? `${longDate(d)} · ${t.slice(0, 5)}` : longDate(d);
};

const size = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

// 06 details pane (v4 data-dpane): the selected post — cover, title and excerpt, its
// Checks (red, when anything's wrong), then Post, Dates, Content and File, and the
// actions. Beside the cards from 1024; below that a sheet that rises from the bottom
// when a card is tapped (v4 _sheets). Publish / Unpublish / Delete come with the
// editor (5.3): they write the .md and index.json in one commit.
export default function Details({ post, sheetOpen, onClose }: Props) {
  return (
    <PaneShell label="Post details" itemKey={post?.id ?? null} sheetOpen={sheetOpen} onClose={onClose}>
      {post && (
        <div className={styles.paneBody} key={post.id} data-pane-scroll>
          <Cover src={post.cover} />
          <div className={styles.paneHead}>
            <span className={styles.paneTitle}>{post.title}</span>
            <span className={styles.paneExcerpt}>{post.excerpt}</span>
          </div>

          {/* Edit and View right under the title, where a pick lands (v4 had them at the
            foot, out of sight once the details scroll); Unpublish / Delete stay at the
            foot, away from them (owner, 1 Oct 69) */}
          <div className={styles.paneActs}>
            <Link href={`/admin/posts/${post.slug}`} className={styles.btnm}>
              Edit post
            </Link>
            {post.status === "draft" ? (
              <button
                type="button"
                className={styles.btnl}
                aria-disabled="true"
                title="Comes with the editor (5.3)"
              >
                Publish
              </button>
            ) : (
              <a href={publicUrl(post)} target="_blank" rel="noopener" className={styles.btnl}>
                View
              </a>
            )}
          </div>

          <Checks checks={postChecks(post)} />

          <dl className={styles.facts}>
            <dt className={`label ${styles.factsHead}`}>Post</dt>
            <dt className="label">Status</dt>
            <dd className={styles.status} data-draft={post.status === "draft" || undefined}>
              {post.status === "draft" ? "Draft" : "Published"}
            </dd>
            <dt className="label">Category</dt>
            <dd>{categoryLabel(post.category)}</dd>
            <dt className="label">{post.section === "project" ? "Stack" : "Tags"}</dt>
            <dd className={styles.mono}>{post.tags.join(", ") || "—"}</dd>
          </dl>
          <dl className={styles.facts}>
            <dt className={`label ${styles.factsHead}`}>Dates</dt>
            <dt className="label">Created</dt>
            <dd className={styles.mono}>{stamp(post.createdAt)}</dd>
            <dt className="label">Published</dt>
            <dd className={styles.mono}>
              {post.status === "draft" ? "Not yet" : longDate(post.publishedAt)}
            </dd>
            <dt className="label">Edited</dt>
            <dd className={styles.mono}>{longDate(post.updatedAt)}</dd>
          </dl>
          <dl className={styles.facts}>
            <dt className={`label ${styles.factsHead}`}>Content</dt>
            <dt className="label">Words</dt>
            <dd>{post.words.toLocaleString("en")}</dd>
            <dt className="label">Read time</dt>
            <dd>{post.readMinutes} min</dd>
            <dt className="label">Images</dt>
            <dd>{post.images}</dd>
            <dt className="label">Videos</dt>
            <dd>{post.videos}</dd>
            <dt className="label">Code blocks</dt>
            <dd>{post.codeBlocks}</dd>
          </dl>
          <dl className={styles.facts}>
            <dt className={`label ${styles.factsHead}`}>File</dt>
            <dt className="label">Size</dt>
            <dd>{size(post.bytes)}</dd>
            <dt className="label">Last commit</dt>
            <dd className={styles.mono}>{post.lastCommit ?? "—"}</dd>
            <dt className="label">Revisions</dt>
            <dd>{post.revisions}</dd>
            <dt className="label">Path</dt>
            <dd className={styles.mono}>{post.file}</dd>
          </dl>

          <div className={styles.danger}>
            {post.status === "draft" ? (
              <span
                className={styles.delete}
                aria-disabled="true"
                title="Comes with the editor (5.3)"
              >
                Delete draft
              </span>
            ) : (
              <span
                className={styles.unpublish}
                aria-disabled="true"
                title="Comes with the editor (5.3)"
              >
                Unpublish
              </span>
            )}
            <span className={styles.dangerNote}>
              {post.status === "draft" ? "drafts only" : "published posts can’t be deleted"}
            </span>
          </div>
          <span className={styles.hint}>
            Click or arrow keys to select · Enter or double-click to open
          </span>
        </div>
      )}
    </PaneShell>
  );
}

// Checks (v4 data-dp-iss): every check, with what it means on hover
function Checks({ checks }: { checks: Check[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useHoverTip(ref);
  const bad = checks.filter((c) => c.ok === false).length;
  return (
    <div ref={ref} className={styles.checks} data-bad={bad || undefined}>
      <span className={styles.checksHead}>
        <span className="label" data-tip="Should be clear before publishing · hover each item">
          Checks
        </span>
        <span className={styles.mono}>
          {bad ? `${bad} ${bad > 1 ? "issues" : "issue"}` : "All clear"}
        </span>
      </span>
      <div className={styles.checksList}>
        {[0, 1].map((col) => (
          <div key={col} className={styles.checksCol}>
            {checks
              .filter((_, i) => i % 2 === col)
              .map((c) => (
                <span
                  key={c.label}
                  className={styles.check}
                  data-state={c.ok === false ? "bad" : c.ok ? "ok" : "later"}
                  data-tip={c.tip}
                >
                  <span className={styles.checkBox} aria-hidden="true" />
                  <span className={styles.checkText}>
                    {c.label}
                    {c.note && <span className={styles.checkNote}>{c.note}</span>}
                  </span>
                </span>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// The cover, with its hover tip (set by Details while a click would scroll the page)
function Cover({ src }: { src: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const onClick = useContext(LiftContext);
  useHoverTip(ref);
  return (
    <div ref={ref} className={styles.paneCover} data-cover onClick={onClick}>
      {src && <Image src={`/${still(src)}`} alt="" fill sizes="320px" className={styles.cover} />}
    </div>
  );
}
