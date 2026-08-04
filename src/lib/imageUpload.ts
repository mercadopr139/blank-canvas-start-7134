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
export async function normalizeImageForUpload(file: File): Promise<File> {
  const isHeic =
    /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  if (!isHeic) return file;

  try {
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const blob = (Array.isArray(out) ? out[0] : out) as Blob;
    const baseName = (file.name || "photo").replace(/\.hei[cf]$/i, "");
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    throw new Error(
      "This looks like an iPhone (HEIC) photo we couldn't convert. Please upload a JPG or PNG instead."
    );
  }
}
