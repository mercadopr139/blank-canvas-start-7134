// How a billed line is typed (Josh, 2026-11-20): the service's rate type,
// stamped on each service day when it is saved, read back by the invoice's
// Type column. Before this the column only knew HOW a line was billed
// (hourly / per day / flat) and every flat line read "Monthly Program
// Cost" — right for Woodbine's month, wrong for a one-off adjustment.

/** The rate types a client or one of its services can have, as the forms list them. */
export const RATE_TYPE_OPTIONS = [
  { value: "per_day", label: "Per Day" },
  { value: "per_hour", label: "Per Hour" },
  { value: "sponsorship", label: "Sponsorship" },
  { value: "adjustment", label: "Adjustment" },
  { value: "other_service", label: "Other" },
] as const;

export type RateType = (typeof RATE_TYPE_OPTIONS)[number]["value"];

/** The rate type as the forms name it ("Per Day"); a type we don't know comes back as typed. */
export const rateTypeLabel = (rateType: string | null | undefined): string => {
  const t = (rateType ?? "").toLowerCase();
  if (!t) return "Per Day";
  if (t === "hourly_rate") return "Per Hour";
  return RATE_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? rateType!;
};

/**
 * What the invoice's Type column says for one line. The line's own rate type
 * first; a line saved before rate types were stamped falls back to how it was
 * billed, the way the column always read.
 */
export const invoiceTypeLabel = (rateType: string | null | undefined, billingMethod: string | null | undefined): string => {
  const t = (rateType ?? "").toLowerCase();
  if (t === "per_day") return "Per Day";
  if (t === "per_hour" || t === "hourly_rate") return "Hourly";
  if (t === "sponsorship") return "Sponsorship";
  if (t === "adjustment") return "Adjustment";
  if (t === "other_service") return "Monthly Program Cost";
  if (t) return rateType!;
  const m = (billingMethod ?? "").toLowerCase();
  if (m === "hourly") return "Hourly";
  if (m === "per_day") return "Per Day";
  return "Monthly Program Cost";
};
