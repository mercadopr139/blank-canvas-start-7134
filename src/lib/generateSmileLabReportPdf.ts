import jsPDF from "jspdf";

// Simple narrative PDF for the Smile Lab grant report.
export function generateSmileLabReportPdf(narrative: string, periodLabel: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Smile Lab", pageWidth / 2, y, { align: "center" });
  y += 22;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  doc.text("Healthy Smiles. Healthy Habits. Happy Kids.", pageWidth / 2, y, { align: "center" });
  y += 24;
  doc.setTextColor(0);
  doc.setFontSize(11);
  if (periodLabel) { doc.text(periodLabel, pageWidth / 2, y, { align: "center" }); y += 26; }

  doc.setFontSize(11.5);
  const paragraphs = (narrative || "").split(/\n{2,}/);
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para.trim(), maxWidth) as string[];
    for (const line of lines) {
      if (y > pageHeight - margin) { doc.addPage(); y = 64; }
      doc.text(line, margin, y);
      y += 16;
    }
    y += 8;
  }

  const generated = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  if (y > pageHeight - margin) { doc.addPage(); y = 64; }
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(`No Limits Boxing Academy — generated ${generated}`, margin, pageHeight - 40);

  doc.save(`SmileLab_GrantReport_${periodLabel ? periodLabel.replace(/[^\w]+/g, "-") : "report"}.pdf`);
}
