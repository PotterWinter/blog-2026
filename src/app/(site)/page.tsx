import Hero from "@/components/home/Hero";
import PostBrowser from "@/components/home/PostBrowser";
import { getPosts } from "@/lib/content";
import { isCategory } from "@/lib/site";

// 01 Blog home
export default async function Home({ searchParams }: PageProps<"/">) {
  const { category } = await searchParams;
  const posts = await getPosts({ section: "blog" });
  return (
    <main>
      <Hero />
      <PostBrowser posts={posts} initialCategory={isCategory(category) ? category : null} />
    </main>
  );
}
