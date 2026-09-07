import jsPDF from "jspdf";

// Daily Duties funder report.
//
// The program is free and the youth keep the facility clean in return. That is
// usually described in adjectives; this puts a number on it — jobs completed,
// youth serving, and what each one actually did — which is the form a funder
// can use.
//
// The figures are a byproduct of the nightly board rather than a survey: a
// youth can only be credited with a job if they checked in that night, so the
// totals here are tied to real attendance.

const NLA_RED: [number, number, number] = [191, 15, 62];

export interface DutyReportYouth {
  name: string;
  total: number;
  byCategory: Record<string, number>;
  byJob: Record<string, number>;
}

export interface DutyReportInput {
  periodLabel: string;
  from: string;
  to: string;
  totalJobs: number;
  totalYouth: number;
  byCategory: Record<string, number>;
  perYouth: DutyReportYouth[];
}

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

export function generateDutyReportPdf(input: DutyReportInput) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxWidth = pageW - margin * 2;
  let y = 0;

  const room = (needed: number) => {
    if (y + needed > pageH - 72) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Masthead ──
  doc.setFillColor(...NLA_RED);
  doc.rect(0, 0, pageW, 84, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  doc.text("No Limits Boxing Academy", margin, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Daily Duties — Youth Facility Service", margin, 60);
  y = 118;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(input.periodLabel, margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 110);
  doc.text(`${fmtDate(input.from)} – ${fmtDate(input.to)}`, margin, y);
  y += 26;

  // ── The headline numbers ──
  const boxW = (maxWidth - 16) / 2;
  doc.setFillColor(247, 247, 249);
  doc.roundedRect(margin, y, boxW, 66, 6, 6, "F");
  doc.roundedRect(margin + boxW + 16, y, boxW, 66, 6, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...NLA_RED);
  doc.text(String(input.totalJobs), margin + 16, y + 34);
  doc.text(String(input.totalYouth), margin + boxW + 32, y + 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text("jobs completed", margin + 16, y + 52);
  doc.text("youth serving", margin + boxW + 32, y + 52);
  y += 88;

  // Average is the line a funder tends to quote, so state it rather than
  // making them divide.
  if (input.totalYouth > 0) {
    doc.setFontSize(10.5);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `An average of ${(input.totalJobs / input.totalYouth).toFixed(1)} facility jobs per youth over this period.`,
      margin,
      y
    );
    y += 24;
  }

  // ── By category ──
  const cats = Object.entries(input.byCategory).sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    room(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NLA_RED);
    doc.text("WORK BY CATEGORY", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(35, 35, 35);
    for (const [cat, n] of cats) {
      room(16);
      doc.text(`${cat}`, margin, y);
      doc.text(`${n}`, margin + 200, y, { align: "right" });
      y += 16;
    }
    y += 12;
  }

  // ── Per youth ──
  if (input.perYouth.length) {
    room(46);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NLA_RED);
    doc.text("BY YOUTH", margin, y);
    y += 16;

    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 140);
    doc.text("YOUTH", margin, y);
    doc.text("JOBS", margin + 190, y, { align: "right" });
    doc.text("BREAKDOWN", margin + 210, y);
    y += 6;
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 14;

    for (const p of input.perYouth) {
      const breakdown = Object.entries(p.byCategory)
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => `${c} x${n}`)
        .join(", ");
      const lines = doc.splitTextToSize(breakdown || "—", maxWidth - 210) as string[];
      room(Math.max(16, lines.length * 13) + 6);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(25, 25, 25);
      doc.text(p.name, margin, y);
      doc.text(String(p.total), margin + 190, y, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(95, 95, 95);
      let ly = y;
      for (const line of lines) {
        doc.text(line, margin + 210, ly);
        ly += 13;
      }
      y = Math.max(y + 16, ly + 3);
    }
  }

  // ── Footer on every page ──
  const generated = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `No Limits Boxing Academy — Daily Duties — generated ${generated}`,
      margin,
      pageH - 40
    );
    doc.text(`${i} / ${pages}`, pageW - margin, pageH - 40, { align: "right" });
  }

  doc.save(`NLA_DailyDuties_${input.from}_to_${input.to}.pdf`);
}
