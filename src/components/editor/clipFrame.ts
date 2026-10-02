// A clip's first frame and size, read in the browser (5.4d): the frame becomes its
// poster — shown until the clip loads, and for good if Blob is shut (owner, 2 Oct 69) —
// a WebP named after the clip, so it waits for Save as any image does.
export async function firstFrame(file: File): Promise<{ poster: File; seconds: number; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Can't read this video"));
    });
    // A hair in: some files show black at 0
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = Math.min(0.05, video.duration / 2 || 0);
    });
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!blob) throw new Error("Can't take the first frame");
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return {
      poster: new File([blob], name, { type: "image/webp" }),
      seconds: Number.isFinite(video.duration) ? video.duration : 0,
      width: video.videoWidth,
      height: video.videoHeight,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
