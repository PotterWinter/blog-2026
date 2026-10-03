// The languages a code frame can be in (post/CodeBlock shows them, the editor's list
// offers them). Named by extension, as GitHub does; the label is what the bar reads.
export const LANGS: { code: string; label: string }[] = [
  { code: "ts", label: "TypeScript" },
  { code: "tsx", label: "TSX" },
  { code: "js", label: "JavaScript" },
  { code: "jsx", label: "JSX" },
  { code: "css", label: "CSS" },
  { code: "html", label: "HTML" },
  { code: "json", label: "JSON" },
  { code: "sh", label: "Shell" },
  { code: "py", label: "Python" },
  { code: "sql", label: "SQL" },
  { code: "yaml", label: "YAML" },
  { code: "md", label: "Markdown" },
  { code: "java", label: "Java" },
];
export const OUTPUT = "output";
export const ALIASES: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  bash: "sh",
  zsh: "sh",
  shell: "sh",
  python: "py",
  yml: "yaml",
  markdown: "md",
  console: OUTPUT,
};

// What a fence's own word means: "typescript" → "ts", "console" → "output"
export const canonical = (lang: string) => ALIASES[lang] ?? lang;

// What a frame is, on its bar beside Copy: "TypeScript", "Output", "Text" for none
export function langLabel(lang: string) {
  const code = canonical(lang);
  if (code === OUTPUT) return "Output";
  if (!code) return "Text";
  return LANGS.find((l) => l.code === code)?.label ?? code.toUpperCase();
}
