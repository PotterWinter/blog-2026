import Image from "next/image";
import type { Post } from "@/lib/content";
import { longDate, readingMinutes } from "@/lib/format";
import { categories } from "@/lib/site";
import TransitionLink from "../TransitionLink";
import styles from "./Post.module.css";
import ProjectLead from "./ProjectLead";

// 04 top: the 2:1 cover across the page, "Back to Blog", title and excerpt, then a
// ruled strip of Category · Published (+ read time, updated) · Tags.
// A project (04B) goes back to Projects and its strip is Role · Year · Stack (its tags,
// EDITOR-SPEC). With links, the title block is 04B's: the links beside a preview.
export default function PostHeader({ post }: { post: Post }) {
  const category = categories.find((c) => c.slug === post.category)?.label ?? post.category;
  const updated = post.updatedAt !== post.publishedAt;
  const project = post.section === "project";
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
          <TransitionLink href={project ? "/project" : "/"} className={`label ${styles.backLink}`}>
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
            {project ? "Back to Projects" : "Back to Blog"}
          </TransitionLink>
        </div>
        {project && post.links.length > 0 ? (
          <ProjectLead
            title={post.title}
            excerpt={post.excerpt}
            // A link without a screenshot of its own previews as the cover
            links={post.links.map((l) => ({ ...l, preview: l.preview ?? post.cover }))}
          />
        ) : (
          <>
            <h1 id="post-title" className={styles.title} data-reveal data-d="80">
              {post.title}
            </h1>
            <p className={styles.excerpt} data-reveal data-d="160">
              {post.excerpt}
            </p>
          </>
        )}
      </div>

      {project ? (
        <dl className={styles.facts} data-reveal>
          {post.role && (
            <div className={styles.fact}>
              <dt className="label">Role</dt>
              <dd>{post.role}</dd>
            </div>
          )}
          {post.year && (
            <div className={styles.fact}>
              <dt className="label">Year</dt>
              <dd>{post.year}</dd>
            </div>
          )}
          {post.tags.length > 0 && (
            <div className={styles.fact}>
              <dt className="label">Stack</dt>
              <dd>{post.tags.join(", ")}</dd>
            </div>
          )}
        </dl>
      ) : (
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
      )}
    </>
  );
}
