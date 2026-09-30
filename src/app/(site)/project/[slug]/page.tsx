import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContentsRail from "@/components/post/ContentsRail";
import styles from "@/components/post/Post.module.css";
import PostBody from "@/components/post/PostBody";
import PostHeader from "@/components/post/PostHeader";
import ProjectEnd from "@/components/post/ProjectEnd";
import { getPost } from "@/lib/content";

// Published projects only: drafts, blog posts (they live at /posts/…) and unknown slugs
// all get the 404 page
async function load(slug: string) {
  const post = await getPost(slug);
  return post && post.section === "project" && post.status === "published" ? post : null;
}

export async function generateMetadata({ params }: PageProps<"/project/[slug]">): Promise<Metadata> {
  const post = await load((await params).slug);
  return post ? { title: `${post.title} · Code by Korn Natthanat`, description: post.excerpt } : {};
}

// 04B Project detail: 04's template, with the project's links in the title block (when
// it has any), Role · Year · Stack, and Back to Projects at the foot
export default async function ProjectPage({ params }: PageProps<"/project/[slug]">) {
  const post = await load((await params).slug);
  if (!post) notFound();
  return (
    <main data-post>
      <div className={styles.railZone}>
        <PostHeader post={post} />
        <PostBody markdown={post.body} />
        <ContentsRail />
      </div>
      <ProjectEnd />
    </main>
  );
}
