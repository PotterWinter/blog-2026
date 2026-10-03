// A code frame's fence line (```ts attach title="search.ts"), as WRITE's grey bar shows
// it: a name, a language picked from a list (Output last), joined or not — the words
// of the fence written behind it (owner, 3 Oct 69: the raw line read as RAW, not WRITE).

import { ALIASES, canonical, LANGS, OUTPUT } from "@/lib/codeLangs";

export { canonical, OUTPUT };

export type Info = {
  lang: string; // "ts", "output", "" for none
  name: string; // without the extension (the language adds it); an Output's command
  attach: boolean;
  rest: string[]; // anything else the fence said, kept as it was
};

const ATTACH = "attach";
const TITLE = /title="([^"]*)"/;

export function readInfo(info: string): Info {
  const title = TITLE.exec(info)?.[1] ?? "";
  const words = info.replace(TITLE, " ").split(/\s+/).filter(Boolean);
  const attach = words.includes(ATTACH);
  const rest = words.filter((w) => w !== ATTACH);
  const lang = rest[0] && !rest[0].includes("=") ? rest.shift()! : "";
  return { lang, name: canonical(lang) === OUTPUT ? title : stripExt(title, canonical(lang)), attach, rest };
}

export function writeInfo({ lang, name, attach, rest }: Info): string {
  const code = canonical(lang);
  const title = !name ? "" : known(code) ? `${name}.${code}` : name;
  return [lang, attach && ATTACH, ...rest, title && `title="${title.replace(/"/g, "")}"`].filter(Boolean).join(" ");
}

// "search.ts" with TypeScript picked → "search"
const stripExt = (name: string, lang: string) => (known(lang) && name.endsWith(`.${lang}`) ? name.slice(0, -lang.length - 1) : name);
// A language from the list adds its extension; one from an old post ("rust") leaves the
// name as it was typed
export const known = (code: string) => LANGS.some((l) => l.code === code);

// A name typed with an extension the list knows ("app.py"): the language follows it,
// the extension leaves the name (it's shown after it)
export function typedName(info: Info, typed: string): Info {
  const ext = /\.([a-z0-9]+)$/i.exec(typed)?.[1].toLowerCase();
  if (canonical(info.lang) !== OUTPUT && ext) {
    const code = ALIASES[ext] ?? ext;
    if (LANGS.some((l) => l.code === code)) return { ...info, lang: code, name: typed.slice(0, -ext.length - 1) };
  }
  return { ...info, name: typed };
}

// The list for the picker: the known ones, this frame's own if it isn't among them
export function langOptions(lang: string) {
  const code = canonical(lang);
  const own = code && code !== OUTPUT && !LANGS.some((l) => l.code === code) ? [{ code, label: code }] : [];
  return [{ code: "", label: "Text" }, ...LANGS, ...own];
}
