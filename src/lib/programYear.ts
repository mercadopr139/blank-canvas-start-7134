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
 * Short display label for a program year. "2025-2026" → "2025-26".
 */
export function shortProgramYear(programYear: string | null | undefined): string {
  if (!programYear) return "—";
  const match = programYear.match(/^(\d{4})-(\d{4})$/);
  if (!match) return programYear;
  return `${match[1]}-${match[2].slice(2)}`;
}
