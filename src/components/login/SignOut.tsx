"use client";

import { useRouter } from "next/navigation";

// Signs this device out (its entry leaves sessions.json) and goes back to /login
export default function SignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="label"
      style={{ padding: "12px 0", border: 0, background: "none", color: "var(--ink)", cursor: "pointer" }}
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        router.replace("/login");
      }}
    >
      Sign out
    </button>
  );
}
