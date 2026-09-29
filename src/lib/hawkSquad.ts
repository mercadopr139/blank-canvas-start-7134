// Hawk Squad — the shared shape of a registration, and the pick-lists.
//
// A separate programme in its own tables (see migration 20260929120000). The
// column names mirror youth_registrations where the concept is the same, so
// the address component, the photo helper and the validators work unchanged;
// the lists here are the ones the form and the admin editor both use, so a
// dropdown can never offer something the other side does not know.

export const HAWK_GRADES = ["9th", "10th", "11th", "12th"] as const;

export const HAWK_CTE_PROGRAMS = [
  "Automotive Technology",
  "Allied Medical",
  "Career Exploratory",
  "Carpentry & Property Management",
  "Coastal & Marine Science",
  "Communication Arts",
  "Computer Technology",
  "Cosmetology",
  "Culinary Arts/Hospitality",
  "Electrical Trades",
  "Environmental Science & Sustainability",
  "Future Educator",
  "HVAC-R/Sustainable Energy",
  "Law & Public Safety",
  "Marine Maintenance",
  "Powersports",
  "Pre-Engineering",
  "Veterinary Science",
  "Welding",
] as const;

export const HAWK_SEX = ["Male", "Female"] as const;

export const HAWK_RACE = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Two or More Races",
] as const;

/** The dismissal waiver's field key — the one optional waiver on the form. */
export const HAWK_DISMISSAL_WAIVER_KEY = "hawk_dismissal";

export interface HawkWaiverRecord {
  title: string;
  name: string;
  signaturePath: string;
}

export interface HawkRegistration {
  id: string;
  created_at: string;
  updated_at: string;
  submission_date: string;
  program_year: string;
  child_first_name: string;
  child_last_name: string;
  child_sex: string | null;
  child_date_of_birth: string | null;
  child_race_ethnicity: string | null;
  grade_level: string | null;
  cte_program: string | null;
  child_primary_address: string | null;
  latitude: number | null;
  longitude: number | null;
  parent_first_name: string | null;
  parent_last_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  free_or_reduced_lunch: string | null;
  allergies: string | null;
  has_asthma: boolean | null;
  asthma_inhaler_info: string | null;
  important_child_notes: string | null;
  child_headshot_url: string | null;
  waivers_data: Record<string, HawkWaiverRecord> | null;
  dismissal_waiver_signed_at: string | null;
  final_signature_name: string | null;
  custom_fields_data: Record<string, string> | null;
  approved_for_attendance: boolean;
  archived_at: string | null;
  youth_link_id: string | null;
}

/** Public URL of a headshot stored in the youth-photos bucket. */
export const hawkPhotoUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const clean = path.startsWith("youth-photos/") ? path.slice("youth-photos/".length) : path;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/youth-photos/${clean}`;
};

/** Public URL of a signature image in the registration-signatures bucket. */
export const hawkSignatureUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/registration-signatures/${path}`;
};

/** Can this student be dismissed from NLA rather than ride the bus? */
export const canBeDismissed = (r: Pick<HawkRegistration, "dismissal_waiver_signed_at">) =>
  !!r.dismissal_waiver_signed_at;

/* ───── Attendance ───── */

export type GoingHome = "bus" | "dismissed";

export interface HawkAttendance {
  id: string;
  registration_id: string;
  check_in_at: string;
  check_in_date: string;
  going_home: GoingHome;
  is_manual: boolean;
  note: string | null;
}

/** Today's date as the gym sees it — America/New_York, YYYY-MM-DD. */
export const hawkTodayET = (now = new Date()) =>
  now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });

/** Hawk Squad runs Tuesday and Thursday unless the calendar says otherwise. */
export const HAWK_DEFAULT_WEEKDAYS = [2, 4] as const;

/**
 * Is this a Hawk Squad day? An override row wins; otherwise Tue/Thu.
 * `date` is YYYY-MM-DD; weekday is read at noon so no timezone can shift it.
 */
export const isHawkPracticeDay = (date: string, overrides: Record<string, boolean>): boolean => {
  if (date in overrides) return overrides[date];
  const dow = new Date(`${date}T12:00:00`).getDay();
  return (HAWK_DEFAULT_WEEKDAYS as readonly number[]).includes(dow);
};

/* ───── Duplicates ───── */

type StudentLike = {
  id: string; child_first_name: string | null; child_last_name: string | null; child_date_of_birth: string | null;
  parent_phone: string | null; parent_email: string | null; program_year: string | null; archived_at: string | null;
};

const squash = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/**
 * Are two registrations clearly the same student? Same first and last name
 * with spacing and punctuation stripped, plus a shared birthday, parent phone
 * or parent email. The same rule the database guard uses when approving.
 */
export const isSameHawkStudent = (a: StudentLike, b: StudentLike): boolean => {
  if (a.id === b.id) return false;
  if (!squash(a.child_first_name) || squash(a.child_first_name) !== squash(b.child_first_name)) return false;
  if (squash(a.child_last_name) !== squash(b.child_last_name)) return false;
  const dob = !!a.child_date_of_birth && a.child_date_of_birth === b.child_date_of_birth;
  const phone = !!digits(a.parent_phone) && digits(a.parent_phone) === digits(b.parent_phone);
  const email = !!a.parent_email?.trim() && a.parent_email.trim().toLowerCase() === (b.parent_email ?? "").trim().toLowerCase();
  return dob || phone || email;
};

/** Other live registrations in the same year that look like the same student. */
export const hawkPossibleDuplicates = <T extends StudentLike>(r: T, all: T[]): T[] =>
  all.filter((o) => !o.archived_at && o.program_year === r.program_year && isSameHawkStudent(r, o));

/* ───── Brand ───── */

// Hawk Squad's own look, from its flyers and the mid-year report: deep green,
// gold, white, the hawk, and the tagline. Used by the printed report.
export const HAWK_BRAND = {
  green: "#0f4c2f",
  greenDark: "#083620",
  gold: "#f2c230",
  white: "#ffffff",
  tagline: "The Ultimate Afterschool Experience",
  wordmark: "HAWK SQUAD",
  sub: "AT NO LIMITS ACADEMY",
  school: {
    name: "Cape May County Technical High School",
    street: "188 Crest Haven Rd",
    cityLine: "Cape May Court House, NJ 08210",
  },
  signer: { name: "Josh Mercado", org: "No Limits Academy" },
} as const;

/* ───── Intelligence ───── */

export interface HawkPeriodStats {
  sessionsHeld: number;     // dates with at least one check-in
  sessionsPlanned: number;  // Hawk Squad days in the period, up to today
  checkIns: number;
  students: number;         // distinct people (cross-year identity)
  avgPerSession: number;
  bus: number;
  dismissed: number;
}

/** label → { bucket → count }, over distinct students. */
export type HawkBreakdown = Record<string, Record<string, number>>;

export interface HawkIntelRow {
  registration_id: string;
  check_in_date: string;
  going_home: GoingHome;
  reg: {
    id: string;
    youth_link_id: string | null;
    child_first_name: string;
    child_last_name: string;
    child_headshot_url: string | null;
    grade_level: string | null;
    cte_program: string | null;
    child_sex: string | null;
    child_race_ethnicity: string | null;
    free_or_reduced_lunch: string | null;
  } | null;
}

export const hawkIdentity = (r: HawkIntelRow) => r.reg?.youth_link_id ?? r.registration_id;

/** Every date between two YYYY-MM-DD dates, inclusive. */
export const datesBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const p = (n: number) => String(n).padStart(2, "0");
  while (d <= end) {
    out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
};

/** The period's headline figures. */
export const hawkPeriodStats = (
  rows: HawkIntelRow[], from: string, to: string, overrides: Record<string, boolean>, today = hawkTodayET(),
): HawkPeriodStats => {
  const sessionsHeld = new Set(rows.map((r) => r.check_in_date)).size;
  const sessionsPlanned = datesBetween(from, to).filter((d) => d <= today && isHawkPracticeDay(d, overrides)).length;
  const students = new Set(rows.map(hawkIdentity)).size;
  return {
    sessionsHeld,
    sessionsPlanned,
    checkIns: rows.length,
    students,
    avgPerSession: sessionsHeld ? Math.round((rows.length / sessionsHeld) * 10) / 10 : 0,
    bus: rows.filter((r) => r.going_home === "bus").length,
    dismissed: rows.filter((r) => r.going_home === "dismissed").length,
  };
};

/** Demographics over distinct students. A student's latest row wins. */
export const hawkBreakdown = (rows: HawkIntelRow[]): HawkBreakdown => {
  const latest = new Map<string, HawkIntelRow>();
  [...rows].sort((a, b) => a.check_in_date.localeCompare(b.check_in_date)).forEach((r) => latest.set(hawkIdentity(r), r));
  const tally = (pick: (r: HawkIntelRow) => string | null | undefined) => {
    const m: Record<string, number> = {};
    latest.forEach((r) => { const k = (pick(r) ?? "").trim() || "Not given"; m[k] = (m[k] ?? 0) + 1; });
    return m;
  };
  return {
    Grade: tally((r) => r.reg?.grade_level),
    "CTE program": tally((r) => r.reg?.cte_program),
    Sex: tally((r) => r.reg?.child_sex),
    "Race / ethnicity": tally((r) => r.reg?.child_race_ethnicity),
    "Free or reduced lunch": tally((r) => r.reg?.free_or_reduced_lunch),
  };
};

/** Every date in a month, as YYYY-MM-DD, for the calendar. */
export const datesInMonth = (year: number, month0: number): string[] => {
  const out: string[] = [];
  const d = new Date(year, month0, 1, 12);
  while (d.getMonth() === month0) {
    const p = (n: number) => String(n).padStart(2, "0");
    out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
};
