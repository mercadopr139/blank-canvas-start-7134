// The text of a funder's Excel workbook or PowerPoint deck, read in the
// browser (Josh, 2026-10-22: the O.C.E.A.N. budget template and the RFP
// session slides). Both are zips of XML, like a Word file, so the zip reader
// already in the app is enough — no spreadsheet library.
import JSZip from "jszip";
import { readDocxText } from "@/lib/grantCoach/readDocx";

const unescape = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#10;/g, "\n").replace(/&amp;/g, "&");

/** Shared strings: the text an Excel cell of type "s" points at by index. */
export const sharedStrings = (xml: string): string[] =>
  [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unescape([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")));

/** One worksheet as rows of tab-separated values, empty rows dropped. */
export const sheetToText = (xml: string, strings: string[]): string => {
  const rows: string[] = [];
  for (const r of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of r[1].matchAll(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1] ?? "", body = c[2] ?? "";
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const inline = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("");
      const formula = body.match(/<f>([\s\S]*?)<\/f>/)?.[1];
      let value = type === "s" && v != null ? strings[Number(v)] ?? "" : type === "inlineStr" ? unescape(inline) : v != null ? unescape(v) : "";
      if (!value && formula) value = `=${unescape(formula)}`;
      cells.push(value.trim());
    }
    while (cells.length && !cells[cells.length - 1]) cells.pop();
    if (cells.some(Boolean)) rows.push(cells.join("\t"));
  }
  return rows.join("\n");
};

/** Slide text: one line per paragraph. */
export const slideToText = (xml: string): string =>
  [...xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)]
    .map((p) => unescape([...p[1].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join("")).trim())
    .filter(Boolean).join("\n");

export async function readXlsxText(file: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const strings = sharedStrings((await zip.file("xl/sharedStrings.xml")?.async("string")) ?? "");
  const workbook = (await zip.file("xl/workbook.xml")?.async("string")) ?? "";
  const names = [...workbook.matchAll(/<sheet[^>]*name="([^"]+)"/g)].map((m) => unescape(m[1]));
  const sheets = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const out: string[] = [];
  for (const [k, n] of sheets.entries()) {
    const text = sheetToText(await zip.file(n)!.async("string"), strings);
    if (text) out.push(`=== Sheet: ${names[k] ?? `Sheet ${k + 1}`} ===\n${text}`);
  }
  if (!out.length) throw new Error("That workbook has no cells to read.");
  return out.join("\n\n");
}

export async function readPptxText(file: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const out: string[] = [];
  for (const [k, n] of slides.entries()) {
    const text = slideToText(await zip.file(n)!.async("string"));
    if (text) out.push(`--- Slide ${k + 1} ---\n${text}`);
  }
  if (!out.length) throw new Error("That deck has no text to read.");
  return out.join("\n\n");
}

/** Which files the browser reads as text (the rest — PDFs, images — go to the reader as they are). */
export const readsAsText = (name: string) => /\.(docx|xlsx|pptx|txt|csv|md)$/i.test(name);

export async function officeText(name: string, file: Blob): Promise<string> {
  if (/\.docx$/i.test(name)) return readDocxText(file);
  if (/\.xlsx$/i.test(name)) return readXlsxText(file);
  if (/\.pptx$/i.test(name)) return readPptxText(file);
  return (await file.text()).trim();
}
