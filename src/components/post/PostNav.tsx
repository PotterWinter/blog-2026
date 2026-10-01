import type { ForReaders } from "@/lib/content";
import { postUrl } from "@/lib/schema";
import TransitionLink from "../TransitionLink";
import styles from "./Post.module.css";

type Props = { previous: ForReaders | null; next: ForReaders | null };

const Arrow = ({ back }: { back?: boolean }) => (
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
    <path
      vectorEffect="non-scaling-stroke"
      d={back ? "M26 7H2M7 1.5 1 7l6 5.5" : "M0 7h24M19 1.5 25 7l-6 5.5"}
    />
  </svg>
);

// 04 foot (v4): Previous | Next, in the home list's order — Previous is the newer post
// (the one above this in the list), Next the older. The pointer becomes a long arrow.
export default function PostNav({ previous, next }: Props) {
  if (!previous && !next) return null;
  return (
    <nav id="post-end" className={styles.postNav} aria-label="More posts">
      {previous ? (
        <TransitionLink href={postUrl(previous)} className={styles.prev}>
          <span className="label">
            <Arrow back /> Previous
          </span>
          <span className={styles.navTitle}>{previous.title}</span>
        </TransitionLink>
      ) : (
        <span />
      )}
      {next ? (
        <TransitionLink href={postUrl(next)} className={styles.next}>
          <span className="label">
            Next <Arrow />
          </span>
          <span className={styles.navTitle}>{next.title}</span>
        </TransitionLink>
      ) : (
        <span />
      )}
    </nav>
  );
}
