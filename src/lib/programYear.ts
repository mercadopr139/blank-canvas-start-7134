// Program-year tagging for youth_registrations.
//
// NLA's program year is "Sept 1 → Aug 31". Re-registration for the next
// program year opens Aug 1 of the prior year (the one-month overlap
// window — see /Programs banner). The rule:
//
//   - Jan 1  → Jul 31  of year Y   → current year is (Y-1)-Y
//   - Aug 1  → Dec 31  of year Y   → registrations roll over to Y-(Y+1)
//
// Examples for today's date:
//   2026-06-16 → "2025-2026"
//   2026-08-01 → "2026-2027"   ← re-registration window opens
//   2026-08-31 → "2026-2027"
//   2026-09-01 → "2026-2027"   ← new program year starts
//   2027-07-31 → "2026-2027"
//   2027-08-01 → "2027-2028"   ← next re-reg window opens

const RE_REGISTRATION_START_MONTH = 7; // August (0-indexed: Jan=0, Aug=7)

/**
 * Returns the program-year tag to apply to a NEW registration submitted
 * on the given date. Format: "YYYY-YYYY" (e.g. "2025-2026"). DB stores
 * long form for clarity; UI helpers can shorten to "2025-26" if needed.
 */
export function getProgramYearForRegistration(today: Date = new Date()): string {
  const month = today.getMonth(); // 0-indexed
  const year = today.getFullYear();
  if (month >= RE_REGISTRATION_START_MONTH) {
    // Aug 1 onwards: new sign-ups are for the upcoming program year.
    return `${year}-${year + 1}`;
  }
  // Jan-Jul: new sign-ups join the current (in-progress) program year.
  return `${year - 1}-${year}`;
}

/**
 * The calendar date range [start, end] a program-year tag covers.
 * "2025-2026" → Sept 1 2025 → Aug 31 2026 (end is inclusive, 23:59:59).
 * Falls back to the current program year if the tag is malformed.
 */
export function programYearRange(programYear?: string | null): [Date, Date] {
  const tag = programYear && /^(\d{4})-(\d{4})$/.test(programYear)
    ? programYear
    : getProgramYearForRegistration();
  const startYr = parseInt(tag.slice(0, 4), 10);
  // Sept 1 (month index 8) of the start year → Aug 31 of the next year.
  return [new Date(startYr, 8, 1, 0, 0, 0), new Date(startYr + 1, 7, 31, 23, 59, 59)];
}

/**
 * Short display label for a program year. "2025-2026" → "2025-26".
 */
export function shortProgramYear(programYear: string | null | undefined): string {
  if (!programYear) return "—";
  const match = programYear.match(/^(\d{4})-(\d{4})$/);
  if (!match) return programYear;
  return `${match[1]}-${match[2].slice(2)}`;
}

/**
 * The program year that's eligible for archival on this date.
 * After Aug 1, the current registration year flips to the next year,
 * which means the OLD year is the one to close out. e.g. on Aug 1, 2026
 * getProgramYearForRegistration() returns "2026-2027" and this returns
 * "2025-2026".
 */
export function getPriorProgramYear(today: Date = new Date()): string {
  const current = getProgramYearForRegistration(today);
  const match = current.match(/^(\d{4})-(\d{4})$/);
  if (!match) return current;
  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);
  return `${start - 1}-${end - 1}`;
}

/**
 * Whether the archive-ceremony button should be visible. The window
 * runs Aug 1 → Sept 30 each year — the natural moment when the new
 * cohort has registered and the old cohort can be closed out.
 */
export function isArchiveWindowOpen(today: Date = new Date()): boolean {
  // Preview override via ?archive=1 — same QA hook as summerBreak.
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("archive") === "1") return true;
    if (params.get("archive") === "0") return false;
  }
  const month = today.getMonth(); // 0-indexed: Aug=7, Sep=8
  return month === 7 || month === 8;
}
