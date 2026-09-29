import type { Ref } from "react";
import styles from "./TravelDot.module.css";

// The dot itself. Put it last inside the group.
export function Dot({ ref }: { ref: Ref<HTMLSpanElement> }) {
  return (
    <span ref={ref} className={styles.dot} aria-hidden="true">
      <span className={styles.ink} />
    </span>
  );
}

// Put first inside each label. Opens 13px of room when the label has data-active.
export function Slot() {
  return <span className={styles.slot} />;
}
