import type { ReactNode } from "react";
import AdminNav from "@/components/admin/AdminNav";
import styles from "@/components/admin/Admin.module.css";
import Header from "@/components/Header";

// The hub, Media and Settings: under the admin header (Posts · Media · Settings). The
// two fill the screen at least, so the dark repo footer sits on its bottom edge however
// tall the header is drawn — the page's height was the screen less a guessed 40px, and
// in Safari the header is shorter: a white line showed under the footer (owner, 2 Oct 69)
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <Header className={styles.header}>
        <AdminNav />
      </Header>
      {children}
    </div>
  );
}
