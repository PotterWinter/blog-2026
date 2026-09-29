import Hero from "@/components/home/Hero";
import PostBrowser from "@/components/home/PostBrowser";
import { getPosts } from "@/lib/content";
import { isCategory } from "@/lib/site";

// 01 Blog home
export default async function Home({ searchParams }: PageProps<"/">) {
  const { category, page } = await searchParams;
  const posts = await getPosts({ section: "blog" });
  const pageNumber = Math.max(1, Number.parseInt(String(page ?? "1"), 10) || 1);
  return (
    <main>
      <Hero />
      <PostBrowser
        posts={posts}
        initialCategory={isCategory(category) ? category : null}
        initialPage={pageNumber}
      />
    </main>
  );
}
