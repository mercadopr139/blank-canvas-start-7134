// The program narrative as a Word file, ready for the funder's upload slot.
// Seven numbered sections in the funder's order, 11-point type, one-inch
// margins, NLA's name in the header. Three pages is the funder's limit; the
// word count on screen keeps the draft inside it before this is built.
import { AlignmentType, Document, Footer, Header, Packer, PageNumber, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

export interface NarrativeSection { n: number; heading: string; text: string }

export interface NarrativeMeta {
  org: string;
  grant: string;
  program: string | null;
}

const FONT = "Calibri";
const INCH = 1440;

const body = (text: string) =>
  text.split(/\n{2,}/).map((para) => new Paragraph({
    spacing: { after: 120, line: 264 },
    children: [new TextRun({ text: para.replace(/\s*\n\s*/g, " ").trim(), font: FONT, size: 22 })],
  }));

export const buildNarrativeDocument = (sections: NarrativeSection[], meta: NarrativeMeta) =>
  new Document({
    creator: meta.org,
    title: `${meta.org} — Program Narrative — ${meta.grant}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: INCH, right: INCH, bottom: INCH, left: INCH } } },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${meta.org} · Program Narrative · ${meta.grant}`, font: FONT, size: 18, color: "666666" })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: "666666" })] })] }),
      },
      children: [
        new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `${meta.org}${meta.program ? ` — ${meta.program}` : ""}`, font: FONT, size: 28, bold: true })] }),
        new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: `Program Narrative · ${meta.grant}`, font: FONT, size: 22, color: "444444" })] }),
        ...sections.flatMap((s) => [
          new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: `${s.n}. ${s.heading}`, font: FONT, size: 23, bold: true })] }),
          ...body(s.text),
        ]),
      ],
    }],
  });

/** Build the file and hand it to the browser to save. */
export async function downloadNarrativeDocx(sections: NarrativeSection[], meta: NarrativeMeta, fileName: string) {
  const blob = await Packer.toBlob(buildNarrativeDocument(sections, meta));
  saveAs(blob, fileName);
}

/** The headings the funder uses, by item number, so the file reads in their words. */
export const headingFromLabel = (label: string) => label.replace(/^\d\.\s*/, "").trim();
