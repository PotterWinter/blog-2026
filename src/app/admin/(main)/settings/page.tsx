import Settings from "@/components/admin/Settings";
import { IMAGE_MAX } from "@/lib/checks";
import { CLIP_MAX } from "@/lib/clips";
import { getPosts, getRepoHead, LOCAL_DIR } from "@/lib/content";
import { allSessions, currentSession, handleOf, missedCodes } from "@/lib/session";
import { categories, projectCategories } from "@/lib/site";

// 09 Admin settings (5.5a): the site's settings as they stand (Site, Categories and
// Checks become editable in 5.5b, kept in site.json in the content repo), where code
// and posts live, the devices signed in and the codes that didn't get in, and Clear cache
export default async function SettingsPage() {
  const [posts, content, sessions, me, missed] = await Promise.all([
    getPosts({ drafts: true }),
    getRepoHead(),
    allSessions(),
    currentSession(),
    missedCodes(7),
  ]);
  const count = (slug: string) => posts.filter((p) => p.category === slug).length;
  // The code repo: what Vercel built this from; in dev, this folder
  const env = process.env;
  const code = env.VERCEL_GIT_REPO_SLUG
    ? {
        repo: `${env.VERCEL_GIT_REPO_OWNER}/${env.VERCEL_GIT_REPO_SLUG}`,
        branch: env.VERCEL_GIT_COMMIT_REF ?? "",
        sha: (env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
      }
    : null;
  return (
    <Settings
      categories={[...categories, ...projectCategories].map((c) => ({ ...c, posts: count(c.slug) }))}
      limits={{ imageKb: IMAGE_MAX / 1024, clipMb: CLIP_MAX / 1024 / 1024 }}
      code={code}
      content={content}
      local={LOCAL_DIR != null}
      sessions={sessions.map(({ id, ...s }) => ({ ...s, handle: handleOf(id), mine: id === me?.id }))}
      missed={missed}
      env={env.VERCEL_ENV === "production" ? "live" : env.VERCEL_ENV === "preview" ? "preview" : "local"}
    />
  );
}
