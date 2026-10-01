import {
  indexEntry,
  postFile,
  splitFrontmatter,
  toMarkdown,
  toMeta,
  type ContentIndex,
  type IndexEntry,
  type PostLink,
  type PostMeta,
} from "./schema.ts";

// What each admin action changes, worked out without touching GitHub or the disk: given
// the index and the post as they are now, the files to write (or remove), the commit
// message and the index after. write.ts reads, calls one of these, and commits — and if
// the repo moved on in between, reads again and calls it again. No server-only imports,
// so it can be tried out on the fixtures from a script.

// What the editor sends: everything it lets you change. id null = a new post.
export type PostInput = {
  id: number | null;
  slug: string;
  title: string;
  excerpt: string;
  section: PostMeta["section"];
  category: string;
  tags: string[];
  cover: string | null;
  coverAlt: string;
  role: string | null;
  year: string | null;
  links: PostLink[];
  body: string;
};

// text null = remove the file · base64 = a binary file (an image), in place of text
export type Change = { path: string; text: string | null; base64?: string };
// slugs: the posts whose pages change (their cache is cleared)
export type Plan = { changes: Change[]; message: string; index: ContentIndex; entry: IndexEntry | null; slugs: string[] };

export type Action = "Publish" | "Edit" | "Draft" | "Delete";

// Bangkok time, the owner's: "2026-10-02 14:16:21" for messages, "2026-10-02" for dates,
// "2026-10-02T14:16:21+07:00" for createdAt
export function bangkok(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  return { date, stamp: `${date} ${time}`, iso: `${date}T${time}+07:00` };
}

// v4 07: "2026-10-02 14:16:21 · Publish #37"
export const commitMessage = (now: Date, action: Action, id: number) => `${bangkok(now).stamp} · ${action} #${id}`;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;


// The index with one entry put in (or taken out), newest id first, as buildIndex leaves it
function withEntry(index: ContentIndex, id: number, entry: IndexEntry | null, nextId = index.nextId): ContentIndex {
  const posts = index.posts.filter((p) => p.id !== id);
  if (entry) posts.push(entry);
  posts.sort((a, b) => b.id - a.id);
  return { nextId, posts };
}

function find(index: ContentIndex, id: number): IndexEntry {
  const entry = index.posts.find((p) => p.id === id);
  if (!entry) throw new Error(`No post #${id}`);
  return entry;
}

// The .md, checked the way every read checks it, then summarised for the index. It's
// written to posts/<id>-<slug>.md; if it was somewhere else (an older unnumbered file,
// or the slug changed) that file goes in the same commit.
function written(meta: PostMeta, body: string, before: IndexEntry | null, now: Date, message: string) {
  const text = toMarkdown(meta, body);
  toMeta(splitFrontmatter(text, meta.slug).data, meta.slug); // throws on anything a read would refuse
  const path = postFile(meta.id, meta.slug);
  const entry = indexEntry({
    slug: meta.slug,
    text,
    file: path,
    createdAt: before?.createdAt ?? bangkok(now).iso,
    revisions: (before?.revisions ?? 0) + 1,
    lastCommit: message,
  });
  const changes: Change[] = [{ path, text }];
  if (before && before.file !== path) changes.push({ path: before.file, text: null });
  const slugs = [...new Set([meta.slug, ...(before ? [before.slug] : [])])];
  return { entry, changes, slugs };
}

// ---------- images waiting for the save (5.4) ----------
// The post points at an image picked but not committed yet as "upload:<key>" — the
// cover field as "upload:cover", the body as ![…](upload:<key>). Matched whole, so
// "upload:photo" never catches "upload:photo-2".
const WAITING = /upload:[a-z0-9-]+/g;

export const waitingKeys = (text: string) => new Set([...text.matchAll(WAITING)].map(([m]) => m.slice("upload:".length)));

// Once committed: "upload:<key>" → its path. The body gets "../" in front, as every
// image in a .md is relative to the post ("../media/…", so Obsidian shows it).
export const placeWaiting = (text: string, paths: Record<string, string>, prefix = "") =>
  text.replace(WAITING, (m) => (paths[m] ? prefix + paths[m] : m));

// The post's own images: media files named after its id ("media/2026/003-cover.webp")
// that a text points at. Images named for another post are never counted as its own.
export function ownMedia(id: number, text: string): Set<string> {
  const own = new RegExp(`media/\\d{4}/${String(id).padStart(3, "0")}-[a-z0-9-]+\\.webp`, "g");
  return new Set(text.match(own) ?? []);
}

// Its own images it no longer points at go in the same commit (owner, 1 Oct 69): a
// replaced cover, an image taken out of the text
const dropped = (id: number, before: string, after: string): Change[] => {
  const kept = ownMedia(id, after);
  return [...ownMedia(id, before)].filter((p) => !kept.has(p)).map((path) => ({ path, text: null }));
};

// Save (Save draft, or a published post's edits): a new post gets the next id and
// starts as a draft; a slug change moves the file. Status, number and publish date stay.
// previous: the .md as it was, to see which of its images it has stopped using.
export function planSave(index: ContentIndex, input: PostInput, now: Date, previous = ""): Plan {
  if (!SLUG.test(input.slug)) throw new Error("Slug: lowercase letters, numbers and single dashes");
  // /admin/posts/new is the editor for a post not made yet
  if (input.slug === "new") throw new Error('Slug "new" is taken by the editor — pick another');
  const before = input.id == null ? null : find(index, input.id);
  const id = before?.id ?? index.nextId;
  const taken = index.posts.find((p) => p.slug === input.slug && p.id !== id);
  if (taken) throw new Error(`Slug "${input.slug}" is already #${taken.id}`);

  const today = bangkok(now).date;
  const { body, ...fields } = input;
  const meta: PostMeta = {
    ...fields,
    id,
    no: before?.no ?? null,
    status: before?.status ?? "draft",
    publishedAt: before?.publishedAt ?? today,
    updatedAt: today,
  };
  const message = commitMessage(now, before?.status === "published" ? "Edit" : "Draft", id);
  const { entry, changes, slugs } = written(meta, body, before, now, message);
  changes.push(...dropped(id, previous, `${meta.cover ?? ""}\n${body}`));
  return { changes, message, index: withEntry(index, id, entry, before ? index.nextId : id + 1), entry, slugs };
}

// Publish: the first time, the section's next number and today's date; again after an
// unpublish, the number and date it had
export function planPublish(index: ContentIndex, id: number, file: string, now: Date): Plan {
  const before = find(index, id);
  if (before.status === "published") throw new Error(`#${id} is already published`);
  const { data, body } = splitFrontmatter(file, before.slug);
  const meta = toMeta(data, before.slug);
  const first = meta.no == null;
  const top = Math.max(0, ...index.posts.filter((p) => p.section === meta.section).map((p) => p.no ?? 0));
  const today = bangkok(now).date;
  const message = commitMessage(now, "Publish", id);
  const { entry, changes, slugs } = written(
    {
      ...meta,
      status: "published",
      no: first ? top + 1 : meta.no,
      publishedAt: first ? today : meta.publishedAt,
      updatedAt: today,
    },
    body,
    before,
    now,
    message,
  );
  return { changes, message, index: withEntry(index, id, entry), entry, slugs };
}

// Unpublish: back to a draft, off the site; it keeps its number for when it goes back up
export function planUnpublish(index: ContentIndex, id: number, file: string, now: Date): Plan {
  const before = find(index, id);
  if (before.status === "draft") throw new Error(`#${id} is already a draft`);
  const { data, body } = splitFrontmatter(file, before.slug);
  const meta = toMeta(data, before.slug);
  const message = commitMessage(now, "Draft", id);
  const { entry, changes, slugs } = written({ ...meta, status: "draft", updatedAt: bangkok(now).date }, body, before, now, message);
  return { changes, message, index: withEntry(index, id, entry), entry, slugs };
}

// Delete: drafts only (a published post is unpublished first). The id is never given
// out again; the file stays in git's history.
// Its own images go with it.
export function planDelete(index: ContentIndex, id: number, now: Date, file = ""): Plan {
  const before = find(index, id);
  if (before.status !== "draft") throw new Error(`#${id} is published: unpublish it first`);
  const message = commitMessage(now, "Delete", id);
  return {
    changes: [{ path: before.file, text: null }, ...dropped(id, file, "")],
    message,
    index: withEntry(index, id, null),
    entry: null,
    slugs: [before.slug],
  };
}

// ---------- the editor's text (RAW .MD) ----------
// RAW shows the post as its .md, frontmatter included — but only the fields the editor
// lets you change. id, no, status and the dates are the system's: they're kept out of
// the text so they can't be typed over, and put back on save.

const SYSTEM = /^(id|no|status|publishedAt|updatedAt):/;
const STAND_IN = { id: 1, status: "draft", publishedAt: "2000-01-01", updatedAt: "2000-01-01" };

export function toRaw({ body, ...fields }: Omit<PostInput, "id">): string {
  const meta: PostMeta = { ...fields, id: 1, no: null, status: "draft", publishedAt: "", updatedAt: "" };
  const [, front, rest] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(toMarkdown(meta, body))!;
  return `---\n${front.split("\n").filter((l) => !SYSTEM.test(l)).join("\n")}\n---\n${rest}`;
}

// RAW back to fields; throws (with the reason) while the text isn't a valid post yet
export function fromRaw(text: string, slug: string): Omit<PostInput, "id" | "slug"> {
  const { data, body } = splitFrontmatter(text, slug);
  for (const key of Object.keys(STAND_IN)) {
    if (key in data) throw new Error(`"${key}" is set by the system — take it out`);
  }
  const meta = toMeta({ ...data, ...STAND_IN }, slug);
  return {
    title: meta.title,
    excerpt: meta.excerpt,
    section: meta.section,
    category: meta.category,
    tags: meta.tags,
    cover: meta.cover,
    coverAlt: meta.coverAlt,
    role: meta.role,
    year: meta.year,
    links: meta.links,
    body,
  };
}

// A slug from a title: "Debouncing without useEffect" → "debouncing-without-useeffect".
// Thai and other letters outside a–z drop out; "" when nothing's left (type one).
export const slugify = (title: string) =>
  title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // é → e, not e-
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");

export const isSlug = (slug: string) => SLUG.test(slug);
