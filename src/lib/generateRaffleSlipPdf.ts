import jsPDF from "jspdf";

// The hand-off slip.
//
// A youth is being trusted with something worth real money. This is the piece
// of paper that says so: which numbers they hold, what they owe, and when. It
// gets signed, they keep a copy, and nobody has to remember it in March.
//
// Half a letter page on purpose — two per sheet, cut down the middle.

import { Pricing, priceFor, describePricing } from "./raffle";

const NLA_RED: [number, number, number] = [191, 15, 62];

export interface RaffleSlipInput {
  campaignName: string;
  youthName: string;
  range: string;
  count: number;
  pricing: Pricing;
  dueDate: string | null;
  prize: string | null;
  issuedOn: string;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function generateRaffleSlipPdf(input: RaffleSlipInput) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 56;
  const owed = priceFor(input.count, input.pricing);

  // ── Masthead ──
  doc.setFillColor(...NLA_RED);
  doc.rect(0, 0, pageW, 76, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("No Limits Boxing Academy", margin, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(input.campaignName, margin, 56);

  let y = 112;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(input.youthName, margin, y);
  y += 26;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(`Tickets issued ${fmtDate(input.issuedOn)}`, margin, y);
  y += 30;

  // ── The two numbers that matter, side by side ──
  const boxW = (pageW - margin * 2 - 16) / 2;
  const boxH = 74;

  const box = (x: number, label: string, value: string, sub: string) => {
    doc.setDrawColor(225, 225, 225);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(x, y, boxW, boxH, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), x + 14, y + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...NLA_RED);
    doc.text(value, x + 14, y + 46);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(sub, x + 14, y + 62);
  };

  box(margin, "Ticket numbers", input.range, `${input.count} tickets · ${describePricing(input.pricing)}`);
  box(margin + boxW + 16, "Total due", usd(owed), `by ${fmtDate(input.dueDate)}`);
  y += boxH + 28;

  if (input.prize) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 20);
    doc.text("Prize", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 70, 70);
    doc.text(doc.splitTextToSize(input.prize, pageW - margin * 2 - 44), margin + 44, y);
    y += 26;
  }

  // ── What they're agreeing to ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(70, 70, 70);
  const terms = doc.splitTextToSize(
    `I have received the tickets listed above. I will return ${usd(owed)}, or any tickets ` +
      `I did not sell, to No Limits Boxing Academy by ${fmtDate(input.dueDate)}. Unsold tickets ` +
      `must come back so they can be sold by someone else.`,
    pageW - margin * 2
  );
  doc.text(terms, margin, y);
  y += terms.length * 14 + 30;

  // ── Signatures ──
  const sigW = (pageW - margin * 2 - 24) / 2;
  const sigLine = (x: number, label: string) => {
    doc.setDrawColor(170, 170, 170);
    doc.line(x, y, x + sigW, y);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(label, x, y + 14);
  };
  sigLine(margin, "Youth signature");
  sigLine(margin + sigW + 24, "Parent / guardian signature");
  y += 44;

  sigLine(margin, "Issued by (staff)");
  sigLine(margin + sigW + 24, "Date");

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Questions? Contact No Limits Boxing Academy.",
    margin,
    doc.internal.pageSize.getHeight() - 40
  );

  const safeName = input.youthName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`raffle-slip-${safeName}-${input.range.replace(/[^0-9]+/g, "-")}.pdf`);
}
