// The text of a Word file, read in the browser, so a funder's application
// sent as .docx can be read like a pasted one. A .docx is a zip; the body is
// word/document.xml, one <w:p> per paragraph.
import JSZip from "jszip";

export const docxXmlToText = (xml: string): string =>
  xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export async function readDocxText(file: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("That Word file has no body to read.");
  return docxXmlToText(await doc.async("string"));
}
