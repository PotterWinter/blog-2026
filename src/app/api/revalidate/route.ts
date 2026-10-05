import { timingSafeEqual } from "node:crypto";
import { refresh, refreshAll } from "@/lib/write";

// POST { slugs } with "Authorization: Bearer <REVALIDATE_SECRET>" → this site forgets
// the index and those posts, as its own save would. A dev server that commits to the
// real repo calls it, since a save only clears the cache of the server that saved and
// the live site would otherwise show the edit up to an hour late (owner, 2 Oct 69).
// { all: true }: everything read from the content repo (Settings › Clear cache).
// No secret set here = the endpoint is off.
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return Response.json({ error: "Not set up" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
  const want = Buffer.from(secret);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return Response.json({ error: "Wrong secret" }, { status: 401 });
  }
  const { slugs, all } = (await request.json().catch(() => ({}))) as { slugs?: unknown; all?: unknown };
  if (all === true) {
    refreshAll();
    return Response.json({ ok: true });
  }
  const list = Array.isArray(slugs) ? slugs.filter((s): s is string => typeof s === "string" && /^[a-z0-9-]{1,80}$/.test(s)) : [];
  refresh(list.slice(0, 10));
  return Response.json({ ok: true });
}
