import MediaLibrary from "@/components/admin/MediaLibrary";
import { getRepoHead } from "@/lib/content";
import { getMediaLibrary } from "@/lib/library";

// 08 Admin media: every image and clip the posts hold, where each is used, and what's
// wrong with it (over size, no alt, not used)
export default async function MediaPage() {
  const [items, head] = await Promise.all([getMediaLibrary(), getRepoHead()]);
  return <MediaLibrary items={items} head={head} />;
}
