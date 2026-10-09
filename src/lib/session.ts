import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { COOKIE, readCookie, sign } from "./cookie";
import { PREFIX, pipeline, redis } from "./redis";

// One admin, signed in per device. The browser holds a signed cookie (cookie.ts); the
// devices, the codes already used and a history of sign-ins live in Redis (redis.ts).
// They lived in sessions.json in the content repo at first (30 Sep 69), which made
// every sign-in and sign-out a commit there and, right after one, GitHub could hand
// back the file from before it — moved to Redis on the owner's call, 1 Oct 69, until
// the homelab database.
//
// Keys (each after PREFIX, "prod:" / "preview:" / "dev:"):
//   session:<id>   the device, as JSON — expires with the cookie
//   sessions       the ids, for Settings' list (ones that expired are dropped as read)
//   totp:<step>    a code's time step once used, so it can't be used again
//   logins         the latest 500 sign-ins, sign-outs and wrong codes, newest first

const DAYS = 30;
const TTL = DAYS * 24 * 3600;
const HISTORY = 500;

const key = (name: string) => `${PREFIX}${name}`;

// A session or history line as stored; ones from before 5 Oct 69 have no ip
const stored = <T extends Where>(raw: string): T => {
  const value = JSON.parse(raw) as T;
  return { ...value, ip: value.ip ?? "" };
};

// Where a request came from: enough to tell one's own devices apart, and to see where
// a wrong code was tried from
export type Where = {
  device: string; // "iPhone · Safari"
  city: string; // from Vercel's IP location, "" in dev
  ip: string; // "" on sessions from before 5 Oct 69
};

export type Session = Where & { id: string; createdAt: string };

export type LoginEvent = Where & {
  at: string;
  event: "in" | "out" | "wrong-code" | "reused-code";
};

// ---------- reading ----------

// The signed-in session, or null: cookie good (signed by us, not expired) AND still in
// Redis (signed out elsewhere = gone). One request per admin page.
export async function currentSession(): Promise<{ id: string } | null> {
  const cookie = readCookie((await cookies()).get(COOKIE)?.value);
  if (!cookie) return null;
  return (await redis<number>("EXISTS", key(`session:${cookie.id}`))) ? { id: cookie.id } : null;
}

// May this request see the Private category (site.ts)? A device still signed in, asked
// of Redis on every page the blog renders — once per request however many ask (cache).
// Redis down = no: the private posts hide rather than the blog breaking.
export const seesPrivate = cache(async (): Promise<boolean> => {
  try {
    return (await currentSession()) != null;
  } catch {
    return false;
  }
});

// Every signed-in device, newest first (Settings, 5.5)
export async function allSessions(): Promise<Session[]> {
  const ids = await redis<string[]>("SMEMBERS", key("sessions"));
  if (!ids.length) return [];
  const values = await redis<(string | null)[]>("MGET", ...ids.map((id) => key(`session:${id}`)));
  const gone = ids.filter((_, i) => values[i] == null);
  if (gone.length) await redis("SREM", key("sessions"), ...gone);
  return values
    .filter((v): v is string => v != null)
    .map((v) => stored<Session>(v))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// A session as the page may see it (Settings): its id is part of the sign-in cookie,
// so the page gets a fingerprint of it instead, which signOutHandle takes back
export const handleOf = (id: string) => createHash("sha256").update(id).digest("base64url").slice(0, 16);

export async function signOutHandle(handle: string): Promise<boolean> {
  const s = (await allSessions()).find((x) => handleOf(x.id) === handle);
  if (!s) return false;
  await signOut(s.id);
  return true;
}

// The history, newest first (kept for a dashboard)
export async function loginHistory(limit = 50): Promise<LoginEvent[]> {
  const rows = await redis<string[]>("LRANGE", key("logins"), 0, limit - 1);
  return rows.map((row) => stored<LoginEvent>(row));
}

// Codes that didn't get in (wrong, or used twice) in the last `days`, newest first —
// what Settings › Sessions shows of the history
export async function missedCodes(days = 7): Promise<LoginEvent[]> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  return (await loginHistory(HISTORY)).filter((h) => h.event !== "in" && h.event !== "out" && h.at >= since);
}

// ---------- signing in and out ----------

// The caller's address: Vercel puts it in x-real-ip; next dev only passes on
// x-forwarded-for (::1 on this machine), an IPv4 one as IPv6 ("::ffff:192.168.1.34"),
// shown as plain IPv4
export function clientIp(headers: Headers): string {
  const ip = headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  return ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, "");
}

// "iPhone · Safari" from the User-Agent — enough to tell one's own devices apart
export function deviceName(ua: string): string {
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  return `${os} · ${browser}`;
}

const logged = (event: LoginEvent["event"], { device, city, ip }: Where) => [
  ["LPUSH", key("logins"), JSON.stringify({ at: new Date().toISOString(), event, device, city, ip } satisfies LoginEvent)],
  ["LTRIM", key("logins"), 0, HISTORY - 1],
];

// Into the history without signing anything in: a wrong code (the login route)
export async function recordLogin(event: LoginEvent["event"], where: Where) {
  await pipeline(logged(event, where));
}

// A code that passed TOTP at `step`: refuse it if that step was used already (SET NX
// is the check and the mark in one), else store this device and set the cookie.
// false = code reused. "dev" = the local test code (next dev only): no check.
// One device, one session: signing in again from the same browser and address (its
// cookie lost, say) replaces the session it had rather than adding another.
export async function signIn(step: number | "dev", where: Where): Promise<boolean> {
  if (step !== "dev") {
    // The step is kept a little past the ±1 step a code is accepted in
    const fresh = await redis<string | null>("SET", key(`totp:${step}`), "1", "NX", "EX", 120);
    if (fresh == null) {
      await recordLogin("reused-code", where);
      return false;
    }
  }
  const id = randomBytes(18).toString("base64url");
  const expires = Date.now() + TTL * 1000;
  const session: Session = { id, ...where, createdAt: new Date().toISOString() };
  const before = (await allSessions()).filter((s) => s.device === where.device && s.ip === where.ip);
  await pipeline([
    ...before.flatMap((s) => [
      ["DEL", key(`session:${s.id}`)],
      ["SREM", key("sessions"), s.id],
    ]),
    ["SET", key(`session:${id}`), JSON.stringify(session), "EX", TTL],
    ["SADD", key("sessions"), id],
    ...logged("in", where),
  ]);
  (await cookies()).set(COOKIE, `${id}.${expires}.${sign(`${id}.${expires}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
  return true;
}

// Sign out one session (this one when no id is given)
export async function signOut(id?: string) {
  const store = await cookies();
  const mine = readCookie(store.get(COOKIE)?.value)?.id;
  const target = id ?? mine;
  if (target) {
    const raw = await redis<string | null>("GET", key(`session:${target}`));
    const gone = raw ? stored<Session>(raw) : null;
    await pipeline([
      ["DEL", key(`session:${target}`)],
      ["SREM", key("sessions"), target],
      ...(gone ? logged("out", gone) : []),
    ]);
  }
  if (!id || id === mine) store.delete(COOKIE);
}
