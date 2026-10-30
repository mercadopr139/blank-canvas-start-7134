// A PDF's text, read in the browser with pdf.js — no AI, no upload, under a
// second. Tax software, accountants and Word all produce real text PDFs, so a
// 48-page Form 990 comes back whole (Josh, 2026-10-29: "why is Grant Coach
// having a hard time reading the 990" — it was being asked to transcribe all
// 48 pages word for word, which no reply can hold). Only a scanned, picture-
// only PDF comes back empty; the caller falls back to Grant Coach's eyes then.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Lines of text in reading order, pages marked; "" when the PDF carries no text (a scan). */
export async function pdfText(file: Blob): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      // Items are positioned glyph runs; group them into lines by y, left to right.
      const rows = new Map<number, { x: number; s: string }[]>();
      for (const it of tc.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        const y = Math.round(it.transform[5]);
        const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key)!.push({ x: it.transform[4], s: it.str });
      }
      const ordered = [...rows.entries()].sort((a, b) => b[0] - a[0]);
      if (!ordered.length) continue;
      lines.push(`--- page ${p} ---`);
      for (const [, parts] of ordered) lines.push(parts.sort((a, b) => a.x - b.x).map((q) => q.s).join(" ").replace(/\s+/g, " ").trim());
    }
  } finally {
    await pdf.destroy();
  }
  return lines.join("\n").trim();
}

/** Enough words to trust the extraction over a scan: a page of real text is hundreds. */
export const pdfHasText = (text: string) => text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length >= 40;
