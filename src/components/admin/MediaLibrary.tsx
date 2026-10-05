"use client";

import Image from "next/image";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { mediaHistory } from "@/app/admin/actions";
import { longDate } from "@/lib/format";
import type { MediaItem } from "@/lib/library";
import Segmented from "../Segmented";
import { usePageTransition } from "../PageTransition";
import type { RepoHead } from "./Hub";
import PaneShell, { LiftContext } from "./PaneShell";
import styles from "./Admin.module.css";
import m from "./Media.module.css";

type Filter = "all" | "image" | "clip" | "over" | "unused" | "noalt";

const pad2 = (n: number) => String(n).padStart(2, "0");
const kb = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const total = (bytes: number) =>
  bytes < 1024 * 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB` : `${(bytes / 1024 ** 3).toFixed(1)} GB`;
const name = (path: string) => path.replace(/^.*\//, "");
const clock = (s = 0) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const src = (path: string) => `/${path}`;
const still = (item: MediaItem) => src(item.kind === "clip" ? item.poster! : item.path);
const format = (item: MediaItem) => {
  const ext = /\.(\w+)$/.exec(item.path)?.[1].toLowerCase() ?? "";
  const label = { webp: "WebP", jpg: "JPEG", jpeg: "JPEG", png: "PNG", gif: "GIF", avif: "AVIF", svg: "SVG", mp4: "MP4", webm: "WebM" }[ext] ?? ext.toUpperCase();
  return item.kind === "clip" ? `${label} · ${(item.seconds ?? 0).toFixed(1)} s · muted loop` : label;
};
// "2026-09-29T14:16:21Z" → "29 Sep 2026 · 21:16" (Bangkok, as the rest of the admin)
const stamp = (iso: string) => {
  const t = new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString();
  return `${longDate(t.slice(0, 10))} · ${t.slice(11, 16)}`;
};

// 08 Media (v4): "Media" with the count, a strip of counts (Files · Total size · Over
// size · Unused), All · Images · Videos | Over size · Unused · Missing alt, search over
// file names; every file in a grid beside the selected one's details (a sheet below
// 1024), a full view (Enter or a double-click; ← → through them, Esc), and the content
// repo at the foot. Nothing is uploaded or deleted here: files come and go with the post
// that names them, on Save (owner, 4 Oct 69).
export default function MediaLibrary({ items, head }: { items: MediaItem[]; head: RepoHead }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [full, setFull] = useState<number | null>(null); // the full view, at this index
  const [columns, setColumns] = useState(5);

  const counts = useMemo(
    () => ({
      all: items.length,
      image: items.filter((i) => i.kind === "image").length,
      clip: items.filter((i) => i.kind === "clip").length,
      over: items.filter((i) => i.over).length,
      unused: items.filter((i) => !i.uses.length).length,
      noalt: items.filter((i) => i.noAlt).length,
      bytes: items.reduce((n, i) => n + i.bytes, 0),
    }),
    [items],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (filter === "all" ||
          (filter === "image" && i.kind === "image") ||
          (filter === "clip" && i.kind === "clip") ||
          (filter === "over" && i.over) ||
          (filter === "unused" && !i.uses.length) ||
          (filter === "noalt" && i.noAlt)) &&
        (!q || name(i.path).toLowerCase().includes(q)),
    );
  }, [items, filter, query]);

  // The first file is selected until one is picked; one filtered away gives way to the
  // first of what's left
  const current = shown.find((i) => i.path === picked) ?? shown[0] ?? null;
  const at = current ? shown.indexOf(current) : -1;

  // How many to a row, for ↑ ↓ (v4: 5 from 1280, 4 from 768, 2 on phones)
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1280px)");
    const mid = window.matchMedia("(min-width: 768px)");
    const set = () => setColumns(wide.matches ? 5 : mid.matches ? 4 : 2);
    set();
    wide.addEventListener("change", set);
    mid.addEventListener("change", set);
    return () => {
      wide.removeEventListener("change", set);
      mid.removeEventListener("change", set);
    };
  }, []);

  // ← → ↑ ↓ move the selection (↑ ↓ by a row), Enter opens the full view; in it ← →
  // go through the files and Esc closes it. Not while typing in the search.
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      if (full != null) {
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (step) {
          e.preventDefault();
          const next = (full + step + shown.length) % shown.length;
          setFull(next);
          setPicked(shown[next].path);
        } else if (e.key === "Escape") setFull(null);
        return;
      }
      if (!current) return;
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[e.key];
      if (step) {
        const next = at + step;
        if (next < 0 || next >= shown.length) return;
        e.preventDefault();
        setPicked(shown[next].path);
        document.querySelector(`[data-tile="${CSS.escape(shown[next].path)}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        setFull(at);
      }
    };
  });
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const pills: { value: Filter; label: string; n: number }[] = [
    { value: "all", label: "All", n: counts.all },
    { value: "image", label: "Images", n: counts.image },
    { value: "clip", label: "Videos", n: counts.clip },
  ];
  const issues: { value: Filter; label: string; n: number }[] = [
    { value: "over", label: "Over size", n: counts.over },
    { value: "unused", label: "Unused", n: counts.unused },
    { value: "noalt", label: "Missing alt", n: counts.noalt },
  ];
  const pill = (p: { value: Filter; label: string; n: number }) => (
    <button
      key={p.value}
      type="button"
      className={styles.pill}
      data-on={filter === p.value || undefined}
      onClick={() => setFilter(p.value)}
    >
      {p.label} <span className={styles.pillN}>{p.n}</span>
    </button>
  );

  return (
    <main className={styles.hub}>
      <div className={`${styles.top} ${m.top}`}>
        <h1 className={styles.title}>
          Media<span className={styles.sup}>{counts.all}</span>
        </h1>
        <span className={m.note}>Comes and goes with the posts that use it, on Save</span>
      </div>

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt className="label">Files</dt>
          <dd>{counts.all}</dd>
        </div>
        <div className={styles.stat}>
          <dt className="label">
            <span className={styles.wide}>Total size</span>
            <span className={styles.narrow}>Size</span>
          </dt>
          <dd className={m.nowrap}>{total(counts.bytes)}</dd>
        </div>
        <div className={styles.stat}>
          <dt className="label">
            <span className={styles.wide}>Over size</span>
            <span className={styles.narrow}>Over</span>
          </dt>
          <dd className={counts.over ? m.bad : undefined}>{pad2(counts.over)}</dd>
        </div>
        <div className={styles.stat}>
          <dt className="label">Unused</dt>
          <dd className={counts.unused ? m.bad : undefined}>{pad2(counts.unused)}</dd>
        </div>
      </dl>

      <div className={styles.controls}>
        {pills.map(pill)}
        <span className={m.sep} aria-hidden="true" />
        {issues.map(pill)}
        <span className={styles.break} aria-hidden="true" />
        <label className={styles.search}>
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
            <circle cx="5.5" cy="5.5" r="4" />
            <path d="M8.6 8.6 12 12" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search file names"
            aria-label="Search file names"
          />
        </label>
      </div>

      <div className={styles.body}>
        <div className={styles.split}>
          <div className={m.grid}>
            {shown.map((item, i) => (
              <button
                key={item.path}
                type="button"
                className={m.tile}
                data-tile={item.path}
                data-on={item === current || undefined}
                onClick={() => {
                  setPicked(item.path);
                  setSheet(true);
                }}
                onDoubleClick={() => setFull(i)}
              >
                <span className={m.thumb}>
                  <Image src={still(item)} alt="" fill sizes="(min-width: 768px) 180px, 45vw" className={m.img} />
                  {item.kind === "clip" && <span className={m.length}>▶ {clock(item.seconds)}</span>}
                </span>
                <span className={m.caption}>
                  <span className={m.name} data-bad={!item.uses.length || item.noAlt || undefined}>
                    {name(item.path)}
                  </span>
                  <span className={m.size} data-bad={item.over || undefined}>
                    {kb(item.bytes)}
                  </span>
                </span>
              </button>
            ))}
            {!shown.length && <p className={m.empty}>Nothing matches</p>}
          </div>
          <MediaDetails item={current} sheetOpen={sheet && current != null} onClose={() => setSheet(false)} onFull={() => setFull(at)} />
        </div>
      </div>

      {full != null && shown[full] && (
        <FullView
          item={shown[full]}
          at={full}
          of={shown.length}
          onStep={(step) => {
            const next = (full + step + shown.length) % shown.length;
            setFull(next);
            setPicked(shown[next].path);
          }}
          onClose={() => setFull(null)}
        />
      )}

      <footer className={styles.term}>
        {head ? (
          <>
            <span>{head.repo}</span>
            <span className={styles.termDim}>
              {head.branch} · {head.sha}
            </span>
          </>
        ) : (
          <span>fixtures/content · local</span>
        )}
        <span className={styles.termDim}>
          {counts.all} files · {total(counts.bytes)}
        </span>
        <span className={styles.termDim}>images in git · clips in Vercel Blob</span>
      </footer>
    </main>
  );
}

// v4 08 details: the file large, its name and what's wrong with it, then File, Usage,
// History, Open post · Copy path, and Download as JPG / PNG / WEBP. Beside the grid from
// 1024, a sheet below (PaneShell, as the hub's).
function MediaDetails({
  item,
  sheetOpen,
  onClose,
  onFull,
}: {
  item: MediaItem | null;
  sheetOpen: boolean;
  onClose: () => void;
  onFull: () => void;
}) {
  return (
    <PaneShell label="File details" itemKey={item?.path ?? null} sheetOpen={sheetOpen} onClose={onClose}>
      {item && <Facts key={item.path} item={item} onFull={onFull} />}
    </PaneShell>
  );
}

function Facts({ item, onFull }: { item: MediaItem; onFull: () => void }) {
  const lift = useContext(LiftContext);
  const { go } = usePageTransition();
  // An image's size is read once it's here (git doesn't keep it); a clip's is in media.json
  const [size, setSize] = useState<{ w: number; h: number } | null>(
    item.width && item.height ? { w: item.width, h: item.height } : null,
  );
  // When it came in, asked of GitHub (undefined: asking · null: not known)
  const [history, setHistory] = useState<{ added: string; sha: string } | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void mediaHistory(item.kind === "clip" ? item.poster! : item.path).then((h) => live && setHistory(h));
    return () => {
      live = false;
    };
  }, [item]);
  const [copied, setCopied] = useState(false);
  const [as, setAs] = useState<"jpg" | "png" | "webp">("webp");
  const [saving, setSaving] = useState(false);

  const alts = [...new Set(item.uses.filter((u) => u.as !== "preview").map((u) => u.alt.trim()))];
  const problems = [
    ...(item.over ? [`Over ${item.kind === "clip" ? "5 MB" : "500 KB"}`] : []),
    ...(!item.uses.length ? ["Not used in any post"] : []),
    ...(item.noAlt ? ["Missing alt text"] : []),
  ];
  const posts = [...new Map(item.uses.map((u) => [u.slug, u])).values()];

  const download = async () => {
    const file = name(item.path);
    const save = (href: string, as: string) => {
      const a = document.createElement("a");
      a.href = href;
      a.download = as;
      a.click();
    };
    // A clip, or the file as it is: straight from where it's kept
    if (item.kind === "clip" || file.toLowerCase().endsWith(`.${as}`)) {
      setSaving(true);
      try {
        const blob = await (await fetch(item.kind === "clip" ? item.url! : src(item.path))).blob();
        const url = URL.createObjectURL(blob);
        save(url, file);
        URL.revokeObjectURL(url);
      } finally {
        setSaving(false);
      }
      return;
    }
    // Another format: drawn again here (JPG on white, as JPG has no see-through)
    setSaving(true);
    try {
      const bitmap = await createImageBitmap(await (await fetch(src(item.path))).blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const g = canvas.getContext("2d")!;
      if (as === "jpg") {
        g.fillStyle = "#fff";
        g.fillRect(0, 0, canvas.width, canvas.height);
      }
      g.drawImage(bitmap, 0, 0);
      const type = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }[as];
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.92));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      save(url, file.replace(/\.\w+$/, `.${as}`));
      URL.revokeObjectURL(url);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.paneBody} data-pane-scroll>
      <div className={m.preview} data-cover onClick={lift} onDoubleClick={onFull}>
        {item.kind === "clip" ? (
          <video key={item.url} src={item.url} poster={src(item.poster!)} muted loop playsInline autoPlay />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- its own size is read from it
          <img
            src={src(item.path)}
            alt=""
            // Read once it's in — or now, if it came in before the page woke up (the
            // first file, drawn on the server: its load came and went unheard, 5 Oct 69)
            ref={(img) => {
              if (img?.complete && img.naturalWidth && !size) setSize({ w: img.naturalWidth, h: img.naturalHeight });
            }}
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
        )}
      </div>
      <div className={m.head}>
        <span className={m.file}>{name(item.path)}</span>
        {problems.length ? (
          problems.map((p) => (
            <span key={p} className={m.state} data-bad>
              {p}
            </span>
          ))
        ) : (
          <span className={m.state}>All clear</span>
        )}
      </div>

      <dl className={styles.facts}>
        <dt className={`label ${styles.factsHead}`}>File</dt>
        <dt className="label">Size</dt>
        <dd className={item.over ? m.bad : undefined}>{kb(item.bytes)}</dd>
        <dt className="label">Dimensions</dt>
        <dd>{size ? `${size.w} × ${size.h} px` : "…"}</dd>
        <dt className="label">Format</dt>
        <dd>{format(item)}</dd>
        <dt className="label">Alt text</dt>
        <dd className={item.noAlt ? m.bad : undefined}>
          {alts.filter(Boolean).join(" · ") || (item.uses.length ? "Missing" : "—")}
        </dd>
      </dl>
      <dl className={styles.facts}>
        <dt className={`label ${styles.factsHead}`}>Usage</dt>
        <dt className="label">Used in</dt>
        <dd className={item.uses.length ? m.uses : m.bad}>
          {posts.length
            ? posts.map((u) => (
                <span key={u.slug}>
                  {u.title}
                  <span className={m.as}>
                    {" "}
                    · {item.uses.filter((x) => x.slug === u.slug).map((x) => x.as).join(", ")}
                    {u.status === "draft" ? " · draft" : ""}
                  </span>
                </span>
              ))
            : "Not used"}
        </dd>
        <dt className="label">Path</dt>
        <dd className={styles.mono}>{item.path}</dd>
      </dl>
      <dl className={styles.facts}>
        <dt className={`label ${styles.factsHead}`}>History</dt>
        <dt className="label">Added</dt>
        <dd className={styles.mono}>{history === undefined ? "…" : history ? stamp(history.added) : "—"}</dd>
        <dt className="label">Commit</dt>
        <dd className={styles.mono}>{history === undefined ? "…" : (history?.sha ?? "—")}</dd>
      </dl>

      <div className={styles.paneActs}>
        <button
          type="button"
          className={styles.btnm}
          disabled={!posts.length}
          onClick={() => posts[0] && go?.(`/admin/posts/${posts[0].slug}`)}
        >
          Open post
        </button>
        <button
          type="button"
          className={styles.btnl}
          onClick={() => {
            void navigator.clipboard.writeText(item.path).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy path"}
        </button>
      </div>

      <div className={m.download}>
        <span className="label">Download{item.kind === "image" ? " as" : ""}</span>
        <div className={m.downloadRow}>
          {item.kind === "image" && (
            <Segmented
              label="Download as"
              options={[
                { value: "jpg", label: "JPG" },
                { value: "png", label: "PNG" },
                { value: "webp", label: "WEBP" },
              ]}
              value={as}
              onChange={setAs}
            />
          )}
          <button type="button" className={styles.btnl} disabled={saving} onClick={() => void download()}>
            {saving ? "Preparing…" : "Download"}
          </button>
        </div>
      </div>
      <span className={styles.hint}>Click or arrow keys to select · Enter or double-click for full view</span>
    </div>
  );
}

// The full view: the file as large as the screen allows on black, its name and place in
// the list; ← → (or the arrows on screen) through them, Esc or × to close
function FullView({
  item,
  at,
  of,
  onStep,
  onClose,
}: {
  item: MediaItem;
  at: number;
  of: number;
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = "";
    };
  }, []);
  return (
    <div className={m.full} role="dialog" aria-label={`${name(item.path)}, full view`} onClick={onClose}>
      <div className={m.fullBar} onClick={(e) => e.stopPropagation()}>
        <span>{name(item.path)}</span>
        <span className={m.fullDim}>
          {at + 1} / {of} · {kb(item.bytes)}
        </span>
        <button type="button" className={m.fullClose} aria-label="Close full view" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <path d="M1 1l12 12M13 1 1 13" />
          </svg>
        </button>
      </div>
      <div className={m.fullStage}>
        {item.kind === "clip" ? (
          <video
            key={item.url}
            src={item.url}
            poster={src(item.poster!)}
            muted
            loop
            playsInline
            autoPlay
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- the file itself, whole
          <img src={src(item.path)} alt="" onClick={(e) => e.stopPropagation()} />
        )}
      </div>
      {of > 1 && (
        <>
          <button
            type="button"
            className={m.fullPrev}
            aria-label="Previous file"
            onClick={(e) => {
              e.stopPropagation();
              onStep(-1);
            }}
          >
            ←
          </button>
          <button
            type="button"
            className={m.fullNext}
            aria-label="Next file"
            onClick={(e) => {
              e.stopPropagation();
              onStep(1);
            }}
          >
            →
          </button>
        </>
      )}
    </div>
  );
}
