import styles from "./Jump.module.css";

type Props = {
  text: string;
  // Letters to wait before this run joins the minute's wave (v4: "Korn." and "made."
  // go 11 letters after the line before them)
  lead?: number;
};

// Headline letters that dodge the pointer and sway (v4 data-jump); JumpMotion moves
// them. Each letter is its own inline-block; each word stays whole on a line. Screen
// readers get the plain text instead of the letters.
export default function JumpText({ text, lead = 0 }: Props) {
  const words = text.split(" ");
  return (
    <span data-jump-group data-jump-lead={lead || undefined}>
      <span className={styles.plain}>{text}</span>
      <span aria-hidden="true">
        {words.map((word, w) => (
          <span key={w}>
            {w > 0 && " "}
            <span className={styles.word}>
              {[...word].map((letter, i) => (
                <span key={i} className={styles.letter} data-jump>
                  {letter}
                </span>
              ))}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
