import type { ReactNode } from "react";
import Header from "@/components/Header";
import SiteNav from "@/components/SiteNav";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header>
        <SiteNav />
      </Header>
      {children}
    </>
  );
}