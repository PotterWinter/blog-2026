"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipEntry } from "@/lib/clips";
import styles from "./Post.module.css";

// A clip on the page (5.4d): its first frame first, always — the file in Blob loads only
// once the clip comes on screen, then plays muted on loop, and pauses when it leaves.
// If the file can't be had (Blob over its free limit is shut for 30 days), the first
// frame simply stays (owner, 2 Oct 69). The poster is a WebP in git, beside the images.
const posterSrc = (poster: string) => (/^(https?:|blob:|\/)/.test(poster) ? poster : `/${poster}`);

// full: <!-- full --> over it — the column's width at --img-max, cropped (cover). Fit
// (none): whole, touching the column's width or --img-max, as a Fit image does.
export default function Clip({
  entry,
  alt,
  caption,
  full = false,
}: {
  entry?: ClipEntry;
  alt: string;
  caption?: string;
  full?: boolean;
}) {
  if (!entry) return null;
  const ratio = entry.width && entry.height ? entry.width / entry.height : undefined;
  return (
    <figure
      className={full ? `${styles.figure} ${styles.full}` : styles.figure}
      style={ratio ? ({ "--r": ratio } as React.CSSProperties) : undefined}
    >
      <ClipVideo entry={entry} alt={alt} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

// A cover filling its box (the post's 2:1, a card's) as next/image's `fill` does
export const FILL = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;

// The video itself, as a clip in the text has it and as a clip cover does (PostHeader,
// filling its 2:1 box: `className` crops it there, as a cover image is).
// Inside a [data-clip-gate] — the list's preview panel and phone card (01B), there all
// the time but shown only with data-on — it plays only while that's shown, too
// (owner, 4 Oct 69): there it'd play, and load, unseen.
export function ClipVideo({
  entry,
  alt,
  className,
  style,
}: {
  entry: ClipEntry;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gate = video.closest<HTMLElement>("[data-clip-gate]");
    let near = false;
    const update = () => {
      if (near && (!gate || gate.hasAttribute("data-on"))) {
        if (video.getAttribute("src") !== entry.url) video.src = entry.url;
        if (!still) void video.play().catch(() => {});
      } else video.pause();
    };
    const seen = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting;
        update();
      },
      { rootMargin: "200px 0px" },
    );
    seen.observe(video);
    const shown = new MutationObserver(update);
    if (gate) shown.observe(gate, { attributes: true, attributeFilter: ["data-on"] });
    return () => {
      seen.disconnect();
      shown.disconnect();
    };
  }, [entry.url]);
  return failed ? (
    // eslint-disable-next-line @next/next/no-img-element -- the first frame, its own size
    <img src={posterSrc(entry.poster)} alt={alt} className={className} style={style} />
  ) : (
    <video
      ref={ref}
      poster={posterSrc(entry.poster)}
      width={entry.width || undefined}
      height={entry.height || undefined}
      muted
      loop
      playsInline
      preload="none"
      aria-label={alt}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
