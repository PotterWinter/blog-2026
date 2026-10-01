import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import styles from "@/components/admin/Admin.module.css";
import Header from "@/components/Header";
import PageSlot from "@/components/PageSlot";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin · Code by Korn Natthanat",
  robots: { index: false, follow: false },
};

// Every /admin page: signed in on this device (proxy.ts checks the cookie; this checks
// the device is still on the list), under the admin header. No rise-in on scroll here
// (no RevealObserver, no data-reveal): open it and it's all there (owner, 2 Oct 69)
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await currentSession())) redirect("/login");
  return (
    <>
      <Header className={styles.header}>
        <AdminNav />
      </Header>
      {/* Posts pressed while on it: the hub starts over (PageSlot remounts it) */}
      <PageSlot>{children}</PageSlot>
    </>
  );
}
