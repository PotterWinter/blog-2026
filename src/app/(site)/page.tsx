import Hero, { Keep } from "@/components/home/Hero";
import PostBrowser from "@/components/home/PostBrowser";
import { getPosts } from "@/lib/content";
import { isCategory } from "@/lib/site";
import { isSort } from "@/lib/sort";

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// 01 Blog home. The filters come in through the URL so a filtered view can be shared:
// /?category=math&tags=react,css&q=grid&page=2&view=list&sort=title-desc
export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const category = one(params.category);
  const tags = one(params.tags);
  const sort = one(params.sort);
  const posts = await getPosts({ section: "blog" });
  return (
    <main>
      <Hero
        first="Hello, I am"
        second="Korn."
        intro={
          <>
            I graduated in architecture, <Keep>ended up</Keep> building software, and write here
            about how things are <Keep>put together.</Keep> This is <Keep>a notebook,</Keep>{" "}
            <Keep>not a publication.</Keep> Posts go up when something breaks and{" "}
            <Keep>I finally understand why.</Keep>
          </>
        }
      />
      <PostBrowser
        posts={posts}
        initial={{
          category: isCategory(category) ? category : null,
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
