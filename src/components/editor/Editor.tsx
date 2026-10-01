"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { publish, remove, save, unpublish, upload, type Result } from "@/app/admin/actions";
import { postChecks } from "@/lib/checks";
import { fromRaw, slugify, toRaw, type PostInput } from "@/lib/edit";
import { postFile, type IndexEntry, type Post } from "@/lib/schema";
import { categories, projectCategories } from "@/lib/site";
import { usePageTransition } from "../PageTransition";
import Segmented from "../Segmented";
import TransitionLink from "../TransitionLink";
import { CoverField, LinksField, TagsField } from "./Fields";
import MetaRow from "./MetaRow";
import RawBox from "./RawBox";
import { UPLOAD, type Waiting } from "./waiting";
import { shrinkForUpload } from "./shrink";
import styles from "./Editor.module.css";

// 07 Admin post editor (v4 07 / EDITOR-SPEC). The form is the post: title, slug, where
// it shows, category, excerpt, tags, links, cover — and the body, in RAW .MD for now
// (WRITE, the formatted view, is 5.3d). Save / Publish / Unpublish / Delete go to the
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

export default function Editor({ post, entry: first, allTags }: { post: Post | null; entry: IndexEntry | null; allTags: string[] }) {
  const { go } = usePageTransition();
  const barRef = useRef<HTMLElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState<Form>(() => (post ? fromPost(post) : blank));
  const [entry, setEntry] = useState(first);
  const [saved, setSaved] = useState(() => JSON.stringify(post ? fromPost(post) : blank));
  const [slugAuto, setSlugAuto] = useState(!post);
  const [mode, setMode] = useState<"write" | "raw">("raw");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [note, setNoteState] = useState<Note | null>(() => notes.get(first?.id ?? "new") ?? null);
  const [warned, setWarned] = useState(false);
  const [asking, setAsking] = useState<"delete" | "unpublish" | null>(null);

  const id = entry?.id ?? null;
  // Where it is (or will be, on the first save): posts/<id>-<slug>.md
  const file = id != null ? postFile(id, form.slug || "…") : `posts/new-${form.slug || "…"}.md`;
  const setNote = (next: Note | null, forId: number | null = id) => {
    if (next) notes.set(forId ?? "new", next);
    else notes.delete(forId ?? "new");
    setNoteState(next);
  };
  const published = entry?.status === "published";
  const dirty = JSON.stringify(form) !== saved;
  const checks = postChecks(form);
  const bad = checks.filter((c) => c.ok === false).length;

  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setWarned(false);
  };
  const setTitle = (title: string) => set(slugAuto ? { title, slug: slugify(title) } : { title });

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
    const sent = Object.values(pending).filter(({ key }) => (form.cover + form.body).includes(`${UPLOAD}${key}`));
    const result = await call("Saving", () => save({ id, ...form }, sent.map(({ key, base64 }) => ({ key, base64 }))));
    if (!result) return null;
    // Where they went: the post now says their paths, and nothing waits any more
    const swap = (text: string) =>
      Object.entries(result.uploads ?? {}).reduce((t, [from, to]) => t.split(from).join(to), text);
    const next = { ...form, cover: form.cover && swap(form.cover), body: swap(form.body) };
    setForm(next);
    setSaved(JSON.stringify(next));
    for (const p of sent) URL.revokeObjectURL(p.url);
    setPending((all) => Object.fromEntries(Object.entries(all).filter(([key]) => !sent.some((p) => p.key === key))));
    setSlugAuto(false);
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
    const target = dirty || id == null ? await doSave() : { id };
    if (!target) return;
    const result = await call("Publishing", () => publish(target.id));
    if (result) setNote({ text: `Published as No. ${result.entry?.no} · live now`, tone: "ok" }, result.id);
  };

  const doUpdate = async () => {
    if (await doSave()) setNote({ text: "Saved · live now", tone: "ok" });
  };

  const doUnpublish = async () => {
    setAsking(null);
    if (id == null) return;
    const result = await call("Unpublishing", () => unpublish(id));
    if (result) setNote({ text: "Back to a draft · off the site", tone: "muted" });
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
  const [uploading, setUploading] = useState(false);
  const uploadCover = async (file: File) => {
    setUploading(true);
    const data = new FormData();
    data.set("role", "cover");
    data.set("file", await shrinkForUpload(file));
    const result = await upload(data);
    setUploading(false);
    if (!result.ok) {
      setNote({ text: `Cover not added · ${result.error}`, tone: "bad" });
      return;
    }
    const image = result.image;
    const bytes = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/webp" }));
    setPending((all) => {
      if (all[image.key]) URL.revokeObjectURL(all[image.key].url);
      return { ...all, [image.key]: { ...image, url } };
    });
    set({ cover: `${UPLOAD}${image.key}` });
    setNote({
      text: `Cover ready · ${image.width} × ${image.height}, ${Math.round(image.bytes / 1024)} KB · goes up with ${published ? "Save changes" : "Save"}`,
      tone: "muted",
    });
  };

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
        if (!busy) void (published ? doUpdate() : doSave());
      }
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("beforeunload", leave);
    };
  });

  // The WRITE / RAW row sticks under the bar, however tall the bar wraps to
  useEffect(() => {
    const bar = barRef.current;
    const page = pageRef.current;
    if (!bar || !page) return;
    const observer = new ResizeObserver(() => page.style.setProperty("--bar-h", `${bar.offsetHeight}px`));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // ---------- RAW .MD ----------

  const raw = useMemo(() => toRaw(form), [form]);
  const onRaw = (text: string) => {
    const parsed = fromRaw(text, form.slug || "new"); // throws: RawBox shows why
    // A title typed (or pasted) here makes the slug too, while it's still automatic
    setForm((f) => ({ ...f, ...parsed, ...(slugAuto && { slug: slugify(parsed.title) }) }));
    setWarned(false);
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

  return (
    <>
      <header ref={barRef} className={styles.bar}>
        <TransitionLink href="/admin" className={styles.back}>
          ← Publishing
        </TransitionLink>
        <span className={styles.id} title="Post ID · primary key, never reused">
          {id == null ? "New" : `#${id}`}
        </span>
        <span className={`${styles.mono} ${styles.path}`}>{file}</span>
        <span className="label">{status}</span>
        <span className={styles.saved} data-state={error ? "bad" : busy ? "busy" : dirty ? "dirty" : undefined}>
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
              {dirty && !busy && " · edited"}
            </>
          )}
        </span>
        <nav className={styles.menu}>
          {published ? (
            <a href={`/${form.section === "project" ? "project" : "posts"}/${entry?.slug}`} target="_blank" rel="noopener" className={styles.link}>
              View live
            </a>
          ) : (
            <span className={styles.off} title="The private preview comes with 5.3g">
              Preview
            </span>
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

      <main ref={pageRef} className={styles.page}>
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

        <div className={styles.fields}>
          <div className={styles.left}>
            <label className={styles.field}>
              <span className="label" title="File name and URL · made from the title until you change it">
                Slug · file name
              </span>
              <span className={styles.slugRow}>
                <input
                  className={`${styles.input} ${styles.mono}`}
                  value={form.slug}
                  onChange={(e) => {
                    setSlugAuto(false);
                    set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") });
                  }}
                  placeholder="a-z, 0-9 and dashes"
                  spellCheck={false}
                />
                <span className={styles.mono}>.md · {slugAuto ? "auto" : "edited"}</span>
              </span>
            </label>

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

            <div className={styles.actions}>
              {published ? (
                <button type="button" className={styles.btnm} disabled={!!busy || !dirty} onClick={() => void doUpdate()}>
                  Save changes
                </button>
              ) : (
                <>
                  <button type="button" className={styles.btnm} disabled={!!busy} onClick={() => void doPublish()}>
                    Publish
                  </button>
                  <button type="button" className={styles.btnl} disabled={!!busy || (!dirty && id != null)} onClick={() => void doSave()}>
                    Save draft
                  </button>
                </>
              )}
            </div>
            {note && (
              <span className={styles.note} data-tone={note.tone}>
                {note.text}
              </span>
            )}
          </div>

          <CoverField
            cover={form.cover}
            alt={form.coverAlt}
            onChange={(cover, coverAlt) => set({ cover, coverAlt })}
            onUpload={(file) => void uploadCover(file)}
            uploading={uploading}
            waiting={form.cover?.startsWith(UPLOAD) ? pending[form.cover.slice(UPLOAD.length)] : undefined}
          />
        </div>

        <MetaRow form={form} file={file} entry={entry} checks={checks} published={published} />

        <div className={styles.tools}>
          <Segmented
            label="Mode"
            options={[
              { value: "write", label: "Write" },
              { value: "raw", label: "Raw .md" },
            ]}
            value={mode}
            onChange={setMode}
            disabled={(m) => m === "write" && "Write — the formatted view — comes next (5.3d)"}
          />
          <span className={styles.toolsNote}>Markdown, frontmatter included · ⌘S saves</span>
        </div>

        <RawBox file={file.replace(/^posts\//, "")} text={raw} onChange={onRaw} />
      </main>
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
