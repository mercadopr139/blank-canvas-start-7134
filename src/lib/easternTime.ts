// Helpers for computing "today" pinned to America/New_York, used by the
// task manager system and any other surface where the day boundary should
// match the academy's local time regardless of the viewer's browser timezone.
//
// We use Intl.DateTimeFormat (built-in, no extra dep) — same pattern as
// AdminAttendance.tsx and the get_todays_excursion DB function.

export const ACADEMY_TIMEZONE = "America/New_York";

// "yyyy-MM-dd" date string for today in Eastern Time. Use this for any
// `date_assigned`-style column writes and equality filters.
export function todayInET(): string {
  // 'en-CA' locale's date format is yyyy-MM-dd which matches what we store.
  return new Date().toLocaleDateString("en-CA", { timeZone: ACADEMY_TIMEZONE });
}

// Friendly display of today's date in Eastern Time, e.g. "Friday, May 5".
// Drop-in replacement for `format(new Date(), "EEEE, MMMM d")`.
export function todayDisplayInET(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: ACADEMY_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
