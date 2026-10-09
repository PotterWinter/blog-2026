import { countWords, readMinutes } from "./words.ts";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// "2026-09-06" → "6 SEP 26" (the v4 card and row date). Read straight from the string,
// never through new Date(), so a timezone can't shift it to the day before.
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year.slice(2)}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-09-06" → "6 Sep 2026" (the post page's Published / Updated)
export function longDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

// A post's number as shown: "012" · in the admin, where every run shares one list, a
// project's "Pro01" and a Private post's "Pri01" (owner, 10 Oct 69 — three letters,
// so the two P's don't clash) · "—" for a draft that was never published
export function postNo(p: { no: number | null; section: string; category?: string }, admin = false): string {
  if (p.no == null) return "—";
  if (!admin) return String(p.no).padStart(3, "0");
  const n = String(p.no).padStart(2, "0");
  if (p.category === "private") return `Pri${n}`;
  return p.section === "project" ? `Pro${n}` : String(p.no).padStart(3, "0");
}

// Minutes to read a markdown body — the same count the index keeps (Thai words found by
// Intl.Segmenter, ~220 a minute)
export function readingMinutes(markdown: string): number {
  return readMinutes(countWords(markdown));
}
