import { describe, it, expect } from "vitest";
import {
  ticketsIn,
  countTickets,
  formatRange,
  parseRange,
  batchHolding,
  youthTotals,
  seasonSummary,
  isOverdue,
  priceFor,
  inferTickets,
  describePricing,
  Pricing,
} from "@/lib/raffle";

const r = (range_start: number, range_end: number) => ({ range_start, range_end });
const pay = (amount: number, tickets_covered: number | null = null) => ({ amount, tickets_covered });

/** $5 a ticket, no bundle. */
const FLAT: Pricing = { ticketPrice: 5 };
/** $5 a ticket, or 5 for $20 — the rate NLA actually runs. */
const BUNDLE: Pricing = { ticketPrice: 5, bundleQty: 5, bundlePrice: 20 };

describe("ticket ranges", () => {
  it("counts inclusively — 101-150 is fifty tickets, not forty-nine", () => {
    expect(ticketsIn(r(101, 150))).toBe(50);
    expect(ticketsIn(r(137, 137))).toBe(1);
  });

  it("sums across books", () => {
    expect(countTickets([r(1, 50), r(101, 110)])).toBe(60);
  });

  it("shows a single ticket without a dash", () => {
    expect(formatRange(r(137, 137))).toBe("137");
    expect(formatRange(r(101, 150))).toBe("101–150");
  });
});

describe("parseRange", () => {
  it("reads hyphens, en dashes and single numbers", () => {
    expect(parseRange("101-150")).toEqual(r(101, 150));
    expect(parseRange("101 – 150")).toEqual(r(101, 150));
    expect(parseRange("137")).toEqual(r(137, 137));
  });

  it("refuses what it can't read rather than guessing", () => {
    expect(parseRange("")).toBeNull();
    expect(parseRange("150-101")).toBeNull(); // backwards
    expect(parseRange("abc")).toBeNull();
    expect(parseRange("0")).toBeNull();
    expect(parseRange("101-")).toBeNull();
  });
});

describe("priceFor", () => {
  it("multiplies when there is no bundle", () => {
    expect(priceFor(10, FLAT)).toBe(50);
    expect(priceFor(0, FLAT)).toBe(0);
  });

  it("uses the bundle rate for whole bundles", () => {
    expect(priceFor(5, BUNDLE)).toBe(20);
    expect(priceFor(50, BUNDLE)).toBe(200); // ten bundles, not $250
  });

  it("mixes bundles and singles for a remainder", () => {
    expect(priceFor(7, BUNDLE)).toBe(30); // one bundle + two singles
    expect(priceFor(3, BUNDLE)).toBe(15); // under a bundle
  });

  it("never charges more than the plain single-ticket price", () => {
    // A badly set-up bundle (worse than buying singly) must not raise the bill.
    const bad: Pricing = { ticketPrice: 5, bundleQty: 5, bundlePrice: 40 };
    expect(priceFor(5, bad)).toBe(25);
  });
});

describe("inferTickets", () => {
  it("assumes the best rate the buyer could have got", () => {
    expect(inferTickets(200, BUNDLE)).toBe(50); // ten bundles
    expect(inferTickets(200, FLAT)).toBe(40); // no bundle available
  });

  it("handles a part-bundle remainder", () => {
    expect(inferTickets(25, BUNDLE)).toBe(6); // one bundle ($20) + one single ($5)
  });

  it("is zero for no money and never divides by zero", () => {
    expect(inferTickets(0, BUNDLE)).toBe(0);
    expect(inferTickets(50, { ticketPrice: 0 })).toBe(0);
  });
});

describe("describePricing", () => {
  it("spells out the rate card", () => {
    expect(describePricing(BUNDLE)).toBe("$5.00 each · 5 for $20.00");
    expect(describePricing(FLAT)).toBe("$5.00 each");
  });
});

describe("youthTotals", () => {
  it("does the straightforward flat-price case", () => {
    // 50 issued at $5, 10 came back, $200 paid for 40.
    const t = youthTotals([r(101, 150)], [r(141, 150)], [pay(200, 40)], FLAT);
    expect(t.issued).toBe(50);
    expect(t.returned).toBe(10);
    expect(t.out).toBe(40);
    expect(t.owed).toBe(200);
    expect(t.paid).toBe(200);
    expect(t.balance).toBe(0);
    expect(t.soldTickets).toBe(40);
    expect(t.sellThrough).toBe(0.8);
  });

  it("credits a full fifty when they were all sold in bundles", () => {
    // The whole reason tickets_covered exists: $200 of bundle sales is FIFTY
    // tickets, and scoring it as forty would rob the best seller in the report.
    const t = youthTotals([r(1, 50)], [], [pay(200, 50)], BUNDLE);
    expect(t.soldTickets).toBe(50);
    expect(t.sellThrough).toBe(1);
    expect(t.owed).toBe(200); // bundle rate, not $250
    expect(t.balance).toBe(0); // settled, with no phantom debt
  });

  it("does not manufacture a debt at the single-ticket rate", () => {
    // Same kid, but nobody recorded the count. Inference still lands on zero
    // owing, because owed is priced at the bundle rate too.
    const t = youthTotals([r(1, 50)], [], [pay(200)], BUNDLE);
    expect(t.balance).toBe(0);
    expect(t.soldTickets).toBe(50);
  });

  it("adds up installments", () => {
    const t = youthTotals([r(1, 20)], [], [pay(40, 10), pay(35, 8)], FLAT);
    expect(t.paid).toBe(75);
    expect(t.balance).toBe(25);
    expect(t.soldTickets).toBe(18);
  });

  it("does NOT credit a kid who returns nothing and pays nothing", () => {
    // Sell-through must be 0% here, not 100%.
    const t = youthTotals([r(1, 50)], [], [], BUNDLE);
    expect(t.out).toBe(50);
    expect(t.balance).toBe(200);
    expect(t.sellThrough).toBe(0);
  });

  it("floors an inferred part-payment instead of rounding a ticket up", () => {
    // $22 at $5 with no bundle is four tickets and change, not five.
    const t = youthTotals([r(1, 10)], [], [pay(22)], FLAT);
    expect(t.soldTickets).toBe(4);
  });

  it("can't invent tickets when someone overpays", () => {
    const t = youthTotals([r(1, 10)], [], [pay(100, 10)], FLAT);
    expect(t.soldTickets).toBe(10);
    expect(t.sellThrough).toBe(1);
    expect(t.balance).toBe(-50); // overpaid, and it shows
  });

  it("caps a mistyped ticket count at what the youth actually holds", () => {
    // Fat-fingered 500 must not produce a 1000% sell-through.
    const t = youthTotals([r(1, 10)], [], [pay(50, 500)], FLAT);
    expect(t.soldTickets).toBe(10);
    expect(t.sellThrough).toBe(1);
  });

  it("survives a free campaign without dividing by zero", () => {
    const t = youthTotals([r(1, 10)], [], [pay(0.01)], { ticketPrice: 0 });
    expect(t.sellThrough).toBe(0);
    expect(Number.isFinite(t.balance)).toBe(true);
  });

  it("has no sell-through for a youth who was never issued anything", () => {
    const t = youthTotals([], [], [], FLAT);
    expect(t.sellThrough).toBe(0);
    expect(t.issued).toBe(0);
  });

  it("keeps currency clean across many small payments", () => {
    const pennies = Array.from({ length: 3 }, () => pay(0.1));
    expect(youthTotals([r(1, 1)], [], pennies, { ticketPrice: 1 }).paid).toBe(0.3);
  });
});

describe("batchHolding", () => {
  const batches = [
    { id: "a", range_start: 101, range_end: 150 },
    { id: "b", range_start: 151, range_end: 200 },
  ];

  it("finds who is holding the winning ticket", () => {
    expect(batchHolding(batches, 137)?.id).toBe("a");
    expect(batchHolding(batches, 151)?.id).toBe("b");
  });

  it("returns nothing for a number never issued", () => {
    expect(batchHolding(batches, 9999)).toBeUndefined();
  });
});

describe("seasonSummary", () => {
  it("reports participation as the share who turned in money", () => {
    const rows = [
      youthTotals([r(1, 10)], [], [pay(50, 10)], FLAT), // sold out
      youthTotals([r(11, 20)], [r(16, 20)], [pay(25, 5)], FLAT), // half
      youthTotals([r(21, 30)], [], [], FLAT), // nothing
      youthTotals([], [], [], FLAT), // never issued any
    ];
    const s = seasonSummary(rows);

    expect(s.youthIssued).toBe(3); // the fourth was never given tickets
    expect(s.youthContributed).toBe(2);
    expect(s.participation).toBeCloseTo(2 / 3);
    expect(s.ticketsIssued).toBe(30);
    expect(s.ticketsSold).toBe(15);
    expect(s.sellThrough).toBe(0.5);
    expect(s.raised).toBe(75);
  });

  it("counts outstanding without letting an overpayment mask a debt", () => {
    const rows = [
      youthTotals([r(1, 10)], [], [pay(100, 10)], FLAT), // overpaid by $50
      youthTotals([r(11, 20)], [], [], FLAT), // owes $50
    ];
    expect(seasonSummary(rows).outstanding).toBe(50);
  });
});

describe("isOverdue", () => {
  const today = new Date("2026-09-07T12:00:00");

  it("is overdue only when past the date AND money is owed", () => {
    expect(isOverdue("2026-09-01", 50, today)).toBe(true);
    expect(isOverdue("2026-09-01", 0, today)).toBe(false); // settled
    expect(isOverdue("2026-12-01", 50, today)).toBe(false); // not yet
    expect(isOverdue(null, 50, today)).toBe(false); // no deadline set
  });
});
