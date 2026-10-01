import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import PageSlot from "@/components/PageSlot";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin · Code by Korn Natthanat",
  robots: { index: false, follow: false },
};

// Every /admin page: signed in on this device (proxy.ts checks the cookie; this checks
// the device is still on the list). No rise-in on scroll here (no RevealObserver, no
// data-reveal): open it and it's all there (owner, 1 Oct 69). The header comes from
// below: the admin's nav for the hub, Media, Settings — (main)/layout — and the
// editor's own bar for a post (07).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await currentSession())) redirect("/login");
  // Posts pressed while on it: the hub starts over (PageSlot remounts it)
  return <PageSlot>{children}</PageSlot>;
}
