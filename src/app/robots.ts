import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// /robots.txt: search engines read the site, not the admin or its plumbing.
// /design is the style sheet page (Body text, buttons…), not something to find in a search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/login", "/design"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
