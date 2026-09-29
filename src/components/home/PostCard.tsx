import Image from "next/image";
import type { CSSProperties } from "react";
import type { PostMeta } from "@/lib/content";
import { shortDate } from "@/lib/format";
import { categories } from "@/lib/site";
import TransitionLink from "../TransitionLink";
import styles from "./PostCard.module.css";

// One card in the 01 grid: 2:1 cover, CATEGORY · tags · (date on hover), title, excerpt
type Props = {
  post: PostMeta;
  delay: number; // reveal-on-scroll stagger (ms)
  reveal?: boolean;
  order: number; // position on the page, for the page-change stagger
};

export default function PostCard({ post, delay, reveal = true, order }: Props) {
  const category = categories.find((c) => c.slug === post.category)?.label ?? post.category;
  return (
    <TransitionLink
      href={`/posts/${post.slug}`}
      className={styles.card}
      data-reveal={reveal || undefined}
      data-d={reveal ? delay : undefined}
      style={{ "--i": order } as CSSProperties}
    >
      <div className={styles.cover}>
        {post.cover && (
          <Image
            src={`/${post.cover}`}
            alt={post.coverAlt}
            fill
            sizes="(min-width: 1024px) min(33vw, 560px), (min-width: 768px) 50vw, 100vw"
            className={styles.image}
          />
        )}
      </div>
      <div className={styles.meta}>
        <span className="label">{category}</span>
        {post.tags.length > 0 && <span className={styles.tags}>{post.tags.join(", ")}</span>}
        <span className={styles.dateClip}>
          <span className={`label ${styles.date}`}>{shortDate(post.publishedAt)}</span>
        </span>
      </div>
      <h2 className={styles.title}>{post.title}</h2>
      <p className={styles.excerpt}>{post.excerpt}</p>
    </TransitionLink>
  );
}
