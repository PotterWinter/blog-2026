import Image from "next/image";
import type { Post } from "@/lib/content";
import { longDate, readingMinutes } from "@/lib/format";
import { categories } from "@/lib/site";
import TransitionLink from "../TransitionLink";
import styles from "./Post.module.css";

// 04 top: the 2:1 cover across the page, "Back to Blog", title and excerpt, then a
// ruled strip of Category · Published (+ read time, updated) · Tags
export default function PostHeader({ post }: { post: Post }) {
  const category = categories.find((c) => c.slug === post.category)?.label ?? post.category;
  const updated = post.updatedAt !== post.publishedAt;
  return (
    <>
      <div className={styles.cover} data-reveal>
        {post.cover && (
          <Image
            src={`/${post.cover}`}
            alt={post.coverAlt}
            fill
            priority
            sizes="(min-width: 1680px) 1680px, 100vw"
            className={styles.coverImage}
          />
        )}
      </div>

      <div className={styles.head}>
        <div className={styles.back} data-reveal>
          <TransitionLink href="/" className={`label ${styles.backLink}`}>
            <svg
              viewBox="0 0 26 14"
              width="1.3em"
              height="0.7em"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="square"
              aria-hidden="true"
            >
              <path vectorEffect="non-scaling-stroke" d="M26 7H2M7 1.5 1 7l6 5.5" />
            </svg>{" "}
            Back to Blog
          </TransitionLink>
        </div>
        <h1 id="post-title" className={styles.title} data-reveal data-d="80">
          {post.title}
        </h1>
        <p className={styles.excerpt} data-reveal data-d="160">
          {post.excerpt}
        </p>
      </div>

      <dl className={styles.facts} data-reveal>
        <div className={styles.fact}>
          <dt className="label">Category</dt>
          <dd>{category}</dd>
        </div>
        <div className={styles.fact}>
          <dt className="label">Published</dt>
          <dd>
            {longDate(post.publishedAt)} · {readingMinutes(post.body)} min read
            {updated && <span className={styles.updated}>Updated {longDate(post.updatedAt)}</span>}
          </dd>
        </div>
        {post.tags.length > 0 && (
          <div className={`${styles.fact} ${styles.tagsFact}`}>
            <dt className="label">Tags</dt>
            <dd className={styles.tags}>
              {post.tags.map((tag, i) => (
                <span key={tag} className={styles.tagItem}>
                  {i > 0 && <span className={styles.sep}>·</span>}
                  <TransitionLink href={`/?tags=${encodeURIComponent(tag)}`} className={styles.tag}>
                    {tag}
                  </TransitionLink>
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </>
  );
}
