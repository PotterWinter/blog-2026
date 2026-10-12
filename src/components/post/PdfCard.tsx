import type { ClipEntry } from "@/lib/clips";
import { fileSize } from "@/lib/format";
import styles from "./Post.module.css";

// A PDF in a post (owner, 12 Oct 69 — papers and book notes in Reading): a card, not the
// document itself (Safari on the iPhone shows only the first page of an embedded PDF).
// Its first page — a WebP in git, beside the images — then the title, its pages and
// size, Open (a new tab) and Download. The file is in Blob (media.json says where); its
// ?download=1 makes Blob send it as a download.
const posterSrc = (poster: string) => (/^(https?:|blob:|\/)/.test(poster) ? poster : `/${poster}`);

export default function PdfCard({ entry, title, caption }: { entry?: ClipEntry; title: string; caption?: string }) {
  if (!entry) return null;
  const pages = entry.pages ? `${entry.pages} ${entry.pages === 1 ? "page" : "pages"} · ` : "";
  const download = entry.url.startsWith("blob:") ? entry.url : `${entry.url}?download=1`;
  return (
    <figure className={styles.pdf}>
      <div className={styles.pdfCard}>
        <a className={styles.pdfPage} href={entry.url} target="_blank" rel="noopener" aria-label={`Open ${title || "the PDF"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a poster from the repo, sized by the card */}
          <img src={posterSrc(entry.poster)} alt="" loading="lazy" />
        </a>
        <div className={styles.pdfInfo}>
          <span className="label">PDF</span>
          <span className={styles.pdfTitle}>{title || "Untitled PDF"}</span>
          <span className={styles.pdfMeta}>
            {pages}
            {fileSize(entry.bytes)}
          </span>
          <span className={styles.pdfLinks}>
            <a href={entry.url} target="_blank" rel="noopener">
              Open
              <svg viewBox="0 0 20 20" width="0.7em" height="0.7em" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path vectorEffect="non-scaling-stroke" d="M1 19 18.5 1.5M10.5 1.5h8v8" />
              </svg>
            </a>
            <a href={download} download>
              Download
              <svg viewBox="0 0 14 26" width="0.45em" height="0.85em" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <path vectorEffect="non-scaling-stroke" d="M7 0v24M1.5 19 7 25l5.5-6" />
              </svg>
            </a>
          </span>
        </div>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
