import type { MetadataRoute } from "next";
import { getPosts } from "@/lib/content";
import { postUrl } from "@/lib/schema";
import { isPrivate, SITE_URL } from "@/lib/site";

// /sitemap.xml: every page a reader can open, so a search engine finds a new post
// without waiting for a link to it. Built from the index, so a publish shows up here
// as soon as the cache clears. Private posts are 404 to the signed out, so they're left out.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = (await getPosts()).filter((p) => !isPrivate(p));
  const pages = ["/", "/project", "/about"].map((path) => ({ url: `${SITE_URL}${path}` }));
  return [
    ...pages,
    ...posts.map((p) => ({ url: `${SITE_URL}${postUrl(p)}`, lastModified: p.updatedAt })),
  ];
}
