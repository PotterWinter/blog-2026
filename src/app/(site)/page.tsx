import { getPosts } from "@/lib/content";

// Temporary: proves the data layer works. Step 3.2b replaces this with the real 01 layout.
export default async function Home() {
  const posts = await getPosts({ section: "blog" });
  return (
    <main style={{ padding: "var(--inset)" }}>
      <p className="label">{posts.length} posts</p>
      <ul>
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
