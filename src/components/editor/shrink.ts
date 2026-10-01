// Before an image goes up (5.4): a photo straight off a phone can be 5–12 MB, past what
// a server action may carry (4 MB here, 4.5 MB on Vercel). Anything over 3.5 MB, or
// over 3000 px on a side, is redrawn at most 3000 px as a JPEG here in the browser —
// still well above the 2400 the server keeps, so nothing is lost to this step.
// (iPhone Safari already hands over HEIC photos as JPEG; createImageBitmap turns
// them upright from their EXIF note.)

const MAX_SIDE = 3000;
const MAX_BYTES = 3.5 * 1024 * 1024;

export async function shrinkForUpload(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // the server will say what's wrong with it
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.9, 0.82, 0.74]) {
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", quality));
    if (blob && (blob.size <= MAX_BYTES || quality === 0.74)) {
      return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" });
    }
  }
  return file;
}
