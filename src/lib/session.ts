import "server-only";

import { randomBytes } from "node:crypto";
import { revalidateTag, unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { readFresh, writeContent } from "./content";
import { COOKIE, readCookie, sign } from "./cookie";

// One admin, signed in per device. The browser holds a signed cookie (cookie.ts); the
// list of devices lives in sessions.json in the content repo (no database — decided
// 30 Sep 69), so Settings can show them and sign one out. Signing in or out is a
// commit, which is fine: it's rare.

const DAYS = 30;
const FILE = "sessions.json";

export type Session = {
  id: string;
  device: string; // "iPhone · Safari"
  city: string; // from Vercel's IP location, "" in dev
  createdAt: string;
};

type SessionFile = {
  sessions: Session[];
  // The TOTP step last used, so a code can't be used twice
  lastStep: number;
};

// ---------- the list ----------

async function readList(): Promise<{ file: SessionFile; sha: string | null }> {
  const fresh = await readFresh(FILE);
  const file = fresh ? (JSON.parse(fresh.text) as SessionFile) : { sessions: [], lastStep: 0 };
  return { file, sha: fresh?.sha ?? null };
}

const writeList = async (file: SessionFile, sha: string | null, message: string) => {
  await writeContent(FILE, JSON.stringify(file, null, 2) + "\n", message, sha);
  revalidateTag("sessions", { expire: 0 });
};

// Cached between requests; signing in or out clears it (tag "sessions")
const cachedIds = unstable_cache(
  async () => (await readList()).file.sessions.map((s) => s.id),
  ["session-ids"],
  { tags: ["sessions"], revalidate: 3600 },
);

// The signed-in session, or null: cookie good AND still in the list (signed out
// elsewhere = gone)
export async function currentSession(): Promise<{ id: string } | null> {
  const cookie = readCookie((await cookies()).get(COOKIE)?.value);
  if (!cookie) return null;
  return (await cachedIds()).includes(cookie.id) ? { id: cookie.id } : null;
}

export async function allSessions(): Promise<Session[]> {
  return (await readList()).file.sessions;
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

// A code that passed TOTP at `step`: refuse it if that step (or a later one) was used
// already, else add this device and set the cookie. false = code reused.
// "dev" = the local test code, which can't be reused against anything, so no check.
export async function signIn(step: number | "dev", device: string, city: string): Promise<boolean> {
  const { file, sha } = await readList();
  if (step !== "dev") {
    if (step <= file.lastStep) return false;
    file.lastStep = step;
  }
  const id = randomBytes(18).toString("base64url");
  const expires = Date.now() + DAYS * 24 * 3600 * 1000;
  file.sessions.push({ id, device, city, createdAt: new Date().toISOString() });
  await writeList(file, sha, `Sign in · ${device}`);
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
    const { file, sha } = await readList();
    const gone = file.sessions.find((s) => s.id === target);
    if (gone) {
      file.sessions = file.sessions.filter((s) => s.id !== target);
      await writeList(file, sha, `Sign out · ${gone.device}`);
    }
  }
  if (!id || id === mine) store.delete(COOKIE);
}
