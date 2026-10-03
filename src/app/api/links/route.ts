import { linkState } from "@/lib/linkcheck";
import { currentSession } from "@/lib/session";

// Checks › Links (5.3f): POST a list of links to other sites → each "ok" or "broken".
// A route, not a server action: a page's actions run one after another, so a slow site
// being asked held up Save behind it (owner, 4 Oct 69: saving took far past its usual 5s).
export async function POST(req: Request) {
  if (!(await currentSession())) return new Response(null, { status: 401 });
  const urls = ((await req.json().catch(() => [])) as unknown[]).filter((u): u is string => typeof u === "string");
  const asked = [...new Set(urls)].filter((u) => /^https?:\/\//.test(u)).slice(0, 30);
  const states = await Promise.all(asked.map(linkState));
  return Response.json(Object.fromEntries(asked.map((u, i) => [u, states[i]])));
}
