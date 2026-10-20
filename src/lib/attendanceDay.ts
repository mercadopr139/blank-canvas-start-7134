// When a day's numbers are final (Josh, 2026-10-20).
//
// Averages are shown to donors, often while the kids are still walking in.
// A day in progress is not a completed observation: counting 18 at 4 PM as a
// full practice night drags the average down and misstates the academy. So
// an average runs over CLOSED days only — every past day, and today once the
// night is over, 8 PM Eastern. Today's own count still shows, as "so far".
// Nothing is hidden and nothing is inflated; today simply joins the average
// when it is complete.
export const DAY_CLOSES_AT_HOUR = 20; // 8 PM, America/New_York

const NY = "America/New_York";

/** Today's calendar date in New York, YYYY-MM-DD. */
export const todayInNY = (now: Date = new Date()): string => now.toLocaleDateString("en-CA", { timeZone: NY });

/** The hour of the day in New York, 0–23. */
export const hourInNY = (now: Date = new Date()): number =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: NY, hour: "numeric", hour12: false }).format(now).replace(/\D/g, "")) % 24;

/** Is this date's attendance final? Past days always; today after 8 PM Eastern; never a future date. */
export const isDayClosed = (dateStr: string, now: Date = new Date()): boolean => {
  const today = todayInNY(now);
  if (dateStr < today) return true;
  if (dateStr > today) return false;
  return hourInNY(now) >= DAY_CLOSES_AT_HOUR;
};

/** Only the records of closed days — what an average may count. */
export const closedDaysOnly = <T extends { check_in_date: string }>(records: T[], now: Date = new Date()): T[] =>
  records.filter((r) => isDayClosed(r.check_in_date, now));

/** The dates among these that are still open (today, before 8 PM). Empty once today is closed. */
export const openDatesIn = (dates: Iterable<string>, now: Date = new Date()): string[] =>
  [...new Set(dates)].filter((d) => !isDayClosed(d, now));
