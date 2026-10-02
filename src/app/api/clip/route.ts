import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { CLIP_MAX, CLIP_TYPES } from "@/lib/clips";
import { currentSession } from "@/lib/session";

// Clips (5.4d) go from the browser straight to Vercel Blob — a 5 MB file through a
// function would hit Vercel's 4.5 MB request limit. This only hands a signed-in admin
// a one-off token for one MP4 / WebM up to 5 MB under clips/; the file never passes
// through here. (Blob's "upload completed" callback isn't used: the editor already has
// what it needs, and media.json is written with the post on Save.)
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!(await currentSession())) throw new Error("Signed out: sign in again to upload");
        if (!/^clips\/[a-z0-9-]+\.(mp4|webm)$/.test(pathname)) throw new Error("Not a clip name");
        return {
          allowedContentTypes: CLIP_TYPES,
          maximumSizeInBytes: CLIP_MAX,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload refused" },
      { status: 400 },
    );
  }
}
