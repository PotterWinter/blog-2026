"use client";

// A single image, Fit (owner, 4 Oct 69): as large as fits the frame — the column's
// width, --img-max tall — touching one edge or the other, small ones grown to it too,
// never a bar of white beside it. CSS can't size by a ratio it doesn't know, so the
// image says its own (--r, on its figure, which sizes to it) once loaded; until then
// it's the column's width.
export default function FitImage({ src, alt }: { src: string; alt: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- sizes come from the file
    <img
      src={src}
      alt={alt}
      loading="lazy"
      ref={(img) => {
        if (img?.complete && img.naturalWidth) img.parentElement?.style.setProperty("--r", String(img.naturalWidth / img.naturalHeight));
      }}
      onLoad={(e) => {
        const img = e.currentTarget;
        img.parentElement?.style.setProperty("--r", String(img.naturalWidth / img.naturalHeight));
      }}
    />
  );
}
