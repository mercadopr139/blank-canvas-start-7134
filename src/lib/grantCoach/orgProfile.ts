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
  "140+ youth from Wildwood and Woodbine, two of New Jersey's most economically distressed communities",
  "14,000-square-foot youth development facility",
  "Youth engaged from 2:30 PM to about 8:30 PM, the hours when they are most vulnerable",
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
  "CARA — embedded mental-health support alongside Cape Assist and Acenda",
  "Gym Buddies law-enforcement partners — Avalon, Lower Township, North Wildwood, Wildwood and Wildwood Crest police departments and the Cape May County Sheriff's Department, with the Prosecutor's Office and Middle Township and Cape May police",
  "Lower Cape May Regional School District — a fee-for-service school partnership",
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

// The need and the place, as the winning CPF proposal put them (2026).
const NEED =
  "While Cape May County is widely known as a tourism destination, many families experience economic hardship and " +
  "limited access to youth development opportunities. Approximately 14% of youth in the county live below the federal " +
  "poverty line, and the hardship is concentrated in communities such as Wildwood and Woodbine. The youth NLA serves " +
  "reflect that: 70% are economically disadvantaged, and 143 live in single-parent households headed by mothers.\n\n" +
  "The school districts where participants live report high shares of economically disadvantaged students: Woodbine " +
  "Elementary about 75%, Wildwood City about 70%, Middle Township about 50%, Lower Township about 45%. For many of these " +
  "families, access to a safe after-school environment is limited. NLA keeps youth engaged, mentored and supported " +
  "during the hours when they are most vulnerable to negative influences.";

const FACILITY =
  "NLA operates a 14,000-square-foot youth development facility at 1086 Route 47 South, Rio Grande, NJ 08242 — a safe, " +
  "structured after-school environment where young people receive mentorship, train in non-contact boxing and fitness, " +
  "develop life skills, and share family-style meals with peers and mentors. Many youth arrive as early as 2:30 PM and " +
  "stay until about 8:30 PM. Transportation removes the barrier for youth from underserved communities, year-round, five " +
  "days a week.\n\n" +
  "The FY2027 Community Project Funding award ($300,000, Rep. Jeff Van Drew) funds the Facility Improvement and Youth " +
  "Development Expansion Project: roof replacement ($150,000), parking lot resurfacing ($80,000), a digital community " +
  "information board ($25,000), exterior beautification ($15,000), and Upper Cuts, a mentorship-based workforce-development " +
  "barbershop teaching entrepreneurship, customer service and financial responsibility ($30,000).";

const DEMOGRAPHICS =
  "Race / ethnicity (CPF proposal, 2026): Caucasian 36.8%, Hispanic/Latino 30.0%, African American 20.0%, Multiracial 10.4%, " +
  "Asian 1.0%, Native Hawaiian/Pacific Islander 0.9%, American Indian/Alaska Native 0.9%. 70% economically disadvantaged; " +
  "143 youth in single-parent households headed by mothers.";

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
      { key: "service_area", label: "Cities, towns and communities served", kind: "long", required: true, seed: "Youth from across Cape May County, including more than 140 from Wildwood and Woodbine, two of the most economically distressed communities in New Jersey. By school district (CPF proposal, 2026): Middle Township 31.5%, Lower Township 18.7%, Wildwood 15.1%, Woodbine 13.1%, Cape May County Technical 6.9%, Avalon / Stone Harbor 1.3%, Ocean City 1.0%, Upper Township 0.7%, Cape May / West Cape May 0.7%, other districts and alternative settings 6.6%.", help: "From the CPF proposal. The youth map under Attendance shows the current spread; refresh the percentages when they change." },
      { key: "target_population", label: "Target population", kind: "short", required: true, seed: "Youth and young adults ages 7–19 across Cape May County; 70% economically disadvantaged" },
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
      { key: "staffing", label: "Staffing", kind: "long", required: true, seed: "No Limits Academy runs on two full-time employees — Josh Mercado, Program Director, and Chrissy Casiello, Program Coordinator — supported by part-time coaches, mentors and a volunteer network, on nearly $1 million in annual revenue. Josh leads programming and partnerships; Chrissy runs participant records, reporting, invoicing and day-to-day coordination. Every dollar funds youth, not overhead.", help: "Funders ask for staff roles, qualifications and supervision (O.C.E.A.N. narrative item 4). Two full-time staff on this revenue reads as efficiency — say it plainly. Add the coaches and volunteers by role." },
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
      { key: "need", label: "Statement of need", kind: "long", required: true, seed: NEED, help: "The community numbers behind every proposal's first question. From the CPF proposal; refresh the census and district figures yearly." },
      { key: "facility", label: "The facility and the CPF project", kind: "long", seed: FACILITY, help: "The building, the hours, and what the $300,000 award is building. Update as the project is completed." },
      { key: "demographics", label: "Who NLA serves — demographics", kind: "long", seed: DEMOGRAPHICS, help: "A snapshot from the CPF proposal. Drafts pull the live breakdown from Registration Analytics for the period a funder asks about." },
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
      { key: "prior_revenue", label: "Prior fiscal year — total revenue ($)", kind: "number", seed: "932498", help: "2025 revenue, from the CPF proposal. Confirm against the 990." },
      { key: "revenue_history", label: "Annual revenue history", kind: "list", seed: "2021 — $149,180\n2022 — $374,295\n2023 — $518,905\n2024 — $596,862\n2025 — $932,498", help: "From the CPF proposal. Funders read steady growth as capacity; add each year as it closes." },
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
      { key: "past_grants", label: "Past grants received", kind: "list", seed: "U.S. House Community Project Funding, FY2027 (Rep. Jeff Van Drew) — $300,000 — Facility Improvement and Youth Development Expansion Project — awarded 2026\nO.C.E.A.N., Inc. CSBG Partnership Program — $180,000 — youth boxing program (confirm amount and years)", help: "Optional. Foundations often ask for grants received in the last three years; awards logged in Grant Coach will add themselves here. Funding only — honors live under Awards and recognition." },
      { key: "other_funds", label: "Other committed or pending program funds", kind: "long", help: "Source, status (committed or pending) and amount." },
      { key: "sustainability", label: "Sustainability and revenue model", kind: "long", seed: "NLA keeps core after-school programming free for families through a diversified funding structure: community support, philanthropic contributions, and fee-for-service partnerships with local school districts (Cape May County Special Services, Cape May County Technical, Middle Township, Lower Cape May Regional, Wildwood and Woodbine) that provide a reliable revenue stream. Annual revenue has grown every year since 2021, from $149,180 to $932,498 in 2025. The CPF award protects the facility itself. Dave Von Savage's business training underpins the financial framework and long-term model.", help: "Every funder asks what happens when their grant ends. From the CPF proposal." },
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
