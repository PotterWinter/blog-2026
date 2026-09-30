import { createHmac, timingSafeEqual } from "node:crypto";

// The session cookie, "<id>.<expires>.<sig>", signed with SESSION_SECRET so it can't be
// made up. Kept apart from session.ts so proxy.ts can check it without the repo code.

export const COOKIE = "session";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET is missing or too short");
  return s;
}

export const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

// { id, expires } if the cookie is ours and not expired, else null
export function readCookie(value: string | undefined): { id: string; expires: number } | null {
  if (!value) return null;
  const [id, exp, sig] = value.split(".");
  if (!id || !exp || !sig) return null;
  const good = Buffer.from(sign(`${id}.${exp}`));
  const given = Buffer.from(sig);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  const expires = Number(exp);
  return expires > Date.now() ? { id, expires } : null;
}
