import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import styles from "@/components/admin/Admin.module.css";
import Header from "@/components/Header";
import RevealObserver from "@/components/RevealObserver";
import { currentSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Admin · Code by Korn Natthanat",
  robots: { index: false, follow: false },
};

// Every /admin page: signed in on this device (proxy.ts checks the cookie; this checks
// the device is still on the list), under the admin header
export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!(await currentSession())) redirect("/login");
  return (
    <>
      <Header className={styles.header}>
        <AdminNav />
      </Header>
      {children}
      <RevealObserver />
    </>
  );
}
