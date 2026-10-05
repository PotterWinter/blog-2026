"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { CLIP, isClip, still, type ClipEntry } from "@/lib/clips";
import type { PostLink } from "@/lib/schema";
import Segmented from "../Segmented";
import type { Waiting } from "./waiting";
import styles from "./Editor.module.css";

// ---------- Tags (v4 07: chips, × to drop one, Manage opens every tag to tick) ----------

export function TagsField({
  label,
  tags,
  all,
  onChange,
}: {
  label: string;
  tags: string[];
  all: string[];
  onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState(0);
  const [find, setFind] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const every = [...new Set([...all, ...tags])].sort();
  const shown = find ? every.filter((t) => t.includes(find.toLowerCase())) : every;
  const toggle = (tag: string) => onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);

  // Opens by easing its height, as the hub's Filter panel
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (wrap && inner) wrap.style.height = `${open ? inner.offsetHeight : 0}px`;
  });

  return (
    <div className={styles.field}>
      <span className={styles.labelRow}>
        <span className="label" title="Keywords for filtering · pick or make one in Manage">
          {label}
        </span>
        <button
          type="button"
          className={styles.manage}
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
            setTurns((n) => n + 1);
          }}
        >
          Manage
          <svg className={styles.plus} width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
            <path d="M0 4.5h9" />
            <path d="M0 4.5h9" style={{ transform: `rotate(${90 + turns * 90}deg)` }} />
          </svg>
        </button>
      </span>
      <span className={styles.chips}>
        {tags.length ? (
          tags.map((tag) => (
            <span key={tag} className={styles.chip}>
              {tag}
              <button type="button" aria-label={`Remove ${tag}`} onClick={() => toggle(tag)}>
                ×
              </button>
            </span>
          ))
        ) : (
          <span className={styles.empty}>None yet · Manage</span>
        )}
      </span>
      <div ref={wrapRef} className={styles.panel}>
        <div ref={innerRef} className={styles.panelInner}>
          <div className={styles.panelHead}>
            <span className="label">On this post</span>
            <span className={styles.mono}>
              {tags.length} {tags.length === 1 ? "tag" : "tags"}
            </span>
            <input
              className={`${styles.input} ${styles.mono} ${styles.find}`}
              value={find}
              onChange={(e) => setFind(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const tag = find.trim();
                if (tag && !tags.includes(tag)) onChange([...tags, tag]);
                setFind("");
              }}
              placeholder="Find or make a tag · Enter"
              spellCheck={false}
            />
          </div>
          <div className={styles.tagGrid}>
            {shown.map((tag) => (
              <button key={tag} type="button" className={styles.tagOpt} data-on={tags.includes(tag) || undefined} onClick={() => toggle(tag)}>
                <span className={styles.box} aria-hidden="true" />
                {tag}
              </button>
            ))}
            {!shown.length && <span className={styles.empty}>No tag “{find}” · Enter makes it</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Links (04B buttons under the lead: up to 3, label ≤ 24) ----------

const PRESETS = ["Live site", "GitHub", "Behance"];
const fromUrl = (url: string) =>
  /github\.com/i.test(url) ? "GitHub" : /behance\.net/i.test(url) ? "Behance" : /^https?:\/\/\S+\.\S+/i.test(url) ? "Live site" : "";

export function LinksField({ links, onChange }: { links: PostLink[]; onChange: (links: PostLink[]) => void }) {
  // Which labels were filled from the URL (and so may change with it)
  const [auto, setAuto] = useState<boolean[]>(() => links.map(() => false));
  const [picking, setPicking] = useState<number | null>(null);

  const update = (i: number, patch: Partial<PostLink>, fromLabel = false) => {
    const next = links.map((l, k) => (k === i ? { ...l, ...patch } : l));
    if (!fromLabel && patch.url != null && (auto[i] || !links[i].label)) {
      next[i].label = fromUrl(patch.url);
      setAuto(auto.map((a, k) => (k === i ? true : a)));
    }
    onChange(next);
  };

  return (
    <div className={styles.field}>
      <span className={styles.labelRow}>
        <span className="label" title="Buttons under the lead · up to 3 · label up to 24 characters">
          Links
        </span>
        <span className={styles.mono}>{links.length} / 3</span>
        {links.length < 3 && (
          <button
            type="button"
            className={styles.manage}
            onClick={() => {
              onChange([...links, { label: "", url: "", preview: null }]);
              setAuto([...auto, true]);
            }}
          >
            Add link
            <svg className={styles.plus} width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
              <path d="M0 4.5h9" />
              <path d="M4.5 0v9" />
            </svg>
          </button>
        )}
      </span>
      {links.map((link, i) => (
        <div key={i} className={styles.linkRow}>
          <span className={styles.linkLabel}>
            <input
              className={styles.input}
              value={link.label}
              maxLength={24}
              placeholder="Label"
              onFocus={() => setPicking(i)}
              onBlur={() => window.setTimeout(() => setPicking(null), 120)}
              onChange={(e) => {
                setAuto(auto.map((a, k) => (k === i ? false : a)));
                update(i, { label: e.target.value }, true);
              }}
            />
            {picking === i && (
              <span className={styles.presets}>
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    data-on={link.label === p || undefined}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setAuto(auto.map((a, k) => (k === i ? false : a)));
                      update(i, { label: p }, true);
                      setPicking(null);
                    }}
                  >
                    {p}
                  </button>
                ))}
                <span className={styles.mono}>or type your own</span>
              </span>
            )}
          </span>
          <input
            className={`${styles.input} ${styles.mono}`}
            value={link.url}
            placeholder="https://"
            spellCheck={false}
            onChange={(e) => update(i, { url: e.target.value.trim() })}
          />
          <button
            type="button"
            className={styles.x}
            aria-label="Remove link"
            onClick={() => {
              onChange(links.filter((_, k) => k !== i));
              setAuto(auto.filter((_, k) => k !== i));
            }}
          >
            ×
          </button>
        </div>
      ))}
      <span className={styles.linkNote}>
        {links.length ? `${links.length} ${links.length > 1 ? "links" : "link"} · page uses the 04B layout` : "No links · page uses the 04 layout"}
      </span>
    </div>
  );
}

// ---------- Cover (the top image, also the card's and the shared link's) ----------
// Beside its label, as v4: the file's size and pixels ("164 KB · 2400 × 1500") — of the
// file itself, not the resized copy the page shows — or, with none yet, the size to aim
// for. Covers are 2:1 (07N: the card, the list's peek and the post's top share one
// crop), 2400 wide covers a 1200px box on a 2× screen.

const posterSrc = (poster: string) => (/^(https?:|blob:|\/)/.test(poster) ? poster : `/${poster}`);

type Measured = { src: string; width: number; height: number; bytes: number };

function useMeasure(src: string | null) {
  const [measured, setMeasured] = useState<Measured | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    const url = `/${src}`;
    const img = new window.Image();
    img.onload = async () => {
      const bytes = await fetch(url)
        .then((r) => r.blob())
        .then((b) => b.size)
        .catch(() => 0);
      if (live) setMeasured({ src, width: img.naturalWidth, height: img.naturalHeight, bytes });
    };
    img.src = url;
    return () => {
      live = false;
    };
  }, [src]);
  return measured?.src === src ? measured : null;
}

// The post's cover on this screen: across the page, up to 1680 (--frame), 2:1
const coverNow = () => String(Math.min(document.documentElement.clientWidth, 1680));
function useCoverFrame() {
  const w = Number(
    useSyncExternalStore(
      (on) => {
        window.addEventListener("resize", on);
        return () => window.removeEventListener("resize", on);
      },
      coverNow,
      () => "1680",
    ),
  );
  return { w, h: Math.round(w / 2) };
}

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export function CoverField({
  cover,
  alt,
  onChange,
  onUpload,
  uploading,
  waiting,
  stem,
  onRename,
  clip,
}: {
  cover: string | null;
  alt: string;
  onChange: (cover: string | null, alt: string) => void;
  // Upload / Replace and dropping a file on the box (5.4): the editor sends it
  onUpload: (file: File) => void;
  uploading: boolean;
  waiting?: Waiting; // an image picked, not saved yet: shown from memory
  // Its file name while it waits: media/2026/003-cover- + the name to type over
  stem: string;
  onRename: (key: string, typed: string) => void;
  clip?: ClipEntry; // the cover's a clip: where it is (waiting: its poster from memory)
}) {
  // Image or Clip (owner, 4 Oct 69): what Upload / Replace picks. It follows the cover —
  // a clip cover shows Clip — and either can be dropped on the box whichever is chosen.
  const clipCover = !!cover && isClip(cover);
  const [kind, setKind] = useState<"image" | "clip">(clipCover ? "clip" : "image");
  const [seen, setSeen] = useState(cover);
  if (cover !== seen) {
    setSeen(cover);
    if (cover) setKind(isClip(cover) ? "clip" : "image");
  }
  const measured = useMeasure(waiting || clipCover ? null : cover);
  const size = clip ? { ...clip, src: cover! } : waiting ? { ...waiting, src: cover! } : measured;
  const off = size && Math.abs(size.width / size.height - 2) > 0.06;
  const pickRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const frame = useCoverFrame();
  // A clip waiting for Save keeps the name its first frame was given (the two go together)
  const clipName = cover?.startsWith(CLIP) ? cover.slice(CLIP.length).replace(/^cover-?/, "") : null;
  return (
    <div className={`${styles.field} ${styles.cover}`}>
      <span className={styles.labelRow}>
        <span className="label" title="Top image or clip of the post · its still is used when a link is shared">
          Cover
        </span>
        <span className={styles.coverActs}>
          <button type="button" className={styles.replace} disabled={uploading} onClick={() => pickRef.current?.click()}>
            {cover ? "Replace" : "Upload"}
          </button>
          {cover && (
            <button type="button" className={styles.remove} onClick={() => onChange(null, alt)}>
              Remove
            </button>
          )}
        </span>
        <input
          ref={pickRef}
          type="file"
          accept={kind === "clip" ? "video/mp4,video/webm" : "image/*"}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // the same file again still counts as a change
            if (file) onUpload(file);
          }}
        />
      </span>
      <span
        className={styles.coverBox}
        data-over={over || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file && /^(image|video)\//.test(file.type)) onUpload(file);
        }}
      >
        {clip ? (
          // Playing here as it will on the page: muted, on loop, filling the 2:1 box
          <video
            key={clip.url}
            src={clip.url}
            poster={posterSrc(clip.poster)}
            className={`${styles.coverImg} ${styles.coverWaiting}`}
            muted
            loop
            autoPlay
            playsInline
          />
        ) : waiting ? (
          // Not in the repo yet: from memory (next/image can't optimise a blob: URL)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={waiting.url} alt="" className={`${styles.coverImg} ${styles.coverWaiting}`} />
        ) : cover ? (
          // A clip not in media.json (the .md edited by hand): its still, if there is one
          <Image src={`/${still(cover)}`} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className={styles.coverImg} />
        ) : (
          <span className={styles.coverEmpty}>
            No cover
            <br />
            drop {kind === "clip" ? "a clip" : "an image"} here, or Upload
          </span>
        )}
        {uploading && (
          <span className={styles.coverBusy}>
            {kind === "clip" ? "Taking the clip's first frame…" : "Uploading · making a WebP…"}
          </span>
        )}
      </span>
      {/* The frame and the file in numbers, worded as an image block's are (owner, 5 Oct
          69): the cover is always 2:1 — on the post across the page up to 1680 wide, on
          the cards — so a 2:1 file shows whole, any other is cropped to it */}
      <span className={styles.coverNote}>
        <span>
          Frame 2:1 · {frame.w} × {frame.h} here · best file 2400 × 1200
          {kind === "clip" ? " · MP4 / WebM up to 5 MB" : ""}
        </span>
        {cover && (
          <span data-off={(off && !clipCover) || undefined}>
            {size
              ? `File ${size.width} × ${size.height}${size.bytes ? ` · ${kb(size.bytes)}` : ""}${clip?.seconds ? ` · ${clip.seconds.toFixed(1)} s` : ""} → ${off ? "cropped to 2:1" : "whole"}`
              : "File …"}
          </span>
        )}
      </span>
      {/* A row of its own, as File and Alt text are: up in the label row it squeezed the
          size into three lines */}
      <div className={`${styles.inline} ${styles.coverType}`}>
        <span className="label">Type</span>
        <Segmented
          label="Cover type"
          options={[
            { value: "image", label: "Image" },
            { value: "clip", label: "Clip" },
          ]}
          value={kind}
          onChange={setKind}
        />
      </div>
      <label className={styles.inline}>
        <span className="label">File</span>
        {clipName != null ? (
          // Held for Save under this name: it stays (renaming would part it from
          // its first frame)
          <span className={`${styles.input} ${styles.coverName}`}>
            <span className={styles.mono}>
              {stem}
              {clipName}.{clip?.url.split(".").pop() ?? "mp4"}
            </span>
          </span>
        ) : waiting ? (
          // Not saved yet: the name is its file's, to type over (Enter or leaving keeps it)
          <span className={`${styles.input} ${styles.coverName}`}>
            <span className={styles.mono}>{stem}</span>
            <input
              key={waiting.key}
              className={styles.mono}
              defaultValue={waiting.key.replace(/^cover-?/, "")}
              spellCheck={false}
              aria-label="Cover file name"
              onBlur={(e) => onRename(waiting.key, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  e.currentTarget.value = waiting.key.replace(/^cover-?/, "");
                  e.currentTarget.blur();
                }
              }}
            />
            <span className={styles.mono}>.webp</span>
          </span>
        ) : (
          <input
            className={`${styles.input} ${styles.mono}`}
            value={cover ?? ""}
            placeholder="media/2026/name.webp"
            spellCheck={false}
            onChange={(e) => onChange(e.target.value.trim().replace(/^\.\.\/|^\//, "") || null, alt)}
          />
        )}
      </label>
      <label className={styles.inline}>
        <span className="label" title="Read aloud by screen readers · shown if the image fails to load">
          Alt text
        </span>
        <input
          className={`${styles.input} ${styles.strong}`}
          value={alt}
          placeholder={clipCover ? "What the clip shows" : "What the image shows"}
          onChange={(e) => onChange(cover, e.target.value)}
        />
      </label>
    </div>
  );
}
