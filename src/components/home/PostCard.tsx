import Image from "next/image";
import type { CSSProperties } from "react";
import { still } from "@/lib/clips";
import type { ForReaders } from "@/lib/content";
import { postUrl } from "@/lib/schema";
import { postNo, shortDate } from "@/lib/format";
import { categories } from "@/lib/site";
import { ClipVideo, FILL } from "../post/Clip";
import TransitionLink from "../TransitionLink";
import styles from "./PostCard.module.css";

// One card in the 01 grid: 2:1 cover, CATEGORY · tags · (date on hover), title, excerpt.
// Phones: NO (left) and date (right) drop into the gap under the cover with the dot.
type Props = {
  post: ForReaders;
  delay: number; // reveal-on-scroll stagger (ms)
  reveal?: boolean;
  order: number; // position on the page, for the page-change stagger
};

export default function PostCard({ post, delay, reveal = true, order }: Props) {
  const category = categories.find((c) => c.slug === post.category)?.label ?? post.category;
  return (
    <TransitionLink
      href={postUrl(post)}
      className={styles.card}
      data-card
      data-reveal={reveal || undefined}
      data-d={reveal ? delay : undefined}
      style={{ "--i": order } as CSSProperties}
    >
      <div className={styles.cover}>
        {post.coverClip ? (
          // A clip cover plays here too, once the card is on screen (owner, 4 Oct 69)
          <ClipVideo entry={post.coverClip} alt={post.coverAlt} className={styles.image} style={FILL} />
        ) : post.cover && (
          <Image
            src={`/${still(post.cover)}`}
            alt={post.coverAlt}
            fill
            sizes="(min-width: 1024px) min(33vw, 560px), (min-width: 768px) 50vw, 100vw"
            className={styles.image}
          />
        )}
      </div>
      {/* Phones: NO · date drop out of the cover's bottom edge into the gap below it */}
      <span className={styles.stampHook} aria-hidden>
        <span className={styles.stampClip}>
          <span className={`label ${styles.stamp}`}>
            <span>NO {postNo(post)}</span>
            <span>{shortDate(post.publishedAt)}</span>
          </span>
        </span>
      </span>
      <div className={styles.meta}>
        <span className={`label ${styles.category}`} data-card-label>
          {category}
        </span>
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
