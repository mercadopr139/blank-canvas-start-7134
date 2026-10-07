// Storing an aftercare (Smile Lab / Life Lab) photo.
//
// A phone photo is 3–6 MB. After the HEIC conversion it is shrunk to a
// 1600 px JPEG for the viewer and a 320 px thumbnail for the lists, stored
// side by side as …_full.jpg and …_thumb.jpg in the smile-lab-photos bucket.
// The session keeps the full URL; thumbOf() in imageResize derives the other.
import { supabase } from "@/integrations/supabase/client";
import { normalizeImageForUpload } from "@/lib/imageUpload";
import { resizePhoto } from "@/lib/imageResize";

export type AftercareLab = "smile" | "life";

export async function uploadAftercarePhoto(source: Blob, lab: AftercareLab): Promise<string> {
  const normalized = source instanceof File ? await normalizeImageForUpload(source) : source;
  const { full, thumb } = await resizePhoto(normalized, { thumbPx: 320 });
  const base = `${lab}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const bucket = supabase.storage.from("smile-lab-photos");
  const put = async (path: string, blob: Blob) => {
    const { error } = await bucket.upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) throw error;
  };
  await Promise.all([put(`${base}_full.jpg`, full), put(`${base}_thumb.jpg`, thumb)]);
  return bucket.getPublicUrl(`${base}_full.jpg`).data.publicUrl;
}
