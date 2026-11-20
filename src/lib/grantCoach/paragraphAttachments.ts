// Screenshots and PDFs pasted into Talk to Grant Coach (Josh, 2026-11-20: "I
// think it would be great if I could copy and paste screenshots while speaking
// to AI"). A file goes into the private grant-documents bucket under
// paragraphs/<year>/<section>/ (the bucket's admin-only rules already cover
// it), and the message keeps its path in the payload. Grant Coach reads the
// image in the same turn and on every later turn of the thread.
import { supabase } from "@/integrations/supabase/client";
import { GRANT_DOCUMENTS_BUCKET } from "@/lib/grantCoach/orgDocuments";

export interface ParagraphAttachment { path: string; name: string; type: string; size: number }

export const MAX_ATTACHMENTS = 4;
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const IMAGE_LIMIT = 5 * 1024 * 1024;
const PDF_LIMIT = 10 * 1024 * 1024;

export const isImage = (a: Pick<ParagraphAttachment, "type">) => a.type.startsWith("image/");
const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;

/** Why a file can't be sent, or null when it can: PNG, JPG and WebP up to 5 MB; a PDF up to 10 MB. */
export function attachmentProblem(file: File): string | null {
  if (file.type === "application/pdf") return file.size > PDF_LIMIT ? `${file.name} is over ${mb(PDF_LIMIT)}.` : null;
  if (!IMAGE_TYPES[file.type]) return `${file.name || "That file"} isn't a PNG, JPG, WebP or PDF.`;
  return file.size > IMAGE_LIMIT ? `${file.name} is over ${mb(IMAGE_LIMIT)}.` : null;
}

/** The files on a paste or a drop (a screenshot pasted from the clipboard arrives as "image.png"). */
export function filesFrom(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const out: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind !== "file") continue;
    const f = item.getAsFile();
    if (f) out.push(f);
  }
  if (!out.length) out.push(...Array.from(dt.files ?? []));
  return out;
}

const safe = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 60);

/** Into the bucket; a pasted screenshot is named by the moment it was pasted. */
export async function uploadParagraphAttachment(year: string, key: string, file: File): Promise<ParagraphAttachment> {
  const ext = file.type === "application/pdf" ? "pdf" : IMAGE_TYPES[file.type] ?? "png";
  const generic = !file.name || /^image\.(png|jpe?g|webp)$/i.test(file.name) || /^blob$/i.test(file.name);
  const name = generic ? `Screenshot ${new Date().toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.${ext}` : file.name;
  const path = `paragraphs/${safe(year)}/${safe(key)}/${Date.now()}_${safe(name)}`;
  const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(`Couldn't upload ${name}: ${error.message}`);
  return { path, name, type: file.type, size: file.size };
}

/** Files that went up for a message that then failed, so a retry doesn't leave copies behind. */
export async function removeParagraphAttachments(paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).remove(paths);
}

/** Signed links (an hour) for showing the thread's files: the bucket is private. */
export async function attachmentUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}
