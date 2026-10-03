import { canonical, langLabel, OUTPUT } from "@/lib/codeLangs";
import CopyButton from "./CopyButton";
import styles from "./Post.module.css";


// title="search.ts" from the fence's info string: ```ts title="search.ts"
const titleOf = (meta: string) => /title="([^"]*)"/.exec(meta)?.[1] ?? "";

type Props = { lang: string; meta: string; code: string };

// 04 code frame (v4): a grey bar — file name, then what it is beside Copy — over the
// code on ink. ```output is the result of running something: the bar reads "Output"
// and the command (its title), and lines starting with $ or # are dimmed. A frame
// marked attach joins onto the one above (CSS).
export default function CodeBlock({ lang: fence, meta, code }: Props) {
  // ```attach alone: no language, joined
  const attach = fence === "attach" || /(^|\s)attach(?=\s|$)/.test(meta);
  const lang = fence === "attach" ? "" : fence;
  const text = code.replace(/\n$/, "");
  const lines = text.split("\n");
  const output = canonical(lang) === OUTPUT;
  const title = titleOf(meta);
  return (
    <div className={styles.code} data-attach={attach || undefined}>
      <div className={styles.codeBar}>
        {/* Its name first, in ink (an Output's command); what it is beside Copy — the
            name's extension says most of that already. No line count (owner, 3 Oct 69). */}
        {title && <span className={styles.codeName}>{title}</span>}
        <span className={styles.codeKind}>{langLabel(lang)}</span>
        <CopyButton text={text} />
      </div>
      <pre className={styles.term}>
        <code>
          {lines.map((line, i) => (
            <span key={i} className={output && /^\s*[$#]/.test(line) ? styles.dim : undefined}>
              {line || " "}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
