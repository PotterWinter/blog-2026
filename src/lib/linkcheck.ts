import "server-only";

// Checks › Links (5.3f): does a link in a post open to anything? Asked from the
// server — a page can't read another site's answer. "broken" only when the site says
// so (404, 410) or there's no such site; a slow site, or one that turns robots away
// (401, 403, 429), isn't called broken.

const TIMEOUT = 6000;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  Accept: "text/html,*/*",
};

async function status(url: string, method: "HEAD" | "GET") {
  const res = await fetch(url, { method, headers: HEADERS, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT) });
  void res.body?.cancel();
  return res.status;
}

export async function linkState(url: string): Promise<"ok" | "broken"> {
  if (!/^https?:\/\//.test(url)) return "ok";
  try {
    // Some sites answer HEAD wrongly (405, 404); GET has the last word
    let code = await status(url, "HEAD");
    if (code >= 400) code = await status(url, "GET");
    return code === 404 || code === 410 ? "broken" : "ok";
  } catch (error) {
    // No such host, or nothing listening there
    const cause = (error as { cause?: { code?: string } }).cause?.code;
    return cause === "ENOTFOUND" || cause === "ECONNREFUSED" ? "broken" : "ok";
  }
}
