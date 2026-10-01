import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import ContentsRail from "@/components/post/ContentsRail";
import styles from "@/components/post/Post.module.css";
import PostBody from "@/components/post/PostBody";
import PostHeader from "@/components/post/PostHeader";
import PostNav from "@/components/post/PostNav";
import { findPublished, forReaders, getPublished } from "@/lib/content";

// /posts/<code>: published blog posts only. Drafts, projects (they live at /project/…)
// and unknown codes get the 404 page; an old /posts/<slug> link moves to the code
// (findPublished).
async function load(code: string) {
  const found = await findPublished("blog", code);
  if (found && "moved" in found) permanentRedirect(found.moved);
  return found?.post ? forReaders(found.post) : null;
}

export async function generateMetadata({ params }: PageProps<"/posts/[code]">): Promise<Metadata> {
  const post = await load((await params).code);
  return post ? { title: `${post.title} · Code by Korn Natthanat`, description: post.excerpt } : {};
}

// 04 Post detail
export default async function PostPage({ params }: PageProps<"/posts/[code]">) {
  const post = await load((await params).code);
  if (!post) notFound();
  // Neighbours in the home list (newest first)
  const posts = await getPublished("blog");
  const i = posts.findIndex((p) => p.slug === post.slug);
  return (
    <main data-post>
      {/* The contents rail runs from the top of the post to the end of the article — it
          lists the title first and Previous | Next last, as "End" */}
      <div className={styles.railZone}>
        <PostHeader post={post} />
        <PostBody markdown={post.body} />
        <ContentsRail />
      </div>
      <PostNav previous={posts[i - 1] ?? null} next={posts[i + 1] ?? null} />
    </main>
  );
}
