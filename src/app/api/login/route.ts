import { deviceName, signIn } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";

// POST { code } → 200 signed in (cookie set) · 401 wrong or reused code.
// Kept on its own path so a Vercel Firewall rule can rate-limit it: at most 5 tries in
// 10 minutes per IP (decided 30 Sep 69, until the homelab database).
export async function POST(request: Request) {
  const secret = process.env.TOTP_SECRET;
  if (!secret) return Response.json({ error: "Login isn't set up" }, { status: 503 });
  const { code } = (await request.json().catch(() => ({}))) as { code?: unknown };
  // On this machine (next dev only — never a build) 111111 always signs in, as v4's
  // test code did, so no authenticator is needed locally (owner, 1 Oct 69)
  const devCode = process.env.NODE_ENV === "development" && code === "111111";
  const step = devCode ? "dev" : typeof code === "string" ? verifyTotp(secret, code) : null;
  if (step == null) return Response.json({ error: "Wrong code" }, { status: 401 });
  const city = decodeURIComponent(request.headers.get("x-vercel-ip-city") ?? "");
  const ok = await signIn(step, deviceName(request.headers.get("user-agent") ?? ""), city);
  if (!ok) return Response.json({ error: "Code already used — wait for the next one" }, { status: 401 });
  return Response.json({ ok: true });
}
