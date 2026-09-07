// Raffle Tracker — shared types and the reconciliation maths.
//
// Everything here is pure so the numbers that end up in front of a funder can
// be unit-tested. See docs/RAFFLE_PLAN.md for the decisions behind them.

export interface RaffleCampaign {
  id: string;
  name: string;
  /** What the money is FOR, in the coach’s own words — “Ireland trip airfare”. */
  kind: string;
  ticket_price: number;
  bundle_qty: number | null;
  bundle_price: number | null;
  prize: string | null;
  goal_amount: number | null;
  due_date: string | null;
  draw_date: string | null;
  winning_ticket: number | null;
  status: "active" | "closed";
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RaffleBatch {
  id: string;
  campaign_id: string;
  registration_id: string;
  range_start: number;
  range_end: number;
  book_label: string | null;
  issued_on: string;
  due_date: string | null;
  issued_by: string | null;
  notes: string | null;
}

export interface RaffleReturn {
  id: string;
  batch_id: string;
  range_start: number;
  range_end: number;
  returned_on: string;
  recorded_by: string | null;
  notes: string | null;
}

export interface RafflePayment {
  id: string;
  campaign_id: string;
  registration_id: string;
  amount: number;
  /** How many tickets this money covers. Null falls back to inference. */
  tickets_covered: number | null;
  paid_on: string;
  method: string;
  recorded_by: string | null;
  notes: string | null;
  revenue_id: string | null;
  posted_at: string | null;
}

/**
 * A campaign's rate card: a single-ticket price and, optionally, a bundle —
 * "$5 each, or 5 for $20".
 */
export interface Pricing {
  ticketPrice: number;
  bundleQty?: number | null;
  bundlePrice?: number | null;
}

const hasBundle = (p: Pricing): p is Pricing & { bundleQty: number; bundlePrice: number } =>
  !!p.bundleQty && p.bundleQty > 1 && p.bundlePrice != null && p.bundlePrice >= 0;

/**
 * What `n` tickets are worth at the best rate a buyer could get.
 *
 * Deliberately the cheapest achievable price, not the full single-ticket price:
 * charging a youth $5 a ticket when they sold every one of them in bundles
 * would leave them showing a debt they don't owe.
 */
export const priceFor = (n: number, p: Pricing): number => {
  if (n <= 0) return 0;
  const single = n * p.ticketPrice;
  if (!hasBundle(p)) return round2(single);

  const bundles = Math.floor(n / p.bundleQty);
  const rest = n % p.bundleQty;
  // Rounding the remainder up to one more bundle is sometimes cheaper: at
  // "5 for $20" with $5 singles, 9 tickets is two bundles ($40), not one
  // bundle plus four singles ($40) — and at other rates it genuinely differs.
  const mixed = bundles * p.bundlePrice + rest * p.ticketPrice;
  const rounded = (bundles + 1) * p.bundlePrice;
  return round2(Math.min(single, rest === 0 ? mixed : Math.min(mixed, rounded)));
};

/**
 * The most tickets `amount` could have paid for at the best available rate.
 * Only used when nobody recorded how many tickets a payment covered.
 */
export const inferTickets = (amount: number, p: Pricing): number => {
  if (amount <= 0) return 0;
  if (hasBundle(p) && p.bundlePrice > 0) {
    const bundles = Math.floor(amount / p.bundlePrice);
    const rest = amount - bundles * p.bundlePrice;
    const extra = p.ticketPrice > 0 ? Math.floor(rest / p.ticketPrice) : 0;
    return bundles * p.bundleQty + extra;
  }
  return p.ticketPrice > 0 ? Math.floor(amount / p.ticketPrice) : 0;
};

/** "$5 each · 5 for $20" — the rate card, for the slip and the campaign card. */
export const describePricing = (p: Pricing) =>
  hasBundle(p)
    ? `${money(p.ticketPrice)} each · ${p.bundleQty} for ${money(p.bundlePrice)}`
    : `${money(p.ticketPrice)} each`;

export const PAYMENT_METHODS = ["Cash", "Check", "Venmo", "CashApp", "Card", "Other"] as const;

/** Ranges are inclusive: 101–150 is fifty tickets. */
export const ticketsIn = (range: { range_start: number; range_end: number }) =>
  Math.max(0, range.range_end - range.range_start + 1);

export const countTickets = (ranges: { range_start: number; range_end: number }[]) =>
  ranges.reduce((n, r) => n + ticketsIn(r), 0);

/** "101–150", or just "137" when it's a single ticket. */
export const formatRange = (r: { range_start: number; range_end: number }) =>
  r.range_start === r.range_end ? `${r.range_start}` : `${r.range_start}–${r.range_end}`;

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export interface YouthTotals {
  issued: number;
  returned: number;
  /** Tickets still in the wild — neither back on the shelf nor accounted for. */
  out: number;
  owed: number;
  paid: number;
  /** What Chrissy is still chasing. Negative means they overpaid. */
  balance: number;
  soldTickets: number;
  /** 0–1. Multiply by 100 for the percentage. */
  sellThrough: number;
}

/**
 * The reconciliation for one youth in one campaign.
 *
 * Tickets sold is a RECORDED number — Chrissy enters how many tickets a payment
 * covers when the money comes in. With a bundle rate the money alone cannot
 * tell you: $200 is forty tickets at $5, or fifty at "5 for $20". Getting that
 * wrong would undercount the best sellers in the funder report.
 *
 * When a payment has no count recorded, it falls back to the most tickets that
 * money could have bought at the best rate. Either way the total is capped at
 * the tickets actually in the youth's hands, so an over-payment — someone hands
 * over $20 for a $5 ticket — can't invent tickets that don't exist.
 *
 * Balance is the value of everything still out, at the best rate, minus what
 * came in: a youth who sold fifty in bundles and turned in the bundle money
 * lands on a clean zero rather than a phantom debt.
 */
export const youthTotals = (
  batches: Pick<RaffleBatch, "range_start" | "range_end">[],
  returns: Pick<RaffleReturn, "range_start" | "range_end">[],
  payments: Pick<RafflePayment, "amount" | "tickets_covered">[],
  pricing: Pricing
): YouthTotals => {
  const issued = countTickets(batches);
  const returned = countTickets(returns);
  const out = Math.max(0, issued - returned);
  const owed = priceFor(out, pricing);
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const claimed = payments.reduce(
    (n, p) => n + (p.tickets_covered ?? inferTickets(Number(p.amount || 0), pricing)),
    0
  );
  const soldTickets = Math.min(claimed, out);

  return {
    issued,
    returned,
    out,
    owed,
    paid: round2(paid),
    balance: round2(owed - paid),
    soldTickets,
    sellThrough: issued > 0 ? soldTickets / issued : 0,
  };
};

/** Money maths in floats drifts; every currency figure goes through this. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

/**
 * Which batch holds a given ticket number — how "who sold the winning ticket?"
 * gets answered. Ranges within a campaign can't overlap (enforced in the
 * database), so at most one batch can match.
 */
export const batchHolding = <T extends { range_start: number; range_end: number }>(
  batches: T[],
  ticket: number
): T | undefined =>
  batches.find((b) => ticket >= b.range_start && ticket <= b.range_end);

/**
 * Parse "101-150", "101–150" (en dash), or "137" into a range. Returns null on
 * anything it can't read, so the caller can show a message rather than save
 * something wrong.
 */
export const parseRange = (input: string): { range_start: number; range_end: number } | null => {
  const cleaned = input.trim().replace(/[–—]/g, "-");
  if (!cleaned) return null;

  const single = cleaned.match(/^(\d+)$/);
  if (single) {
    const n = parseInt(single[1], 10);
    return n > 0 ? { range_start: n, range_end: n } : null;
  }

  const span = cleaned.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!span) return null;

  const start = parseInt(span[1], 10);
  const end = parseInt(span[2], 10);
  if (!start || !end || end < start) return null;
  return { range_start: start, range_end: end };
};

/** Overdue = past its due date with money still owed. */
export const isOverdue = (dueDate: string | null, balance: number, today = new Date()) => {
  if (!dueDate || balance <= 0) return false;
  return dueDate < toDateString(today);
};

export const toDateString = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export interface SeasonSummary {
  youthIssued: number;
  youthContributed: number;
  /** Share of youth given tickets who turned in at least a dollar. */
  participation: number;
  ticketsIssued: number;
  ticketsSold: number;
  sellThrough: number;
  raised: number;
  outstanding: number;
}

/**
 * The season roll-up — the numbers that go in a grant application. Takes the
 * per-youth totals already computed, so the aggregation rules live in one place.
 */
export const seasonSummary = (rows: YouthTotals[]): SeasonSummary => {
  const youthIssued = rows.filter((r) => r.issued > 0).length;
  const youthContributed = rows.filter((r) => r.paid > 0).length;
  const ticketsIssued = rows.reduce((n, r) => n + r.issued, 0);
  const ticketsSold = rows.reduce((n, r) => n + r.soldTickets, 0);
  const raised = round2(rows.reduce((n, r) => n + r.paid, 0));
  const outstanding = round2(
    rows.reduce((n, r) => n + Math.max(0, r.balance), 0)
  );

  return {
    youthIssued,
    youthContributed,
    participation: youthIssued > 0 ? youthContributed / youthIssued : 0,
    ticketsIssued,
    ticketsSold,
    sellThrough: ticketsIssued > 0 ? ticketsSold / ticketsIssued : 0,
    raised,
    outstanding,
  };
};
