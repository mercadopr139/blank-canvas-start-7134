import jsPDF from "jspdf";
import type { HawkPeriodStats, HawkBreakdown } from "@/lib/hawkSquad";
import type { ProgramConfig } from "@/lib/programs";

// The printed report, in the program's own colours.
//
// Letterhead: a deep green band with the wordmark and tagline, a gold rule
// under it. For a letter, the school's address and the date follow, as on the
// mid-year report Josh sends Cape May Tech. Then the body as the writer
// returned it (a letter already carries its salutation and sign-off), and a
// "By the numbers" panel with the period's figures and who the students are.

export interface ProgramReportPdfOptions {
  program: ProgramConfig;
  format: "letter" | "narrative";
  period: string;
  stats: HawkPeriodStats;
  breakdown: HawkBreakdown;
  /** Data-URL of the hawk logo, when one is bundled. */
  logoDataUrl?: string | null;
}

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function generateProgramReportPdf(narrative: string, opts: ProgramReportPdfOptions) {
  const B = opts.program.brand;
  const L = opts.program.letter;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxWidth = W - margin * 2;
  const green = hex(B.primary), gold = hex(B.accent);

  // ── Letterhead ──
  const bandH = 96;
  doc.setFillColor(...green); doc.rect(0, 0, W, bandH, "F");
  doc.setFillColor(...gold); doc.rect(0, bandH, W, 6, "F");
  let x = margin;
  if (opts.logoDataUrl) {
    try { doc.addImage(opts.logoDataUrl, "PNG", margin, 14, 68, 68); x = margin + 82; } catch { /* no logo, wordmark only */ }
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...gold);
  doc.text(B.wordmark, x, 48);
  doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal");
  doc.text(B.sub, x + 1, 62);
  doc.setFont("helvetica", "bolditalic"); doc.setFontSize(11);
  doc.text(B.tagline, x, 82);
  // Report title at the right.
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text(opts.format === "letter" ? `${opts.program.name} Report` : `${opts.program.name} Grant Narrative`, W - margin, 40, { align: "right" });
  doc.setFontSize(10); doc.setTextColor(...gold);
  doc.text(opts.period, W - margin, 56, { align: "right" });

  let y = bandH + 40;
  doc.setTextColor(0);

  // ── Letter header: the school's address and today's date ──
  if (opts.format === "letter") {
    doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    L.addressLines.forEach((l) => { doc.text(l, margin, y); y += 15; });
    y += 4;
    doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), margin, y);
    y += 26;
  }

  // ── Body ──
  const newPage = () => { doc.addPage(); y = 64; };
  doc.setFont("helvetica", "normal"); doc.setFontSize(11.5);
  const paragraphs = (narrative || "").split(/\n{2,}/);
  for (const para of paragraphs) {
    // Short lines (salutation, "Sincerely," and the signature) keep their line breaks.
    const lines = para.split("\n").flatMap((l) => doc.splitTextToSize(l.trim(), maxWidth) as string[]);
    for (const line of lines) {
      if (y > H - margin - 20) newPage();
      doc.text(line, margin, y);
      y += 16;
    }
    y += 8;
  }

  // ── By the numbers ──
  const s = opts.stats;
  const tiles: [string, string][] = [
    ["Sessions held", `${s.sessionsHeld}${s.sessionsPlanned ? ` of ${s.sessionsPlanned} planned` : ""}`],
    ["Check-ins", String(s.checkIns)],
    ["Students reached", String(s.students)],
    ["Average per session", String(s.avgPerSession)],
    ["Rode the bus", `${s.bus} check-ins`],
    ["Dismissed from NLA", `${s.dismissed} check-ins`],
  ];
  const breakdownLines: string[] = [];
  for (const [label, counts] of Object.entries(opts.breakdown)) {
    const parts = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} (${n})`);
    if (parts.length) breakdownLines.push(`${label}: ${parts.join(", ")}`);
  }
  const wrapped = breakdownLines.flatMap((l) => doc.splitTextToSize(l, maxWidth - 32) as string[]);
  const panelH = 34 + Math.ceil(tiles.length / 3) * 38 + (wrapped.length ? 14 + wrapped.length * 13 : 0) + 16;
  if (y + panelH > H - margin) newPage();

  doc.setFillColor(...green); doc.roundedRect(margin, y, maxWidth, panelH, 8, 8, "F");
  doc.setFillColor(...gold); doc.rect(margin, y + 30, maxWidth, 2, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...gold);
  doc.text(`BY THE NUMBERS · ${opts.period.toUpperCase()}`, margin + 16, y + 20);
  const colW = (maxWidth - 32) / 3;
  tiles.forEach(([label, value], i) => {
    const cx = margin + 16 + (i % 3) * colW;
    const cy = y + 54 + Math.floor(i / 3) * 38;
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
    doc.text(value, cx, cy);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...gold);
    doc.text(label.toUpperCase(), cx, cy + 12);
  });
  if (wrapped.length) {
    let by = y + 54 + Math.ceil(tiles.length / 3) * 38 + 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
    for (const l of wrapped) { doc.text(l, margin + 16, by); by += 13; }
  }
  y += panelH + 20;

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...green); doc.rect(0, H - 28, W, 28, "F");
    doc.setFillColor(...gold); doc.rect(0, H - 30, W, 2, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
    doc.text(`${opts.program.name} at No Limits Academy · ${B.tagline}`, margin, H - 11);
    doc.text(`${p} / ${pages}`, W - margin, H - 11, { align: "right" });
  }

  const kind = opts.format === "letter" ? "Report" : "GrantNarrative";
  doc.save(`${opts.program.name.replace(/[^\w]+/g, "")}_${kind}_${opts.period ? opts.period.replace(/[^\w]+/g, "-") : "report"}.pdf`);
}
