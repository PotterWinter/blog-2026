import Hero from "@/components/home/Hero";
import { getPosts } from "@/lib/content";

// 01 Blog home. The plain list below is temporary until the grid (3.2d).
export default async function Home() {
  const posts = await getPosts({ section: "blog" });
  return (
    <main>
      <Hero />
      <p className="label" style={{ padding: "0 var(--page-x)" }}>{posts.length} posts</p>
      <ul style={{ padding: "0 var(--page-x) 104px", listStyle: "none" }}>
        {posts.map((post) => (
          <li key={post.slug}>
            {post.publishedAt} · {post.category} · {post.title} · [{post.tags.join(", ")}] ·{" "}
            {post.cover ?? "no cover"}
          </li>
        ))}
      </ul>
    </main>
  );
}
