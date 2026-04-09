import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import nlaLogo from "@/assets/nla-logo.png";

interface AttendanceRecord {
  child_first_name: string;
  child_last_name: string;
  child_date_of_birth: string;
  check_in_date: string;
  check_in_at: string;
  is_manual: boolean;
}

const calculateAge = (dob: string): number => {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

export function generateLilChampsAttendancePdf(
  records: AttendanceRecord[],
  dateFilter: string
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  // Determine date range text
  const dates = records.map((r) => r.check_in_date).sort();
  const uniqueDates = [...new Set(dates)];
  let dateRangeText: string;
  if (dateFilter) {
    dateRangeText = format(new Date(dateFilter + "T12:00:00"), "MMMM d, yyyy");
  } else if (uniqueDates.length === 1) {
    dateRangeText = format(new Date(uniqueDates[0] + "T12:00:00"), "MMMM d, yyyy");
  } else if (uniqueDates.length > 1) {
    dateRangeText = `${format(new Date(uniqueDates[0] + "T12:00:00"), "MMM d, yyyy")} — ${format(new Date(uniqueDates[uniqueDates.length - 1] + "T12:00:00"), "MMM d, yyyy")}`;
  } else {
    dateRangeText = "No records";
  }

  const generatedDate = format(new Date(), "MMMM d, yyyy");

  // --- Header ---
  let y = margin;

  // Logo
  try {
    const logoW = 60;
    const logoH = 60;
    doc.addImage(nlaLogo, "PNG", (pageWidth - logoW) / 2, y, logoW, logoH);
    y += logoH + 12;
  } catch {
    y += 12;
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Lil Champs Corner — Attendance Report", pageWidth / 2, y, { align: "center" });
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(dateRangeText, pageWidth / 2, y, { align: "center" });
  y += 14;
  doc.text(`Report generated on ${generatedDate}`, pageWidth / 2, y, { align: "center" });
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.text(`Total Check-Ins: ${records.length}`, pageWidth / 2, y, { align: "center" });
  y += 20;

  // Divider
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // --- Table ---
  const tableData = records.map((r, i) => [
    String(i + 1),
    `${r.child_last_name}, ${r.child_first_name}`,
    String(calculateAge(r.child_date_of_birth)),
    r.check_in_date,
    format(new Date(r.check_in_at), "h:mm a"),
    r.is_manual ? "Manual" : "Lil Champs Corner",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Name", "Age", "Date", "Check-In Time", "Source"]],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 35, halign: "center" },
      3: { cellWidth: 70 },
      4: { cellWidth: 75 },
      5: { cellWidth: 95 },
    },
    didDrawPage: () => {
      // Footer on every page
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120);
      doc.text("No Limits Academy — Confidential", margin, pageHeight - 25);
      const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 25, { align: "right" });
      doc.setTextColor(0);
    },
  });

  // --- Summary Section ---
  const finalY = (doc as any).lastAutoTable?.finalY || y + 40;
  let sy = finalY + 30;

  // Check if we need a new page for summary
  if (sy + 80 > pageHeight - 50) {
    doc.addPage();
    sy = margin + 20;
  }

  const uniqueYouth = new Set(records.map((r) => `${r.child_first_name}|${r.child_last_name}`));
  const ages = records.map((r) => calculateAge(r.child_date_of_birth));
  const avgAge = ages.length > 0 ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "N/A";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Summary", margin, sy);
  sy += 16;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, sy, pageWidth - margin, sy);
  sy += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summaryLines = [
    `Total Unique Youth: ${uniqueYouth.size}`,
    `Total Check-Ins: ${records.length}`,
    `Average Age: ${avgAge}`,
    `Date Range: ${dateRangeText}`,
  ];
  summaryLines.forEach((line) => {
    doc.text(line, margin, sy);
    sy += 14;
  });

  // Save
  const fileName = `LilChampsCorner_Attendance_${dateFilter || format(new Date(), "yyyy-MM-dd")}.pdf`;
  doc.save(fileName);
}
