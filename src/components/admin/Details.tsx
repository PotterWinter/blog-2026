"use client";

import Image from "next/image";
import Link from "next/link";
import { postIssues } from "@/lib/checks";
import { longDate } from "@/lib/format";
import type { IndexEntry } from "@/lib/schema";
import { categories, projectCategories } from "@/lib/site";
import { publicUrl } from "./AdminCards";
import styles from "./Admin.module.css";

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
  const issues = post ? postIssues(post) : [];
  return (
    <aside className={styles.pane} data-open={sheetOpen || undefined} aria-label="Post details">
      <div className={styles.sheetBar}>
        <span className="label">Details</span>
        <button type="button" className={styles.sheetClose} aria-label="Close details" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M1 1l12 12M13 1 1 13" />
          </svg>
        </button>
      </div>
      {post && (
        <div className={styles.paneBody} key={post.id}>
          <div className={styles.paneCover}>
            {post.cover && <Image src={`/${post.cover}`} alt="" fill sizes="320px" className={styles.cover} />}
          </div>
          <div className={styles.paneHead}>
            <span className={styles.paneTitle}>{post.title}</span>
            <span className={styles.paneExcerpt}>{post.excerpt}</span>
          </div>

          {issues.length > 0 && (
            <div className={styles.checks}>
              <span className={styles.checksHead}>
                <span className="label">Checks</span>
                <span className={styles.mono}>{issues.length} to fix</span>
              </span>
              <div className={styles.checksList}>
                {issues.map((i) => (
                  <span key={i.label}>
                    {i.label} <span className={styles.mono}>{i.note}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <dl className={styles.facts}>
            <dt className={`label ${styles.factsHead}`}>Post</dt>
            <dt className="label">Status</dt>
            <dd>{post.status === "draft" ? "Draft" : "Published"}</dd>
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
            <dd className={styles.mono}>{post.status === "draft" ? "Not yet" : longDate(post.publishedAt)}</dd>
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
            <dd className={styles.mono}>posts/{post.slug}.md</dd>
          </dl>

          <div className={styles.paneActs}>
            <Link href={`/admin/posts/${post.slug}`} className={styles.btnm}>
              Edit post
            </Link>
            {post.status === "draft" ? (
              <button type="button" className={styles.btnl} aria-disabled="true" title="Comes with the editor (5.3)">
                Publish
              </button>
            ) : (
              <a href={publicUrl(post)} target="_blank" rel="noopener" className={styles.btnl}>
                View
              </a>
            )}
          </div>
          <div className={styles.danger}>
            {post.status === "draft" ? (
              <span className={styles.delete} aria-disabled="true" title="Comes with the editor (5.3)">
                Delete draft
              </span>
            ) : (
              <span className={styles.unpublish} aria-disabled="true" title="Comes with the editor (5.3)">
                Unpublish
              </span>
            )}
          </div>
          <span className={styles.hint}>
            Click or arrow keys to select · Enter or double-click to open
          </span>
        </div>
      )}
    </aside>
  );
}
