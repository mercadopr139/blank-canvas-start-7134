import jsPDF from "jspdf";

// Raffle season report — the funder-facing document.
//
// The claim it exists to support: the youth of this academy are not passive
// recipients. They are required to contribute to the cost of the program that
// serves them, and here is what that contributed, by name and by number.
//
// The headline is participation — what share of youth given tickets turned in
// money — because a programme where three kids do everything is a different
// programme from one where eighty each do a little.

const NLA_RED: [number, number, number] = [191, 15, 62];

export interface RaffleSeasonCampaign {
  name: string;
  kind: string;
  ticketsIssued: number;
  ticketsSold: number;
  raised: number;
  outstanding: number;
  youthParticipating: number;
}

export interface RaffleSeasonYouth {
  name: string;
  issued: number;
  sold: number;
  raised: number;
  sellThrough: number;
  campaigns: number;
}

export interface RaffleSeasonInput {
  periodLabel: string;
  youthIssued: number;
  youthContributed: number;
  participation: number;
  ticketsIssued: number;
  ticketsSold: number;
  sellThrough: number;
  raised: number;
  outstanding: number;
  campaigns: RaffleSeasonCampaign[];
  perYouth: RaffleSeasonYouth[];
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const pct = (f: number) => `${Math.round(f * 100)}%`;

export function generateRaffleSeasonPdf(input: RaffleSeasonInput) {
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
  doc.text("Youth Fundraising — Raffle Program", margin, 60);
  y = 118;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(input.periodLabel, margin, y);
  y += 26;

  // ── The sentence a funder can quote ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const headline = doc.splitTextToSize(
    `${input.youthContributed} of ${input.youthIssued} youth entrusted with raffle tickets ` +
      `(${pct(input.participation)}) contributed money back to the academy, raising ${usd(input.raised)} ` +
      `toward the cost of the program that serves them.`,
    maxWidth
  );
  doc.text(headline, margin, y);
  y += headline.length * 15 + 18;

  // ── Headline stats ──
  const stats: [string, string][] = [
    ["Youth participating", `${input.youthContributed} of ${input.youthIssued}`],
    ["Raised", usd(input.raised)],
    ["Tickets sold", `${input.ticketsSold} of ${input.ticketsIssued}`],
    ["Sell-through", pct(input.sellThrough)],
  ];
  const boxW = (maxWidth - 3 * 12) / 4;
  const boxH = 62;
  stats.forEach(([label, value], i) => {
    const x = margin + i * (boxW + 12);
    doc.setDrawColor(225, 225, 225);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(x, y, boxW, boxH, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), x + 10, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...NLA_RED);
    doc.text(value, x + 10, y + 44);
  });
  y += boxH + 30;

  // ── Per campaign ──
  if (input.campaigns.length > 0) {
    room(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text("By campaign", margin, y);
    y += 18;

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "bold");
    doc.text("CAMPAIGN", margin, y);
    doc.text("YOUTH", margin + 250, y, { align: "right" });
    doc.text("SOLD", margin + 320, y, { align: "right" });
    doc.text("RAISED", margin + 400, y, { align: "right" });
    doc.text("OUTSTANDING", maxWidth + margin, y, { align: "right" });
    y += 6;
    doc.setDrawColor(225, 225, 225);
    doc.line(margin, y, margin + maxWidth, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    input.campaigns.forEach((c) => {
      room(20);
      doc.setFontSize(10);
      const label = c.kind ? `${c.name} (${c.kind})` : c.name;
      doc.text(doc.splitTextToSize(label, 240)[0], margin, y);
      doc.text(String(c.youthParticipating), margin + 250, y, { align: "right" });
      doc.text(`${c.ticketsSold}/${c.ticketsIssued}`, margin + 320, y, { align: "right" });
      doc.text(usd(c.raised), margin + 400, y, { align: "right" });
      doc.text(usd(c.outstanding), maxWidth + margin, y, { align: "right" });
      y += 17;
    });
    y += 16;
  }

  // ── Per youth ──
  room(60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("By youth", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  y += 12;
  doc.text(
    "Sell-through is money collected divided by the value of the tickets that youth was given.",
    margin,
    y
  );
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("YOUTH", margin, y);
  doc.text("CAMPAIGNS", margin + 250, y, { align: "right" });
  doc.text("SOLD", margin + 330, y, { align: "right" });
  doc.text("RAISED", margin + 410, y, { align: "right" });
  doc.text("SELL-THROUGH", maxWidth + margin, y, { align: "right" });
  y += 6;
  doc.setDrawColor(225, 225, 225);
  doc.line(margin, y, margin + maxWidth, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  input.perYouth.forEach((p) => {
    room(18);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(p.name, 240)[0], margin, y);
    doc.text(String(p.campaigns), margin + 250, y, { align: "right" });
    doc.text(`${p.sold}/${p.issued}`, margin + 330, y, { align: "right" });
    doc.text(usd(p.raised), margin + 410, y, { align: "right" });
    doc.text(pct(p.sellThrough), maxWidth + margin, y, { align: "right" });
    y += 16;
  });

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `No Limits Boxing Academy · Raffle Program · ${input.periodLabel}`,
      margin,
      pageH - 40
    );
    doc.text(`${i} of ${pages}`, maxWidth + margin, pageH - 40, { align: "right" });
  }

  doc.save(`nla-raffle-report-${input.periodLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
}
