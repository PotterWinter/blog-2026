import { getMedia } from "@/lib/content";

// /media/2026/cover.webp → the file from the content repo's media/ folder (on GitHub,
// or fixtures/content in dev). Covers in the .md say "../media/…" and the site asks for
// "/media/…", so the same path works in Obsidian, on GitHub and here.
export async function GET(_request: Request, { params }: RouteContext<"/media/[...path]">) {
  const { path } = await params;
  const file = await getMedia(path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.body, {
    headers: {
      "Content-Type": file.type,
      // A day in the browser, then checked again; a replaced image shows within a day
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
