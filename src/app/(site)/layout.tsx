import type { ReactNode } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PageTransition from "@/components/PageTransition";
import RevealObserver from "@/components/RevealObserver";
import SiteNav from "@/components/SiteNav";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <PageTransition>
      <Header>
        <SiteNav />
      </Header>
      {children}
      <Footer />
      <RevealObserver />
    </PageTransition>
  );
}
