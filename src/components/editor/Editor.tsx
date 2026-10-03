"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { publish, remove, save, unpublish, upload, type Result } from "@/app/admin/actions";
import { postChecks } from "@/lib/checks";
import { fromRaw, placeWaiting, slugify, toRaw, waitingKeys, type PostInput } from "@/lib/edit";
import { postFile, postUrl, type IndexEntry, type Post } from "@/lib/schema";
import { categories, projectCategories } from "@/lib/site";
import { usePageTransition } from "../PageTransition";
import Segmented from "../Segmented";
import TransitionLink from "../TransitionLink";
import { CoverField, LinksField, TagsField } from "./Fields";
import MetaRow from "./MetaRow";
import Preview from "./Preview";
import RawBox from "./RawBox";
import WriteBox from "./WriteBox";
import type { Images } from "./WriteFigure";
import type { LinkTarget } from "./WriteMenus";
import { UPLOAD, type Waiting } from "./waiting";
import { firstFrame } from "./clipFrame";
import { CLIP, CLIP_MAX, CLIP_TYPES, clipKey, isClip, placeClips, waitingClips, type ClipMap, type WaitingClip } from "@/lib/clips";
import { shrinkForUpload } from "./shrink";
import { anchorIn, type Anchor } from "./anchor";
import styles from "./Editor.module.css";

// 07 Admin post editor (v4 07 / EDITOR-SPEC). The form is the post: title, slug, where
// it shows, category, excerpt, tags, links, cover — and the body, in WRITE (formatted,
// typed into directly) or RAW .MD. Save / Publish / Unpublish / Delete go to the
// server actions, one commit each. Fields left unsaved are kept on the page (and a
// leave warns); a save that fails says so in the header and tries again every 10s.

export type Form = Omit<PostInput, "id">;

const fromPost = (post: Post): Form => ({
  slug: post.slug,
  title: post.title,
  excerpt: post.excerpt,
  section: post.section,
  category: post.category,
  tags: post.tags,
  cover: post.cover,
  coverAlt: post.coverAlt,
  role: post.role,
  year: post.year,
  links: post.links,
  body: post.body,
});

const blank: Form = {
  slug: "",
  title: "",
  excerpt: "",
  section: "blog",
  category: categories[0].slug,
  tags: [],
  cover: null,
  coverAlt: "",
  role: null,
  year: null,
  links: [],
  body: "\n",
};

const RETRY_MS = 10_000;

type Note = { text: string; tone: "ok" | "bad" | "muted" };
// The last message under Publish, per post. Kept outside the editor: when a new post's
// address changes (/admin/posts/new → its slug), Next builds the page afresh and the
// editor's own state goes with it — the note shouldn't.
const notes = new Map<number | "new", Note>();
const time = (d: Date) => d.toTimeString().slice(0, 8);

export default function Editor({
  post,
  entry: first,
  allTags,
  targets,
  clips: savedClips,
  pages,
  media,
}: {
  post: Post | null;
  entry: IndexEntry | null;
  allTags: string[];
  targets: LinkTarget[]; // posts a link in the text can go to
  clips: ClipMap; // media.json: where the clips posts name really are (5.4d)
  pages: string[]; // the site's own addresses that open (Checks › Links)
  media: Record<string, number> | null; // media/ in the repo and the sizes (Checks › Files); null = couldn't list
}) {
  const { go } = usePageTransition();
  const barRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState<Form>(() => (post ? fromPost(post) : blank));
  const [entry, setEntry] = useState(first);
  const [saved, setSaved] = useState(() => JSON.stringify(post ? fromPost(post) : blank));
  const [mode, setMode] = useState<"write" | "raw">("write");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [note, setNoteState] = useState<Note | null>(
    () =>
      notes.get(first?.id ?? "new") ??
      (first && !first.code ? { text: "Save once to give it its address · /posts/<code>", tone: "muted" } : null),
  );
  const [warned, setWarned] = useState(false);
  const [asking, setAsking] = useState<"delete" | "unpublish" | "reset" | null>(null);
  const [rawReset, setRawReset] = useState(0);
  const [publishing, setPublishing] = useState(false);
  // Seconds since a press started, shown under it while it works — a commit can take a
  // few, and a count says it's still going (owner, 2 Oct 69). Publish's save runs on
  // into its publish, one count for both.
  const working = !!busy || publishing;
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (!working) return;
    const start = Date.now();
    const timer = window.setInterval(() => setWaited(Math.floor((Date.now() - start) / 1000)), 250);
    return () => {
      clearInterval(timer);
      setWaited(0);
    };
  }, [working]);

  const id = entry?.id ?? null;
  // Where it is (or will be, on the first save): posts/<id>-<slug>.md
  const file = id != null ? postFile(id, form.slug || "…") : `posts/new-${form.slug || "…"}.md`;
  const setNote = (next: Note | null, forId: number | null = id) => {
    if (next) notes.set(forId ?? "new", next);
    else notes.delete(forId ?? "new");
    setNoteState(next);
  };  // What the last press that committed said ("Saved 01:54:56 · live now"): a Reset puts
  // it back, so after playing about you still see when it was last saved. Nothing saved
  // since the page opened = nothing to put back (owner, 2 Oct 69).
  const lastSaved = useRef<Note | null>(null);
  const setSavedNote = (next: Note, forId: number | null = id) => {
    lastSaved.current = next;
    setNote(next, forId);
  };

  const published = entry?.status === "published";
  // A post last saved before addresses were codes (2 Oct 69) gets one on its next save:
  // Save is open for it even with nothing changed
  const needsCode = !!entry && !entry.code;
  const changed = JSON.stringify(form) !== saved; // something typed since the last save
  const dirty = changed || needsCode;

  // Any edit: what the last press said is over — "Saved · live now" no longer holds once
  // there's something new to save (owner, 2 Oct 69)
  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setWarned(false);
    if (note) setNote(null);
  };
  // The slug follows the title, always (owner, 2 Oct 69): it names the file and the
  // editor's address, never the site's (that's its code), so nothing breaks when the
  // title changes. No a–z in the title → the server makes it "post-<id>".
  const setTitle = (title: string) => set({ title, slug: slugify(title) });

  // ---------- the server ----------

  // One call: busy while it runs, the header's "saved" or "Not saved" after
  const call = async (label: string, action: () => Promise<Result>) => {
    setBusy(label);
    const result = await action();
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setError(null);
    setSavedAt(new Date());
    setEntry(result.saved.entry);
    return result.saved;
  };

  const doSave = async () => {
    // The images still waiting (5.4) that the post points at go with it
    // — and the clips (5.4d), in Blob already, with their first frames
    const usedClips = waitingClips(form.body);
    const used = new Set([...waitingKeys(`${form.cover ?? ""}\n${form.body}`), ...usedClips]);
    const sent = Object.values(pending).filter(({ key }) => used.has(key));
    const clipsSent = Object.values(waitingClipsRef.current).filter(({ key }) => usedClips.has(key));
    const result = await call("Saving", () =>
      save({ id, ...form }, sent.map(({ key, base64 }) => ({ key, base64 })), clipsSent),
    );
    if (!result) return null;
    // Where they went: the post now says their paths, and nothing waits any more
    const paths = result.uploads ?? {};
    const clipPaths = Object.fromEntries(
      clipsSent.flatMap((c) => (paths[`upload:${c.key}`] ? [[c.key, paths[`upload:${c.key}`].replace(/\.webp$/, `.${c.url.split(".").pop()}`)]] : [])),
    );
    if (clipsSent.length) {
      setClipMap((m) => ({
        ...m,
        ...Object.fromEntries(
          clipsSent.flatMap(({ key, ...c }) => (clipPaths[key] ? [[clipPaths[key], { ...c, poster: paths[`upload:${key}`] }]] : [])),
        ),
      }));
      for (const c of clipsSent) delete waitingClipsRef.current[c.key];
    }
    // The images just committed are in media/ now (Checks › Files)
    if (sent.length) {
      setMediaFiles((m) => m && { ...m, ...Object.fromEntries(sent.flatMap((p) => (paths[`${UPLOAD}${p.key}`] ? [[paths[`${UPLOAD}${p.key}`], p.bytes]] : []))) });
    }
    // Links typed since: asked now
    void askLinks(outsideRef.current);
    // The slug as the server settled it ("post-37" for a Thai title, "-37" if taken)
    const next = {
      ...form,
      slug: result.slug,
      cover: form.cover && placeWaiting(form.cover, paths),
      body: placeClips(placeWaiting(form.body, paths, "../"), clipPaths),
    };
    setForm(next);
    setSaved(JSON.stringify(next));
    if (sent.length || clipsSent.length) setRawReset((n) => n + 1);
    for (const p of sent) URL.revokeObjectURL(p.url);
    pendingRef.current = Object.fromEntries(Object.entries(pendingRef.current).filter(([key]) => !sent.some((p) => p.key === key)));
    setPending(pendingRef.current);
    // A new post, or a new slug: the address follows, without reloading the page
    if (location.pathname !== `/admin/posts/${result.slug}`) {
      window.history.replaceState(null, "", `/admin/posts/${result.slug}`);
    }
    return result;
  };

  const doPublish = async () => {
    // With issues: say so; a second press publishes anyway (v4)
    if (bad && !warned) {
      setWarned(true);
      setNote({ text: `Fix ${bad} ${bad > 1 ? "issues" : "issue"} before publishing — or press Publish again to publish anyway`, tone: "bad" });
      return;
    }
    setWarned(false);
    setPublishing(true); // the save before it reads "Publishing…" too
    const target = dirty || id == null ? await doSave() : { id };
    const result = target && (await call("Publishing", () => publish(target.id)));
    setPublishing(false);
    if (result) {
      setSavedNote(
        result.live
          ? { text: `Published as No. ${result.entry?.no} at ${time(new Date())} · ${result.live}`, tone: "bad" }
          : { text: `Published as No. ${result.entry?.no} at ${time(new Date())} · live now`, tone: "ok" },
        result.id,
      );
    }
  };

  // Save draft (button, ⌘S): says when, as Save changes does
  const doDraft = async () => {
    if (await doSave()) setSavedNote({ text: `Draft saved ${time(new Date())} · not on the site`, tone: "muted" });
  };

  const doUpdate = async () => {
    const result = await doSave();
    // The time says which press this was: save again and it moves on
    const at = time(new Date());
    if (result) setSavedNote(result.live ? { text: `Saved ${at} · ${result.live}`, tone: "bad" } : { text: `Saved ${at} · live now`, tone: "ok" });
  };

  // Reset (owner, 2 Oct 69): every field and the text back to the last save — for when
  // an edit went nowhere and starting over is quicker than undoing it. Images picked
  // since then go too.
  const doReset = () => {
    setAsking(null);
    const back = JSON.parse(saved) as Form;
    setForm(back);
    for (const image of Object.values(pendingRef.current)) URL.revokeObjectURL(image.url);
    pendingRef.current = {};
    setPending({});
    setRawReset((n) => n + 1);
    setWarned(false);
    setNote(lastSaved.current);
  };

  const doUnpublish = async () => {
    setAsking(null);
    if (id == null) return;
    const result = await call("Unpublishing", () => unpublish(id));
    if (result) setSavedNote({ text: result.live ? `Back to a draft · ${result.live}` : "Back to a draft · off the site", tone: result.live ? "bad" : "muted" });
  };

  const doDelete = async () => {
    setAsking(null);
    if (id == null) return;
    const result = await call("Deleting", () => remove(id));
    if (result) {
      setSaved(JSON.stringify(form)); // nothing left to lose
      go?.("/admin");
    }
  };

  // The cover (5.4): shrunk here if it's a big photo, made a WebP on the server and
  // held here — shown in the box, not in the repo yet. Save commits it with the post.
  const [pending, setPending] = useState<Record<string, Waiting>>({});
  // The same, for uploads one after another (state is a render behind); set together
  const pendingRef = useRef(pending);
  // Clips picked since the last save (5.4d): up in Blob, waiting to be named in the post
  const waitingClipsRef = useRef<Record<string, WaitingClip>>({});
  // Where saved clips are (media.json), plus those this page has saved since it opened
  const [clipMap, setClipMap] = useState<ClipMap>(savedClips);
  const [uploading, setUploading] = useState(false);
  const saveWord = published ? "Save changes" : "Save";

  // One file → a WebP held here under its key. An image in the body never takes a key
  // already waiting or written in the post ("photo" → "photo-2"); "cover" is the cover's.
  const prepare = async (file: File, role: "cover" | "image") => {
    const data = new FormData();
    data.set("role", role);
    data.set("file", await shrinkForUpload(file));
    const result = await upload(data);
    if (!result.ok) return result;
    let key = result.image.key;
    if (role === "image") {
      const taken = new Set(["cover", ...Object.keys(pendingRef.current), ...waitingKeys(form.body)]);
      for (let n = 2; taken.has(key); n++) key = `${result.image.key}-${n}`;
    }
    const bytes = Uint8Array.from(atob(result.image.base64), (c) => c.charCodeAt(0));
    const image: Waiting = { ...result.image, key, url: URL.createObjectURL(new Blob([bytes], { type: "image/webp" })) };
    const all = pendingRef.current;
    if (all[key]) URL.revokeObjectURL(all[key].url);
    pendingRef.current = { ...all, [key]: image };
    setPending(pendingRef.current);
    return { ok: true as const, image };
  };
  const sized = (image: Waiting) => `${image.width} × ${image.height}, ${Math.round(image.bytes / 1024)} KB`;

  const uploadCover = async (file: File) => {
    setUploading(true);
    const result = await prepare(file, "cover");
    setUploading(false);
    if (!result.ok) {
      setNote({ text: `Cover not added · ${result.error}`, tone: "bad" });
      return;
    }
    set({ cover: `${UPLOAD}${result.image.key}` });
    setNote({ text: `Cover ready · ${sized(result.image)} · goes up with ${saveWord}`, tone: "muted" });
  };

  // Its name, before Save (owner, 2 Oct 69): starts as the file's own, typed over here;
  // the post's id goes in front when it's committed (and "cover-" for the cover).
  // Taken → "-2"; nothing left in a–z and 0–9 (Thai only, say) → stays as it was.
  const renameImage = (from: string, typed: string, lead = "") => {
    const name = slugify(typed).slice(0, 40).replace(/-+$/, "");
    const base = lead + name;
    if (!name || base === from) return;
    const taken = new Set(["cover", ...Object.keys(pendingRef.current), ...waitingKeys(`${form.cover ?? ""}\n${form.body}`)]);
    taken.delete(from);
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
    const { [from]: image, ...rest } = pendingRef.current;
    if (!image) return;
    pendingRef.current = { ...rest, [key]: { ...image, key } };
    setPending(pendingRef.current);
    const swap = (text: string) => text.replace(/upload:[a-z0-9-]+/g, (m) => (m === `${UPLOAD}${from}` ? `${UPLOAD}${key}` : m));
    set({ body: swap(form.body), cover: form.cover && swap(form.cover) });
    setRawReset((n) => n + 1);
  };
  // WRITE's Image blocks (5.3e): an image picked there is made a WebP and held here
  // under its key until Save, as the cover is; the block shows it from memory. One
  // after another; the note under Save says what's waiting.
  const images: Images = {
    url: (src) => (src.startsWith(UPLOAD) ? (pending[src.slice(UPLOAD.length)]?.url ?? "") : src.replace(/^(\.\.\/)+/, "/")),
    waiting: (src) => {
      const image = src.startsWith(UPLOAD) ? pending[src.slice(UPLOAD.length)] : undefined;
      return image ? { name: image.key, width: image.width, height: image.height } : null;
    },
    add: async (files) => {
      const srcs: string[] = [];
      const failed: string[] = [];
      let last: Waiting | null = null;
      for (const file of files) {
        const result = await prepare(file, "image");
        if (result.ok) {
          srcs.push(`${UPLOAD}${result.image.key}`);
          last = result.image;
        } else failed.push(`${file.name}: ${result.error}`);
      }
      if (failed.length) setNote({ text: `Not added · ${failed.join(" · ")}`, tone: "bad" });
      else if (last) {
        const what = srcs.length > 1 ? `${srcs.length} images ready` : `Image ready · ${sized(last)}`;
        setNote({ text: `${what} · goes up with ${saveWord}`, tone: "muted" });
      }
      return srcs;
    },
    rename: (src, typed) => renameImage(src.slice(UPLOAD.length), typed),
    clip: (src) => {
      if (!src.startsWith(CLIP)) return clipMap[clipKey(src)];
      const key = src.slice(CLIP.length);
      const waiting = waitingClipsRef.current[key];
      return waiting && { ...waiting, poster: pending[key]?.url ?? "" };
    },
    addClip: async (file) => {
      if (!CLIP_TYPES.includes(file.type)) {
        setNote({ text: "Clip not added · MP4 or WebM only", tone: "bad" });
        return null;
      }
      if (file.size > CLIP_MAX) {
        setNote({ text: `Clip not added · ${(file.size / 1024 / 1024).toFixed(1)} MB, over 5 MB`, tone: "bad" });
        return null;
      }
      try {
        // Its first frame goes the images' way (the key names both); the file goes
        // straight to Blob from here (/api/clip hands out the token)
        const frame = await firstFrame(file);
        const poster = await prepare(frame.poster, "image");
        if (!poster.ok) throw new Error(poster.error);
        const key = poster.image.key;
        const ext = file.type === "video/webm" ? "webm" : "mp4";
        const { upload: toBlob } = await import("@vercel/blob/client");
        const blob = await toBlob(`clips/${key}.${ext}`, file, {
          access: "public",
          handleUploadUrl: "/api/clip",
          contentType: file.type,
        });
        waitingClipsRef.current[key] = {
          key,
          url: blob.url,
          bytes: file.size,
          seconds: frame.seconds,
          width: frame.width,
          height: frame.height,
        };
        setNote({ text: `Clip ready · ${(file.size / 1024 / 1024).toFixed(1)} MB · goes in with ${saveWord}`, tone: "muted" });
        return `${CLIP}${key}`;
      } catch (error) {
        const why = error instanceof Error ? error.message : "upload failed";
        // /api/clip refused the token: Blob not connected here (no BLOB_READ_WRITE_TOKEN),
        // or signed out
        const said = /client token/i.test(why) ? "Blob isn't connected (BLOB_READ_WRITE_TOKEN) — or sign in again" : why;
        setNote({ text: `Clip not added · ${said}`, tone: "bad" });
        return null;
      }
    },
  };

  // ---------- Checks (5.3f) ----------
  // Worked out from the form on each render. Files: in the repo (media/), waiting for
  // Save, or a clip in media.json. Links: the site's own by its addresses; another
  // site's asked from the server (below), grey until it answers.
  const [mediaFiles, setMediaFiles] = useState(media);
  // Another site's links, by what the server said ("asking" while it's out)
  const [answers, setAnswers] = useState<Record<string, "ok" | "broken" | "asking">>({});
  const fileOf = (src: string) => {
    if (src.startsWith(UPLOAD)) return pending[src.slice(UPLOAD.length)] ?? null;
    if (src.startsWith(CLIP)) return waitingClipsRef.current[src.slice(CLIP.length)] ?? null;
    if (isClip(src)) return clipMap[clipKey(src)] ?? null;
    if (!mediaFiles) return undefined;
    const bytes = mediaFiles[clipKey(src)];
    return bytes == null ? null : { bytes };
  };
  const link = (href: string) => {
    if (/^https?:\/\//.test(href)) {
      const said = answers[href];
      return said === "asking" ? undefined : (said ?? "later");
    }
    if (!href.startsWith("/")) return "ok"; // #heading, mailto:
    const path = href.replace(/[?#].*$/, "").replace(/(.)\/$/, "$1");
    if (path.startsWith("/media/")) return fileOf(path) === null ? "broken" : "ok";
    return pages.includes(path) ? "ok" : "broken";
  };
  const checks = postChecks(form, { body: form.body, title: form.title, links: form.links, file: fileOf, link });
  const bad = checks.filter((c) => c.ok === false).length;

  // Another site's links: asked when the post opens and after each Save / Publish —
  // not as you type (owner, 4 Oct 69). Each once per page; one typed since reads
  // "on save" until then.
  const outside = useMemo(
    () => [...`${form.body}\n${form.links.map((l) => `(${l.url})`).join("\n")}`.matchAll(/\]?\((https?:\/\/[^)\s]+)/g)].map((m) => m[1]),
    [form.body, form.links],
  );
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const askLinks = useCallback(async (urls: string[]) => {
    const fresh = [...new Set(urls)].filter((u) => !answersRef.current[u]);
    if (!fresh.length) return;
    setAnswers((a) => ({ ...a, ...Object.fromEntries(fresh.map((u) => [u, "asking" as const])) }));
    // A route of its own (/api/links): a server action would queue Save behind it
    const got = await fetch("/api/links", { method: "POST", body: JSON.stringify(fresh) })
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, "ok" | "broken">>) : null))
      .catch(() => null);
    setAnswers((a) => {
      const next = { ...a, ...got };
      if (!got) for (const u of fresh) delete next[u]; // signed out, offline: next time
      return next;
    });
  }, []);
  const outsideRef = useRef(outside);
  outsideRef.current = outside;
  useEffect(() => {
    void askLinks(outsideRef.current);
  }, [askLinks]);

  // media/2026/3lcdqaxt-… (a new post's code comes with its first save)
  const stem = `media/${new Date().getFullYear()}/${entry?.code ?? "<code>"}-`;

  // A failed save tries again on its own every 10s while there's something to save
  useEffect(() => {
    if (!error || busy || !dirty) return;
    const timer = window.setTimeout(() => void doSave(), RETRY_MS);
    return () => clearTimeout(timer);
  });

  // ⌘S saves; leaving with unsaved changes asks first
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!busy) void (published ? doUpdate() : doDraft());
      }
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (changed) e.preventDefault();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("beforeunload", leave);
    };
  });


  // From 1024 the cover is as wide as puts its Alt text line level with the bottom of
  // Save: it's 2:1, so each px taller is 2 px wider. Measured from where it is now,
  // again whenever the left column changes height (a link added, a project's fields).
  // Never under 560 nor past its column (owner, 2 Oct 69). A panel open for a moment
  // (Tags › Manage) doesn't count: opening it grew the cover (owner, 2 Oct 69).
  const fieldsRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fields = fieldsRef.current;
    const actions = actionsRef.current;
    const cover = fields?.querySelector<HTMLElement>(`.${styles.cover}`);
    const box = cover?.querySelector<HTMLElement>(`.${styles.coverBox}`);
    if (!fields || !actions || !cover || !box) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const fit = () => {
      if (!wide.matches) return cover.style.removeProperty("--cover-w");
      const b = box.getBoundingClientRect();
      const below = cover.getBoundingClientRect().bottom - b.bottom; // File + Alt text rows
      const panels = [...fields.querySelectorAll<HTMLElement>(`.${styles.panel}`)].reduce((sum, p) => sum + p.offsetHeight, 0);
      const height = actions.getBoundingClientRect().bottom - panels - below - b.top;
      const column = fields.clientWidth - actions.parentElement!.offsetWidth - parseFloat(getComputedStyle(fields).columnGap);
      const width = Math.min(column, Math.max(560, height * 2));
      cover.style.setProperty("--cover-w", `${Math.floor(width)}px`);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(fields);
    observer.observe(actions.parentElement!);
    return () => observer.disconnect();
  }, []);

  // WRITE / RAW .MD: the same body, two views (switching reads it afresh)
  const modeSwitch = (
    <Segmented
      label="Mode"
      options={[
        { value: "write", label: "Write" },
        { value: "raw", label: "Raw .md" },
      ]}
      value={mode}
      onChange={setMode}
    />
  );
  // ...and Preview beside them, never far from where you write (owner, 2 Oct 69)
  const modeRow = (
    <>
      {modeSwitch}
      <button type="button" className={`${styles.link} ${styles.modePreview}`} onClick={() => openPreview()}>
        Preview
      </button>
    </>
  );

  // ---------- RAW .MD ----------

  const raw = useMemo(() => toRaw(form), [form]);
  const onRaw = (text: string) => {
    const parsed = fromRaw(text, form.slug || "new"); // throws: RawBox shows why
    // A title typed (or pasted) here makes the slug too, while it's still automatic
    setForm((f) => ({ ...f, ...parsed, slug: slugify(parsed.title) }));
    setWarned(false);
    if (note) setNote(null);
  };

  // ---------- page ----------

  const cats = form.section === "project" ? projectCategories : categories;
  const status = entry?.status === "published" ? "Published" : "Draft";
  const savedText = busy
    ? `${busy}…`
    : error
      ? null
      : savedAt
        ? `saved ${time(savedAt)}`
        : entry
          ? // The time of the last commit, from its message ("2026-10-01 21:26:52 · Draft #37")
            `saved ${/\d\d:\d\d:\d\d/.exec(entry.lastCommit ?? "")?.[0] ?? ""}`.trim()
          : "not saved yet";

  // ---------- Preview (07P) ----------
  // The editor stays mounted but hidden (all that's typed stays put); the preview starts
  // at the top, and leaving puts you back where you were. Opening it is a step in the
  // browser's history, so Back — the button, or Safari's swipe from the edge — closes
  // the preview rather than leaving the editor; Close, Esc, Back to Blog and the swipe
  // in Preview all go the same way (owner, 2 Oct 69).
  // It slides in from the right over the editor, the way the swipe puts it away
  // ("entering": held over the screen, the editor still showing beneath); once in, the
  // editor hides and the page is the preview's, from its top. It used to swap in at
  // once, a blink (owner, 2 Oct 69).
  const [previewing, setPreviewing] = useState<false | "entering" | "open" | "leaving">(false);
  const scrollRef = useRef(0);
  // Where you were in WRITE: the preview opens there (anchor.ts) — from RAW, at the top
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const openPreview = () => {
    scrollRef.current = window.scrollY;
    setAnchor(mode === "write" ? anchorIn(document.querySelector(`.${styles.writeText}`)) : null);
    window.history.pushState({ preview: true }, "");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPreviewing(still ? "open" : "entering");
  };
  const previewIn = useCallback(() => setPreviewing((v) => (v === "entering" ? "open" : v)), []);
  const previewOut = useCallback(() => setPreviewing(false), []);
  // Leaving, it slides off to the right as it came (owner, 3 Oct 69 — it used to vanish
  // at once, a blink): held over the screen again at the height you'd read to, the
  // editor back beneath it where you left it
  const [readTo, setReadTo] = useState(0);
  useLayoutEffect(() => {
    if (previewing === "leaving") window.scrollTo({ top: scrollRef.current, behavior: "instant" });
  }, [previewing]);
  const closePreview = useCallback(() => window.history.back(), []);
  useEffect(() => {
    if (!previewing) return;
    const back = () => {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (previewing === "open" && !still) {
        setReadTo(window.scrollY);
        setPreviewing("leaving");
        return;
      }
      setPreviewing(false);
      requestAnimationFrame(() => window.scrollTo({ top: scrollRef.current, behavior: "instant" }));
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [previewing]);
  const today = new Date().toISOString().slice(0, 10);
  const previewPost = {
    ...form,
    code: entry?.code ?? null,
    no: entry?.no ?? null,
    status: entry?.status ?? "draft",
    publishedAt: entry?.publishedAt ?? today,
    updatedAt: changed ? today : (entry?.updatedAt ?? today),
  } as const;

  return (
    <>
      {previewing && (
        <Preview
          post={previewPost}
          coverUrl={form.cover?.startsWith(UPLOAD) ? pending[form.cover.slice(UPLOAD.length)]?.url : undefined}
          entering={previewing === "entering"}
          leaving={previewing === "leaving" ? readTo : null}
          onOut={previewOut}
          anchor={anchor}
          onIn={previewIn}
          onClose={closePreview}
          clips={{
            ...clipMap,
            ...Object.fromEntries(
              Object.keys(waitingClipsRef.current).map((key) => [`${CLIP}${key}`, images.clip(`${CLIP}${key}`)!]),
            ),
          }}
        />
      )}
      <div className={styles.sheet} hidden={previewing === "open"}>
      {/* The bar sticks to the top only as far as the end of this block, so the WRITE /
          RAW row, reaching the top, pushes it up and off — one bar at a time, done by
          the browser itself (owner, 2 Oct 69; the scripted push stuttered on the iPhone) */}
      <div className={styles.head}>
      <header ref={barRef} className={styles.bar}>
        <TransitionLink href="/admin" className={styles.back}>
          ← Publishing
        </TransitionLink>
        <span className={styles.id} title="Post ID · primary key, never reused">
          {id == null ? "New" : `#${id}`}
        </span>
        <span className={`${styles.mono} ${styles.path}`}>{file}</span>
        <span className="label">{status}</span>
        <span className={styles.saved} data-state={error ? "bad" : busy ? "busy" : changed ? "dirty" : undefined}>
          {error ? (
            <>
              Not saved ·{" "}
              <button type="button" className={styles.retry} title={error} onClick={() => void doSave()}>
                Retry
              </button>
            </>
          ) : (
            <>
              {savedText}
              {changed && !busy && " · edited"}
            </>
          )}
        </span>
        <nav className={styles.menu}>
          {published && (
            <a href={entry ? postUrl(entry) : "#"} target="_blank" rel="noopener" className={styles.link}>
              View live
            </a>
          )}
          {published ? (
            <span className={styles.ask}>
              <button type="button" className={styles.link} onClick={() => setAsking(asking === "unpublish" ? null : "unpublish")}>
                Unpublish
              </button>
              {asking === "unpublish" && (
                <Confirm
                  question="Take this post off the site?"
                  note="Back to a draft · keeps its number"
                  yes="Unpublish"
                  onYes={doUnpublish}
                  onNo={() => setAsking(null)}
                />
              )}
            </span>
          ) : (
            <span className={styles.off} title="Not published yet">
              Unpublish
            </span>
          )}
          {id != null && !published && (
            <span className={styles.ask}>
              <button type="button" className={styles.delete} onClick={() => setAsking(asking === "delete" ? null : "delete")}>
                Delete draft
              </button>
              {asking === "delete" && (
                <Confirm
                  question="Delete this draft?"
                  note="Commits a removal · recoverable from git"
                  yes="Delete"
                  danger
                  onYes={doDelete}
                  onNo={() => setAsking(null)}
                />
              )}
            </span>
          )}
        </nav>
      </header>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.page}>
        <label className={styles.titleField}>
          <input
            className={styles.title}
            value={form.title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Title"
          />
          <Count n={form.title.length} max={70} />
        </label>

        <div ref={fieldsRef} className={styles.fields}>
          <div className={styles.left}>
            <div className={styles.field}>
              <span className="label" title="File name and URL · made from the title until you change it">
                Slug · file name
              </span>
              <span className={styles.slugRow}>
                <span className={`${styles.input} ${styles.mono} ${styles.slugText}`}>
                  {form.slug || `post-${id ?? "…"}`}
                </span>
                <span className={styles.mono}>.md · from the title</span>
              </span>
            </div>

            <div className={styles.pair}>
              <div className={styles.field}>
                <span className="label" title="Same template · decides whether it lists under Blog or Project">
                  Shows in
                </span>
                <Segmented
                  label="Shows in"
                  options={[
                    { value: "blog", label: "Blog" },
                    { value: "project", label: "Project" },
                  ]}
                  value={form.section}
                  onChange={(section) =>
                    set({ section, category: (section === "project" ? projectCategories : categories)[0].slug })
                  }
                />
              </div>
              <div className={styles.field}>
                <span className="label" title="Decides which list the post appears in">
                  Category
                </span>
                <Segmented
                  label="Category"
                  options={cats.map((c) => ({ value: c.slug as string, label: c.label }))}
                  value={form.category}
                  onChange={(category) => set({ category })}
                />
              </div>
            </div>

            <label className={styles.field}>
              <span className={styles.labelRow}>
                <span className="label" title="One line under the title in lists and on hover · up to 200 characters">
                  Excerpt
                </span>
                <Count n={form.excerpt.length} max={200} />
              </span>
              <input
                className={`${styles.input} ${styles.strong}`}
                value={form.excerpt}
                onChange={(e) => set({ excerpt: e.target.value })}
                placeholder="One line under the title — shown in lists and on hover"
              />
            </label>

            {form.section === "project" && (
              <div className={styles.pair}>
                <label className={`${styles.field} ${styles.grow}`}>
                  <span className="label" title="What you did on it · shown beside the lead">
                    Role
                  </span>
                  <input className={styles.input} value={form.role ?? ""} onChange={(e) => set({ role: e.target.value || null })} placeholder="Design & development" />
                </label>
                <label className={`${styles.field} ${styles.grow}`}>
                  <span className="label">Year</span>
                  <input className={styles.input} value={form.year ?? ""} onChange={(e) => set({ year: e.target.value || null })} placeholder="2026" />
                </label>
              </div>
            )}

            <TagsField
              label={form.section === "project" ? "Stack" : "Tags"}
              tags={form.tags}
              all={allTags}
              onChange={(tags) => set({ tags })}
            />

            <LinksField links={form.links} onChange={(links) => set({ links })} />

            <div ref={actionsRef} className={styles.actions}>
              {published ? (
                <button type="button" className={styles.btnm} disabled={!!busy || !dirty} onClick={() => void doUpdate()}>
                  {busy === "Saving" ? "Saving…" : "Save changes"}
                </button>
              ) : (
                <>
                  <button type="button" className={styles.btnm} disabled={!!busy} onClick={() => void doPublish()}>
                    {busy === "Publishing" || (busy === "Saving" && publishing) ? "Publishing…" : "Publish"}
                  </button>
                  <button type="button" className={styles.btnl} disabled={!!busy || (!dirty && id != null)} onClick={() => void doDraft()}>
                    {busy === "Saving" && !publishing ? "Saving…" : "Save draft"}
                  </button>
                </>
              )}
              <span className={`${styles.ask} ${styles.askLeft}`}>
                <button
                  type="button"
                  className={styles.btnl}
                  disabled={!!busy || !changed}
                  title="Every field back to the last save"
                  onClick={() => setAsking(asking === "reset" ? null : "reset")}
                >
                  Reset
                </button>
                {asking === "reset" && (
                  <Confirm
                    question="Throw away the changes since the last save?"
                    note={id == null ? "Back to an empty post" : "Back to the last save · nothing is committed"}
                    yes="Reset"
                    danger
                    onYes={doReset}
                    onNo={() => setAsking(null)}
                  />
                )}
              </span>
              {/* Down here with Save and Reset, not in the header beside Unpublish: it's
                  pressed often, and shouldn't sit next to taking a post down (owner, 2 Oct 69) */}
              <button type="button" className={styles.btnl} onClick={openPreview}>
                Preview
              </button>
            </div>
            {working ? (
              <span className={styles.note} data-tone="muted">
                {publishing ? "Publishing" : busy}… {waited}s
              </span>
            ) : (
              note && (
                <span className={styles.note} data-tone={note.tone}>
                  {note.text}
                </span>
              )
            )}
          </div>

          <CoverField
            cover={form.cover}
            alt={form.coverAlt}
            onChange={(cover, coverAlt) => set({ cover, coverAlt })}
            onUpload={(file) => void uploadCover(file)}
            uploading={uploading}
            waiting={form.cover?.startsWith(UPLOAD) ? pending[form.cover.slice(UPLOAD.length)] : undefined}
            stem={`${stem}cover-`}
            onRename={(key, typed) => renameImage(key, typed, "cover-")}
          />
        </div>

        <MetaRow form={form} file={file} entry={entry} checks={checks} published={published} />
      </div>
      </div>

      <main className={styles.pageBody}>

        {mode === "write" ? (
          <WriteBox body={form.body} onChange={(body) => set({ body })} reset={rawReset} modeSwitch={modeRow} targets={targets} images={images} />
        ) : (
          <>
            <div className={styles.tools}>
              {modeRow}
              <span className={styles.toolsNote}>Markdown, frontmatter included · ⌘S saves</span>
            </div>
            <RawBox file={file.replace(/^posts\//, "")} text={raw} onChange={onRaw} reset={rawReset} />
          </>
        )}
      </main>
      {/* v4 07: the file at the foot of the page, on ink as the hub's repo bar, so the
          page ends somewhere (owner, 2 Oct 69) — where the post lives, whether it's on
          the site, and the last commit made to it */}
      <footer className={styles.term}>
        <span>{file}</span>
        <span className={styles.termDim}>
          {published ? `live · ${entry ? postUrl(entry) : ""}` : id == null ? "not saved yet" : "draft · not on the site"}
        </span>
        {entry?.lastCommit && <span className={styles.termDim}>last commit {entry.lastCommit}</span>}
      </footer>
      </div>
    </>
  );
}

function Count({ n, max }: { n: number; max: number }) {
  return (
    <span className={styles.count} data-over={n > max || undefined}>
      {n} / {max}
    </span>
  );
}

function Confirm({
  question,
  note,
  yes,
  danger,
  onYes,
  onNo,
}: {
  question: string;
  note: string;
  yes: string;
  danger?: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className={styles.confirm} data-danger={danger || undefined} role="dialog">
      <span>{question}</span>
      <span className={styles.mono}>{note}</span>
      <div className={styles.confirmActions}>
        <button type="button" className={styles.btnl} onClick={onNo}>
          Cancel
        </button>
        <button type="button" className={`${styles.btnl} ${styles.yes}`} onClick={onYes}>
          {yes}
        </button>
      </div>
    </div>
  );
}
