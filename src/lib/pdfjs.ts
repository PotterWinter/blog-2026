// pdf.js, loaded only when a PDF is opened in the browser: the editor reading a picked
// file (pdfPage), a reader stepping past a PDF's first page (PdfViewer). Its legacy
// build (older Safari too), its worker run on the page (globalThis.pdfjsWorker) rather
// than as a file of its own the bundler would have to serve.
export async function loadPdfjs() {
  const g = globalThis as { pdfjsWorker?: unknown };
  if (!g.pdfjsWorker) g.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  return import("pdfjs-dist/legacy/build/pdf.mjs");
}
