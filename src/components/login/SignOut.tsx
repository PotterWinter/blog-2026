"use client";

import { useRouter } from "next/navigation";
import { usePageTransition } from "../PageTransition";

// Signs this device out (its entry leaves sessions.json) and leaves for the blog's
// front page (owner, 2 Oct 69)
export default function SignOut({ className }: { className?: string }) {
  const router = useRouter();
  const { go } = usePageTransition();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        // With the page transition, as every page change
        if (go) go("/");
        else router.replace("/");
      }}
    >
      Sign out
    </button>
  );
}
