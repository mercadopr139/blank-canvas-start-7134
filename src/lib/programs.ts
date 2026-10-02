// The partner programs: Hawk Squad and BAM.
//
// Each is a separate program from NLA in its own tables, with the same shape
// of build -- a public registration form, a kiosk on the same device, and an
// admin group with Registrations, a Form Editor and an Intelligence page that
// carries attendance, Weekly Standout Moments and a branded report. The pages
// are written once and take one of these entries; adding a program is a new
// entry here, its tables, and its branding.
//
// Nothing here counts toward NLA registration. The one place the programs
// meet NLA is the Youth Served (all programs) page.

export type ProgramKey = "hawk" | "bam";

export interface ProgramConfig {
  key: ProgramKey;
  /** Short name, as spoken: "Hawk Squad", "BAM". */
  name: string;
  /** With the expansion, for headings that have room. */
  fullName: string;
  /** URL piece: /<slug>/register, /check-in/<slug>, /admin/operations/<slug>/… */
  slug: string;
  /** The school partner, as it appears under the kiosk title and in emails. */
  partner: string;
  /** One line for the sidebar. */
  description: string;
  /** Staff permission key for the sidebar group. */
  permKey: string;
  /** The default days the program runs, 0 = Sunday. The calendar can switch any day. */
  defaultWeekdays: readonly number[];
  /** "Tuesday and Thursday by default" -- shown on the attendance calendar. */
  scheduleLine: string;
  /** Preset session dates (YYYY-MM-DD) baked into the app -- the published schedule. A calendar click still overrides any of them. */
  scheduleDates?: readonly string[];
  /** Season labels for the schedule shown after registering: each season runs up to and including `through`. */
  scheduleSeasons?: readonly { name: string; through: string }[];
  tables: { fields: string; registrations: string; attendance: string; practiceDays: string; moments: string };
  rpc: { search: string; roster: string; today: string; undo: string; sameYear: string };
  /** Folder prefix for photos and signatures in the shared buckets. */
  storagePrefix: string;
  grades: readonly string[];
  /** Cape May Tech's career and technical education question. */
  hasCte: boolean;
  /** Bus-or-dismissed going-home toggle and the optional dismissal waiver. */
  hasGoingHome: boolean;
  dismissalWaiverKey: string | null;
  /** Weekly Standout Moments: the first week expected (its Monday) and which weekday a week becomes due. */
  momentsStart: string;
  /** 5 = due from Friday (sessions midweek); 1 = due from Monday (the session was Friday). */
  momentsDueFrom: 5 | 1;
  brand: {
    /** Deep brand colour for panels, letterheads and email headers. */
    primary: string;
    primaryDark: string;
    /** The accent on the brand colour: gold on green, silver on slate. */
    accent: string;
    /** Text colour that reads on the accent. */
    onAccent: string;
    /** Bright UI accent for the kiosk and admin highlights. */
    ui: string;
    uiDark: string;
    wordmark: string;
    sub: string;
    tagline: string;
    /** Behind the public registration form. */
    formBg: string;
  };
  /** Tailwind class strings kept literal here so the build can see them. */
  tw: {
    button: string;
    chipActive: string;
    calSelected: string;
    calToday: string;
    dotOn: string;
    sidebarButton: string;
  };
  letter: {
    org: string;
    contact: string;
    contactTitle: string;
    addressLines: readonly string[];
    /** Salutation when no recipient is typed. */
    defaultSalutation: string;
  };
  submitted: { title: string; line: string };
}

const RACE = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Two or More Races",
] as const;

export const PROGRAM_SEX = ["Male", "Female"] as const;
export const PROGRAM_RACE = RACE;

export const HAWK_SQUAD: ProgramConfig = {
  key: "hawk",
  name: "Hawk Squad",
  fullName: "Hawk Squad",
  slug: "hawk-squad",
  partner: "Cape May Tech",
  description: "Cape May Tech students — registration, check-in, attendance",
  permKey: "operations_hawk_squad",
  // None by default: the calendar is the schedule. The 2026-27 dates are seeded
  // in hawk_squad_practice_days and a coach flips any day on the admin calendar.
  defaultWeekdays: [],
  scheduleLine: "The 2026-27 schedule, preset — click any day to change it",
  // Cape May Tech 2026-27. Fall is Tue/Wed/Thu plus three Mondays; Winter & Spring is Tue/Thu through Mar 11.
  // Oct 1 was the contracted first day but the school cancelled it, so it is left out on purpose.
  scheduleDates: [
    "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-13", "2026-10-14", "2026-10-15",
    "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-27", "2026-10-28", "2026-10-29",
    "2026-11-02", "2026-11-03", "2026-11-10", "2026-11-11", "2026-11-12",
    "2026-11-16", "2026-11-18", "2026-11-19", "2026-11-23", "2026-11-24",
    "2026-12-01", "2026-12-03", "2026-12-08", "2026-12-10", "2026-12-15", "2026-12-17", "2026-12-22",
    "2027-01-05", "2027-01-07", "2027-01-12", "2027-01-14", "2027-01-19", "2027-01-21", "2027-01-26", "2027-01-28",
    "2027-02-02", "2027-02-04", "2027-02-09", "2027-02-11", "2027-02-16", "2027-02-18", "2027-02-23", "2027-02-25",
    "2027-03-02", "2027-03-04", "2027-03-09", "2027-03-11",
  ],
  scheduleSeasons: [
    { name: "Fall", through: "2026-11-30" },
    { name: "Winter & Spring", through: "2027-03-31" },
  ],
  tables: {
    fields: "hawk_squad_form_fields",
    registrations: "hawk_squad_registrations",
    attendance: "hawk_squad_attendance",
    practiceDays: "hawk_squad_practice_days",
    moments: "hawk_squad_weekly_moments",
  },
  rpc: {
    search: "search_hawk_squad_youth",
    roster: "hawk_squad_kiosk_roster",
    today: "hawk_squad_today_roster",
    undo: "hawk_squad_kiosk_undo",
    sameYear: "hawk_squad_same_year_matches",
  },
  storagePrefix: "hawk-squad",
  grades: ["9th", "10th", "11th", "12th"],
  hasCte: true,
  hasGoingHome: true,
  dismissalWaiverKey: "hawk_dismissal",
  momentsStart: "2026-10-05",
  momentsDueFrom: 5,
  brand: {
    primary: "#0f4c2f",
    primaryDark: "#083620",
    accent: "#f2c230",
    onAccent: "#0f4c2f",
    ui: "#22c55e",
    uiDark: "#15803d",
    wordmark: "HAWK SQUAD",
    sub: "AT NO LIMITS ACADEMY",
    tagline: "The Ultimate Afterschool Experience",
    formBg: "#0f4c2f",
  },
  tw: {
    button: "bg-green-600 hover:bg-green-500 text-black",
    chipActive: "bg-green-500 text-black border-green-500",
    calSelected: "border-green-400/70 bg-green-500/10",
    calToday: "text-green-300",
    dotOn: "bg-green-500 border-green-400",
    sidebarButton: "bg-green-600 hover:bg-green-500",
  },
  letter: {
    org: "Cape May County Technical High School",
    contact: "",
    contactTitle: "",
    addressLines: ["Cape May County Technical High School", "188 Crest Haven Rd", "Cape May Court House, NJ 08210"],
    defaultSalutation: "To Cape May Tech Administration:",
  },
  submitted: { title: "Welcome to HAWK SQUAD!", line: "See you immediately afterschool on Hawk Squad days!" },
};

export const BAM: ProgramConfig = {
  key: "bam",
  name: "BAM",
  fullName: "BAM — Body and Mind",
  slug: "bam",
  partner: "Cape May County Special Services",
  description: "Body and Mind — Friday behavior incentive with Special Services",
  permKey: "operations_bam",
  defaultWeekdays: [5],
  scheduleLine: "Fridays by default",
  tables: {
    fields: "bam_form_fields",
    registrations: "bam_registrations",
    attendance: "bam_attendance",
    practiceDays: "bam_practice_days",
    moments: "bam_weekly_moments",
  },
  rpc: {
    search: "search_bam_youth",
    roster: "bam_kiosk_roster",
    today: "bam_today_roster",
    undo: "bam_kiosk_undo",
    sameYear: "bam_same_year_matches",
  },
  storagePrefix: "bam",
  grades: ["5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"],
  hasCte: false,
  hasGoingHome: false,
  dismissalWaiverKey: null,
  momentsStart: "2026-10-05",
  momentsDueFrom: 1,
  brand: {
    primary: "#374151",
    primaryDark: "#1f2937",
    accent: "#d1d5db",
    onAccent: "#111827",
    ui: "#9ca3af",
    uiDark: "#4b5563",
    wordmark: "BAM",
    sub: "BODY AND MIND · AT NO LIMITS ACADEMY",
    tagline: "A behavior incentive program with Cape May County Special Services",
    formBg: "#374151",
  },
  tw: {
    button: "bg-gray-400 hover:bg-gray-300 text-black",
    chipActive: "bg-gray-300 text-black border-gray-300",
    calSelected: "border-gray-300/70 bg-gray-400/10",
    calToday: "text-gray-200",
    dotOn: "bg-gray-400 border-gray-300",
    sidebarButton: "bg-gray-500 hover:bg-gray-400",
  },
  letter: {
    org: "Cape May County Special Services School District",
    contact: "Val Bowers",
    contactTitle: "Director, Cape May County High School and Ocean Academy",
    // Street address to be added when Josh supplies it.
    addressLines: ["Val Bowers", "Director, Cape May County High School and Ocean Academy", "Cape May County Special Services School District"],
    defaultSalutation: "Dear Ms. Bowers,",
  },
  submitted: { title: "Welcome to BAM!", line: "Keep up the great week — we'll see you Friday!" },
};

export const PROGRAMS: Record<ProgramKey, ProgramConfig> = { hawk: HAWK_SQUAD, bam: BAM };
export const PROGRAM_LIST: ProgramConfig[] = [HAWK_SQUAD, BAM];
export const programBySlug = (slug: string) => PROGRAM_LIST.find((p) => p.slug === slug) ?? null;
