"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PostLink } from "@/lib/schema";
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

const RECOMMENDED = "2400 × 1200 recommended · 2:1";

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

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export function CoverField({
  cover,
  alt,
  onChange,
  onUpload,
  uploading,
  waiting,
}: {
  cover: string | null;
  alt: string;
  onChange: (cover: string | null, alt: string) => void;
  // Upload / Replace and dropping a file on the box (5.4): the editor sends it
  onUpload: (file: File) => void;
  uploading: boolean;
  waiting?: Waiting; // an image picked, not saved yet: shown from memory
}) {
  const measured = useMeasure(waiting ? null : cover);
  const size = waiting ? { ...waiting, src: cover! } : measured;
  const off = size && Math.abs(size.width / size.height - 2) > 0.06;
  const pickRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className={`${styles.field} ${styles.cover}`}>
      <span className={styles.labelRow}>
        <span className="label" title="Top image of the post · also used when a link is shared">
          Cover
        </span>
        <span className={styles.coverSize} data-off={off || undefined} title={off ? "Covers are 2:1 — this one will be cropped" : undefined}>
          {!cover ? RECOMMENDED : size ? `${size.bytes ? `${kb(size.bytes)} · ` : ""}${size.width} × ${size.height}${off ? " · not 2:1" : ""}` : "…"}
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
          accept="image/*"
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
          if (file?.type.startsWith("image/")) onUpload(file);
        }}
      >
        {waiting ? (
          // Not in the repo yet: from memory (next/image can't optimise a blob: URL)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={waiting.url} alt="" className={`${styles.coverImg} ${styles.coverWaiting}`} />
        ) : cover ? (
          <Image src={`/${cover}`} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className={styles.coverImg} />
        ) : (
          <span className={styles.coverEmpty}>
            No cover · {RECOMMENDED}
            <br />
            drop an image here, or Upload
          </span>
        )}
        {uploading && <span className={styles.coverBusy}>Uploading · making a WebP…</span>}
      </span>
      <label className={styles.inline}>
        <span className="label">File</span>
        <input
          className={`${styles.input} ${styles.mono}`}
          value={waiting ? "named on Save · media/<year>/<id>-cover.webp" : (cover ?? "")}
          readOnly={!!waiting}
          placeholder="media/2026/name.webp"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.trim().replace(/^\.\.\/|^\//, "") || null, alt)}
        />
      </label>
      <label className={styles.inline}>
        <span className="label" title="Read aloud by screen readers · shown if the image fails to load">
          Alt text
        </span>
        <input
          className={`${styles.input} ${styles.strong}`}
          value={alt}
          placeholder="What the image shows"
          onChange={(e) => onChange(cover, e.target.value)}
        />
      </label>
    </div>
  );
}
