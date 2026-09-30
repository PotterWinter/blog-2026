import Hub from "@/components/admin/Hub";
import { getPosts, getRepoHead } from "@/lib/content";

// 06 Admin publishing hub: every post, drafts included, blog and project alike
export default async function AdminPage() {
  const [posts, head] = await Promise.all([getPosts({ drafts: true }), getRepoHead()]);
  return <Hub posts={posts} head={head} />;
}
