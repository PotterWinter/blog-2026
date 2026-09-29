const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

// "2026-09-06" → "6 SEP 26" (the v4 card and row date). Read straight from the string,
// never through new Date(), so a timezone can't shift it to the day before.
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year.slice(2)}`;
}
