// Summer-break window for the public-facing site. Drives the banner on the
// Programs page, the pill inside the Junior Boxing sign-up modal, and the
// banner on /register. Auto-appears when the current date falls inside the
// configured window; auto-disappears after it.
//
// Update these constants annually (typically in late June) to reflect the
// upcoming year's summer schedule.
//
// Preview override: append `?summer=1` to any URL to force the banner on
// outside the configured window — useful for QA before July 1.

const SUMMER_START = new Date(2026, 5, 22); // June 22, 2026 (month is 0-indexed). Started early per Josh on 2026-06-22 — NLA was already on the summer schedule.
const SUMMER_END   = new Date(2026, 8, 28); // September 28, 2026

export const SUMMER_BREAK_COPY = {
  seniorSchedule: "Monday–Thursday, 6:15pm–8:15pm",
  juniorReturn: "Tuesday, September 29",
  reRegistrationOpens: "August 1",
  newProgramYear: "2026-27",
} as const;

export function isSummerBreakActive(today: Date = new Date()): boolean {
  // Preview override via ?summer=1 — only in the browser, never on the
  // server. Saves Josh a deploy-date dance when QAing copy.
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("summer") === "1") return true;
    if (params.get("summer") === "0") return false;
  }
  // Compare just the date portion — the banner should flip on at the
  // start of July 1 and off at the end of Sept 28 in local time.
  const t = today.getTime();
  return t >= SUMMER_START.getTime() && t <= SUMMER_END.getTime() + 86400000 - 1;
}
