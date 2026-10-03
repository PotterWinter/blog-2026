import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import ContentsRail from "@/components/post/ContentsRail";
import styles from "@/components/post/Post.module.css";
import PostBody from "@/components/post/PostBody";
import PostHeader from "@/components/post/PostHeader";
import ProjectEnd from "@/components/post/ProjectEnd";
import { findPublished, forReaders, getClips, getPostTitles } from "@/lib/content";

// /project/<code>: published projects only. Drafts, blog posts (they live at /posts/…)
// and unknown codes get the 404 page; an old /project/<slug> link moves to the code.
async function load(code: string) {
  const found = await findPublished("project", code);
  if (found && "moved" in found) permanentRedirect(found.moved);
  return found?.post ? forReaders(found.post) : null;
}

export async function generateMetadata({ params }: PageProps<"/project/[code]">): Promise<Metadata> {
  const post = await load((await params).code);
  return post ? { title: `${post.title} · Code by Korn Natthanat`, description: post.excerpt } : {};
}

// 04B Project detail: 04's template, with the project's links in the title block (when
// it has any), Role · Year · Stack, and Back to Projects at the foot
export default async function ProjectPage({ params }: PageProps<"/project/[code]">) {
  const post = await load((await params).code);
  if (!post) notFound();
  return (
    <main data-post>
      <div className={styles.railZone}>
        <PostHeader post={post} />
        <PostBody markdown={post.body} clips={await getClips()} titles={await getPostTitles()} />
        <ContentsRail />
      </div>
      <ProjectEnd />
    </main>
  );
}
