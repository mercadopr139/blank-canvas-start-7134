// Shrink a photo in the browser before it is stored.
//
// A phone photo is 4–6 MB and 4000 pixels across; a board thumbnail is 40
// pixels. Storing the original meant the Juniors board downloaded 80 MB to
// show 17 thumbnails. Every upload now becomes a JPEG at a sensible size,
// plus a small thumbnail for lists.

export interface ResizedPhoto {
  /** Up to `fullPx` on the long side — the pop-up. */
  full: Blob;
  /** Up to `thumbPx` on the long side — the list. */
  thumb: Blob;
}

const draw = async (bitmap: ImageBitmap, maxPx: number, quality: number): Promise<Blob> => {
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't draw the photo.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't encode the photo."))), "image/jpeg", quality));
};

/**
 * The thumbnail that sits beside a full photo stored by `storePair`-style
 * uploads: `…_full.jpg` → `…_thumb.jpg`. Older photos without the suffix
 * have no thumbnail, so the full picture is returned.
 */
export const thumbOf = (url: string) => (url.endsWith("_full.jpg") ? url.slice(0, -"_full.jpg".length) + "_thumb.jpg" : url);

/** Was this photo stored shrunk, with a thumbnail beside it? */
export const isShrunk = (url: string) => url.endsWith("_full.jpg");

/** Resize a photo (File or Blob) into a full-size JPEG and a thumbnail. Honours camera orientation. */
export const resizePhoto = async (source: Blob, { fullPx = 1600, thumbPx = 240, quality = 0.82 } = {}): Promise<ResizedPhoto> => {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const [full, thumb] = await Promise.all([draw(bitmap, fullPx, quality), draw(bitmap, thumbPx, 0.8)]);
    return { full, thumb };
  } finally {
    bitmap.close();
  }
};
