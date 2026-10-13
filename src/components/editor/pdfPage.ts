import { loadPdfjs } from "@/lib/pdfjs";

// A PDF's first page and page count, read in the browser (owner, 12 Oct 69): the page
// becomes its poster — the card's picture on the post, a WebP in git beside the images —
// so it waits for Save as an image does, as a clip's first frame does (clipFrame).
const WIDTH = 1200; // px: the poster's width — sharp on the card, shrunk to WebP after

export async function firstPage(file: File): Promise<{ poster: File; pages: number; width: number; height: number }> {
  const { getDocument } = await loadPdfjs();
  const doc = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: WIDTH / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff"; // a page with no background of its own is white, not clear
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
    if (!blob) throw new Error("Can't draw its first page");
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return {
      poster: new File([blob], name, { type: "image/webp" }),
      pages: doc.numPages,
      width: Math.round(base.width),
      height: Math.round(base.height),
    };
  } finally {
    void doc.destroy();
  }
}
