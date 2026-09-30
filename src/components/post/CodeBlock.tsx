import CopyButton from "./CopyButton";
import styles from "./Post.module.css";

const LANGUAGES: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  typescript: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  javascript: "JavaScript",
  json: "JSON",
  css: "CSS",
  html: "HTML",
  sql: "SQL",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  shell: "Shell",
  py: "Python",
  python: "Python",
  java: "Java",
  yaml: "YAML",
  yml: "YAML",
  md: "Markdown",
  markdown: "Markdown",
};

// title="search.ts" from the fence's info string: ```ts title="search.ts"
const titleOf = (meta: string) => /title="([^"]*)"/.exec(meta)?.[1] ?? "";

type Props = { lang: string; meta: string; code: string };

// 04 code frame (v4): a grey bar — file name, language · line count, Copy — over the
// code on ink. ```output is the result of running something: the bar reads "Output"
// and the command (its title), and lines starting with $ or # are dimmed. A frame
// straight after another joins onto it (CSS).
export default function CodeBlock({ lang, meta, code }: Props) {
  const text = code.replace(/\n$/, "");
  const lines = text.split("\n");
  const output = lang === "output" || lang === "console";
  const title = titleOf(meta);
  const language = LANGUAGES[lang] ?? lang.toUpperCase();
  return (
    <div className={styles.code}>
      <div className={styles.codeBar}>
        {output ? (
          <>
            <span>Output</span>
            {title && <span>{title}</span>}
          </>
        ) : (
          <>
            {title && <span>{title}</span>}
            <span>
              {lang ? `${language} · ` : ""}
              {lines.length} {lines.length === 1 ? "line" : "lines"}
            </span>
          </>
        )}
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
