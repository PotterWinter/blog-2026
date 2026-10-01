import "server-only";

// Upstash Redis (Vercel Marketplace, free plan, iad1 — set up 1 Oct 69) over its REST
// API: one HTTP request per call, which suits functions that start and stop. No client
// library: the few commands the sessions need are plain JSON arrays.
//
// One database for everything, keys split by where the code runs, so testing never
// mixes with the real thing: "prod:" on the live site, "preview:" on preview deploys,
// "dev:" under next dev.

const URL_VAR = "KV_REST_API_URL";
const TOKEN_VAR = "KV_REST_API_TOKEN";

export const PREFIX =
  process.env.VERCEL_ENV === "production" ? "prod:" : process.env.VERCEL_ENV === "preview" ? "preview:" : "dev:";

type Command = (string | number)[];

function settings() {
  const url = process.env[URL_VAR];
  const token = process.env[TOKEN_VAR];
  const missing = [!url && URL_VAR, !token && TOKEN_VAR].filter(Boolean);
  if (missing.length) {
    throw new Error(`Redis isn't set up: ${missing.join(", ")} missing (vercel env pull .env.local)`);
  }
  return { url: url!, token: token! };
}

async function send<T>(path: string, body: unknown): Promise<T> {
  const { url, token } = settings();
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return (await res.json()) as T;
}

// One command: redis("GET", "prod:x") → its result
export async function redis<T = unknown>(...command: Command): Promise<T> {
  const { result, error } = await send<{ result: T; error?: string }>("", command);
  if (error) throw new Error(`Redis: ${error}`);
  return result;
}

// Several in one request, in order: their results
export async function pipeline(commands: Command[]): Promise<unknown[]> {
  const replies = await send<{ result: unknown; error?: string }[]>("/pipeline", commands);
  const failed = replies.find((r) => r.error);
  if (failed) throw new Error(`Redis: ${failed.error}`);
  return replies.map((r) => r.result);
}
