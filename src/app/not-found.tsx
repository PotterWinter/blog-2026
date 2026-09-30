import type { Metadata } from "next";
import NotFound from "@/components/not-found/NotFound";
import SiteLayout from "./(site)/layout";

export const metadata: Metadata = {
  title: "Not found · Code by Korn Natthanat",
};

// Any unknown URL (and notFound() from a page, e.g. a post that doesn't exist).
// This file renders in the root layout only, so it brings the site's header and
// footer itself.
export default function NotFoundPage() {
  return (
    <SiteLayout>
      <NotFound />
    </SiteLayout>
  );
}
