// Branded PDF record of a single Form Builder response — logo, every answer,
// the signature, and any uploaded photo. Client-side (jsPDF), mirrors the
// look of generateAdHocDocPdf so all NLA documents read as one family.

import jsPDF from "jspdf";
import { format } from "date-fns";
import nlaLogo from "@/assets/nla-logo.png";
import { type FormFieldDef, ageFromDob } from "@/lib/formKit";

const BRAND_DARK = [17, 24, 39] as const;
const BRAND_GRAY = [107, 114, 128] as const;
const LIGHT_BG = [249, 250, 251] as const;
const ACCENT = [191, 15, 62] as const; // NLA red
const BORDER = [229, 231, 235] as const;

async function loadLogoBase64(): Promise<string | undefined> {
  try {
    const res = await fetch(nlaLogo);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const fmtOf = (dataUrl: string) => (/image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG");

function answerText(f: FormFieldDef, v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (f.field_type === "rating") return `${v} / 5`;
  if (f.field_type === "dob") { const a = ageFromDob(String(v)); return `${v}${a !== null ? ` (age ${a})` : ""}`; }
  if (f.field_type === "currency") return `$${v}`;
  if (v === true) return "Yes";
  if (v === false) return "No";
  return String(v);
}

export async function downloadFormResponsePdf(opts: {
  formTitle: string;
  fields: FormFieldDef[];
  data: Record<string, unknown>;
  submittedAt: string;
}) {
  const { formTitle, fields, data, submittedAt } = opts;
  const logo = await loadLogoBase64();

  // Preload images to base64 (signatures are already data URLs; uploaded
  // photos are public URLs that need fetching).
  const imgCache: Record<string, string | null> = {};
  for (const f of fields) {
    if (f.field_type !== "signature" && f.field_type !== "image") continue;
    const raw = data[f.field_key];
    if (typeof raw !== "string" || !raw) continue;
    if (raw.startsWith("data:")) imgCache[f.field_key] = raw;
    else if (raw.startsWith("http")) imgCache[f.field_key] = await urlToBase64(raw);
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 14, mR = 14;
  const contentW = pageW - mL - mR;

  // ── Header band ──
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, pageW, 40, "F");
  let logoRight = mL;
  if (logo) { try { doc.addImage(logo, "PNG", mL, 8, 22, 22); logoRight = mL + 26; } catch { /* ignore */ } }
  doc.setTextColor(...BRAND_DARK);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(formTitle || "Form Response", logoRight, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("No Limits Boxing Academy", logoRight, 24);

  doc.setFontSize(8);
  doc.setTextColor(...BRAND_GRAY);
  doc.text("Submitted", pageW - mR, 13, { align: "right" });
  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "bold");
  let submittedStr = submittedAt;
  try { submittedStr = format(new Date(submittedAt), "MMM d, yyyy · h:mm a"); } catch { /* keep raw */ }
  doc.text(submittedStr, pageW - mR, 18, { align: "right" });
  doc.setFont("helvetica", "normal");

  doc.setFillColor(...ACCENT);
  doc.rect(0, 40, pageW, 0.8, "F");

  // ── Answers ──
  let y = 50;
  const ensureSpace = (needed: number) => { if (y + needed > pageH - 14) { doc.addPage(); y = 20; } };

  for (const f of fields) {
    ensureSpace(12);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_GRAY);
    doc.text((f.label || "").toUpperCase(), mL, y);
    y += 4.5;

    const isImg = f.field_type === "signature" || f.field_type === "image";
    const img = imgCache[f.field_key];
    if (isImg && img) {
      const isSig = f.field_type === "signature";
      let pw = 0, ph = 0;
      try { const p = doc.getImageProperties(img); pw = p.width; ph = p.height; } catch { /* ignore */ }
      const maxW = isSig ? 70 : 45;
      const maxH = isSig ? 28 : 55;
      let w = maxW, h = pw ? (maxW * ph) / pw : (isSig ? 26 : 45);
      if (h > maxH) { h = maxH; w = ph ? (maxH * pw) / ph : maxW; }
      ensureSpace(h + 4);
      try { doc.addImage(img, fmtOf(img), mL, y, w, h); } catch { /* ignore */ }
      y += h + 6;
    } else {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND_DARK);
      const lines = doc.splitTextToSize(answerText(f, data[f.field_key]), contentW);
      ensureSpace(lines.length * 5 + 2);
      doc.text(lines, mL, y);
      y += lines.length * 5 + 4;
    }

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(mL, y - 2, pageW - mR, y - 2);
    y += 2;
  }

  // ── Footer ──
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text("No Limits Boxing Academy  •  www.nolimitsboxingacademy.org", pageW / 2, pageH - 8, { align: "center" });

  const slug = (formTitle || "form").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "form";
  doc.save(`${slug}-response.pdf`);
}
