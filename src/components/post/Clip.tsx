"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipEntry } from "@/lib/clips";
import styles from "./Post.module.css";

// A clip on the page (5.4d): its first frame first, always — the file in Blob loads only
// once the clip comes on screen, then plays muted on loop, and pauses when it leaves.
// If the file can't be had (Blob over its free limit is shut for 30 days), the first
// frame simply stays (owner, 2 Oct 69). The poster is a WebP in git, beside the images.
const posterSrc = (poster: string) => (/^(https?:|blob:|\/)/.test(poster) ? poster : `/${poster}`);

export default function Clip({
  entry,
  alt,
  caption,
}: {
  entry?: ClipEntry;
  alt: string;
  caption?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video || !entry) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!video.src) video.src = entry.url;
          if (!still) void video.play().catch(() => {});
        } else video.pause();
      },
      { rootMargin: "200px 0px" },
    );
    seen.observe(video);
    return () => seen.disconnect();
  }, [entry]);
  if (!entry) return null;
  return (
    <figure className={styles.figure}>
      {failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- the first frame, its own size
        <img src={posterSrc(entry.poster)} alt={alt} />
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
          onError={() => setFailed(true)}
        />
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
