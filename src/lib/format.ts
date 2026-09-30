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

// Minutes to read a markdown body at ~220 words a minute. Thai has no spaces between
// words, so its letters count at roughly six to a word.
export function readingMinutes(markdown: string): number {
  const thai = (markdown.match(/[฀-๿]/g) ?? []).length;
  const words = markdown.replace(/[฀-๿]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words + thai / 6) / 220));
}
