import Hero from "@/components/home/Hero";
import HomeIntro from "@/components/home/HomeIntro";
import PostBrowser from "@/components/home/PostBrowser";
import { getPublished } from "@/lib/content";
import { isCategory, isPrivate } from "@/lib/site";
import { isSort } from "@/lib/sort";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// 01 Blog home. The filters come in through the URL so a filtered view can be shared:
// /?category=math&tags=react,css&q=grid&page=2&view=list&sort=title-desc
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const category = one(params.category);
  const tags = one(params.tags);
  const sort = one(params.sort);
  const posts = await getPublished("blog");
  return (
    <main>
      <Hero
        first="Hello, I am"
        second="Korn."
        intro={<HomeIntro />}
      />
      <PostBrowser
        posts={posts}
        initial={{
          // ?category=private on a device that isn't signed in: All, as if it weren't there
          category:
            isCategory(category) && (!isPrivate({ category }) || posts.some(isPrivate)) ? category : null,
          tags: tags ? tags.split(",").filter(Boolean) : [],
          query: one(params.q) ?? "",
          page: Math.max(1, Number.parseInt(one(params.page) ?? "1", 10) || 1),
          view: one(params.view) === "list" ? "list" : "grid",
          sort: isSort(sort) ? sort : null,
        }}
      />
    </main>
  );
}
