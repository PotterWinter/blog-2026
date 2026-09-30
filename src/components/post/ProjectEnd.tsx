import TransitionLink from "../TransitionLink";
import styles from "./Post.module.css";

// 04B foot (v4): one big "Back to Projects", centred under a rule — in place of 04's
// Previous | Next. Its id makes it the contents rail's "End".
export default function ProjectEnd() {
  return (
    <nav id="post-end" className={styles.projectEnd} aria-label="More projects">
      <TransitionLink href="/project" className={styles.projectBack}>
        Back to Projects
      </TransitionLink>
    </nav>
  );
}
