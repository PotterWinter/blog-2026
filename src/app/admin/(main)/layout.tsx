import type { ReactNode } from "react";
import AdminNav from "@/components/admin/AdminNav";
import styles from "@/components/admin/Admin.module.css";
import Header from "@/components/Header";

// The hub, Media and Settings: under the admin header (Posts · Media · Settings)
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header className={styles.header}>
        <AdminNav />
      </Header>
      {children}
    </>
  );
}
