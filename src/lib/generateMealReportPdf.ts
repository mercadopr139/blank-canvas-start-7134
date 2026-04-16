import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import nlaLogo from "@/assets/nla-logo.png";

// ─── Colors (matching invoice style) ───
const BRAND_DARK = [17, 24, 39] as const;
const BRAND_GRAY = [107, 114, 128] as const;
const LIGHT_BG = [249, 250, 251] as const;
const ACCENT = [17, 24, 39] as const;
const TABLE_HEAD = [31, 41, 55] as const;
const BORDER = [229, 231, 235] as const;
const SUB_ROW_BG = [248, 249, 250] as const;

export interface MealItemDetail {
  food_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
}

interface ReportRow {
  event_id: string;
  event_date: string;
  donor_name: string | null;
  meal_count: number;
  notes: string | null;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  item_count: number;
  items?: MealItemDetail[];
}

export interface MealReportPdfData {
  reportData: ReportRow[];
  startDate: Date;
  endDate: Date;
  logoBase64?: string;
}

function formatNum(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function drawHR(doc: jsPDF, y: number, marginL: number, marginR: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(marginL, y, pageWidth - marginR, y);
}

function generateMealReportPdf(data: MealReportPdfData): jsPDF {
  const { reportData, startDate, endDate, logoBase64 } = data;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageWidth - marginL - marginR;

  const totalMeals = reportData.reduce((s, r) => s + r.meal_count, 0);
  const totalEvents = reportData.length;
  const avgMealsPerNight = totalEvents > 0 ? Math.round(totalMeals / totalEvents) : 0;
  const avgProtein = totalEvents > 0 ? reportData.reduce((s, r) => s + r.total_protein, 0) / totalEvents : 0;

  // ─── HEADER BAND ───
  doc.setFillColor(...LIGHT_BG);
  doc.rect(0, 0, pageWidth, 44, "F");

  let logoRightEdge = marginL;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", marginL, 6, 24, 24);
      logoRightEdge = marginL + 28;
    } catch (e) {
      console.error("Failed to add logo to PDF:", e);
    }
  }

  doc.setTextColor(...BRAND_DARK);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("MEAL SERVICE REPORT", logoRightEdge, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("No Limits Academy", logoRightEdge, 24);

  const metaX = pageWidth - marginR;
  const labelX = metaX - 62;
  doc.setFontSize(8);
  doc.setTextColor(...BRAND_GRAY);
  doc.text("Report Period", labelX, 12);
  doc.text("Generated", labelX, 18);
  doc.text("Total Meals", labelX, 24);

  doc.setTextColor(...BRAND_DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`${format(startDate, "MMM d, yyyy")} – ${format(endDate, "MMM d, yyyy")}`, metaX, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(format(new Date(), "MMM d, yyyy"), metaX, 18, { align: "right" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(String(totalMeals), metaX, 25, { align: "right" });

  // Accent stripe
  doc.setFillColor(...ACCENT);
  doc.rect(0, 44, pageWidth, 0.8, "F");

  // ─── SUMMARY STRIP ───
  let y = 50;
  const boxW = contentW / 4 - 2;
  const summaryItems = [
    { label: "Total Meals Served", value: String(totalMeals) },
    { label: "Reporting Period", value: `${format(startDate, "M/d")} – ${format(endDate, "M/d/yy")}` },
    { label: "Avg Meals Per Night", value: String(avgMealsPerNight) },
    { label: "Avg Protein/Meal", value: `${Math.round(avgProtein)}g` },
  ];

  summaryItems.forEach((item, i) => {
    const x = marginL + i * (boxW + 2.67);
    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, y, boxW, 18, 2, 2, "FD");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");

    if (i === 3) {
      if (avgProtein >= 20) doc.setTextColor(22, 163, 74);
      else if (avgProtein >= 10) doc.setTextColor(202, 138, 4);
      else doc.setTextColor(220, 38, 38);
    } else {
      doc.setTextColor(...BRAND_DARK);
    }
    doc.text(item.value, x + boxW / 2, y + 9, { align: "center" });

    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND_GRAY);
    doc.text(item.label, x + boxW / 2, y + 14, { align: "center" });
  });

  y += 22;

  // ─── MEAL EVENTS TABLE with food item sub-rows ───
  drawHR(doc, y, marginL, marginR);
  y += 1;

  const tableHead = [["Date", "Donor / Volunteer", "Meals", "Food Items", "Calories", "Protein", "Carbs", "Fat"]];

  // Build table body with interleaved sub-rows for food items
  const sortedData = [...reportData].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );

  const tableBody: any[][] = [];
  const subRowIndices = new Set<number>();

  sortedData.forEach((r) => {
    // Main event row
    tableBody.push([
      format(new Date(r.event_date + "T12:00:00"), "MMM d, yyyy"),
      r.donor_name || "—",
      String(r.meal_count),
      String(r.item_count),
      formatNum(r.total_calories),
      `${formatNum(r.total_protein)}g`,
      `${formatNum(r.total_carbs)}g`,
      `${formatNum(r.total_fat)}g`,
    ]);

    // Food item sub-rows
    if (r.items && r.items.length > 0) {
      r.items.forEach((item) => {
        const detail = `  • ${item.food_name} — ${item.calories ?? "—"} cal | ${item.protein_g ?? "—"}g protein | ${item.carbs_g ?? "—"}g carbs | ${item.fat_g ?? "—"}g fat`;
        subRowIndices.add(tableBody.length);
        tableBody.push([
          { content: detail, colSpan: 8, styles: { fontSize: 6.5, textColor: [...BRAND_GRAY], fillColor: [...SUB_ROW_BG], cellPadding: { top: 1, bottom: 1, left: 8, right: 2 }, fontStyle: "normal" } },
        ]);
      });
    }
  });

  if (tableBody.length === 0) {
    tableBody.push(["", "No meal events in this period", "", "", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: "striped",
    headStyles: {
      fillColor: [...TABLE_HEAD],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [...BRAND_DARK],
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    styles: { lineColor: [...BORDER], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 36 },
      2: { cellWidth: 16, halign: "center" as const },
      3: { cellWidth: 18, halign: "center" as const },
      4: { cellWidth: 20, halign: "right" as const },
      5: { cellWidth: 18, halign: "right" as const },
      6: { cellWidth: 18, halign: "right" as const },
      7: { cellWidth: 18, halign: "right" as const },
    },
    margin: { left: marginL, right: marginR },
    didParseCell: (hookData) => {
      // Force sub-row styling (the colSpan cell already has inline styles,
      // but we also suppress alternating stripe for sub-rows)
      if (hookData.section === "body" && subRowIndices.has(hookData.row.index)) {
        hookData.cell.styles.fillColor = [...SUB_ROW_BG];
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 30) {
      doc.addPage();
      y = 14;
    }
  };

  // ─── NUTRITIONAL INSIGHTS ───
  if (totalEvents > 0) {
    const lowProteinCount = reportData.filter((r) => r.total_protein < 10).length;

    // Compute averages per night for all macros
    const avgCalories = reportData.reduce((s, r) => s + r.total_calories, 0) / totalEvents;
    const avgCarbs = reportData.reduce((s, r) => s + r.total_carbs, 0) / totalEvents;
    const avgFat = reportData.reduce((s, r) => s + r.total_fat, 0) / totalEvents;

    // Fiber/sugar/sodium come from item details
    let totFiber = 0, totSugar = 0, totSodium = 0;
    let eventsWithDetail = 0;
    reportData.forEach((r) => {
      if (r.items && r.items.length > 0) {
        eventsWithDetail++;
        r.items.forEach((it) => {
          totFiber += Number(it.fiber_g || 0);
          totSugar += Number(it.sugar_g || 0);
          totSodium += Number(it.sodium_mg || 0);
        });
      }
    });
    const denom = eventsWithDetail || 1;
    const avgFiber = totFiber / denom;
    const avgSugar = totSugar / denom;
    const avgSodium = totSodium / denom;

    // Most frequently served foods
    const foodFreq = new Map<string, number>();
    reportData.forEach((r) => {
      if (r.items) {
        r.items.forEach((item) => {
          foodFreq.set(item.food_name, (foodFreq.get(item.food_name) || 0) + 1);
        });
      }
    });
    const topFoods = Array.from(foodFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Layout: header (7) + 6-card grid row (18) + sodium line (5) + top foods (variable) + warning (variable)
    const topFoodsLines = topFoods.length > 0 ? 2 + topFoods.length : 0;
    const warningLines = lowProteinCount > 0 && totalEvents >= 3 ? 2 : 0;
    const boxH = 14 + 18 + 6 + topFoodsLines * 3.5 + warningLines * 3.5 + 4;
    checkPage(boxH + 4);

    doc.setFillColor(...LIGHT_BG);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(marginL, y, contentW, boxH, 3, 3, "FD");

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_GRAY);
    doc.text("NUTRITIONAL INSIGHTS — AVERAGE PER NIGHT", marginL + 6, y + 7);

    // ─── 6-CARD MACRO GRID ───
    const gridY = y + 11;
    const gridH = 16;
    const gapX = 2;
    const gridW = contentW - 12;
    const cardW = (gridW - gapX * 5) / 6;

    const proteinColor: readonly [number, number, number] =
      avgProtein >= 20 ? [22, 163, 74] : avgProtein >= 10 ? [202, 138, 4] : [220, 38, 38];
    const fiberColor: readonly [number, number, number] =
      avgFiber >= 5 ? [22, 163, 74] : [80, 80, 80];
    const sugarColor: readonly [number, number, number] =
      avgSugar > 25 ? [220, 38, 38] : avgSugar > 15 ? [202, 138, 4] : [22, 163, 74];

    const macros: { label: string; value: string; color: readonly [number, number, number] }[] = [
      { label: "Calories", value: `${Math.round(avgCalories)} kcal`, color: [234, 88, 12] },
      { label: "Protein", value: `${Math.round(avgProtein)}g`, color: proteinColor },
      { label: "Carbs", value: `${Math.round(avgCarbs)}g`, color: [37, 99, 235] },
      { label: "Fat", value: `${Math.round(avgFat)}g`, color: [147, 51, 234] },
      { label: "Fiber", value: `${Math.round(avgFiber)}g`, color: fiberColor },
      { label: "Sugar", value: `${Math.round(avgSugar)}g`, color: sugarColor },
    ];

    macros.forEach((m, i) => {
      const cx = marginL + 6 + i * (cardW + gapX);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(cx, gridY, cardW, gridH, 1.5, 1.5, "FD");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(m.color[0], m.color[1], m.color[2]);
      doc.text(m.value, cx + cardW / 2, gridY + 7, { align: "center" });
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND_GRAY);
      doc.text(m.label, cx + cardW / 2, gridY + 12, { align: "center" });
    });

    let insY = gridY + gridH + 5;

    // Sodium line
    if (avgSodium > 0) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND_GRAY);
      doc.text(`Avg sodium: ${Math.round(avgSodium)}mg per meal`, marginL + 6, insY);
      insY += 4;
    }

    if (topFoods.length > 0) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND_GRAY);
      doc.text("Most frequently served:", marginL + 6, insY);
      insY += 3.5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND_DARK);
      topFoods.forEach(([name, count]) => {
        doc.text(`• ${name} (${count}×)`, marginL + 10, insY);
        insY += 3.5;
      });
    }

    if (lowProteinCount > 0 && totalEvents >= 3) {
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(7);
      const warnText = `⚠ ${lowProteinCount} of ${totalEvents} meals were low in protein — consider encouraging volunteers to include a lean protein source.`;
      const warnLines = doc.splitTextToSize(warnText, contentW - 12);
      doc.text(warnLines, marginL + 6, insY);
      insY += warnLines.length * 3.5;
    }

    y += boxH + 4;
  }

  // ─── DONOR ATTRIBUTION TABLE ───
  const donorMap = new Map<string, { meals: number; count: number; totalProtein: number }>();
  reportData.forEach((r) => {
    const name = r.donor_name || "Unknown";
    const existing = donorMap.get(name) || { meals: 0, count: 0, totalProtein: 0 };
    existing.meals += r.meal_count;
    existing.count += 1;
    existing.totalProtein += r.total_protein;
    donorMap.set(name, existing);
  });

  if (donorMap.size > 0) {
    checkPage(20);
    drawHR(doc, y, marginL, marginR);
    y += 4;

    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND_GRAY);
    doc.text("DONOR ATTRIBUTION", marginL, y);
    y += 2;

    const donorHead = [["Donor Name", "Nights Served", "Total Meals", "Avg Protein"]];
    const donorBody = Array.from(donorMap.entries())
      .sort((a, b) => b[1].meals - a[1].meals)
      .map(([name, info]) => [
        name,
        String(info.count),
        String(info.meals),
        `${Math.round(info.totalProtein / info.count)}g`,
      ]);

    autoTable(doc, {
      startY: y,
      head: donorHead,
      body: donorBody,
      theme: "striped",
      headStyles: {
        fillColor: [...TABLE_HEAD],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: 2.5,
      },
      bodyStyles: { fontSize: 7.5, cellPadding: 2, textColor: [...BRAND_DARK] },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      styles: { lineColor: [...BORDER], lineWidth: 0.2 },
      columnStyles: {
        1: { halign: "center" as const },
        2: { halign: "center" as const },
        3: { halign: "right" as const },
      },
      margin: { left: marginL, right: marginR },
    });

    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ─── THANK YOU SIGNATURE ───
  checkPage(35);
  drawHR(doc, y, marginL, marginR);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text("Thank you for your partnership!", marginL, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("We truly appreciate your support and look forward to continuing our work together.", marginL, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_DARK);
  doc.text("Josh Mercado", marginL, y);
  y += 3.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND_GRAY);
  doc.text("Program Director, No Limits Academy", marginL, y);
  y += 3.5;
  doc.text("joshmercado@nolimitsboxingacademy.org", marginL, y);

  doc.setFontSize(6);
  doc.setTextColor(180, 180, 180);
  doc.text("Nutritional values are AI-estimated based on typical serving sizes.", pageWidth - marginR, pageHeight - 14, { align: "right" });

  const footerY = pageHeight - 10;
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text("No Limits Academy  •  If you have questions, reply to joshmercado@nolimitsboxingacademy.org", pageWidth / 2, footerY, { align: "center" });

  return doc;
}

async function loadLogoBase64(): Promise<string | undefined> {
  try {
    const response = await fetch(nlaLogo);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to load logo:", e);
    return undefined;
  }
}

export async function downloadMealReportPdf(data: Omit<MealReportPdfData, "logoBase64">): Promise<void> {
  const logoBase64 = await loadLogoBase64();
  const doc = generateMealReportPdf({ ...data, logoBase64 });
  const startStr = format(data.startDate, "yyyy-MM-dd");
  const endStr = format(data.endDate, "yyyy-MM-dd");
  doc.save(`NLA_Meal_Report_${startStr}_to_${endStr}.pdf`);
}
