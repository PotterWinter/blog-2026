"use client";

import { useRouter } from "next/navigation";

// Signs this device out (its entry leaves sessions.json) and goes back to /login
export default function SignOut({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        router.replace("/login");
      }}
    >
      Sign out
    </button>
  );
}
