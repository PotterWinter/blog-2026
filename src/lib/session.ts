import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
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

export type Session = {
  id: string;
  device: string; // "iPhone · Safari"
  city: string; // from Vercel's IP location, "" in dev
  createdAt: string;
};

export type LoginEvent = {
  at: string;
  event: "in" | "out" | "wrong-code" | "reused-code";
  device: string;
  city: string;
};

// ---------- reading ----------

// The signed-in session, or null: cookie good (signed by us, not expired) AND still in
// Redis (signed out elsewhere = gone). One request per admin page.
export async function currentSession(): Promise<{ id: string } | null> {
  const cookie = readCookie((await cookies()).get(COOKIE)?.value);
  if (!cookie) return null;
  return (await redis<number>("EXISTS", key(`session:${cookie.id}`))) ? { id: cookie.id } : null;
}

// Every signed-in device, newest first (Settings, 5.5)
export async function allSessions(): Promise<Session[]> {
  const ids = await redis<string[]>("SMEMBERS", key("sessions"));
  if (!ids.length) return [];
  const values = await redis<(string | null)[]>("MGET", ...ids.map((id) => key(`session:${id}`)));
  const gone = ids.filter((_, i) => values[i] == null);
  if (gone.length) await redis("SREM", key("sessions"), ...gone);
  return values
    .filter((v): v is string => v != null)
    .map((v) => JSON.parse(v) as Session)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// The history, newest first (a dashboard, later)
export async function loginHistory(limit = 50): Promise<LoginEvent[]> {
  const rows = await redis<string[]>("LRANGE", key("logins"), 0, limit - 1);
  return rows.map((row) => JSON.parse(row) as LoginEvent);
}

// ---------- signing in and out ----------

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

const logLine = (event: LoginEvent["event"], device: string, city: string) =>
  JSON.stringify({ at: new Date().toISOString(), event, device, city } satisfies LoginEvent);

const logged = (event: LoginEvent["event"], device: string, city: string) => [
  ["LPUSH", key("logins"), logLine(event, device, city)],
  ["LTRIM", key("logins"), 0, HISTORY - 1],
];

// Into the history without signing anything in: a wrong code (the login route)
export async function recordLogin(event: LoginEvent["event"], device: string, city: string) {
  await pipeline(logged(event, device, city));
}

// A code that passed TOTP at `step`: refuse it if that step was used already (SET NX
// is the check and the mark in one), else store this device and set the cookie.
// false = code reused. "dev" = the local test code (next dev only): no check.
export async function signIn(step: number | "dev", device: string, city: string): Promise<boolean> {
  if (step !== "dev") {
    // The step is kept a little past the ±1 step a code is accepted in
    const fresh = await redis<string | null>("SET", key(`totp:${step}`), "1", "NX", "EX", 120);
    if (fresh == null) {
      await recordLogin("reused-code", device, city);
      return false;
    }
  }
  const id = randomBytes(18).toString("base64url");
  const expires = Date.now() + TTL * 1000;
  const session: Session = { id, device, city, createdAt: new Date().toISOString() };
  await pipeline([
    ["SET", key(`session:${id}`), JSON.stringify(session), "EX", TTL],
    ["SADD", key("sessions"), id],
    ...logged("in", device, city),
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
    const gone = raw ? (JSON.parse(raw) as Session) : null;
    await pipeline([
      ["DEL", key(`session:${target}`)],
      ["SREM", key("sessions"), target],
      ...(gone ? logged("out", gone.device, gone.city) : []),
    ]);
  }
  if (!id || id === mine) store.delete(COOKIE);
}
