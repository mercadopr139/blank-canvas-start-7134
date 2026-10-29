// Grant Coach — the files an application asks for (Josh, 2026-10-29).
//
// An "Upload" row read off a portal screen gets an Attach button. The file
// comes from one of three places — the Vault's standing documents (990,
// determination letter, operating budget…), a file already in this folder,
// or a new upload — and the row points at a grant_documents row in THIS
// folder (side "ours"). A Vault file is copied into the folder when it is
// attached, so replacing the Vault's 990 next year never changes what an
// old folder says it submitted. Print then merges every attached PDF after
// the answers, in portal order.
import { PDFDocument } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import { GRANT_DOCUMENTS_BUCKET, ORG_DOCUMENTS } from "@/lib/grantCoach/orgDocuments";
import { officeText, readsAsText } from "@/lib/grantCoach/readOffice";
import { pdfText, pdfHasText } from "@/lib/grantCoach/readPdf";

export interface FolderDoc {
  id: string; folder_id: string; side: "funder" | "ours"; title: string; storage_path: string | null; file_name: string | null;
  mime_type?: string | null; size_bytes: number | null; link_url: string | null; uploaded_at: string;
  /** What the file says, read once when attached (2026-10-29). */
  read_text?: string | null; read_at?: string | null;
}
export interface VaultDoc {
  key: string; storage_path: string | null; file_name: string | null; mime_type: string | null; size_bytes: number | null; link_url: string | null;
}

const safeName = (s: string) => s.replace(/[^\w.-]+/g, "_").slice(0, 80);
export const folderDocPath = (folderId: string, fileName: string) => `grants/${folderId}/${Date.now()}_${safeName(fileName)}`;

/** The row's answer line, so the hardcopy and the "whole application" view read it as a fact. */
export const attachedAnswer = (d: Pick<FolderDoc, "title" | "file_name" | "link_url">) =>
  d.link_url ? `Attached: ${d.title} (${d.link_url})` : `Attached: ${d.file_name ?? d.title}`;

export const isPdf = (d: Pick<FolderDoc, "file_name" | "mime_type">) =>
  d.mime_type === "application/pdf" || /\.pdf$/i.test(d.file_name ?? "");

/** A new file into this folder's documents (ours). */
export async function uploadToFolder(folderId: string, file: File, userId: string | null, title?: string): Promise<FolderDoc> {
  const path = folderDocPath(folderId, file.name);
  const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  const { data, error: e2 } = await supabase.from("grant_documents" as never).insert({
    folder_id: folderId, side: "ours", title: title ?? file.name.replace(/\.[^.]+$/, ""), storage_path: path, file_name: file.name,
    mime_type: file.type || null, size_bytes: file.size, uploaded_by: userId,
  } as never).select("*").single();
  if (e2) throw e2;
  return data as unknown as FolderDoc;
}

/** A Vault document, copied into this folder so the folder keeps the version it submitted. */
export async function copyVaultDocToFolder(folderId: string, doc: VaultDoc, userId: string | null): Promise<FolderDoc> {
  const title = ORG_DOCUMENTS.find((d) => d.key === doc.key)?.title ?? doc.key;
  let storage_path: string | null = null;
  if (doc.storage_path) {
    storage_path = folderDocPath(folderId, doc.file_name ?? doc.storage_path.split("/").pop() ?? doc.key);
    const { error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).copy(doc.storage_path, storage_path);
    if (error) throw error;
  } else if (!doc.link_url) {
    throw new Error("That Vault document has no file yet.");
  }
  const { data, error } = await supabase.from("grant_documents" as never).insert({
    folder_id: folderId, side: "ours", title, storage_path, file_name: doc.file_name, mime_type: doc.mime_type,
    size_bytes: doc.size_bytes, link_url: doc.link_url, uploaded_by: userId,
  } as never).select("*").single();
  if (error) throw error;
  return data as unknown as FolderDoc;
}

/** Open a folder document in a new tab (a signed link for a file; the address for a link). */
export async function openFolderDoc(d: Pick<FolderDoc, "storage_path" | "link_url">): Promise<boolean> {
  if (d.link_url) { window.open(d.link_url, "_blank", "noopener"); return true; }
  if (!d.storage_path) return false;
  const { data, error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).createSignedUrl(d.storage_path, 3600);
  if (error || !data?.signedUrl) return false;
  window.open(data.signedUrl, "_blank", "noopener");
  return true;
}

export interface MergeInput {
  /** The row's label on the attachments page. */
  label: string;
  doc: FolderDoc | null;
}
export interface MergeNote { label: string; fileName: string | null; how: "merged" | "not a PDF" | "link" | "missing" | "could not read" }

/**
 * The answers (a jsPDF byte string) with every attached PDF after it, in
 * order. Files that are not PDFs are left in the folder and noted; the
 * caller prints those notes on the attachments page before merging.
 */
export async function planMerge(inputs: MergeInput[]): Promise<{ notes: MergeNote[]; pdfs: { label: string; bytes: ArrayBuffer }[] }> {
  const notes: MergeNote[] = [];
  const pdfs: { label: string; bytes: ArrayBuffer }[] = [];
  for (const { label, doc } of inputs) {
    if (!doc) { notes.push({ label, fileName: null, how: "missing" }); continue; }
    if (doc.link_url && !doc.storage_path) { notes.push({ label, fileName: doc.link_url, how: "link" }); continue; }
    if (!doc.storage_path) { notes.push({ label, fileName: doc.file_name, how: "missing" }); continue; }
    if (!isPdf(doc)) { notes.push({ label, fileName: doc.file_name, how: "not a PDF" }); continue; }
    const { data, error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).download(doc.storage_path);
    if (error || !data) { notes.push({ label, fileName: doc.file_name, how: "could not read" }); continue; }
    try {
      const bytes = await data.arrayBuffer();
      await PDFDocument.load(bytes, { ignoreEncryption: true }); // readable?
      pdfs.push({ label, bytes });
      notes.push({ label, fileName: doc.file_name, how: "merged" });
    } catch {
      notes.push({ label, fileName: doc.file_name, how: "could not read" });
    }
  }
  return { notes, pdfs };
}

/** One PDF: the answers first, then each attachment's pages. */
export async function mergePdfs(answers: ArrayBuffer, pdfs: { bytes: ArrayBuffer }[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const src of [answers, ...pdfs.map((p) => p.bytes)]) {
    const doc = await PDFDocument.load(src, { ignoreEncryption: true });
    const pages = await out.copyPages(doc, doc.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return out.save();
}

/* ── Reading an attachment, and handing the attachments to the writer ── */

const wordsOf = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/**
 * Read a folder document once and keep its text: Word/Excel/PowerPoint/text
 * and any PDF that carries text in the browser (a 48-page Form 990 in under a
 * second — Josh, 2026-10-29); a scanned PDF or an image through the writer's
 * eyes (a faithful transcription); a link not at all. Returns the text;
 * throws when nothing could be read.
 */
export async function readAttachment(doc: FolderDoc): Promise<string> {
  if (!doc.storage_path) throw new Error(doc.link_url ? "A link can't be read; attach the file itself." : "No file to read.");
  const name = doc.file_name ?? doc.storage_path;
  let text: string;
  if (readsAsText(name)) {
    const { data, error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).download(doc.storage_path);
    if (error || !data) throw new Error(error?.message ?? "Couldn't open the file.");
    text = await officeText(name, data);
  } else if (/\.(pdf|png|jpe?g|webp)$/i.test(name)) {
    let local = "";
    if (/\.pdf$/i.test(name)) {
      const { data, error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).download(doc.storage_path);
      if (error || !data) throw new Error(error?.message ?? "Couldn't open the file.");
      try { local = await pdfText(data); } catch { local = ""; }
    }
    if (pdfHasText(local)) { text = local; }
    else {
    const { data, error } = await supabase.functions.invoke("grant-writer", { body: { mode: "read_document", docs: [{ title: doc.title, path: doc.storage_path }], folder: { name: "", funder: "" }, library: [], facts: [], answered: [] } });
    if (error) {
      let reason = error.message;
      try { const res = (error as { context?: Response }).context; const said = res ? await res.clone().json() : null; if (said?.error) reason = said.error; } catch { /* generic */ }
      throw new Error(reason);
    }
    if (data?.error) throw new Error(data.error);
    text = String(data?.text ?? "");
    }
  } else {
    throw new Error("That file type can't be read. Attach a PDF, Word or Excel file.");
  }
  text = text.trim();
  if (!text) throw new Error("The file came back empty.");
  const { error } = await supabase.from("grant_documents" as never).update({ read_text: text.slice(0, 200_000), read_at: new Date().toISOString() } as never).eq("id", doc.id);
  if (error) throw new Error(error.message);
  invalidateWriterAttachments();
  return text;
}

export const readLabel = (doc: Pick<FolderDoc, "read_text" | "read_at">) =>
  doc.read_text?.trim() ? `Read · ${wordsOf(doc.read_text).toLocaleString()} words` : "Not read yet";

/** What the writer is handed: each attached file, by the row it answers, as written. */
export interface WriterAttachment { label: string; title: string; text: string }

let writerFolder: string | null = null;
let cachedFor: string | null = null;
let cached: Promise<WriterAttachment[]> | null = null;
/** The folder every Grant Coach call on this page is about (the folder page sets it). */
export const setWriterFolder = (folderId: string | null) => { if (writerFolder !== folderId) { writerFolder = folderId; cached = null; cachedFor = null; } };
export const invalidateWriterAttachments = () => { cached = null; cachedFor = null; };
export function attachmentsForWriter(): Promise<WriterAttachment[]> {
  const id = writerFolder;
  if (!id) return Promise.resolve([]);
  if (cached && cachedFor === id) return cached;
  cachedFor = id;
  cached = (async () => {
    const { data: rows } = await supabase.from("grant_checklist_items" as never).select("label, attachment_id, sort_order").eq("folder_id", id).not("attachment_id", "is", null).neq("status", "na").order("sort_order") as unknown as { data: { label: string; attachment_id: string }[] | null };
    const ids = (rows ?? []).map((r) => r.attachment_id);
    if (!ids.length) return [];
    const { data: docs } = await supabase.from("grant_documents" as never).select("id, title, read_text").in("id", ids) as unknown as { data: { id: string; title: string; read_text: string | null }[] | null };
    const byId = new Map((docs ?? []).map((d) => [d.id, d]));
    return (rows ?? []).flatMap((r) => {
      const d = byId.get(r.attachment_id);
      return d?.read_text?.trim() ? [{ label: r.label, title: d.title, text: d.read_text.slice(0, 60_000) }] : [];
    });
  })().catch(() => []);
  return cached;
}
