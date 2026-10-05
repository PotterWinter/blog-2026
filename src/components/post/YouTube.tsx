"use client";

import { useState } from "react";
import styles from "./Post.module.css";

type Props = { id: string; caption: string };

// The video's poster at the sharpest YouTube keeps: 1280 × 720 (maxresdefault) when the
// video has one, else 480 × 360 (hqdefault) — stretched over the column, that one came
// out soft (owner, 5 Oct 69). A missing maxres comes back as a 120 × 90 grey stand-in.
export function YouTubePoster({ id, className }: { id: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- YouTube's own image
    <img
      src={`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`}
      alt=""
      className={className}
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth <= 120) e.currentTarget.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      }}
      onError={(e) => {
        if (!e.currentTarget.src.endsWith("/hqdefault.jpg")) e.currentTarget.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      }}
    />
  );
}

// 04 YouTube facade (v4 _yt): the thumbnail and a PLAY mark; the real player (from
// youtube-nocookie) only loads when pressed, so a post with videos stays light
export default function YouTube({ id, caption }: Props) {
  const [playing, setPlaying] = useState(false);
  return (
    <figure className={styles.video}>
      <div className={styles.videoBox}>
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
            title={caption || "YouTube video"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className={styles.videoPoster}
            onClick={() => setPlaying(true)}
            aria-label={`Play on YouTube: ${caption}`}
          >
            <YouTubePoster id={id} className={styles.videoStill} />
            <svg
              viewBox="0 0 68 48"
              width="68"
              height="48"
              aria-hidden="true"
              className={styles.play}
            >
              <path
                d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
                fill="#ff0000"
              />
              <path d="M45 24 27 14v20" fill="#ffffff" />
            </svg>
          </button>
        )}
      </div>
      {caption && <figcaption className={styles.videoCaption}>{caption}</figcaption>}
    </figure>
  );
}
