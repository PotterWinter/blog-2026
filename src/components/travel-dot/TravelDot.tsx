import type { Ref } from "react";
import styles from "./TravelDot.module.css";

// The dot itself. Put it last inside the group. `solid` for one inside the sticky
// header, where a difference blend can't reach the page (see the CSS).
export function Dot({ ref, solid = false }: { ref: Ref<HTMLSpanElement>; solid?: boolean }) {
  return (
    <span ref={ref} className={styles.dot} data-blend={solid ? undefined : ""} aria-hidden="true">
      <span className={styles.ink} />
    </span>
  );
}

// Put first inside each label. Opens 13px of room when the label has data-active.
export function Slot() {
  return <span className={styles.slot} />;
}
