// The Grant Vault: every fact a funder asks for, in one place — the one
// source of truth for grants (Josh, 2026-10-28).
//
// This is the field catalog — sections, labels, help, and the text seeded
// from the public website (docs/grant-coach/README.md: "fill once, update
// when things change"). Saved values live in grant_org_fields, keyed by
// `key`; a field with no saved value shows its seed, marked "from the
// website", until someone writes over it. Seeds are a mirror of the site as
// of 2026-10-16; when the site changes, change the seed here too.
//
// The sections run in the order funders ask, and each of the first four
// OPENS with the approved paragraph of the program year that answers it
// (`snapshot`, a Snapshot section: src/lib/grantCoach/snapshot.ts). The
// rule since 2026-10-28: every fact lives in ONE place. A number, name, date
// or address is a field here; a paragraph about the year is a Snapshot
// section written from those fields and the live numbers. The old prose
// fields that repeated the Snapshot (demographics, impact numbers) are gone.
import type { SnapshotKey } from "@/lib/grantCoach/snapshot";

export type FieldKind = "short" | "long" | "list" | "number" | "date" | "yesno";

export interface OrgField {
  key: string;
  label: string;
  kind: FieldKind;
  /** Funders ask for this on nearly every application. */
  required?: boolean;
  /** One line under the box: what this is for, or where to find it. */
  help?: string;
  /** One line shown while the card is folded: what is inside, so the Vault reads as a library index. */
  gist?: string;
  /** Text from the public website, shown until a saved value exists. */
  seed?: string;
}

export interface OrgSection {
  key: string;
  title: string;
  blurb: string;
  /** The approved paragraph of the program year that opens this section. */
  snapshot?: SnapshotKey;
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

// The hours by season — a fact, not a second description of the program
// (that is "The program · three groups" and the Snapshot).
const SCHEDULE =
  "NLA operates year-round: five days a week during the school year, four in summer.\n\n" +
  "School year (September–June): Monday–Friday, 2:30–8:30 PM; the training block 5:15–7:15 PM; " +
  "Junior Boxing on Tuesdays with Juniors Aftercare 6:00–7:00 PM; dinner through the Meal Train five nights a week.\n\n" +
  "Summer (July–August): Monday–Thursday, 6:15–8:15 PM, with full-day excursions to partner venues " +
  "across South Jersey, Philadelphia and the shore. Junior Boxing pauses for the summer and resumes the last " +
  "Tuesday of September. Every youth re-registers each September 1.";

/**
 * Josh's own writing, the way he wants every answer to read (2026-10-23, from
 * the CSBG narrative he is proud of). The writer is told to match it. Its
 * figures are from that proposal's moment — the live numbers win on counts.
 */
const WRITING_EXAMPLES = `No Limits Academy – CSBG Program Narrative

Organizational Overview: No Limits Academy (NLA) is a 501(c)(3) youth development organization founded in 2020 in Rio Grande, New Jersey. NLA operates a 14,000 sq. ft. facility that provides year-round academic support, boxing and fitness training, behavioral health services, nutrition, transportation, and mentoring at no cost to youth or their families. Serving over 500 youth per year, NLA has become a trusted partner for schools, families, and agencies throughout Cape May County. Local school districts regularly refer students for academic, behavioral, and social support, demonstrating the organization's strong reputation and community impact.

Program Approach: NLA operates five days per week from 3:00 PM to 8:30 PM, creating a structured, holistic after-school environment. Youth arrive through district transportation, parent drop-offs, or NLA's two 15-passenger vans operated by trained CDL drivers. Upon arrival, youth receive healthy snacks, complete homework in the Learning Center with support from certified teachers, and then participate in fitness, boxing, and recreational activities.
Daily programming includes:
- Academic Tutoring & Homework Support delivered by certified NJ educators
- Boxing & Fitness Training led by former professional boxer and educator Josh Mercado
- Behavioral Health Counseling through partners such as Cape Assist, CARA, and NJ4S
- Daily Nutrition including snacks and full dinners provided by the NLA Meal Train
- Recreational Activities including basketball, structured gym time, and supervised peer interaction
- Weekend Excursions that provide cultural, recreational, and personal growth experiences
This approach integrates physical wellness, academic achievement, behavioral health, mentorship, and social development into one coordinated system.

Community Need & Target Population (≤200% FPL): Cape May County includes multiple communities where youth experience poverty, food insecurity, academic struggles, unstable home environments, and limited access to transportation or enrichment programs. Most of the families NLA serves fall at or below 200% of the Federal Poverty Level, particularly those in Woodbine, Wildwood, Rio Grande, and other underserved pockets of the county. NLA addresses critical community needs by providing:
- Safe, structured after-school programming during high-risk hours
- Transportation for youth with no other way to attend programming
- Daily nutritious meals for youth facing food insecurity
- Academic support for students struggling in school
- On-site access to mental health professionals
- Long-term mentorship and positive adult relationships

Anticipated Number and Age Range of Participants: NLA will serve 130 CSBG-funded youth, ages 7–19. Participant surveys will demonstrate improvement across key domains of well-being, including academic, social, emotional, and physical development.

Service Gaps Addressed: NLA fills major service gaps in Cape May County, including the lack of affordable or free youth programs, limited access to mental health support, insufficient after-school services in rural areas, no consistent transportation for low-income youth, food insecurity among school-age children, and a shortage of safe, structured environments during after-school hours. No other program in the region offers NLA's comprehensive combination of academic support, fitness, mental health, nutrition, and transportation.

Organizational Capacity & Key Personnel: NLA has the staffing, infrastructure, and experience necessary to implement the CSBG-funded program successfully. Key personnel include:
- Josh Mercado, Program Director – Former professional boxer, national collegiate champion, and certified educator with extensive experience in youth development, school-based intervention, and program leadership.
- Chrissy Casiello, Program Coordinator – Full-time staff overseeing daily supervision, academic programming, scheduling, logistics, and youth services.
- Certified Teachers – Deliver academic support in core subjects.
- CDL Drivers – Provide safe transportation for scholarship youth throughout the county.
- Behavioral Health Partners – Licensed counselors providing on-site services.
- Administrative Support Staff & CPA Services – Ensure compliance, financial management, and reporting.
NLA has demonstrated the ability to manage complex operations, deliver multi-component youth programs, maintain accurate documentation, and meet all grant reporting and accountability requirements.

Why NLA Is Best Suited to Deliver These Services: NLA is the only program in Cape May County that provides a fully integrated model of tutoring, nutrition, counseling, mentoring, transportation, and athletics under one roof. Its strong community partnerships, experienced leadership, operational capacity, and proven track record make it uniquely equipped to deliver high-quality, outcomes-driven services for low-income youth. NLA is requesting $200,000 to serve 130 youth.`;

/**
 * The five things NLA offers, in the order the website sells them (reviewed
 * 2026-10-23). Every brief program summary is built on these, in this order.
 */
/**
 * The program as it actually runs — one program, three groups. Josh's words,
 * approved 2026-10-28 after his talk with an experienced grant writer:
 * "represent what NLA actually is." Every application quotes this.
 */
const PROGRAM_DESCRIPTION = `NLA Boxing & Youth Development Program

No Limits Academy (NLA) operates one comprehensive Boxing & Youth Development Program organized into three training groups. All groups share the same facility, coaches, transportation, daily structure, and family-style dinner. This model provides a consistent environment where young people develop physically, personally, and socially, with opportunities to participate from age seven through high school graduation.

Junior Boxing serves as the entry point. Each Tuesday, children ages 7–10 participate in an hour of introductory boxing, followed by the opportunity to attend Juniors Aftercare, which includes NLA's Smile Lab and Life Skills Lab, and a family-style dinner. Through these activities, coaches build relationships, recognize individual needs, and identify children who would benefit from more frequent participation. These children may then be invited to join the Littles for additional training throughout the week.

The Littles (ages 7–13) provide the next level of participation. NLA policy bars youth ages 7–10 from lifting weights, and NLA extended that restriction to ages 11–13, creating the Littles so this age group is separated from weight training. Instead, the Littles train through body-weight work, plyometrics, endurance and flexibility, alongside boxing fundamentals, movement, coordination, discipline and teamwork. Older NLA athletes assist with coaching, reinforcing the organization's core value of Service while serving as positive role models for younger participants.

The Non-Battle Team (ages 14–19) provides structured, non-contact boxing and physical development. Monday through Thursday, participants engage in strength and conditioning, boxing instruction, and recreation. Weekly training plans include two strength-development tracks, Bravo for building and Alpha for progressing, designed to accommodate different abilities. Thursday programming incorporates Bible study, while Fun Friday provides opportunities for recreation, relationship-building, and team bonding.

The Battle Team (ages 14–19) provides advanced training for youth who demonstrate commitment to NLA's House Rules and core values. Athletes are selected by coaches and follow structured strength and boxing programs designed to prepare them for competition. The Battle Team is NLA's only contact group; sparring is supervised and fully equipped, and 95% of NLA youth train in non-contact boxing. However, competition is always a personal choice. For many participants, the Battle Team represents an opportunity to challenge themselves, develop discipline, and pursue personal growth. The team's guiding mentality, "We are fighting," extends beyond the boxing ring to the fight for one's future, teammates, and personal potential.

Daily attendance ranges from 40 to 120 youth, depending on the day and season, with January and February typically experiencing the highest participation. Among youth who train nightly, approximately 45% participate in the Battle Team, 30% in the Non-Battle Team, and 25% in the Littles.

One program. One daily structure. One shared commitment to youth development. Each day follows a consistent schedule that includes open gym and after-school support, team roll call and reflection, structured training, daily responsibilities, and a shared sit-down dinner. NLA operates Monday through Friday, 2:30–8:30 PM, during the school year and four days per week during summer. All programming is provided free of charge.`;

/** Josh's short description of the two teams (2026-10-28): the boxing program for ages 14–19 in four sentences. The Littles are the third group; "The program · three groups" is the whole. */
const BOXING_TEAMS_SHORT = `NLA's boxing program consists of two groups: the Battle Team and the Non-Battle Team. The Battle Team focuses on competitive boxing, advanced skill development, and athletic performance through structured training and sanctioned competitions. The Non-Battle Team emphasizes non-contact boxing, physical fitness, and skill development. Both groups promote discipline, confidence, resilience, and personal growth.`;

/** The seven core values (the website shows them as a banner image) and the ten House Rules (nolimitsboxingacademy.org/house-rules). */
const VALUES_AND_RULES = `NLA's seven core values: Respect, Commitment, Accountability, Faith, Leadership, Trust, Service.

NLA's House Rules — every boxer learns them in Rookie Orientation and passes the House Rules test:
1. Respect.
2. Be on time. Being on time means 15 minutes early. No call, no show is unacceptable. 100% attendance is not required; 100% communication is required.
3. Be prepared. Show up at the right time with the right attitude, the right equipment and the right attire.
4. Support your team. The gym is a community far bigger than you. Always contribute to the team; to whom much is given, much will be required.
5. Respect your team. Never fight a fellow NLA boxer. Love and correct them. If there is an issue, squash it immediately.
6. Be credible. Tell the entire truth, never lie, and remain accountable for your actions. We will not steal. We will not do drugs.
7. No social media. We are internally driven; NLA's social media director ensures our values are never misrepresented.
8. Be a leader. Leaders outwork everyone in the room. In the absence of direction, NLA boxers lead and take action.
9. Keep your house orderly. Clean the gym daily, never neglect it or take it for granted; make improvements when needed and keep it secure.
10. We are not victims. Life is unfair, unforgiving and exhausting. Our past is our past. Resiliency is developed through challenging circumstances.`;

const OFFER_TOP5 = [
  "1. Free, year-round boxing and youth development five days a week — ages 7–19, Monday to Friday, 2:30–8:30 PM; one program in three groups (the Battle Team, the Non-Battle Team and the Littles), with Junior Boxing on Tuesdays as the door; boxing, fitness and strength training with mentorship and structure, at no cost to any youth or family",
  "2. A hot, family-style dinner every program night — the Meal Train, five nights a week after programming, cooked and served by donor families, businesses and community groups",
  "3. The Launch Pad — the after-high-school pipeline for 8th through 12th graders: four Pads (Military & Law Enforcement, College, Trade School, Workforce), a Pathway Coach and an Accountability Coach, placement only with employers who develop young leaders",
  "4. A structured daily rhythm with adults who show up — roll call, daily reflection, the training block, daily duties, dinner together; a steady, reliable presence five days a week through the most chaotic years of a young person's life",
  "5. Experiences beyond the gym — summer and weekend excursions (camping, kayaking, tubing, day trips across South Jersey, Philadelphia and the shore) and free transportation so a youth without a ride still comes every day",
].join("\n");

const PROGRAMS = [
  "NLA Boxing & Youth Development Program — one program, three groups, Monday–Friday 2:30–8:30 PM (see \"The program · three groups\"): the Battle Team (ages 14–19, contact, trains to compete, earned through the House Rules and core values), the Non-Battle Team (ages 14–19, non-contact boxing, strength and conditioning in two tracks) and the Littles (ages 7–13, boxing basics with body-weight, plyometric, endurance and flexibility training — no weights, by NLA policy; chosen from Junior Boxing)",
  "Junior Boxing — ages 7–10, Tuesdays: an hour of introductory boxing, then optional Juniors Aftercare and dinner; the entry point to the program and where the coaches find the Littles",
  "Juniors Aftercare — Tuesdays 6:00–7:00 PM for Junior Boxers: Smile Lab (oral health and hygiene, with Delta Dental) and Life Skills Lab (character and values)",
  "Meal Train — a hot dinner five nights a week during the school year, cooked and served by donor families, businesses and community groups",
  "Transportation — free rides to and from practice for youth in designated areas",
  "Summer Excursions — full-day experiences at partner venues across South Jersey, Philadelphia and the shore",
  "Strength & Conditioning — a structured lifting programme for the Battle Team and the Non-Battle Team",
  "Real Talk Sessions — influential adults share honest stories of struggle and perseverance",
  "Spiritual Development — reflection, values and purpose in a supportive, respectful setting",
  "The Launch Pad — the development pipeline for 8th through 12th graders, built so every young person leaves able to answer " +
  "\"What am I going to do after high school?\" A classroom environment designed around an introspective process that helps " +
  "each youth identify their strengths and align those gifts with a real, viable future. Each young person chooses one of four " +
  "Pads and gets a plan built around it: Military & Law Enforcement (ASVAB preparation, recruiter matching, readiness for " +
  "service); College (SAT prep, scholarship and financial-aid applications, housing and admissions support); Trade School " +
  "(application support through every phase); Workforce (direct placement within a growing network of local business owners " +
  "and organizations committed to developing young leaders). Two coaches walk with each youth: a Pathway Coach who helps them " +
  "discover their strengths and choose their Pad (42 years of business leadership across national beverage and food-service " +
  "brands; has hired and developed 388 employees) and an Accountability Coach — a retired NYPD lieutenant with 21 years " +
  "of service and 22 years teaching psychology as a college professor — who owns the follow-through so every test, " +
  "application and deadline is completed. Workforce Standard: youth are placed only with employers committed to developing " +
  "them as future leaders, owners and decision-makers — a leadership pipeline, not a labor pipeline. The Universal Curriculum " +
  "every Pad shares: professionalism (how to dress, present and carry yourself), work ethic (show up early, stay late, finish " +
  "the job), the value of starting at the bottom and earning your way up, communication, conduct and character, long-term " +
  "thinking and personal accountability. Beyond the sessions: guest speakers, mentorship, networking, résumés and " +
  "interviewing. A long-term model: youth graduate high school with a clear plan, the discipline to execute it, and a network " +
  "of mentors and partners ready to support them",
  "Coaching Boys into Men — the evidence-based violence-prevention programme, in partnership with Cape Assist",
  "Hawk Squad — after-school boxing and mentorship for Cape May County Technical High School students (Tuesdays and Thursdays)",
  "BAM (Body and Mind) — a Friday behavior-incentive programme with Cape May County Special Services, grades 5–12",
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

const OUTCOMES =
  "NLA keeps attendance for every program through kiosk check-ins, so youth served are counted unduplicated and " +
  "retention is measured night by night. The back end also records meals served, rides provided, Juniors Aftercare " +
  "session journals and standout moments, weigh-ins, strength and conditioning logs, and registration demographics " +
  "including household income and free or reduced lunch, from which the economically disadvantaged share is reported.";

export const ORG_SECTIONS: OrgSection[] = [
  {
    key: "served",
    title: "Who we serve",
    blurb: "The need and the youth: the statement of need, the service area, the target population. The year's approved paragraph carries the counts and shares.",
    snapshot: "who_we_served",
    fields: [
      { key: "counties", label: "Counties Served", kind: "short", required: true, seed: "Cape May County" },
      { key: "service_area", label: "Cities, Towns and Communities Served", kind: "long", required: true, seed: "Youth from across Cape May County, including more than 140 from Wildwood and Woodbine, two of the most economically distressed communities in New Jersey. By school district (CPF proposal, 2026): Middle Township 31.5%, Lower Township 18.7%, Wildwood 15.1%, Woodbine 13.1%, Cape May County Technical 6.9%, Avalon / Stone Harbor 1.3%, Ocean City 1.0%, Upper Township 0.7%, Cape May / West Cape May 0.7%, other districts and alternative settings 6.6%.", help: "From the CPF proposal. The youth map under Attendance shows the current spread; refresh the percentages when they change." },
      { key: "target_population", label: "Target Population", kind: "short", required: true, seed: "Youth and young adults ages 7–19 across Cape May County; 70% economically disadvantaged" },
      { key: "need", label: "Statement of Need", gist: "The county's hardship, where it concentrates (Wildwood, Woodbine), what the districts report, and why the after-school hours matter.", kind: "long", required: true, seed: NEED, help: "The community numbers behind every proposal's first question. From the CPF proposal; refresh the census and district figures yearly." },
    ],
  },
  {
    key: "program",
    title: "What we do · the program",
    blurb: "One program, three groups. The mission, Josh's program description, the values and rules, the services and the hours.",
    snapshot: "what_we_do",
    fields: [
      { key: "mission", label: "Mission Statement", gist: "Free, year-round, ages 7–19, Cape May County: boxing, mentorship and structure.", kind: "long", required: true, seed: MISSION },
      { key: "program_description", label: "Boxing Groups Explained", gist: "One program, three groups — the Littles, the Non-Battle Team and the Battle Team — with Junior Boxing on Tuesdays as the door. Josh's words, approved 2026-10-28.", kind: "long", required: true, seed: PROGRAM_DESCRIPTION, help: "One program, three groups: the Battle Team, the Non-Battle Team and the Littles, with Junior Boxing on Tuesdays as the door. Josh's words, approved word for word. The 40–120 a night and the 45/30/25 split are his figures until the January–February counts replace them." },
      { key: "boxing_teams_short", label: "Battle Team and Non-Battle Team · in four sentences", gist: "The two teams for ages 14–19, in a few lines, for a funder who wants the boxing program short.", kind: "long", required: true, seed: BOXING_TEAMS_SHORT, help: "Josh's words. The short way to say what the Battle Team and the Non-Battle Team are (ages 14–19) when a funder wants the boxing program in a few lines; the Littles are the third group and the full picture is \"The program · three groups\"." },
      { key: "battle_team_case", label: "The Battle Team Explained · the funding case", kind: "long", gist: "Josh's two paragraphs (2026-10-28): the battle between the ears, who earns the Battle Team and why it matters. Written for O.C.E.A.N. 2027 — the $75,000 ask is in the first paragraph.", help: "Your words, saved from the O.C.E.A.N. 2027 application. Reuse the second paragraph anywhere; change the ask and the funder's name for the next grant." },
      { key: "values_rules", label: "Core Values and House Rules", gist: "The seven values and the ten rules, word for word. The path onto the Battle Team runs through them.", kind: "long", required: true, seed: VALUES_AND_RULES, help: "The seven values and the ten rules, word for word from the website. The path to the Battle Team runs through these." },
      { key: "programs", label: "Programs and Services · the list", gist: "Every program and service NLA runs, one per line.", kind: "list", required: true, seed: PROGRAMS },
      { key: "offer_top5", label: "The Five Things NLA Offers", gist: "The spine of every brief program summary, in the website's order.", kind: "list", required: true, seed: OFFER_TOP5, help: "The spine of every brief program summary — a funding purpose, an overview, \"describe your program\". Grant Coach writes them in this order with the strongest live number behind each. Reorder or reword here and every draft follows." },
      { key: "schedule", label: "Hours and Calendar", gist: "The hours by season; year-round, never a 10-month program.", kind: "long", required: true, seed: SCHEDULE, help: "The hours by season. Never \"a 10-month after-school program\": NLA is year-round." },
      { key: "outcomes", label: "Outcomes and How We Measure", gist: "What the back end records and how youth served, retention and the disadvantaged share are counted.", kind: "long", required: true, seed: OUTCOMES, help: "What is measured and how. Drafts cite this when a funder asks for outcome measures and data tools." },
    ],
  },
  {
    key: "organization",
    title: "The organization",
    blurb: "NLA on paper — screen 1 of almost every application — and its story and facility.",
    snapshot: "organization",
    fields: [
      { key: "legal_name", label: "Legal name of organization", kind: "short", required: true, seed: "No Limits Academy Inc." },
      { key: "dba", label: "Doing business as (DBA / AKA)", kind: "short", required: true, seed: "No Limits Academy", help: "The site and the domain say No Limits Boxing Academy too; use what is registered." },
      { key: "ein", label: "Federal EIN", kind: "short", required: true, help: "On the IRS determination letter and the 990. Two digits, a dash, seven digits (XX-XXXXXXX); the dash is placed for you." },
      { key: "nonprofit_date", label: "Date of 501(c)(3) determination", kind: "date", required: true },
      { key: "fiscal_year", label: "Fiscal year", kind: "short", required: true, help: "e.g. January 1 – December 31" },
      { key: "year_established", label: "Year established", kind: "number", required: true, seed: "2020" },
      { key: "website", label: "Website", kind: "short", seed: "https://www.nolimitsboxingacademy.org" },
      { key: "phone", label: "Main phone", kind: "short" },
      { key: "address_physical", label: "Program address (the gym)", kind: "long", required: true, seed: "1086 Route 47 South, Rio Grande, NJ 08242", help: "From Our Story; confirm the ZIP." },
      { key: "address_mailing", label: "Mailing address of record", kind: "long", required: true, help: "Funders use this on the award. Repeat the gym address if they are the same." },
      { key: "story", label: "Our Story", gist: "Josh and Dave, 2020, the building on Route 47, and what NLA became.", kind: "long", required: true, seed: STORY },
      { key: "facility", label: "The Facility and the CPF Project", gist: "The 14,000-square-foot building and what the $300,000 CPF award is building.", kind: "long", seed: FACILITY, help: "The building, the hours, and what the $300,000 award is building. Update as the project is completed." },
    ],
  },
  {
    key: "capacity",
    title: "Capacity and partners",
    blurb: "Who leads, who the funder calls, who signs; the board, the staff, the partners, the letters and the recognition.",
    snapshot: "capacity",
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
      { key: "board", label: "Board of Directors", kind: "list", required: true, help: "One per line: name, role on the board, affiliation." },
      { key: "staffing", label: "Staffing", gist: "Two full-time staff, the part-time coaches, drivers, partners and CPA — said as efficiency.", kind: "long", required: true, seed: "No Limits Academy runs on two full-time employees — Josh Mercado, Program Director, and Chrissy Casiello, Program Coordinator — supported by part-time coaches, mentors and a volunteer network, on nearly $1 million in annual revenue. Josh leads programming and partnerships; Chrissy runs participant records, reporting, invoicing and day-to-day coordination. Every dollar funds youth, not overhead.", help: "Funders ask for staff roles, qualifications and supervision (O.C.E.A.N. narrative item 4). Two full-time staff on this revenue reads as efficiency — say it plainly. Add the coaches and volunteers by role." },
      { key: "staff_bios", label: "Staff Bios", gist: "A short paragraph each for the people funders will see named.", kind: "long", help: "A short paragraph each for Josh, Chrissy and the coaches funders will see named. Edit names and details here; the writer names roles exactly as written.", seed: "Josh Mercado, Program Director — former professional boxer, national collegiate champion and certified educator; leads programming, coaching and partnerships.\n\nChrissy Casiello, Program Coordinator — a former police detective; runs participant records, eligibility files, reporting, invoicing and day-to-day coordination. (Chrissy is not the Accountability Coach.)\n\nThe Launch Pad Pathway Coach — 42 years of business leadership across national beverage and food-service brands; has hired and developed 388 employees; helps each youth discover their strengths and choose their Pad.\n\nThe Launch Pad Accountability Coach — a retired NYPD lieutenant with 21 years of service and 22 years teaching psychology as a college professor; owns the follow-through so every test, application and deadline is completed." },
      { key: "partners", label: "Partners · who and what", gist: "Every partner and what each does with NLA, one per line.", kind: "list", required: true, seed: PARTNERS, help: "Funders ask about coordination and duplicated services; name who NLA works with and on what." },
      { key: "law_enforcement", label: "Law Enforcement Partners", kind: "long", gist: "Every department and what it does with NLA: Gym Buddies, Gloves Up for the Blue, Shop with a Cop, referrals, the Meal Train, the letters. Josh (2026-10-28): never undersell these.", help: "Name them by department. A funder asking about coordination, mentors, referrals or safety should read this list." },
      { key: "partner_quotes", label: "What Partners Say", gist: "Attributed lines from the letters of support, ready to quote.", kind: "list", seed: QUOTES, help: "Attributed lines from the letters of support. The writer quotes these where a funder asks about coordination, experience or effectiveness." },
      { key: "letters_support", label: "Letters of Support and MOUs", gist: "The eleven March 2026 letters, by organization and signer.", kind: "list", seed: LETTERS, help: "Who has written one (the March 2026 CPF packet is under Documents) and the agreements on file. Each can be asked for again for a new application." },
      { key: "awards", label: "Awards and Recognition", gist: "The honors, alphabetical, as the website lists them.", kind: "list", seed: AWARDS },
    ],
  },
  {
    key: "finances",
    title: "Finances",
    blurb: "The numbers behind the budget screens.",
    fields: [
      { key: "annual_budget", label: "Most recent approved annual operating budget ($)", kind: "number", required: true, help: "The board-approved figure. The brief says NLA runs on about $1M a year." },
      { key: "prior_revenue", label: "Prior fiscal year — total revenue ($)", kind: "number", seed: "932498", help: "2025 revenue, from the CPF proposal. Confirm against the 990." },
      { key: "revenue_history", label: "Annual Revenue History", kind: "list", seed: "2021 — $149,180\n2022 — $374,295\n2023 — $518,905\n2024 — $596,862\n2025 — $932,498", help: "From the CPF proposal. Funders read steady growth as capacity; add each year as it closes." },
      { key: "prior_expenses", label: "Prior fiscal year — total expenses ($)", kind: "number" },
      { key: "operating_deficit", label: "Operating deficit?", kind: "yesno", required: true },
      { key: "deficit_explanation", label: "If a Deficit: amount and explanation", kind: "long" },
      { key: "audit_status", label: "Audit or financial review", kind: "short", help: "Most recent audited statements or financial review, and the year." },
      { key: "form_990_year", label: "Most recent Form 990 — tax year", kind: "short", required: true },
      { key: "financial_position", label: "Financial Position · from the latest audit and 990", kind: "long", gist: "Revenue, surplus, cash, net assets, debt, the program share of spending and the audit opinion — the capacity answer, in one place.", help: "Refresh each year when the audit and the 990 arrive. Figures are from the audited statements unless the line says the 990." },
    ],
  },
  {
    key: "funding",
    title: "Funding history",
    blurb: "What NLA has received, and from whom — asked by every funder, especially a returning one — and what happens when a grant ends.",
    fields: [
      { key: "ocean_prior", label: "Previously received O.C.E.A.N. funding?", kind: "yesno", required: true, seed: "Yes" },
      { key: "ocean_program", label: "O.C.E.A.N. — program name funded", kind: "short", seed: "No Limits Academy's Youth Boxing Program" },
      { key: "ocean_amount", label: "O.C.E.A.N. — previous funding amount ($)", kind: "number", seed: "180000", help: "From the walk-through on 2026-10-15 — confirm." },
      { key: "past_grants", label: "Past Grants Received", gist: "Funding received, by funder, amount and year.", kind: "list", seed: "U.S. House Community Project Funding, FY2027 (Rep. Jeff Van Drew) — $300,000 — Facility Improvement and Youth Development Expansion Project — awarded 2026\nO.C.E.A.N., Inc. CSBG Partnership Program — $180,000 — youth boxing program (confirm amount and years)", help: "Optional. Foundations often ask for grants received in the last three years; awards logged in Grant Coach will add themselves here. Funding only — honors live under Awards and recognition." },
      { key: "other_funds", label: "Other Committed or Pending Program Funds", kind: "long", help: "Source, status (committed or pending) and amount." },
      { key: "sustainability", label: "Sustainability and Revenue Model", gist: "What keeps the program free when a grant ends: donors, events, fee-for-service districts, grants.", kind: "long", seed: "NLA keeps core after-school programming free for families through a diversified funding structure: community support, philanthropic contributions, and fee-for-service partnerships with local school districts (Cape May County Special Services, Cape May County Technical, Middle Township, Lower Cape May Regional, Wildwood and Woodbine) that provide a reliable revenue stream. Annual revenue has grown every year since 2021, from $149,180 to $932,498 in 2025. The CPF award protects the facility itself. Dave Von Savage's business training underpins the financial framework and long-term model.", help: "Every funder asks what happens when their grant ends. From the CPF proposal." },
    ],
  },
  {
    key: "voice",
    title: "How Grant Coach writes",
    blurb: "Not facts about NLA — instructions to the writer: the proposal it writes like, and the rules it learned from your edits.",
    fields: [
      { key: "writing_examples", label: "Writing Example · how NLA's proposals read", gist: "The CSBG narrative Josh is proud of. Grant Coach writes to match it.", kind: "long", seed: WRITING_EXAMPLES, help: "Grant Coach writes to match this. Paste in any proposal you are proud of; the more the better. Its figures are from their moment — drafts take counts from the live numbers." },
      { key: "corrections", label: "Josh's Corrections · rules Grant Coach learned", gist: "One rule per line, learned each time you changed an answer and approved it.", kind: "list", help: "Each time you change a Grant Coach answer and approve it, Grant Coach writes the lesson here, one per line, and every draft after follows it. Edit or delete any line; add your own." },
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

/**
 * An EIN is nine digits written XX-XXXXXXX (IRS). Typed any other way —
 * 84-399-8071 was saved once — portals that check the format reject it.
 * Anything that is not nine digits is left alone for a person to fix.
 */
export const formatEin = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 9 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : raw.trim();
};
