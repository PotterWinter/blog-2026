// TEMPORARY (30 Sep 69): why does production read nothing from the content repo?
// Reports whether the variables are set and what GitHub answers — never the token.
export const dynamic = "force-dynamic";

export async function GET() {
  const repo = process.env.CONTENT_REPO ?? "";
  const token = process.env.GITHUB_TOKEN ?? "";
  const ask = async (url: string) => {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    const body = res.ok ? null : (await res.text()).slice(0, 200);
    return { status: res.status, body };
  };
  return Response.json({
    repo,
    repoSet: Boolean(repo),
    tokenSet: Boolean(token),
    tokenStartsWith: token.slice(0, 11), // "github_pat_" for a fine-grained token
    contentDir: process.env.CONTENT_DIR ?? null,
    repoInfo: repo ? await ask(`https://api.github.com/repos/${repo}`) : null,
    index: repo ? await ask(`https://api.github.com/repos/${repo}/contents/index.json?ref=main`) : null,
  });
}
