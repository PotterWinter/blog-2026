import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentsRail from "@/components/post/ContentsRail";
import styles from "@/components/post/Post.module.css";
import PostBody from "@/components/post/PostBody";
import PostHeader from "@/components/post/PostHeader";
import PostNav from "@/components/post/PostNav";
import { getPost, getPosts } from "@/lib/content";

// Published blog posts only: drafts, projects (they live at /project/…) and unknown
// slugs all get the 404 page
async function load(slug: string) {
  const post = await getPost(slug);
  return post && post.section === "blog" && post.status === "published" ? post : null;
}

export async function generateMetadata({ params }: PageProps<"/posts/[slug]">): Promise<Metadata> {
  const post = await load((await params).slug);
  return post ? { title: `${post.title} · Code by Korn Natthanat`, description: post.excerpt } : {};
}

// 04 Post detail
export default async function PostPage({ params }: PageProps<"/posts/[slug]">) {
  const post = await load((await params).slug);
  if (!post) notFound();
  // Neighbours in the home list (newest first)
  const posts = await getPosts({ section: "blog" });
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
