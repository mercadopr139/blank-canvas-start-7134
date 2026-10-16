// The About NLA library: every fact a funder asks for, in one place.
//
// This is the field catalog — sections, labels, help, and the text seeded
// from the public website (docs/grant-coach/README.md: "fill once, update
// when things change"). Saved values live in grant_org_fields, keyed by
// `key`; a field with no saved value shows its seed, marked "from the
// website", until someone writes over it. Seeds are a mirror of the site as
// of 2026-10-16; when the site changes, change the seed here too.

export type FieldKind = "short" | "long" | "list" | "number" | "date" | "yesno";

export interface OrgField {
  key: string;
  label: string;
  kind: FieldKind;
  /** Funders ask for this on nearly every application. */
  required?: boolean;
  /** One line under the box: what this is for, or where to find it. */
  help?: string;
  /** Text from the public website, shown until a saved value exists. */
  seed?: string;
}

export interface OrgSection {
  key: string;
  title: string;
  blurb: string;
  fields: OrgField[];
}

const MISSION =
  "No Limits Academy is a free, year-round youth development center serving kids and young adults, " +
  "7–19 years old, of Cape May County. Monday through Friday, 2:30 PM–8:30 PM, we use boxing, mentorship, " +
  "and structure to set young people up for success in life.";

const STORY =
  "No Limits Academy was co-founded in 2020 by Josh Mercado and Dave Von Savage Jr. Josh, a National Collegiate " +
  "Boxing Champion who boxed at Lock Haven under Dr. Ken Cox, spent over a decade as a psychology and sociology " +
  "teacher and multi-sport coach at Cape May County Technical High School. Dave, raised in Cape May, boxed four " +
  "years at the United States Naval Academy, served seven years on active duty, and earned his MBA at Wharton. " +
  "They met when Josh coached a young Dave in a basement boxing gym, and their shared belief in structure and " +
  "consistency became the academy.\n\n" +
  "In 2020 they made their home at 1086 Route 47 South in Rio Grande, NJ, and renovated the space by hand with " +
  "volunteers into a boxing facility, performance center, learning center and teen center. In 2022 Josh left " +
  "teaching to lead NLA full time.\n\n" +
  "Today No Limits Academy is more than a boxing gym: a community hub built on mentorship, belonging and " +
  "opportunity, where young people are challenged, supported and believed in, and learn that their circumstances " +
  "do not define their future and that no one succeeds alone.";

const SCHEDULE =
  "NLA operates year-round, with after-school programming five days a week during the school year and an " +
  "excursions-driven schedule four days a week through the summer.\n\n" +
  "School year (September–June): Monday–Friday. Senior Boxing 5:15–7:15 PM within extended hours of 2:30–8:30 PM; " +
  "Junior Boxing on Tuesdays with Juniors Aftercare 6:00–7:00 PM; dinner through the Meal Train five nights a week.\n\n" +
  "Summer (July–August): Monday–Thursday. Senior Boxing 6:15–8:15 PM, with full-day excursions to partner venues " +
  "across South Jersey, Philadelphia and the shore. Junior Boxing pauses for the summer and resumes the last " +
  "Tuesday of September. Every youth re-registers each September 1.";

const PROGRAMS = [
  "Senior Boxing Program — ages 11–19, Monday–Friday: boxing and fitness training with mentorship, accountability, leadership development and life skills",
  "Junior Boxing Program — ages 7–10, Tuesdays: an introduction to boxing, fitness and discipline focused on confidence, listening and teamwork",
  "Juniors Aftercare — Tuesdays 6:00–7:00 PM for Junior Boxers: Smile Lab (oral health and hygiene, with Delta Dental) and Life Lab (character and values)",
  "Meal Train — a hot dinner five nights a week during the school year, cooked and served by donor families, businesses and community groups",
  "Transportation — free rides to and from practice for youth in designated areas",
  "Summer Excursions — full-day experiences at partner venues across South Jersey, Philadelphia and the shore",
  "Strength & Conditioning — a structured lifting programme for the Battle Team and the Non-Battle Team",
  "Real Talk Sessions — influential adults share honest stories of struggle and perseverance",
  "Spiritual Development — reflection, values and purpose in a supportive, respectful setting",
  "The Launch Pad — mentors, local employers and opportunities that keep young people connected after they leave the gym",
  "Coaching Boys into Men — the evidence-based violence-prevention programme, in partnership with Cape Assist",
  "Hawk Squad — after-school boxing and mentorship for Cape May County Technical High School students (Tuesdays and Thursdays)",
  "BAM (Body and Mind) — a Friday behavior-incentive programme with Cape May County Special Services, grades 5–12",
].join("\n");

const IMPACT = [
  "500+ youth served annually",
  "70% economically disadvantaged",
  "Free transportation for youth in designated areas",
  "Meals served five nights a week",
  "95% of youth participate in non-contact boxing",
  "$3M+ raised since 2020",
].join("\n");

const AWARDS = [
  "BCMF — Be Kind Award Recipient",
  "Cape Assist — Partner in Prevention Award",
  "Cape May County Board of County Commissioners — Certificate of Recognition, Josh Mercado, Program Director (2026)",
  "Cape May County Chamber of Commerce — Non-Profit of the Year Award",
  "Cape May County NAACP Freedom Fund — Recognition of Educator Award",
  "Caring For Kids — Community Impact Award",
  "Middle Township City Council — \"Middle Matters\" Civic Recognition Award",
  "United States House of Representatives — 2024 Congressional Proclamation of Recognition, No Limits Academy",
  "United States House of Representatives — 2026 Congressional Proclamation of Recognition, Chrissy Casiello, Program Coordinator",
  "United States House of Representatives — 2026 Congressional Proclamation of Recognition, Josh Mercado, Program Director",
  "USA Boxing's Mid-Atlantic Association — George Hill Humanitarian Award",
  "Veteran Boxers Association, Ring 1 — Man of the Year Award, presented at the Pennsylvania Boxing Hall of Fame (2026)",
].join("\n");

// Alphabetical, like the awards list on the site (Josh, 2026-10-16). What
// each partner does with NLA comes from their March 2026 letters of support
// for the Community Project Funding request.
const PARTNERS = [
  "Acenda Integrated Health / NJ4S (Atlantic & Cape May Counties) — youth mental-health, prevention and early-intervention services delivered on site; Lil' Champs' Corner (now Juniors Aftercare) and NJ4S youth camp programming",
  "Cape Assist — on-site mental-health and prevention support; Coaching Boys Into Men, the evidence-based violence-prevention programme; named NLA its Partner in Prevention (2022)",
  "Cape May County Prosecutor's Office — the annual Shop with a Cop holiday initiative for youth from economically disadvantaged households",
  "Cape May County Special Services School District — BAM (Body and Mind), a behavior-incentive programme for high-need students",
  "Cape May County Technical School District — Hawk Squad, a fee-for-service after-school partnership; CTE students (HVAC, welding, automotive, carpentry) complete real projects at the academy",
  "Cape May Police Department — Gym Buddies, officers working out alongside youth; Gloves Up for the Blue; the annual New Year's formal-dining event",
  "Caring For Kids — Cape May County children's services",
  "Delta Dental — Smile Lab oral-health programming",
  "Meal Train donors — families, businesses, churches and local police who cook and serve dinner five nights a week",
  "Middle Township Police Department — Gym Buddies; officers present at practice and events; refers at-risk youth to NLA; NLA staff support the department's youth camp",
  "Middle Township Public Schools — the largest share of NLA youth; students ride directly from school to NLA at dismissal; referrals and shared communication with teachers, counselors and coaches",
  "O.C.E.A.N., Inc. — CSBG partnership funding hundreds of youth from economically disadvantaged households; financial guidance and mentorship to NLA's leadership",
  "Summer excursion venues across South Jersey, Philadelphia and the shore",
  "Wildwood Public Schools — NLA extends the district's 21st Century Community Learning Centers after-school programme into the evening, with transportation from the school programme to NLA",
  "Woodbine School District — a five-day-a-week after-school partnership through the academic year, extended to summer programming",
].join("\n");

// The eleven letters written in March 2026 for the Community Project Funding
// request, alphabetical by organization. Each can be asked for again.
const LETTERS = [
  "Acenda Integrated Health / NJ4S — Dr. Noëlle Jacquelin, Director, NJ4S Atlantic & Cape May Counties (March 19, 2026)",
  "Cape Assist — Katie Faldetta, Executive Director (March 20, 2026)",
  "Cape May County Prosecutor's Office — Jeffrey H. Sutherland, County Prosecutor (March 20, 2026)",
  "Cape May County Special Services School District — Valerie Bowers, Director, Cape May County High School and Ocean Academy (March 20, 2026)",
  "Cape May County Technical School District & Special Services — Jamie Moscony, Superintendent (March 19, 2026)",
  "Cape May Police Department — Chief Dekon W. Fashaw Sr. (2026)",
  "Middle Township Police Department — Tracey Super, Chief of Police (March 20, 2026)",
  "Middle Township Public Schools — Dr. Stephanie DeRose, Superintendent of Schools (March 19, 2026)",
  "O.C.E.A.N., Inc. — Tamica Mickle, President & CEO (March 19, 2026)",
  "Wildwood Public Schools — J. Kenyon Kummings, Superintendent (March 20, 2026)",
  "Woodbine School District — Adrienne Breitinger, Ed.D., Superintendent (March 19, 2026)",
].join("\n");

// Lines a narrative can quote, each attributed, from those letters.
const QUOTES = [
  "\"The relationship between our department and No Limits Academy is one of the strongest community partnerships we have.\" — Tracey Super, Chief of Police, Middle Township",
  "\"We frequently refer youth — particularly those who may be at risk — to their programming.\" — Tracey Super, Chief of Police, Middle Township",
  "\"Middle Township represents the largest percentage of youth participating in No Limits Academy's programming.\" — Dr. Stephanie DeRose, Superintendent, Middle Township Public Schools",
  "\"Students receive meaningful support that strengthens emotional regulation, engagement, and connection to positive adult mentors.\" — Jamie Moscony, Superintendent, Cape May County Technical School District",
  "\"The City of Wildwood is recognized as a distressed community … Through our partnership with No Limits Academy, we have been able to extend that support even further into the evening hours.\" — J. Kenyon Kummings, Superintendent, Wildwood Public Schools",
  "\"Woodbine is a high-need district … this partnership has also expanded to include summer programming, allowing Woodbine students to access No Limits Academy's facility and services year-round.\" — Adrienne Breitinger, Superintendent, Woodbine School District",
  "\"O.C.E.A.N., Inc. has partnered with No Limits Academy to support hundreds of youth living below the federal poverty line.\" — Tamica Mickle, President & CEO, O.C.E.A.N., Inc.",
  "\"[BAM] has created measurable improvements in student behavior, motivation, and confidence.\" — Valerie Bowers, Director, Cape May County Special Services",
  "\"Cape Assist provides on-site mental health and prevention support … particularly for young people in communities such as Wildwood and Woodbine, where access to services can be limited.\" — Katie Faldetta, Executive Director, Cape Assist",
  "\"A space where young people feel safe, supported, and held accountable.\" — Chief Dekon W. Fashaw Sr., Cape May Police Department",
  "\"An essential partner in our efforts to connect with and support young people across Cape May County.\" — Jeffrey H. Sutherland, Cape May County Prosecutor",
].join("\n");

const OUTCOMES =
  "NLA keeps attendance for every program through kiosk check-ins, so youth served are counted unduplicated and " +
  "retention is measured night by night. The back end also records meals served, rides provided, Juniors Aftercare " +
  "session journals and standout moments, weigh-ins, strength and conditioning logs, and registration demographics " +
  "including household income and free or reduced lunch, from which the economically disadvantaged share is reported.";

export const ORG_SECTIONS: OrgSection[] = [
  {
    key: "identity",
    title: "Identity",
    blurb: "The organization on paper. Screen 1 of almost every application.",
    fields: [
      { key: "legal_name", label: "Legal name of organization", kind: "short", required: true, seed: "No Limits Academy Inc." },
      { key: "dba", label: "Doing business as (DBA / AKA)", kind: "short", required: true, seed: "No Limits Academy", help: "The site and the domain say No Limits Boxing Academy too; use what is registered." },
      { key: "ein", label: "Federal EIN", kind: "short", required: true, help: "On the IRS determination letter and the 990." },
      { key: "nonprofit_date", label: "Date of 501(c)(3) determination", kind: "date", required: true },
      { key: "fiscal_year", label: "Fiscal year", kind: "short", required: true, help: "e.g. January 1 – December 31" },
      { key: "year_established", label: "Year established", kind: "number", required: true, seed: "2020" },
      { key: "website", label: "Website", kind: "short", seed: "https://www.nolimitsboxingacademy.org" },
      { key: "phone", label: "Main phone", kind: "short" },
      { key: "address_physical", label: "Program address (the gym)", kind: "long", required: true, seed: "1086 Route 47 South, Rio Grande, NJ 08242", help: "From Our Story; confirm the ZIP." },
      { key: "address_mailing", label: "Mailing address of record", kind: "long", required: true, help: "Funders use this on the award. Repeat the gym address if they are the same." },
      { key: "counties", label: "Counties served", kind: "short", required: true, seed: "Cape May County" },
      { key: "service_area", label: "Cities, towns and communities served", kind: "long", required: true, help: "The towns most youth come from — the youth map under Attendance shows them." },
      { key: "target_population", label: "Target population", kind: "short", required: true, seed: "Youth and young adults ages 7–19 in Cape May County" },
    ],
  },
  {
    key: "people",
    title: "Leadership and contacts",
    blurb: "Who leads, who the funder calls, and who signs.",
    fields: [
      { key: "ed_name", label: "Executive leadership — name and title", kind: "short", required: true, seed: "Josh Mercado, Program Director", help: "O.C.E.A.N. asks for the Executive Director / CEO; use the title on file with the state." },
      { key: "ed_email", label: "Executive leadership — email", kind: "short", required: true, seed: "joshmercado@nolimitsboxingacademy.org" },
      { key: "ed_phone", label: "Executive leadership — phone", kind: "short", required: true },
      { key: "grant_contact_name", label: "Primary grant contact — name and title", kind: "short", required: true, seed: "Josh Mercado, Program Director", help: "Overall responsibility for the partnership." },
      { key: "grant_contact_email", label: "Primary grant contact — email", kind: "short", required: true, seed: "joshmercado@nolimitsboxingacademy.org" },
      { key: "grant_contact_phone", label: "Primary grant contact — phone", kind: "short", required: true },
      { key: "program_contact_name", label: "Program contact — name and title", kind: "short", seed: "Chrissy Casiello, Program Coordinator", help: "Program implementation, participant records and reporting coordination." },
      { key: "program_contact_email", label: "Program contact — email", kind: "short", seed: "chrissycasiello@nolimitsboxingacademy.org" },
      { key: "program_contact_phone", label: "Program contact — phone", kind: "short" },
      { key: "finance_contact_name", label: "Finance contact — name and title", kind: "short", help: "Invoices, reimbursement documentation and payment coordination." },
      { key: "finance_contact_email", label: "Finance contact — email", kind: "short" },
      { key: "finance_contact_phone", label: "Finance contact — phone", kind: "short" },
      { key: "signer_name", label: "Authorized signer — name and title", kind: "short", required: true, seed: "Josh Mercado, Program Director", help: "Who signs applications and agreements." },
      { key: "board", label: "Board of directors", kind: "list", required: true, help: "One per line: name, role on the board, affiliation." },
      { key: "staff_bios", label: "Staff bios", kind: "long", help: "A short paragraph each for Josh, Chrissy and the coaches funders will see named." },
    ],
  },
  {
    key: "story",
    title: "Mission, story and programs",
    blurb: "The words. Seeded from the website; edit here and every draft uses the edit.",
    fields: [
      { key: "mission", label: "Mission statement", kind: "long", required: true, seed: MISSION },
      { key: "story", label: "Our story, short", kind: "long", required: true, seed: STORY },
      { key: "schedule", label: "How the program runs through the year", kind: "long", required: true, seed: SCHEDULE, help: "Never \"a 10-month after-school program\": NLA is year-round." },
      { key: "programs", label: "Programs", kind: "list", required: true, seed: PROGRAMS },
      { key: "outcomes", label: "Outcomes and evaluation language", kind: "long", required: true, seed: OUTCOMES, help: "What is measured and how. Drafts cite this when a funder asks for outcome measures and data tools." },
      { key: "impact", label: "Impact numbers, from the website", kind: "list", seed: IMPACT, help: "Headline figures. Drafts pull live counts from the back end for the period a funder asks about." },
      { key: "awards", label: "Awards and recognition", kind: "list", seed: AWARDS },
      { key: "partners", label: "Partners", kind: "list", required: true, seed: PARTNERS, help: "Funders ask about coordination and duplicated services; name who NLA works with and on what." },
      { key: "partner_quotes", label: "What partners say", kind: "list", seed: QUOTES, help: "Attributed lines from the letters of support. The writer quotes these where a funder asks about coordination, experience or effectiveness." },
    ],
  },
  {
    key: "finances",
    title: "Finances",
    blurb: "The numbers behind the budget screens.",
    fields: [
      { key: "annual_budget", label: "Most recent approved annual operating budget ($)", kind: "number", required: true, help: "The board-approved figure. The brief says NLA runs on about $1M a year." },
      { key: "prior_revenue", label: "Prior fiscal year — total revenue ($)", kind: "number", help: "From the 990 or the year-end statement." },
      { key: "prior_expenses", label: "Prior fiscal year — total expenses ($)", kind: "number" },
      { key: "operating_deficit", label: "Operating deficit?", kind: "yesno", required: true },
      { key: "deficit_explanation", label: "If a deficit: amount and explanation", kind: "long" },
      { key: "audit_status", label: "Audit or financial review", kind: "short", help: "Most recent audited statements or financial review, and the year." },
      { key: "form_990_year", label: "Most recent Form 990 — tax year", kind: "short", required: true },
    ],
  },
  {
    key: "funding",
    title: "Funding history",
    blurb: "What NLA has received, and from whom — asked by every funder, especially a returning one.",
    fields: [
      { key: "ocean_prior", label: "Previously received O.C.E.A.N. funding?", kind: "yesno", required: true, seed: "Yes" },
      { key: "ocean_program", label: "O.C.E.A.N. — program name funded", kind: "short", seed: "No Limits Academy's Youth Boxing Program" },
      { key: "ocean_amount", label: "O.C.E.A.N. — previous funding amount ($)", kind: "number", seed: "180000", help: "From the walk-through on 2026-10-15 — confirm." },
      { key: "past_grants", label: "Past grants received", kind: "list", required: true, help: "Funding only — honors live under Awards and recognition. One per line: funder, year, amount, purpose." },
      { key: "other_funds", label: "Other committed or pending program funds", kind: "long", help: "Source, status (committed or pending) and amount." },
      { key: "letters_support", label: "Letters of support and MOUs", kind: "list", seed: LETTERS, help: "Who has written one (the March 2026 CPF packet is under Documents) and the agreements on file. Each can be asked for again for a new application." },
    ],
  },
];

export const ORG_FIELDS: OrgField[] = ORG_SECTIONS.flatMap((s) => s.fields);

/**
 * The value a field shows: what was saved (a cleared field stays empty — the
 * person chose that), else its website seed, else empty.
 */
export const orgFieldValue = (field: OrgField, saved: Record<string, string | null>): string =>
  field.key in saved ? (saved[field.key] ?? "") : (field.seed ?? "");

/** How filled in the library is: required fields with text, over all required fields. */
export const orgCompleteness = (saved: Record<string, string | null>) => {
  const required = ORG_FIELDS.filter((f) => f.required);
  const done = required.filter((f) => orgFieldValue(f, saved).trim()).length;
  return { done, total: required.length };
};
