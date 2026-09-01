// Normalizes a user-picked image before it's uploaded.
//
// iPhones save photos as HEIC, which browsers on Windows/Android (Chrome, Edge,
// Firefox) can't display — so an uploaded HEIC renders as a black/broken tile.
// We convert HEIC/HEIF to JPEG here so a photo straight from any phone "just
// works." Everything that's already a normal web image passes through untouched.
//
// The converter (heic2any, which bundles a libheif WASM) is imported ON DEMAND,
// so it only loads the first time someone actually uploads a HEIC — it never
// weighs down the main app bundle.
// Resize (longest side ≤ maxDim) + re-encode to WebP so a giant phone/camera
// photo (tens of MB) becomes a light, web-perfect file (~100–300 KB) before it
// ever uploads. Falls back to the original on any failure or if it wouldn't get
// smaller. Runs in the browser via canvas — no library needed.
export async function compressImageForUpload(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/webp", quality));
    if (!blob || blob.size >= file.size) return file; // only use it if it's actually smaller
    const name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}

export async function normalizeImageForUpload(file: File): Promise<File> {
  // 1) iPhone HEIC → JPEG (browsers can't display HEIC).
  let out = file;
  const isHeic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  if (isHeic) {
    try {
      const heic2any = (await import("heic2any")).default;
      const res = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      const blob = (Array.isArray(res) ? res[0] : res) as Blob;
      const baseName = (file.name || "photo").replace(/\.hei[cf]$/i, "");
      out = new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
    } catch {
      throw new Error(
        "This looks like an iPhone (HEIC) photo we couldn't convert. Please upload a JPG or PNG instead."
      );
    }
  }
  // 2) Resize + compress for the web.
  return compressImageForUpload(out);
}
