import { signOut } from "@/lib/session";

// POST → this device signed out (its entry leaves sessions.json, the cookie goes)
export async function POST() {
  await signOut();
  return Response.json({ ok: true });
}
