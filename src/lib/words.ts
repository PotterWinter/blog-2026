// Words in a markdown body, Thai included. Thai has no spaces between words, so a split
// on spaces would count a whole Thai sentence as one; Intl.Segmenter knows where Thai
// words break (and handles English the usual way).
const segmenter = new Intl.Segmenter("th", { granularity: "word" });

export function countWords(markdown: string): number {
  let n = 0;
  for (const part of segmenter.segment(markdown)) if (part.isWordLike) n += 1;
  return n;
}

// Minutes to read, at ~220 words a minute, never under one
export function readMinutes(words: number): number {
  return Math.max(1, Math.round(words / 220));
}
