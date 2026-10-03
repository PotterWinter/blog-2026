import { notFound } from "next/navigation";
import Editor from "@/components/editor/Editor";
import { getClips, getMediaFiles, getPost, getPosts } from "@/lib/content";
import { postUrl } from "@/lib/schema";

// 07 Admin post editor. /admin/posts/new is a post not made yet: it gets its id (and
// its file) on the first save, and the address becomes /admin/posts/<slug> — the same
// route, so the editor on screen stays as it is (two routes swapped it for a fresh
// one, losing what was on it). Read straight after a save: every write clears this
// post's cache (post:<slug>) and the list's (index).
export default async function EditPostPage({ params }: PageProps<"/admin/posts/[slug]">) {
  const { slug } = await params;
  const posts = await getPosts({ drafts: true });
  const allTags = [...new Set(posts.flatMap((p) => p.tags))].sort();
  const published = posts.filter((p) => p.status === "published");
  // What WRITE's Link can point to: the published posts, by their address
  const targets = published.map((p) => ({ title: p.title, href: postUrl(p), section: p.section }));
  // Checks › Links (5.3f): the site's own addresses that open — its pages, each
  // published post by its code and by its slug (an old link moves to the code)
  const pages = ["/", "/about", "/project", ...published.flatMap((p) => [postUrl(p), postUrl({ ...p, code: null })])];
  const clips = await getClips();
  // Checks › Files, Image size: what's in media/ and how big. Not listed (GitHub
  // down) = those checks stay grey rather than the editor not opening.
  const media = await getMediaFiles().catch(() => null);
  const shared = { allTags, targets, pages, clips, media };
  if (slug === "new") return <Editor post={null} entry={null} {...shared} />;
  const post = await getPost(slug);
  if (!post) notFound();
  const entry = posts.find((p) => p.id === post.id) ?? null;
  return <Editor post={post} entry={entry} {...shared} />;
}
