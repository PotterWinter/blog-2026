import type { Prepped } from "@/lib/media";

// An image picked in the editor and made a WebP, waiting for Save (5.4): the post points
// at it as "upload:<key>"; url shows it in the meantime. (lib/media.ts is server-only,
// so the marker is repeated here.)
export const UPLOAD = "upload:";
export type Waiting = Prepped & { url: string };
