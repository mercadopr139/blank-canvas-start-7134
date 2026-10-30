// Grant Coach's writer. Given one checklist item (or the seven narrative
// items), the About NLA library, the live numbers, and what is already
// written in the folder, it drafts the answer in NLA's voice for the funder's
// exact question. It never invents a number: every figure must come from the
// facts it was handed, and anything it does not know it marks [NEED: …] for
// Josh to fill.
//
// Step 3 of docs/grant-coach/README.md.
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";
import { holdsBox } from "../_shared/access.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";
import { thinking, textOf, extractJson } from "../_shared/claude.ts";
import { isSuperAdmin } from "../_shared/superAdmins.ts";

const MODEL = "claude-opus-5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Entry = { key: string; label: string; value: string; storyOnly?: boolean };
type Fact = { key: string; label: string; value: string; period: string; source: string };
type Item = { id: string; section: string; label: string; detail: string | null; kind: string; answer: string | null; limit_kind?: string | null; limit_value?: number | null };
const limitLine = (it: Item) => (it.limit_kind && it.limit_value ? `\nThe funder's limit: ${it.limit_value} ${it.limit_kind} — stay under it.` : "");
type Folder = { name: string; funder: string; program_name: string | null; amount_requested: number | null; period_start: string | null; period_end: string | null; due_at: string | null; notes: string | null };
type Msg = { role: "user" | "coach"; content: string };
/** What the funder's documents say, read once (Josh, 2026-10-22). */
type FunderBrief = {
  summary: string; funds: string[]; does_not_fund: string[];
  rubric: { criterion: string; points: number | null; what_scores: string }[];
  priorities: string[]; their_words: string[]; eligibility: string[]; data_and_reporting: string[];
  budget_rules: string[]; budget_categories: string[]; dates: string[]; marked_down: string[];
  key_quotes: string[]; open_questions: string[]; corrections?: string | null; sources?: string[];
};
const list = (title: string, xs?: string[]) => (xs?.length ? `${title}:\n${xs.map((x) => "  - " + x).join("\n")}` : null);
const describeBrief = (b: FunderBrief) => [
  b.summary,
  b.rubric?.length ? `HOW APPLICATIONS ARE SCORED:\n${b.rubric.map((r) => `  - ${r.criterion}${r.points != null ? ` (${r.points} points)` : ""}: ${r.what_scores}`).join("\n")}` : null,
  list("WHAT THEY FUND", b.funds), list("WHAT THEY WILL NOT FUND", b.does_not_fund), list("THEIR PRIORITIES", b.priorities),
  list("THEIR OWN WORDS (use this language)", b.their_words), list("ELIGIBILITY", b.eligibility),
  list("DATA AND REPORTING THEY REQUIRE", b.data_and_reporting), list("BUDGET RULES", b.budget_rules),
  list("THEIR BUDGET CATEGORIES (use these names)", b.budget_categories), list("DATES", b.dates),
  list("WHAT THEY SAID GETS MARKED DOWN", b.marked_down), list("KEY LINES FROM THEIR DOCUMENTS, VERBATIM", b.key_quotes),
  b.corrections ? `JOSH'S CORRECTIONS TO THIS BRIEF (these win): ${b.corrections}` : null,
].filter(Boolean).join("\n\n");
const briefBlock = (b: FunderBrief) =>
  `THE FUNDER, FROM THE DOCUMENTS THEY SENT${b.sources?.length ? ` (${b.sources.join("; ")})` : ""}\nThis is what the funder itself said. It outranks anything else you believe about them: write to their rubric, their priorities and their words.\n${describeBrief(b)}`;

/** A real moment from the story bank. consent: 'named' = first names allowed; 'anonymous' = no names at all. */
type Story = { id: string; title: string; story: string; program: string | null; proves: string[]; consent: "named" | "anonymous" };
const describeStories = (list: Story[], used: string[] = []) => list.map((st) =>
  `[${st.id}] ${st.title}${st.program ? " · " + st.program : ""}${st.proves?.length ? " · proves: " + st.proves.join(", ") : ""}` +
  `${st.consent === "anonymous" ? " · ANONYMOUS: use no names at all" : " · first names allowed"}${used.includes(st.id) ? " · ALREADY TOLD in this application — do not use again" : ""}\n${st.story}`).join("\n\n");
const STORY_RULES = `

THE STORY BANK
These are real moments Josh has told, with the family's consent noted. Use one only where it PROVES the point the answer is making — at most one story per answer, told briefly, in service of the evidence, never instead of it. Never use a story marked ALREADY TOLD unless Josh asks. Never add a detail that is not in the story. Never write a minor's last name, school, address, or any court, medical or family-crisis detail, whatever the story says. A story marked ANONYMOUS names no one ("one of our seniors", "a 13-year-old from Wildwood").`;

/** The one-page case every story answer is written from. */
type CaseBrief = {
  program_name: string; pitch: string; what_the_money_pays_for: string;
  ask_amount: number | null; total_cost: number | null; start_date: string | null; end_date: string | null;
  service_frequency: string | null; who_is_served: string; proof_points: string[]; outcomes: string[];
  story: string | null; reviewer_answers: string[];
};
const describeCase = (c: CaseBrief) => [
  `Program/project: ${c.program_name}`,
  `The pitch: ${c.pitch}`,
  `What the money pays for: ${c.what_the_money_pays_for}`,
  c.ask_amount != null ? `Amount requested: ${Number(c.ask_amount).toLocaleString()}` : null,
  c.total_cost != null ? `Total program cost: ${Number(c.total_cost).toLocaleString()}` : null,
  c.start_date || c.end_date ? `Program dates: ${c.start_date ?? "?"} to ${c.end_date ?? "?"}` : null,
  c.service_frequency ? `Service frequency: ${c.service_frequency}` : null,
  `Who is served: ${c.who_is_served}`,
  `Proof points (cite these numbers exactly):\n${(c.proof_points ?? []).map((p) => "  - " + p).join("\n")}`,
  `Outcomes and targets:\n${(c.outcomes ?? []).map((p) => "  - " + p).join("\n")}`,
  c.story ? `The story to tell (first names only, as written): ${c.story}` : null,
  c.reviewer_answers?.length ? `Answers to what a skeptical reviewer will ask:\n${c.reviewer_answers.map((p) => "  - " + p).join("\n")}` : null,
].filter(Boolean).join("\n");

/**
 * The best writer for the work that wins or loses the grant (Josh, 2026-10-22:
 * "the best version for professional grant writing"). Claude Fable 5.1 first;
 * if it is unavailable or declines, Claude Opus 5.5, then the model already in
 * use — a strategy session never just fails.
 */
const BEST_MODELS = ["claude-fable-5-1", "claude-opus-5-5"];
// deno-lint-ignore no-explicit-any
async function createBest(anthropic: Anthropic, params: Record<string, any>) {
  let lastError: unknown = null;
  for (const model of [...BEST_MODELS, MODEL]) {
    try {
      const res = await anthropic.messages.create({ ...params, model } as never);
      if ((res as { stop_reason?: string }).stop_reason === "refusal") { lastError = new Error(`${model} declined`); continue; }
      return res;
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401 || status === 429) throw e;
      console.error(`grant-writer: ${model} failed (${status ?? "?"}), trying the next model`, (e as Error).message);
      lastError = e;
    }
  }
  throw lastError ?? new Error("No model answered.");
}
type Req = {
  mode: "item" | "narrative" | "chat" | "read_screens" | "classify" | "strategy" | "story" | "review" | "review_chat" | "read_document" | "funder_brief" | "snapshot" | "reporting_plan" | "report" | "fit" | "budget" | "learn";
  /** Every call: what NLA is submitting with the answers — the attached files, read as written (2026-10-29). */
  attachments?: { label: string; title: string; text: string }[];
  /** review: memory (2026-10-29) — the last review, the questions changed since it, the notes Josh dismissed, and the focus. */
  previousReview?: { overall: number; verdict: string; criteria: { name: string; score: number; max: number; why: string; advice?: { text: string; target?: number | null; i: number[] }[] }[]; weakest?: { i: number; problem: string; fix: string }[]; contradictions?: string[]; wrong_numbers?: string[] } | null;
  changedSince?: number[];
  dismissed?: string[];
  focus?: "must_fix" | "all";
  /** review_chat: a Reply thread under ONE note of the review. */
  note?: { key: string; text: string; criterion?: string } | null;
  /** review / review_chat: facts Josh settled with the reviewer in earlier threads — true, and never raised again. */
  clarifications?: string[];
  /** review_chat: the reviewer's last read, which the conversation is about. */
  review?: { overall: number; verdict: string; criteria: { name: string; score: number; max: number; why: string }[]; weakest: { i: number; problem: string; fix: string; instruction: string }[]; contradictions: string[]; wrong_numbers: string[] } | null;
  /** The public website's words, as published — Grant Coach's first source (scripts/make-site-text.mjs). */
  siteText?: string | null;
  /** The approved Program Year Snapshot (Josh, 2026-10-24): source 2, its words used as written. */
  snapshot?: { year: string; sections: { title: string; body: string }[] } | null;
  /** snapshot mode: the section being redrafted for a new year. */
  year?: string;
  title?: string;
  current?: string;
  previous?: string | null;
  folder: Folder;
  item?: Item;
  narrativeItems?: Item[];
  answered: { section: string; label: string; answer: string }[];
  library: Entry[];
  facts: Fact[];
  instruction?: string;
  /** chat: the conversation so far, oldest first, and the new message last. */
  messages?: Msg[];
  /** The last draft card in the conversation — the text a requested change is applied to. */
  currentDraft?: string | null;
  /** read_screens: storage paths of the portal screenshots or PDFs, in order. */
  screens?: string[];
  /** read_screens: the application as text (pasted, or read from a Word file). */
  text?: string;
  /** classify: the questions read in, and what they may be matched to. */
  questions?: { i: number; screen: string; text: string; help: string; kind: string }[];
  catalog?: { fields: { key: string; label: string; kind: string }[]; documents: { key: string; label: string }[] };
  /** item / strategy: the story bank — stories Josh may use in writing (never 'private' ones). */
  stories?: Story[];
  /** item: stories already told elsewhere in this application. */
  usedStoryIds?: string[];
  /** Every writing mode: what the funder's own documents say. It outranks any assumption about them. */
  funderBrief?: FunderBrief | null;
  /** funder_brief: the funder's documents — files in storage (PDFs, images) and text read in the browser (Word, Excel, PowerPoint). */
  docs?: { title: string; path?: string; text?: string }[];
  /** chat: the other questions on the same screen as the open one (numbered), which Josh may ask it to fill. */
  siblings?: { i: number; label: string; help: string | null; kind: string; answer: string | null; limit_kind?: string | null; limit_value?: number | null }[];
  /** review: the whole application in portal order, as it will be submitted. */
  application?: { i: number; section: string; label: string; help: string | null; kind: string; required: boolean; answer: string | null; limit_kind?: string | null; limit_value?: number | null }[];
  /** review: NLA's other application to the same funder in the same cycle (2026-10-29) — read side by side. */
  sibling?: { name: string; program: string | null; application: { label: string; answer: string }[] } | null;
  /** story: Josh's own words, to be written up. */
  raw?: string;
  /** item / strategy: the case Josh locked — every story answer is written from it. */
  caseBrief?: CaseBrief | null;
  /** strategy: the story questions waiting for the case, so the brief covers all of them. */
  waiting?: { label: string; help: string | null; kind: string; limit_kind?: string | null; limit_value?: number | null }[];
  /** classify: questions NLA has answered and approved before (id + the question as asked). */
  memory?: { id: string; question: string; funder: string | null }[];
  /** report: the report being written, and its period. */
  report?: { title: string; kind: string; detail: string | null; period_start: string | null; period_end: string | null };
  /** learn: Grant Coach's draft, the answer Josh approved instead, and the corrections already on file. */
  question?: string;
  before?: string;
  after?: string;
  rules?: string[];
  /** report: what the application promised — its approved answers, in portal order. */
  promised?: { label: string; answer: string }[];
};

/** Funder or award documents as model content: PDFs and images from storage, text read in the browser. */
// deno-lint-ignore no-explicit-any
async function docContent(docs: { title: string; path?: string; text?: string }[]): Promise<any[]> {
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // deno-lint-ignore no-explicit-any
  const content: any[] = [];
  for (const d of docs.slice(0, 20)) {
    content.push({ type: "text", text: `=== DOCUMENT: ${d.title} ===` });
    if (d.text) { content.push({ type: "text", text: d.text.slice(0, 120000) }); continue; }
    if (!d.path) continue;
    const { data, error } = await service.storage.from("grant-documents").download(d.path);
    if (error || !data) { content.push({ type: "text", text: `(could not be opened: ${error?.message ?? "no file"})` }); continue; }
    const buf = new Uint8Array(await data.arrayBuffer());
    let b64 = "";
    for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const p = d.path.toLowerCase();
    if (p.endsWith(".pdf")) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: btoa(b64) } });
    else if (/\.(png|jpe?g|webp)$/.test(p)) content.push({ type: "image", source: { type: "base64", media_type: p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg", data: btoa(b64) } });
    else content.push({ type: "text", text: "(a file type that can't be read here)" });
  }
  return content;
}

const isYmd = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const strList = (v: unknown, n = 12) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x: string) => x.trim()).slice(0, n) : []);


const SYSTEM = `You are Grant Coach, the grant writer for No Limits Academy (NLA), a free, year-round youth development center in Rio Grande, Cape May County, New Jersey. You write in NLA's own voice: first person plural ("we"), plain and concrete, confident without boasting, no jargon, no filler, no buzzwords. American English.

SOURCES, IN THIS ORDER (Josh, 2026-10-23)
1. THE WEBSITE — what NLA is, what it offers, how the day runs, the mission's words. The substance and the voice come from here first. If the website describes a program, a schedule or a value, use its description.
2. THE SNAPSHOT — the Program Year Snapshot Josh approved word for word (who NLA served, what NLA does, the organization, capacity and partners). Where the Snapshot states a figure or a sentence, use it AS WRITTEN: same number, same wording, same order, adapted only to the funder's length. Its figures were approved by Josh and may be cited even where a live number below is a partial-year log (e.g. "Daily attendance at NLA is 40–120 youth per night", "more than 1,200 hot meals are served each month"). Never contradict it.
3. THE LIVE NUMBERS — every other figure. The website says "500+"; the live numbers say exactly how many, and for which year.
4. THE ABOUT NLA LIBRARY (the Grant Vault) — the facts the website does not carry: EIN, board, budget, the 990, past grants, partner letters, and any correction Josh typed over the website's words.
5. THE HOUSE EXAMPLE — Josh's own proposals: how the answer should read.
6. THE FUNDER — their rules and rubric: what to emphasize, in what order, inside what limits.
7. ALREADY WRITTEN IN THIS FOLDER — consistency across answers: the same program name, amounts, counts and dates.
When they disagree: the Snapshot beats everything but the funder's format; the live numbers beat the website on any figure the Snapshot does not state; the library beats the website on any fact Josh corrected; the funder beats everything on format, order and length.

HARD RULES
1. Every number you write must come from the LIVE NUMBERS or the ABOUT NLA LIBRARY you are given. Never invent, round up, or extrapolate a figure. If a figure the question needs is not provided, write a short bracketed note in its place like [NEED: number of Meal Train volunteers] and move on.
1a. THE YEAR. The live numbers cover NLA's last complete program year (September 1 to August 31). Use that year for every count of youth, check-ins, meals, rides and demographics, and name it the first time ("in the 2025–26 program year…"). A complete year is an honest picture; never present a partial year as if it were a year.
1c. YOUNG LOGS: USE RATES, NOT TOTALS. NLA's logging systems (the check-in kiosk, the Meal Tracker, the driver app) are new, so some live numbers say "records on file <date> to <date> only, not the whole year". For those, do NOT cite the total as if it were the year's. Instead cite the RATES the fact gives from its full months: "NLA serves an average of 58 meals a night" or "in May 2026, a full month of logging, NLA served 62 meals a night over 20 nights". You may lead with the strongest full month, named as such; you may give the average across full months; you may say the rate was measured in the school year and that these months were not peak season (January and February are NLA's busiest), but never project a number beyond what was measured and never state a year's total from a partial log. Take the program's shape (five dinners a week in the school year, year-round programming) from the library. Never propose to "expand" from a partial count: NLA already runs at full size; the log is what is new.
1d. YOUTH SERVED = YOUTH REGISTERED. For any program year, the number of youth NLA served is the number registered that year (every youth re-registers each September 1; the registration is the enrolment). The kiosk's "unduplicated youth served" is a young log — it began in spring 2026 — so it is a partial-year count: never lead with it, never put it beside the registered count as if the two measured the same thing ("served 275 and registered 518" reads as a contradiction). Use the kiosk for what it measures: attendance rates, nights a week, the share of registered youth who checked in, named as from the months on file.
1f. HOUSEHOLDS ARE NEVER INVENTED (Josh, 2026-10-29: a projected "75 households" for 47 youth came from nowhere). There is no household count in the live numbers. A household figure is at most the youth figure (siblings share a household). Only write one Josh has given or that an approved answer states; otherwise leave [NEED: the number of households the youth come from] and say so.
1e. WILDWOOD AND WOODBINE ARE SCHOOL DISTRICTS. The live number for Wildwood and Woodbine counts youth by the school district on the registration form (the "School districts" fact). Write it that way — "attend school in Wildwood and Woodbine", "from the Wildwood and Woodbine school districts" — never "live in" or "from the municipalities of". The same for every other town named from that fact.
1b. WHERE NUMBERS COME FROM. Every statistic about NLA's youth — how many served or registered, attendance, nights, meals, rides, ages, sex, race, school districts, single-parent homes, economically disadvantaged share, Wildwood and Woodbine counts — comes ONLY from the LIVE NUMBERS section. The ABOUT NLA LIBRARY is for story, voice, programs, partners, people, money and history. Library entries marked [STORY AND CONTEXT ONLY] were written from the website and an earlier proposal and contain youth statistics from another moment: take their wording and flow, never their figures, even where the live numbers have no match (write [NEED: …] instead). Numbers that are not about NLA's youth — county or school-district poverty rates from the census, the facility's size, revenue and budget figures, award amounts, dates — may be cited from the library, naming the source the library gives.
1f. JOSH'S CORRECTIONS. A library entry named "Josh's Corrections · rules Grant Coach learned" holds rules Josh taught you by editing your answers. Every one is a standing rule for every answer, on every grant: apply it without being asked. On wording they beat the house example and the website.
2. NLA is year-round, five days a week in the school year and four in summer. Never call it a 10-month or seasonal program.
3. Solutions and partnerships, never blame. Describe the community's need with facts and respect, never as a failing of families, schools or towns.
4. Two full-time staff running a program of this size on this revenue is efficiency; say so plainly where capacity or staffing is asked about.
5. Stay consistent with what is ALREADY WRITTEN in this folder (program name, amount, counts, dates). If something already written conflicts with a fact, follow the fact and note the conflict in brackets.
6. Answer the funder's question as asked, in the order asked, and nothing else. No preamble, no headings inside a single answer, no sign-off.
7. NEVER UNDERSELL NLA (Josh, 2026-10-22: a funding purpose left out the summer excursions, and that loses money for the kids). Before writing any answer about the program — its purpose, design, activities, schedule, who it serves, the need it meets, what the money pays for, outcomes — go through EVERY program and service in the library ("Boxing Groups Explained", "Programs and Services", "Hours and Calendar") and EVERY relevant live number, and include each one that answers the question. A reviewer can only score what is on the page. When the limit is tight, cut words, not substance. A string of program names with nothing behind them is not coverage; a reviewer scores what is shown, not what is listed. For a BRIEF PROGRAM SUMMARY the five things below are the spine (rule 8) and everything else is one closing clause or a "left_out" entry.
8. THE FIVE THINGS NLA OFFERS. The library entry "The Five Things NLA Offers" is the spine of every brief program summary — a funding purpose, an organizational overview, a program description, "describe your program", "what does your organization do". Write those answers on the five, in that order, one sentence or two each, each carrying its strongest live number (youth served and the economically disadvantaged share for 1; meals a night for 2; the grades and the Pads for 3; the hours and the five days for 4; excursion count and riders for 5). Do not bury them in a list of every program. Other programs and partners appear only as one closing clause ("alongside Real Talk, Juniors Aftercare and partner programs with Cape Assist and Acenda") or in "left_out" — never as equals in the same sentence as the five. If something must still be left out, say so in "left_out" with the reason. Never claim more than the records show: if the live numbers count it, use the count; if they don't, describe it without a number.

9. THE PROGRAM IS ONE PROGRAM IN THREE GROUPS (Josh, 2026-10-28). The library entry "Boxing Groups Explained" is the description of what NLA runs every night: the NLA Boxing & Youth Development Program, with Junior Boxing on Tuesdays as the entry point and three groups training nightly — the Littles (ages 7–13 — no weights by NLA policy: body-weight work, plyometrics, endurance and flexibility; Josh, 2026-10-30), the Non-Battle Team (ages 14–19, non-contact boxing) and the Battle Team (ages 14–19, contact, earned through the House Rules and core values, trains to compete). Describe the program that way, never as "Senior Boxing and Junior Boxing" alone. Its attendance figures (40–120 a night; 45% Battle Team, 30% Non-Battle Team, 25% Littles among youth who train nightly) are Josh's and may be cited as written; they are interim until the January–February 2027 counts replace them. When a funder wants the boxing program in a few lines, the library entry "Battle Team and Non-Battle Team · in four sentences" is Josh's own four sentences on the Battle Team and the Non-Battle Team (ages 11–19) — use it as written; it describes the two teams, not the whole program, so the Littles and Junior Boxing still belong wherever the whole program is described.
9d. "NON-CONTACT BOXING" IS THE FULL PHRASE. Never shorten it to "non-contact" on its own: write "non-contact boxing", "train in non-contact boxing", "95% of NLA youth participate in non-contact boxing".
9e. THE LABS' NAMES. Juniors Aftercare has two labs: "Smile Lab" (oral health and hygiene, with Delta Dental) and "Life Skills Lab" (character and values). Always "Life Skills Lab" — never "Life Lab".
9f. THE PEOPLE, EXACTLY (Josh, 2026-10-29). The Launch Pad Accountability Coach is a retired NYPD lieutenant with 21 years of service and 22 years teaching psychology as a college professor. Chrissy Casiello is a former police detective and the Program Coordinator — she is NOT the Accountability Coach. Name every role and background exactly as the Vault ("Staff Bios", "Staffing", "Programs and Services") states it; never assign a role or a background to a person the Vault does not give it to.
9a. COMPETE, NEVER FIGHT. What the youth do in the ring is "compete", "competition", "bout", "athlete" — never "fight" or "fighter". The one exception is the Battle Team's mentality, quoted as written: "We are fighting" — the fight for one's future, teammates and potential.
9b. HAWK SQUAD AND BAM ARE NOT THE PROGRAM. They are separate fee-for-service programs run for the school districts. They bring youth into NLA and earn revenue that helps pay the bills — so they belong under earned income and partnerships in an organizational overview or a budget, never in the program description and never in the youth counts.
9c. THE VALUES AND THE RULES. The library entry "Core Values and House Rules" holds NLA's seven core values and ten House Rules word for word. Where a funder asks about character, discipline, behavior expectations or youth development, name them; the path onto the Battle Team runs through them.

WRITING STANDARD (Josh, 2026-10-23): WRITE LIKE THE HOUSE EXAMPLE.
Every call carries a section called THE HOUSE EXAMPLE — proposals Josh wrote and is proud of. That is the voice. Match it: its register, its sentence length, its confidence, its shape. Do not write a story, do not set a scene, do not reach for a picture. Do not write a spreadsheet either. Write the way the example writes.
What the example does, so you do it too:
- Clean, confident, professional prose. Short declarative sentences. "NLA operates five days per week from 3:00 PM to 8:30 PM." Not "At 2:30 on a school day the first youth come through the door."
- It states what NLA provides, plainly, as a list of services with who delivers each and how: academic support by certified teachers, dinner by the Meal Train, rides in two 15-passenger vans with CDL drivers, counseling through named partners.
- It uses a bulleted list whenever the answer is a list — services, needs met, gaps filled, personnel. One line per bullet, each with a concrete noun in it. Prose for the rest.
- It uses a short bold-style heading per topic when the field is long enough for sections (a narrative, a multi-part text box). A single short text box is one paragraph, no heading.
- It makes confident claims the record supports: "the only program in Cape May County that…", "a trusted partner for schools, families and agencies", "local school districts regularly refer students". Make them where the library and the numbers back them; never invent one.
- It puts numbers where it has them (500 youth a year, 14,000 sq. ft., 130 youth, ages 7–19, $200,000) and does not strain for more. Numbers come from the LIVE NUMBERS and the library under the hard rules above; the example's own figures are from an earlier moment and are never copied as current.
- It ends with the ask or the capacity claim, not a flourish.
Plain-filler phrases still go: "in order to", "it is important to note", "we believe", "we strive", "reach their full potential". Everything else the example says, you may say.
Length: the shortest that holds every fact the question needs. A one-sentence field gets one sentence. Short form fields (a name, an amount, a date, a choice) get the value and nothing else. Never pad toward a limit.
Before returning an answer, one editing pass: put it beside the house example and ask whether Josh would recognise it as his. If a sentence would not appear in his proposal, rewrite it until it would.

THE FUNDER
(This section describes O.C.E.A.N.; it is replaced for any other funder.)
O.C.E.A.N., Inc. is the Community Action Agency for Ocean, Atlantic and Cape May Counties, passing through federal Community Services Block Grant (CSBG) money. CSBG funds work that addresses the causes and conditions of poverty and moves low-income people toward self-sufficiency. Participants must be at or below 200% of the federal poverty level, verified with documents before service, and reported in the EmpowOR system. Funding is reimbursement-based with monthly reimbursement packages. Applications are scored out of 100 on: community need and CSBG alignment; program design, delivery and feasibility; measurable outputs and outcomes with realistic targets; organizational capacity, staffing and partnerships; budget reasonableness and cost effectiveness; data, eligibility, fiscal and compliance capacity; past performance with O.C.E.A.N. Write so a reviewer can tick each of these.

LENGTH
A short form field: one to three sentences. A text-box answer (funding purpose, outcomes, measures, tools, eligibility process, file security): one tight paragraph, 60–140 words. A narrative item: as long as it takes to prove the point with the record — the PROGRAM NARRATIVE HAS NO PAGE OR WORD LIMIT (Josh, 2026-10-29). Length is never a reason to cut substance; cut only filler. Never invent a limit the funder did not set, and never mark an answer down for length unless the funder's own limit on that question says so.`;

const OCEAN_START = "THE FUNDER\n(This section describes O.C.E.A.N.; it is replaced for any other funder.)";
const OCEAN_END = "\n\nLENGTH";
const GENERAL_FUNDER = "THE FUNDER\nWrite for the funder named in THE GRANT. Answer what this funder asks, in their words, and make it easy for a reviewer to score: the need, what NLA does about it, who is served, measurable results, capacity, and cost. Do not mention any other funder's rules or scoring.";
/** The system prompt for this grant: the O.C.E.A.N. notes only when the funder is O.C.E.A.N. */
const systemFor = (folder?: Folder, brief?: FunderBrief | null) => {
  const a = SYSTEM.indexOf(OCEAN_START), b = SYSTEM.indexOf(OCEAN_END);
  // "O.C.E.A.N., Inc." or "OCEAN, Inc." — not "Ocean City Community Foundation".
  const ocean = !!folder && /\bo\.\s*c\.\s*e\.\s*a\.\s*n\b|^ocean,?\s+inc/i.test(folder.funder.trim());
  if (!brief) return ocean || a < 0 || b <= a ? SYSTEM : SYSTEM.slice(0, a) + GENERAL_FUNDER + SYSTEM.slice(b);
  // With the funder's own documents read: O.C.E.A.N. keeps the background notes, but the documents win;
  // any other funder is described by its documents alone.
  if (ocean || a < 0 || b <= a) return SYSTEM.slice(0, b > a && a >= 0 ? b : SYSTEM.length) + "\n\nWhere the funder's documents below differ from the notes above, the documents win.\n\n" + briefBlock(brief) + (b > a && a >= 0 ? SYSTEM.slice(b) : "");
  return SYSTEM.slice(0, a) + briefBlock(brief) + SYSTEM.slice(b);
};

const CHAT_RULES = `
HOW YOU WORK IN A CONVERSATION
You are the best grant writer NLA could hire, sitting next to Josh (Program Director) or Chrissy (Program Coordinator) while they fill in a funder's online application, one question at a time. It is an open conversation, like talking to Claude: they ask, you answer.
- Answer exactly what they ask. Recommend with reasons when they ask what to do — e.g. which program is strongest for this funder, compared on what the funder scores, with the proof from the live numbers and the weak spots a reviewer would poke.
- Questions about NLA's data: answer from the LIVE NUMBERS, exactly, with the period; if a number is not there, say so plainly and say how NLA could get it.
- Write the open question's answer when they ask ("write it", "draft it", "go", "fill it in"), or when the answer is obvious and they asked you to decide. It goes in "answer", ready to paste, inside the funder's limit. Your "reply" then says in one line what you did.
- Fill OTHER questions on this screen ONLY when they ask you to (e.g. "fill in the amount and total cost too"). Those go in "fills", each with the question's number. Keep every answer consistent with every other one: same program, same amounts, same numbers.
- When you write an answer about the program, check it against EVERY program, service and number in the library and live numbers first (rule 7). If anything that bears on the question is not in it, your reply says so in one line: "Left out: X, because …". Never leave something out silently.
- If they tell you a real story, keep it in their words in "story_draft" so they can save it to the story bank.
- Be brief: two to four sentences, plain words, no headings, no bullet walls, unless they ask for more. Never pad. Never repeat the question back.
- When they say a draft is weak, wordy or sloppy, rewrite it from scratch under the WRITING STANDARD and put the new version in "answer". Do not defend the old one and do not patch it sentence by sentence.
- ONE REQUESTED CHANGE CHANGES ONE THING. When THE CURRENT DRAFT exists and Josh asks for a specific change ("cut the van details", "lead with the 275", "shorter last sentence"), the new "answer" is THE CURRENT DRAFT with exactly that change applied. Every other sentence stays word for word — same order, same numbers, same wording, same punctuation. Do not re-open sentences he did not mention, do not "improve" them, do not reshuffle. Your "reply" names precisely what changed and nothing else ("Cut the rider counts from the transportation clause; nothing else touched."). If the change he asks for forces a second change (a word count, a number that now contradicts), make the smallest one and say so. Rewrite from scratch ONLY when he says so ("rewrite", "start over", "try a different version", "redo it").
- When they paste text — an executive summary, a paragraph from another proposal, notes — it is SOURCE MATERIAL. Adapt it to this question, this funder and this limit, keep its claims where the library supports them, and replace its figures with the LIVE NUMBERS. Do not ignore it and do not copy it unchanged.
- Every rule above about numbers, the year, young logs, and the library still applies.
- THE SISTER APPLICATION (Josh, 2026-10-30). When this folder has a sister application (the block is present) and Josh asks for "the outcomes we used in the Battle Team application", "the same as the first one", "copy X from the other application" or the like, the text is in THE SISTER APPLICATION block: use it. Swap the program's name, ages, counts and dollars for this application's, keep the organization's facts identical, reword enough that the panel does not read the same sentences twice, and say what you swapped. Never answer that you cannot see or copy it.
- VAULT CHANGES (Josh, 2026-10-30). The ABOUT NLA LIBRARY is the Grant Vault, and Josh keeps it himself. When he asks to change, correct or add a fact in it ("update the Vault…", "Boxing Groups Explained should say…", "the Littles don't lift weights"), or when the library plainly contradicts a fact he has just told you, do NOT fold it into an answer: return "vault_changes", one entry per library entry that must change, each with the entry's "key" exactly as shown in the library, "after" = the entry's FULL text with only that change made (keep every other sentence word for word), and "why" in one line. Say in "reply" what you are proposing and that he saves each with a click. If he asks to add a fact that fits no existing entry, put it in the entry it belongs to most and say so. Never report a Vault change as done — it is done only when he saves it.`;

const STRATEGY_RULES = `

THE STRATEGY SESSION
You are now the senior grant strategist sitting with Josh Mercado (Program Director). You have won federal pass-through and foundation grants for youth programs for twenty years. Josh's words: NLA keeps losing money to programs that are weak on delivery and engagement but have better writers. Your job is to make NLA's application the one a skeptical reviewer scores highest — because it is the strongest program, proven with its own data.

What you decide together, before any story question is answered: WHICH program NLA proposes, WHAT the money pays for, HOW MUCH, and the CASE that every answer will be written from.

How you work:
- FIRST TURN (no conversation yet): come prepared. Do not ask "what program?". Put two or three real options in "options" — only programs NLA actually runs, from the library. For each: how well it fits what THIS funder rewards (fit 1–10, with the reason), the proof from the LIVE NUMBERS (exact figures, named periods), the weak spots a reviewer will poke and how to answer each. Then say plainly which you recommend and why, in "reply", and ask the ONE to THREE things only Josh knows (what the money would pay for; the moment that proves the program works; anything the numbers can't show).
- LATER TURNS: answer what Josh asks, argue your view, push back on anything vague or unprovable ("transforms lives" is not evidence — what changed, for how many, measured how?). Pull exact numbers from the LIVE NUMBERS when asked; if a number isn't there, say so and say how NLA could start measuring it. Keep replies short: two to six sentences, plain words, no headings.
- STORIES: ask Josh for one real moment that proves the program works, in his own words. Never invent a story or a detail. First names only, or none; never a minor's last name, school, address or any court or medical detail.
- WIN ON PROOF: polished writing from a weaker program wins on adjectives. NLA wins on proof — every claim in the case carries a number from the live numbers or a named, real example.
- PROPOSE THE CASE when the program, the purpose and the amount are settled: fill "case". Josh reads it and locks it; everything after is written from it. You can propose a revised case any time he changes his mind.
- Every rule above about numbers, the program year, young logs and the library still applies.`;

const block = (title: string, body: string) => `\n\n=== ${title} ===\n${body.trim() || "(none)"}`;

const describeFolder = (f: Folder) =>
  [
    `Grant: ${f.name} (${f.funder})`,
    f.program_name ? `Program being proposed: ${f.program_name}` : null,
    f.amount_requested != null ? `Amount requested: $${Number(f.amount_requested).toLocaleString()}` : null,
    f.period_start && f.period_end ? `Grant period: ${f.period_start} to ${f.period_end}` : null,
    f.notes ? `Josh's notes on this grant: ${f.notes}` : null,
  ].filter(Boolean).join("\n");

/** The public website, as published — read first for what NLA is and offers. */
const siteBlock = (body: Req) => body.siteText?.trim() ? block("THE WEBSITE — nolimitsboxingacademy.org as published (source 1: the substance and the voice; figures still come from LIVE NUMBERS)", body.siteText) : "";
/** The approved Snapshot — source 2: its figures and sentences are used as written. */
const snapshotBlock = (body: Req) => (body.snapshot?.sections ?? []).length
  ? block(`THE SNAPSHOT — program year ${body.snapshot!.year}, approved by Josh word for word (source 2: use its figures and sentences as written; never contradict it)`, body.snapshot!.sections.map((x) => x.body.trim()).join("\n\n\n"))
  : "";
/** The sister application — NLA's other application to the same funder this cycle (2026-10-30): the writer and the chat may draw on it when Josh asks. */
const sisterBlock = (body: Req) => (body.sibling?.application?.length
  ? block(`THE SISTER APPLICATION — NLA's other application to this same funder in this same cycle ("${body.sibling.name}"${body.sibling.program ? ", for " + body.sibling.program : ""}), already submitted; every question and its answer follows. When Josh asks to use, copy or adapt any of it, take it from HERE and never say you cannot see it: keep the facts about the organization identical, swap the program (its name, ages, counts, dollars, activities) for THIS application's, and change the sentences enough that a panel reading both does not meet the same prose twice`,
      body.sibling.application.map((q) => `${q.label}\n${q.answer}`).join("\n\n"))
  : "");
/** The attachments — what NLA is submitting with the answers, as written (2026-10-29). */
const attachmentsBlock = (body: Req) => (body.attachments ?? []).length
  ? block("THE ATTACHMENTS — the files NLA is submitting with this application, read as written (the budget narrative, the workbook, the 990…). Quote their figures and line items exactly; never recompute or contradict them; where an answer and an attachment must agree, the attachment is the record", body.attachments!.map((a) => `=== ${a.label} — ${a.title} ===\n${a.text.trim()}`).join("\n\n"))
  : "";
/** Josh's proposals, as THE HOUSE EXAMPLE — the voice every answer matches. */
const houseExample = (lib: Entry[] | undefined) => {
  const ex = (lib ?? []).find((e) => e.key === "writing_examples");
  return ex && ex.value.trim() ? block("THE HOUSE EXAMPLE — write like this (its figures are from an earlier proposal; take counts from LIVE NUMBERS)", ex.value) : "";
};
const describeLibrary = (lib: Entry[]) => lib.filter((e) => e.key !== "writing_examples").map((e) => `• ${e.label} (vault key: ${e.key})${e.storyOnly ? " [STORY AND CONTEXT ONLY — do not cite its youth statistics; use LIVE NUMBERS]" : ""}:\n${e.value}`).join("\n\n");
const describeFacts = (facts: Fact[]) => facts.map((f) => `• ${f.label}: ${f.value} — ${f.period} (source: ${f.source})`).join("\n");
const describeAnswered = (a: Req["answered"]) => a.map((x) => `• [${x.section}] ${x.label}:\n${x.answer}`).join("\n\n");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    // Grant Coach is an Admin app: the grant tables are admin-only, so the
    // writer is too. (A Staff box for it would need those rules opened first.)
    const email = String(claimsData.claims.email ?? "").toLowerCase();
    const uid = String(claimsData.claims.sub ?? "");
    let allowed = isSuperAdmin(email);
    if (!allowed && uid) {
      const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: role } = await service.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      allowed = !!role;
    }
    if (!allowed) allowed = await holdsBox(req, ["app_grant_coach"]);
    if (!allowed) return json({ error: "Grant Coach is open to Admins." }, 403);

    const body = (await req.json()) as Req;
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // ── Reading a portal's screens into questions ──
    if (body.mode === "read_screens") {
      const paths = Array.isArray(body.screens) ? body.screens.filter((p) => typeof p === "string") : [];
      const pastedText = typeof body.text === "string" ? body.text.trim().slice(0, 60000) : "";
      if (!paths.length && !pastedText) return json({ error: "Paste or upload the application first." }, 400);
      const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const images: ({ type: "image"; source: { type: "base64"; media_type: string; data: string } } | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } } | { type: "text"; text: string })[] = [];
      if (pastedText) images.push({ type: "text", text: `THE APPLICATION, AS TEXT:\n${pastedText}` });
      for (const p of paths.slice(0, 12)) {
        const { data, error } = await service.storage.from("grant-documents").download(p);
        if (error || !data) throw new Error(`Couldn't read ${p}: ${error?.message ?? "no file"}`);
        const buf = new Uint8Array(await data.arrayBuffer());
        let b64 = "";
        for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        if (p.toLowerCase().endsWith(".pdf")) { images.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: btoa(b64) } }); continue; }
        const media = p.toLowerCase().endsWith(".png") ? "image/png" : p.toLowerCase().endsWith(".webp") ? "image/webp" : "image/jpeg";
        images.push({ type: "image", source: { type: "base64", media_type: media, data: btoa(b64) } });
      }
      const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 8000,
        system: "You read a grant funder's application — screenshots of an online portal, a PDF, or pasted text — and list every question or field on it, in order, exactly as the funder worded it. You never answer the questions.",
        messages: [{
          role: "user",
          content: [
            ...images,
            { type: "text", text: `This is a funder's application (screenshots in order, a document, or text). List every question, field, checkbox and upload slot a person must fill, in the order shown. For each give: "screen" (the screen or section heading it sits under, e.g. "Proposed Program/Project"; reuse the same heading for every field on that screen), "text" (the question exactly as worded, including any sub-label), "help" (any hint or instruction text under it, or ""), "kind" (one of: field — a short answer; narrative — a text box; upload — a file slot; acknowledgment — a checkbox to certify; signature; choice — a dropdown or set of options, listing the options in "help"), "required" (true if marked with an asterisk or the word required), "limit_kind" ("words" or "characters" or null), "limit_value" (the number, or null). If the image is a screenshot of Grant Coach itself — NLA's own app, recognisable by labels like "FROM YOUR VAULT", "EDITED FOR THIS GRANT", "Approve" and "Reject" buttons, "Upload Grant Questions Here" — it is NOT a funder's application: return no questions and set "note" to "a screenshot of Grant Coach, not the funder's application". List EVERY field, including fields that already have an answer typed into them — a filled-in field is still a question. For each, also give "typed": the answer already entered on the screen, exactly as shown (for radio buttons, checkboxes and dropdowns, the option that is selected, worded as listed), or "" when the field is empty. Grey placeholder or example text is not typed. Ignore navigation buttons (Next, Back, Save) and the portal's own menus. A screen that continues the one before it uses the same "screen" heading. Only when there is truly no question on the image, return an empty list and set "note" to one line saying what the image shows.\n\nReturn ONLY JSON: {"questions":[{"screen":"","text":"","help":"","kind":"","required":true,"limit_kind":null,"limit_value":null,"typed":""}, …],"note":null}` },
          ],
        }],
        ...thinking("medium"),
      } as never);
      const parsed = extractJson(textOf(response as never));
      const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
      const note = typeof parsed.note === "string" && parsed.note.trim() ? parsed.note.trim() : null;
      return json({ questions, note });
    }

    // ── Matching questions to the Grant Vault ──
    // Facts are then filled by the app from the Vault itself, exactly; this
    // call only says WHICH field (and which piece of it) each question wants.
    if (body.mode === "classify") {
      const qs = Array.isArray(body.questions) ? body.questions : [];
      const cat = body.catalog;
      if (!qs.length || !cat) return json({ error: "Send the questions and the catalog." }, 400);
      const fieldList = cat.fields.map((f) => `${f.key} — ${f.label} (${f.kind})`).join("\n");
      const docList = cat.documents.map((d) => `${d.key} — ${d.label}`).join("\n");
      const mem = Array.isArray(body.memory) ? body.memory.slice(0, 400) : [];
      const memList = mem.map((m) => `${m.id} — ${m.question}${m.funder ? " (asked by " + m.funder + ")" : ""}`).join("\n");
      const qList = qs.map((q) => `${q.i}. [${q.kind}] ${q.screen ? q.screen + " · " : ""}${q.text}${q.help ? " (" + q.help + ")" : ""}`).join("\n");
      const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 6000,
        system: "You match the questions on a grant application to the fields of an organization's fact sheet. You are exact and conservative: a match only when the field holds precisely what the question asks for.",
        messages: [{ role: "user", content:
          `THE FACT SHEET FIELDS (key — label (kind)):\n${fieldList}\n\nTHE ORGANIZATION'S DOCUMENTS (key — title):\n${docList}\n\nQUESTIONS ANSWERED AND APPROVED ON PAST GRANTS (id — question):\n${memList || "(none yet)"}\n\nTHE QUESTIONS:\n${qList}\n\n` +
          `For each question give "vault_key": the ONE fact-sheet key whose value answers it as a fact (legal name, DBA, EIN, dates, fiscal year, year established, website, phone, addresses, contacts, signer, budget and revenue figures, yes/no history, counties), or null when the question needs writing (need, program design, outcomes, narratives) or is not on the sheet. Never match a written question to a long field like mission or need — those are written fresh. Exception: a question asking for the mission statement itself may use "mission".\n` +
          `"part": when the portal splits a field, which piece it wants — street, street2, city, state, zip (for an address); name, first, last, title (for a "name and title" field); else null. "Street Address Line 2" is street2. Choose the mailing address for "mailing address", the program address for "physical/program/site address".\n` +
          `"document_key": for an upload slot, the document it asks for, or null.\n` +
          `"needs_case": true when the answer depends on WHICH program NLA proposes or what it will do with the money — program/project name, funding purpose, need, design, activities, who the program serves, outcomes, targets, evaluation, requested amount, total program cost, program start and end dates, service frequency, program staffing, budget justification. false for facts about the organization itself (name, EIN, address, contacts, mission, history, finances, certifications).\n` +
          `"memory_id": the id of a past question that asks for the SAME thing (same meaning, wording may differ — "How many volunteers?" = "Number of volunteers"), or null. Not a question that is merely on the same topic.\n\nReturn ONLY JSON: {"matches":[{"i":0,"vault_key":null,"part":null,"document_key":null,"memory_id":null,"needs_case":false}, …]} with one entry per question.` }],
        ...thinking("low"),
      } as never);
      const parsed = extractJson(textOf(response as never));
      const keys = new Set(cat.fields.map((f) => f.key));
      const docs = new Set(cat.documents.map((d) => d.key));
      const parts = new Set(["street", "street2", "city", "state", "zip", "name", "first", "last", "title"]);
      const memIds = new Set(mem.map((m) => m.id));
      const matches = (Array.isArray(parsed.matches) ? parsed.matches : []).map((m: { i: number; vault_key?: string | null; part?: string | null; document_key?: string | null; memory_id?: string | null }) => ({
        memory_id: m.memory_id && memIds.has(m.memory_id) ? m.memory_id : null,
        needs_case: (m as { needs_case?: boolean }).needs_case === true,
        i: Number(m.i),
        vault_key: m.vault_key && keys.has(m.vault_key) ? m.vault_key : null,
        part: m.part && parts.has(m.part) ? m.part : null,
        document_key: m.document_key && docs.has(m.document_key) ? m.document_key : null,
      }));
      return json({ matches });
    }

    // ── A story, told in Josh's words, written up for the bank ──
    if (body.mode === "story") {
      const raw = typeof body.raw === "string" ? body.raw.trim().slice(0, 6000) : "";
      if (!raw) return json({ error: "Tell the story first." }, 400);
      const response = await createBest(anthropic, {
        max_tokens: 4000,
        system: "You write up a youth program director's real stories for a grant story bank. Plain, concrete, warm without sentiment, NLA's voice. Only what he said: never add a detail, a quote or a number. First names only; never a minor's last name, school, address, or any court, medical or family-crisis detail — leave those out even if he said them.",
        messages: [{ role: "user", content: `NLA's programs, for reference:\n${describeLibrary((body.library ?? []).filter((e) => e.key === "programs"))}\n\nJOSH'S STORY, IN HIS WORDS:\n${raw}\n\nReturn ONLY JSON: {"title":"<short title>","story":"<written up, 60–140 words>","program":"<the program it belongs to>","proves":["<what it proves>"],"people":"<first names in it, or empty>","left_out":"<anything you left out to protect a minor, in one line, or empty>"}` }],
        ...thinking("low"),
      });
      const parsed = extractJson(textOf(response as never));
      if (!parsed.story) throw new Error("The story came back empty. Try again.");
      return json({ draft: parsed });
    }

    // ── The Snapshot: one section redrafted for a new program year ──
    if (body.mode === "snapshot") {
      const current = String(body.current ?? body.previous ?? "").trim();
      if (!body.title) return json({ error: "Which section?" }, 400);
      const response = await createBest(anthropic, {
        max_tokens: 9000,
        system: `You update No Limits Academy's Program Year Snapshot: one fixed, funder-neutral section Josh approved word for word. Josh's wording is final. Keep every sentence, its order and its claims exactly as he wrote them; change ONLY (a) the program year wherever it is named and (b) any figure about NLA's youth that the LIVE NUMBERS now state differently for the new year. Never add a claim, a program, an adjective or a sentence; never remove one unless the live numbers show it is no longer true, and then say so in "changed". Figures Josh set himself and the live numbers do not measure (a range like "40–120 youth per night", "more than 1,200 hot meals each month", "more than $3 million since 2020", "95% … non-contact boxing") stay exactly as written. Never write that NLA owns its operations platform: it is "a custom-built operations platform". American English, NLA's voice.`,
        messages: [{ role: "user", content:
          `SECTION: ${body.title}\nNEW PROGRAM YEAR: ${body.year ?? ""}\n\nTHE APPROVED SECTION, JOSH'S WORDING:\n${current || "(empty — write it from the website and the live numbers, short declarative sentences, in the house style)"}` +
          (body.instruction ? `\n\nJOSH'S INSTRUCTION: ${body.instruction}` : "") +
          siteBlock(body) +
          block("LIVE NUMBERS (as of today, from the back end)", describeFacts(body.facts ?? [])) +
          block("ABOUT NLA LIBRARY", describeLibrary(body.library ?? [])) +
          `\n\nReturn ONLY JSON: {"answer":"<the full section, ready to approve>","changed":["<each change, one line: what it said → what it says now, and why>"]}` }],
        ...thinking("high"),
      });
      const parsed = extractJson(textOf(response as never));
      const answer = String(parsed.answer ?? "").trim();
      if (!answer) throw new Error("The section came back empty. Try again.");
      const changed = Array.isArray(parsed.changed) ? parsed.changed.filter((x: unknown) => typeof x === "string" && x.trim()).slice(0, 20) : [];
      return json({ answer, changed });
    }

    // ── Learning from Josh's edit: the lesson, not the content ──
    if (body.mode === "learn") {
      const before = String(body.before ?? "").trim().slice(0, 12000);
      const after = String(body.after ?? "").trim().slice(0, 12000);
      if (!before || !after) return json({ rules: [] });
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 3000,
        system: "You study how a nonprofit's program director edited a grant answer an AI wrote, and write down the LESSONS: short, general rules the AI should follow in every future answer (wording, spelling, terms, tone, what to always or never include, how to state numbers). Ignore changes that only fit this one question (a different fact, a reordered sentence, a cut for length). Never record a number as a rule. Never repeat a rule already on file, even reworded. Most edits teach zero or one rule; never more than three.",
        messages: [{ role: "user", content:
          `QUESTION: ${body.question ?? ""}\n\nTHE AI'S DRAFT:\n${before}\n\nWHAT JOSH APPROVED INSTEAD:\n${after}\n\nRULES ALREADY ON FILE:\n${(body.rules ?? []).map((r) => "• " + r).join("\n") || "(none)"}\n\nReturn ONLY JSON: {"rules":["<one short rule, imperative, e.g. Write year-round, never year around>"]}` }],
        ...thinking("low"),
      } as never);
      const parsed = extractJson(textOf(response as never));
      return json({ rules: strList(parsed.rules, 3).map((r) => r.slice(0, 240)) });
    }

    if (!body?.folder || !Array.isArray(body.library) || !Array.isArray(body.facts)) return json({ error: "Send the folder, the library and the facts." }, 400);

    // ── Awarded: the reporting checklist, from the RFP's rules or the award letter ──
    if (body.mode === "reporting_plan") {
      const fb = body.funderBrief;
      const fromBrief = fb ? [
        fb.data_and_reporting?.length ? "REPORTING RULES (from the funder's documents):\n" + fb.data_and_reporting.map((x) => "• " + x).join("\n") : "",
        fb.dates?.length ? "DATES (from the funder's documents):\n" + fb.dates.map((x) => "• " + x).join("\n") : "",
      ].filter(Boolean).join("\n\n") : "";
      const award = Array.isArray(body.docs) && body.docs.length ? await docContent(body.docs) : [];
      if (!fromBrief && !award.length) return json({ error: "Grant Coach needs the funder's reporting rules: read the RFP into the funder brief, or upload the award letter." }, 400);
      const response = await createBest(anthropic, {
        max_tokens: 8000,
        system: "You turn a funder's reporting requirements into a reporting checklist for a small nonprofit. Only what the documents require: never add a report, a date or a requirement they do not state. Use the funder's own words for what each report must contain.",
        messages: [{ role: "user", content: [
          ...award,
          { type: "text", text:
            `THE GRANT: ${body.folder.name} from ${body.folder.funder}. Grant period: ${body.folder.period_start ?? "?"} to ${body.folder.period_end ?? "?"}.\n\n` +
            (award.length ? "The documents above are the AWARD LETTER / AGREEMENT. They replace the RFP's reporting rules wherever they differ.\n\n" : "") +
            (fromBrief ? fromBrief + "\n\n" : "") +
            `Build the reporting checklist: one row per report the funder requires. Expand a repeating report into one row per occurrence inside the grant period ("monthly by the 15th" over a January–December period = twelve rows, each with its own period and due date). Dates as YYYY-MM-DD; if a due date cannot be worked out from the documents, leave it null and say why in "notes". kind is one of narrative, financial, data, reimbursement, other.\n\nReturn ONLY JSON: {"reports":[{"title":"<e.g. Monthly reimbursement package — January 2027>","kind":"reimbursement","detail":"<what it must contain, in the funder's words>","period_start":"YYYY-MM-DD","period_end":"YYYY-MM-DD","due_on":"YYYY-MM-DD"}],"notes":["<anything unclear, for Josh to ask the funder>"]}` },
        ] }],
        ...thinking("medium"),
      });
      const parsed = extractJson(textOf(response as never));
      const kinds = new Set(["narrative", "financial", "data", "reimbursement", "other"]);
      // deno-lint-ignore no-explicit-any
      const reports = (Array.isArray(parsed.reports) ? parsed.reports : []).slice(0, 60).map((r: any) => ({
        title: String(r?.title ?? "").trim().slice(0, 200),
        kind: kinds.has(r?.kind) ? r.kind : "other",
        detail: typeof r?.detail === "string" ? r.detail.trim().slice(0, 2000) : null,
        period_start: isYmd(r?.period_start) ? r.period_start : null,
        period_end: isYmd(r?.period_end) ? r.period_end : null,
        due_on: isYmd(r?.due_on) ? r.due_on : null,
      // deno-lint-ignore no-explicit-any
      })).filter((r: any) => r.title);
      return json({ reports, notes: strList(parsed.notes) });
    }

    // ── A report, drafted from the period's numbers and what the application promised ──
    if (body.mode === "report") {
      const r = body.report;
      if (!r) return json({ error: "Which report?" }, 400);
      const promised = (body.promised ?? []).map((p) => `• ${p.label}:\n${p.answer}`).join("\n\n");
      const response = await createBest(anthropic, {
        max_tokens: 9000,
        system: systemFor(body.folder, body.funderBrief) +
          "\n\nYOU ARE WRITING A REPORT TO A FUNDER THAT ALREADY AWARDED NLA. Report what happened in the period, honestly: every figure from the LIVE NUMBERS for that period (or the Snapshot), never a projection and never a number the facts do not give. Hold it against what the application PROMISED: name each promise and what was delivered. Where a promised measure has no number in the facts, write [NEED: …] and list it in \"gaps\". Lead with results, plain and confident.",
        messages: [{ role: "user", content:
          `Write this report.\n\nREPORT: ${r.title} (${r.kind})\nPERIOD: ${r.period_start ?? "?"} to ${r.period_end ?? "?"}` +
          (r.detail ? `\nWHAT THE FUNDER REQUIRES IN IT:\n${r.detail}` : "") +
          (body.instruction ? `\n\nJosh's instruction: ${body.instruction}` : "") +
          block("THE GRANT", describeFolder(body.folder)) +
          block("WHAT THE APPLICATION PROMISED (approved answers)", promised || "(no approved answers on file)") +
          siteBlock(body) + snapshotBlock(body) + attachmentsBlock(body) +
          block("ABOUT NLA LIBRARY", describeLibrary(body.library)) +
          block("LIVE NUMBERS FOR THE REPORT PERIOD (from the back end)", describeFacts(body.facts)) +
          `\n\nReturn ONLY JSON: {"answer":"<the report, ready to submit, with a heading per part the funder requires>","gaps":["<a promised measure or required item with no number yet — what's needed>"]}` }],
        ...thinking("medium"),
      });
      const parsed = extractJson(textOf(response as never));
      const answer = String(parsed.answer ?? "").trim();
      if (!answer) throw new Error("The report came back empty. Try again.");
      return json({ answer, gaps: strList(parsed.gaps, 20) });
    }

    // ── The fit check: go or no-go before the work starts ──
    if (body.mode === "fit") {
      const response = await createBest(anthropic, {
        max_tokens: 6000,
        system: "You are a seasoned grant strategist advising a small youth nonprofit whether an opportunity is worth the hours. Be direct and honest: a clear no saves days. Judge only from the funder's documents and what you are told about NLA; never assume the funder funds something its documents don't say. Solutions and partnerships, never blame.",
        messages: [{ role: "user", content:
          `Should NLA apply to this grant?` +
          block("THE GRANT", describeFolder(body.folder)) +
          (body.funderBrief ? block("WHAT THE FUNDER'S DOCUMENTS SAY", JSON.stringify(body.funderBrief)) : "\n\n(No funder documents read yet — say so, and judge from the grant's name and notes only, with low confidence.)") +
          siteBlock(body) + snapshotBlock(body) + attachmentsBlock(body) +
          block("ABOUT NLA LIBRARY", describeLibrary(body.library)) +
          block("LIVE NUMBERS", describeFacts(body.facts)) +
          `\n\nWeigh eligibility first (a hard no on eligibility is a no-go), then fit with what the funder funds, NLA's strength against their rubric, the effort against the amount, and any requirement NLA would struggle to meet (match, audit, reimbursement cash flow, data it doesn't collect).\n\nReturn ONLY JSON: {"verdict":"go"|"maybe"|"no_go","score":<0-100 fit>,"summary":"<two sentences>","strengths":["<why NLA scores>"],"risks":["<what could sink it>"],"must_haves":["<requirement NLA must meet or prepare>"],"questions":["<what to ask the funder before deciding>"]}` }],
        ...thinking("medium"),
      });
      const parsed = extractJson(textOf(response as never));
      const verdict = ["go", "maybe", "no_go"].includes(parsed.verdict) ? parsed.verdict : "maybe";
      const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
      return json({ fit: { verdict, score, summary: String(parsed.summary ?? "").trim(), strengths: strList(parsed.strengths), risks: strList(parsed.risks), must_haves: strList(parsed.must_haves), questions: strList(parsed.questions) } });
    }

    // ── Budget help: lines inside the funder's categories, a justification for each ──
    if (body.mode === "budget") {
      const fb = body.funderBrief;
      const response = await createBest(anthropic, {
        max_tokens: 8000,
        system: "You draft a grant budget for a small youth nonprofit. Use ONLY the funder's allowable categories and rules. Every amount must be grounded in a figure from NLA's library (staffing, budget, revenue, costs) or derived from one with the arithmetic shown in the justification; where no figure exists, put 0, mark the line [NEED: …] in its justification and list it in the needs list. Never invent a salary, a rate or a vendor quote. The total never exceeds the amount requested.",
        messages: [{ role: "user", content:
          `Draft the budget for this application. Amount requested: ${body.folder.amount_requested ?? "not set"}.` +
          (body.instruction ? `\n\nJosh's instruction: ${body.instruction}` : "") +
          block("THE GRANT", describeFolder(body.folder)) +
          (fb ? block("THE FUNDER'S BUDGET RULES", [...(fb.budget_rules ?? []).map((x) => "• " + x), "", "Allowable categories:", ...(fb.budget_categories ?? []).map((x) => "• " + x), "", "Does not fund:", ...(fb.does_not_fund ?? []).map((x) => "• " + x)].join("\n")) : "\n\n(No funder budget rules read yet — use standard categories: personnel, fringe, program supplies, food, transportation, other, and say so in notes.)") +
          block("ABOUT NLA LIBRARY", describeLibrary(body.library)) +
          block("LIVE NUMBERS", describeFacts(body.facts)) +
          `\n\nReturn ONLY JSON: {"lines":[{"category":"<the funder's category>","item":"<what it buys>","amount":<number>,"justification":"<how the amount is built, one or two sentences>"}],"total":<number>,"notes":["<assumptions>"],"needs":["<a figure Josh must supply>"]}` }],
        ...thinking("medium"),
      });
      const parsed = extractJson(textOf(response as never));
      // deno-lint-ignore no-explicit-any
      const lines = (Array.isArray(parsed.lines) ? parsed.lines : []).slice(0, 40).map((l: any) => ({
        category: String(l?.category ?? "Other").trim(), item: String(l?.item ?? "").trim(),
        amount: Math.max(0, Math.round(Number(l?.amount) || 0)), justification: String(l?.justification ?? "").trim(),
      // deno-lint-ignore no-explicit-any
      })).filter((l: any) => l.item);
      // deno-lint-ignore no-explicit-any
      const total = lines.reduce((n: number, l: any) => n + l.amount, 0);
      return json({ budget: { lines, total, notes: strList(parsed.notes), needs: strList(parsed.needs) } });
    }

    // ── The funder's documents, read once into the brief ──
    // ── Read one attachment (a PDF or an image) into text, faithfully ──
    if (body.mode === "read_document") {
      const d = Array.isArray(body.docs) ? body.docs[0] : null;
      if (!d?.path) return json({ error: "Nothing to read." }, 400);
      const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await service.storage.from("grant-documents").download(d.path);
      if (error || !data) return json({ error: `Couldn't open the file: ${error?.message ?? "no file"}` }, 400);
      const buf = new Uint8Array(await data.arrayBuffer());
      let b64 = "";
      for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const p = d.path.toLowerCase();
      // deno-lint-ignore no-explicit-any
      const content: any[] = [];
      if (p.endsWith(".pdf")) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: btoa(b64) } });
      else if (/\.(png|jpe?g|webp)$/.test(p)) content.push({ type: "image", source: { type: "base64", media_type: p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg", data: btoa(b64) } });
      else return json({ error: "That file type can't be read here." }, 400);
      content.push({ type: "text", text: `Transcribe this document ("${d.title}") into plain text, completely and faithfully: every heading, paragraph, number and dollar figure exactly as printed; tables as one row per line with cells separated by " | "; totals where they appear. On a printed form (an IRS return, a government application) transcribe every line that carries a value and skip the form's own instructions, blank lines and unchecked boxes. Add nothing, summarize nothing, correct nothing. Return the text only.` });
      // Scans and pictures only: a text PDF is read in the browser (src/lib/grantCoach/readPdf.ts).
      // Streamed, so a long transcription is not cut off by an idle connection (a 48-page 990, 2026-10-29).
      const response = await anthropic.messages.stream({
        model: "claude-sonnet-5-5", max_tokens: 24000,
        system: "You transcribe documents exactly. You never add, summarize, interpret or correct.",
        messages: [{ role: "user", content }],
      }).finalMessage();
      const text = textOf(response as never).trim();
      if (!text) return json({ error: "The file came back empty." }, 400);
      return json({ text });
    }

    if (body.mode === "funder_brief") {
      const docs = Array.isArray(body.docs) ? body.docs.slice(0, 20) : [];
      if (!docs.length) return json({ error: "Upload the funder's documents first." }, 400);
      const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      // deno-lint-ignore no-explicit-any
      const content: any[] = [];
      for (const d of docs) {
        content.push({ type: "text", text: `=== DOCUMENT: ${d.title} ===` });
        if (d.text) { content.push({ type: "text", text: d.text.slice(0, 120000) }); continue; }
        if (!d.path) continue;
        const { data, error } = await service.storage.from("grant-documents").download(d.path);
        if (error || !data) { content.push({ type: "text", text: `(could not be opened: ${error?.message ?? "no file"})` }); continue; }
        const buf = new Uint8Array(await data.arrayBuffer());
        let b64 = "";
        for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        const p = d.path.toLowerCase();
        if (p.endsWith(".pdf")) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: btoa(b64) } });
        else if (/\.(png|jpe?g|webp)$/.test(p)) content.push({ type: "image", source: { type: "base64", media_type: p.endsWith(".png") ? "image/png" : p.endsWith(".webp") ? "image/webp" : "image/jpeg", data: btoa(b64) } });
        else content.push({ type: "text", text: "(a file type that can't be read here)" });
      }
      content.push({ type: "text", text:
        `Those are every document ${body.folder?.funder ?? "the funder"} sent for ${body.folder?.name ?? "this grant"}: the RFP, guidelines, rubric, session slides, templates. Read ALL of them closely — a grant writer will write every answer from what you take out, so miss nothing that affects how an application is scored or whether it is eligible. Use the funder's own words where they matter. Never add anything the documents do not say; where they are silent, leave the list empty. Put anything unclear or contradictory in "open_questions" for Josh to ask the funder.\n\n` +
        `Return ONLY JSON: {"summary":"<3-5 sentences: what this funding is, for whom, how much, the period, how it is paid>",` +
        `"funds":[],"does_not_fund":[],"rubric":[{"criterion":"","points":null,"what_scores":"<what earns the points, in their terms>"}],` +
        `"priorities":[],"their_words":["<terms and phrases the funder uses that answers should echo>"],"eligibility":[],"data_and_reporting":[],` +
        `"budget_rules":[],"budget_categories":["<the line items / categories of their budget template>"],"dates":["<date — what is due>"],` +
        `"marked_down":["<anything they said loses points or disqualifies>"],"key_quotes":["<the most important lines, verbatim>"],"open_questions":[]}` });
      const response = await createBest(anthropic, {
        max_tokens: 12000,
        system: "You are a senior grant writer reading a funder's documents to brief the writing team. You are exact: you take out what the funder said, in its words, and you never add or assume.",
        messages: [{ role: "user", content }],
        ...thinking("medium"),
      });
      const parsed = extractJson(textOf(response as never));
      if (!parsed.summary) throw new Error("The documents came back unread. Try again.");
      return json({ brief: { ...parsed, sources: docs.map((d) => d.title) } });
    }

    // ── The reviewer: the whole application, read the way the funder will ──
    if (body.mode === "review") {
      const app = Array.isArray(body.application) ? body.application : [];
      if (!app.length) return json({ error: "There is nothing to review yet." }, 400);
      const listed = app.map((q) =>
        `[${q.i}] (${q.section.replace(/^Portal · /, "")}) ${q.label}${q.required ? "" : " (optional)"}${q.limit_value ? ` — limit ${q.limit_value} ${q.limit_kind}` : ""}\n${q.answer?.trim() ? q.answer.trim() : "(NOT ANSWERED)"}`).join("\n\n");
      const context =
        block("THE GRANT", describeFolder(body.folder)) +
        (body.caseBrief ? block("THE CASE NLA LOCKED (the answers should all tell this)", describeCase(body.caseBrief)) : "") +
        siteBlock(body) + snapshotBlock(body) + attachmentsBlock(body) +
        block("LIVE NUMBERS (NLA's recorded figures — check every number in the answers against these and against THE SNAPSHOT; a figure that matches either is NLA's own record, not an unsupported claim)", describeFacts(body.facts)) +
        (Array.isArray(body.clarifications) && body.clarifications.length ? block("JOSH'S CLARIFICATIONS (facts he settled with you in earlier threads — treat each as true; never raise a note these settle)", body.clarifications.map((c) => "- " + c).join("\n")) : "") +
        (Array.isArray(body.dismissed) && body.dismissed.length ? block("NOTES JOSH DISMISSED (he read each and decided it is not an issue — never raise these again, nor the same point in other words)", body.dismissed.map((c) => "- " + c).join("\n")) : "") +
        (body.previousReview ? block("YOUR PREVIOUS REVIEW (your last read of this application — start from it; see the consistency rule)",
          `Score ${body.previousReview.overall}/100. ${body.previousReview.verdict}\n\nCriteria:\n${(body.previousReview.criteria ?? []).map((c) => `- ${c.name}: ${c.score}/${c.max} — ${c.why}${(c.advice ?? []).length ? `\n    advice: ${c.advice!.map((a) => a.text).join(" | ")}` : ""}`).join("\n")}\n\nWhere it lost the most points:\n${(body.previousReview.weakest ?? []).map((w) => `- [${w.i}] ${w.problem} FIX: ${w.fix}`).join("\n")}${body.previousReview.contradictions?.length ? `\n\nAnswers that disagreed:\n${body.previousReview.contradictions.map((c) => "- " + c).join("\n")}` : ""}${body.previousReview.wrong_numbers?.length ? `\n\nNumbers that didn't match:\n${body.previousReview.wrong_numbers.map((c) => "- " + c).join("\n")}` : ""}\n\nANSWERS CHANGED SINCE THAT REVIEW: ${(body.changedSince ?? []).length ? body.changedSince!.map((i) => `[${i}]`).join(", ") : "none"}`) : "") +
        (body.sibling?.application?.length ? block(`THE SISTER APPLICATION — NLA's other application to this same funder in this same cycle ("${body.sibling.name}"${body.sibling.program ? ", for " + body.sibling.program : ""}), already submitted. The panel will read the two side by side. The FACTS must agree across both (the organization, its numbers, its people); the PROSE must not repeat. Under the relevant criterion, add advice citing the question for: any answer here that reads as copied from it (the same sentences, the same openings, the same order); any cost or line item funded in both (double-funding); anything that makes the two read as one program split in two to double the ask`,
          body.sibling.application.map((q) => `${q.label}\n${q.answer}`).join("\n\n")) : "") +
        block("THE APPLICATION, AS IT WILL BE SUBMITTED", listed);
      const mustFix = body.focus !== "all";
      const response = await createBest(anthropic, {
        max_tokens: 14000,
        system: systemFor(body.folder, body.funderBrief) + `

YOU ARE NOW THE REVIEWER, NOT THE WRITER
Read this application the way the funder's scoring panel will: experienced, skeptical, reading forty applications this week, scoring against the criteria above. You want to fund programs that deliver; you have been fooled before by polished writing from weak programs, so you reward PROOF — specific numbers with periods, named places, measured outcomes with targets, a real example — and you mark down adjectives, vague claims, unmeasured promises and answers that don't answer the question asked.
Be honest and specific. A generous score helps no one: Josh wants to know where it would lose points while there is still time to fix it.
${body.previousReview ? `CONSISTENCY (Josh, 2026-10-29: a review that churns is useless). Start from YOUR PREVIOUS REVIEW. For each note in it: if the answers it cites are in ANSWERS CHANGED SINCE and now fix it, DROP it; if they are unchanged, CARRY IT FORWARD in the same words; if changed and still wrong, carry it forward and say what is still wrong. Raise a NEW note only for a real defect you missed or one a change introduced. Never raise a dismissed note or the same point in other words. Scores move only as much as the changes warrant: an unchanged criterion keeps its score unless you say in "why" what you missed.\n` : ""}${mustFix ? `FOCUS: MUST-FIX ONLY. List only what would cost points or disqualify. No style, no grammar, no "could be tighter", no "consider". In "contradictions" and "wrong_numbers" list only genuine conflicts of fact — two answers that cannot both be true, or a figure that contradicts the record — never a difference in detail or rounding. If a criterion has nothing that costs points, say so in one clause.\n` : `FOCUS: EVERYTHING. Note what costs points first, then what a careful panel would also say.\n`}
Check: every criterion the funder scores; whether each answer answers exactly what was asked, within its limit (only a limit stated on that question counts — the Program Narrative has no page or word limit, so never mark it down for length); contradictions between answers (program name, amounts, counts, dates, who is served); any number that doesn't match the live numbers; required questions left blank.`,
        messages: [{ role: "user", content: context +
          `\n\nReturn ONLY JSON: {"overall":<0-100, your honest total>,"verdict":"<two sentences: would you fund it as written, and the one thing that would move the score most>",` +
          `"criteria":[{"name":"<the funder's criterion, exactly as the funder names it>","score":<points>,"max":<points available>,"why":"<one line: what earned or lost points, citing the answers as [i]>",` +
          `"advice":[{"text":"<ONE short sentence Josh can act on: what to change in ONE question, citing it as [i] — e.g. 'In [32] state the total program cost as $794,427 and the $75,000 as the CSBG share'>","target":<the ONE question index whose answer changes>,"i":[<every question index the sentence cites>]}]}] ` +
          `(advice: ONE LINE = ONE CHANGE IN ONE QUESTION — if two questions must change, write two lines; zero to three lines per criterion, worst first; ${mustFix ? "ONLY what costs points or disqualifies — an empty list means nothing here costs points" : "what costs points first, then what a careful panel would also say"}; a contradiction between answers or a figure that does not match the record goes here, under the criterion it hurts, as one line naming both questions)}` }],
        // Medium on the best model keeps a full-application read inside the function's time limit.
        ...thinking("medium"),
      });
      const parsed = extractJson(textOf(response as never));
      if (typeof parsed.overall !== "number" && !Array.isArray(parsed.criteria)) throw new Error("The review came back empty. Try again.");
      const ids = new Set(app.map((q) => q.i));
      // deno-lint-ignore no-explicit-any
      const criteria = (Array.isArray(parsed.criteria) ? parsed.criteria : []).map((c: any) => ({
        name: String(c.name ?? ""), score: Number(c.score ?? 0), max: Number(c.max ?? 0), why: String(c.why ?? ""),
        // deno-lint-ignore no-explicit-any
        advice: (Array.isArray(c.advice) ? c.advice : []).map((a: any) => {
          const cited = [...String(a?.text ?? "").matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])).filter((n) => ids.has(n));
          const i = Array.isArray(a?.i) ? a.i.map(Number).filter((n: number) => ids.has(n)) : cited;
          const target = ids.has(Number(a?.target)) ? Number(a.target) : (cited[0] ?? i[0] ?? null);
          return { text: String(a?.text ?? "").trim(), target, i: i.length ? i : cited };
        }).filter((a: { text: string }) => a.text).slice(0, mustFix ? 3 : 4),
      }));
      return json({
        review: {
          overall: Number(parsed.overall ?? 0), verdict: String(parsed.verdict ?? ""),
          criteria, weakest: [], contradictions: [], wrong_numbers: [],
          model: (response as { model?: string }).model ?? null,
        },
      });
    }

    // ── Talk to the reviewer: questions, pushback, and "write it" (Josh, 2026-10-29) ──
    if (body.mode === "review_chat") {
      const app = Array.isArray(body.application) ? body.application : [];
      if (!app.length) return json({ error: "There is nothing to talk about yet." }, 400);
      const history = Array.isArray(body.messages) ? body.messages.filter((m) => m && typeof m.content === "string") : [];
      if (!history.length) return json({ error: "Say something first." }, 400);
      const listed = app.map((q) =>
        `[${q.i}] (${q.section.replace(/^Portal · /, "")}) ${q.label}${q.required ? "" : " (optional)"}${q.limit_value ? ` — limit ${q.limit_value} ${q.limit_kind}` : ""}\n${q.answer?.trim() ? q.answer.trim() : "(NOT ANSWERED)"}`).join("\n\n");
      const r = body.review;
      const reviewText = r
        ? `Score ${r.overall}/100. ${r.verdict}\n\nCriteria:\n${(r.criteria ?? []).map((c) => `- ${c.name}: ${c.score}/${c.max} — ${c.why}`).join("\n")}\n\nWhere it loses the most points:\n${(r.weakest ?? []).map((w) => `- [${w.i}] ${w.problem} FIX: ${w.fix}`).join("\n")}${r.contradictions?.length ? `\n\nAnswers that disagree:\n${r.contradictions.map((c) => "- " + c).join("\n")}` : ""}${r.wrong_numbers?.length ? `\n\nNumbers that don't match the back end:\n${r.wrong_numbers.map((c) => "- " + c).join("\n")}` : ""}`
        : "(No review on file yet — read the application and answer from it.)";
      const context =
        block("THE GRANT", describeFolder(body.folder)) +
        (body.caseBrief ? block("THE CASE NLA LOCKED", describeCase(body.caseBrief)) : "") +
        siteBlock(body) + snapshotBlock(body) + attachmentsBlock(body) +
        block("LIVE NUMBERS (NLA's recorded figures; a figure that matches these or THE SNAPSHOT is NLA's own record)", describeFacts(body.facts)) +
        (Array.isArray(body.clarifications) && body.clarifications.length ? block("JOSH'S CLARIFICATIONS (facts he settled with you in earlier threads — treat each as true; never raise a note these settle)", body.clarifications.map((c) => "- " + c).join("\n")) : "") +
        block("THE APPLICATION, AS IT WILL BE SUBMITTED", listed) +
        block("YOUR REVIEW (what you wrote last time you read it)", reviewText) +
        (body.note ? block("THIS THREAD IS ABOUT ONE NOTE OF YOURS", `${body.note.text}${body.note.criterion ? `\n(Criterion: ${body.note.criterion})` : ""}`) : "");
      const wantsWrite = /\b(write|rewrite|draft|fix) (it|that|this|them|\[?\d+\]?|question \d+|number \d+)\b|\bwrite it\b|\bdraft it\b|\bfix it\b/i.test(history[history.length - 1].content);
      const response = await createBest(anthropic, {
        max_tokens: wantsWrite ? 6000 : 2500,
        system: systemFor(body.folder, body.funderBrief) + `

YOU ARE THE REVIEWER, IN CONVERSATION WITH JOSH
You are the same skeptical scoring-panel reviewer who wrote YOUR REVIEW. Josh (Program Director, the one who runs the program) is sitting with you to understand it before he changes anything. Answer as that person, against the record in front of you.
- Answer exactly what he asks, in plain words, citing the question numbers in square brackets like [32] so he can click to them.
- When he pushes back, check the application and the live numbers again. If he is right, say so plainly and say what you would score instead; if the note still stands, hold it and say why with the evidence. Never flatter, never fold just because he argued.
- When he asks which fix moves the score most, rank them with the points at stake.
- Your score does not change in this conversation; it changes when he runs Review again. Say so if he asks.
- The Program Narrative has no page or word limit. Only a limit stated on a question counts.
- When he asks you to WRITE or FIX a specific question, write the full answer for THAT question the way the writer would (THE WRITING STANDARD, the sources, the rules), apply the one-change rule to the answer as it stands when he asks for one change, and put it in "draft" with the question's index. Write for one question at a time; if he names none, ask which.
${body.note ? `- THIS IS A REPLY THREAD UNDER ONE NOTE. Josh is explaining his side of that note. Weigh what he says against the application and the record. Two outcomes: (a) HOLD — the note still stands because the APPLICATION AS WRITTEN still has the problem (a reviewer on the panel will not hear Josh's explanation; only the page counts): say exactly what the page must say for the note to go away, in one or two sentences; or (b) WITHDRAW — his explanation shows the note was wrong, or the page already says what is needed: set "withdraw": true, give "clarification" (ONE sentence of fact, in the third person, to be remembered for every future review — e.g. "NLA's budget is built per youth at about $1,600; 47 Battle Team youth is $75,000, the CSBG share of a $794,427 program"), and "revised": {"criterion": "<the criterion this note sat under, exactly as named in YOUR REVIEW>", "score": <that criterion's new points>, "overall": <the new overall>} — revise only for this note, honestly, never more than the note was worth. Never withdraw a note because the page SHOULD be read a certain way; withdraw only when the page already works or the note was mistaken.` : ""}
Return ONLY JSON: {"reply":"<your answer, plain text, paragraphs allowed>","draft":{"i":<question index>,"text":"<the full answer>"} (only when he asked you to write or fix a question; otherwise omit),"withdraw":<true only in a reply thread when the note is withdrawn; otherwise omit>,"clarification":"<one sentence of fact; only with withdraw>","revised":{"criterion":"","score":0,"overall":0} (only with withdraw)}`,
        messages: [
          { role: "user", content: context + "\n\nThe conversation follows. Reply to the last message." },
          { role: "assistant", content: "Ready." },
          ...history.map((m) => ({ role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant", content: m.content })),
        ],
        ...thinking(wantsWrite ? "high" : "medium"),
      });
      // The reviewer sometimes answers in prose instead of JSON (2026-10-29): a
      // plain answer is still the answer, so it is kept as the reply.
      const rawText = textOf(response as never);
      // deno-lint-ignore no-explicit-any
      let parsed: Record<string, any>;
      try { parsed = extractJson(rawText); }
      catch { parsed = { reply: rawText.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim() }; }
      const reply = String(parsed.reply ?? "").trim();
      if (!reply) throw new Error("The reviewer came back with nothing. Try again.");
      const ids = new Set(app.map((q) => q.i));
      const d = parsed.draft && typeof parsed.draft.text === "string" && ids.has(Number(parsed.draft.i)) ? { i: Number(parsed.draft.i), text: String(parsed.draft.text).trim(), words: String(parsed.draft.text).trim().split(/\s+/).filter(Boolean).length } : null;
      const withdraw = !!body.note && parsed.withdraw === true;
      const revised = withdraw && parsed.revised && typeof parsed.revised.overall === "number" ? { criterion: String(parsed.revised.criterion ?? ""), score: Number(parsed.revised.score ?? 0), overall: Number(parsed.revised.overall) } : null;
      return json({ reply, draft: d, withdraw, clarification: withdraw && typeof parsed.clarification === "string" ? parsed.clarification.trim() : null, revised, model: (response as { model?: string }).model ?? null });
    }

    // ── The strategy session: pick the program, build the case ──
    if (body.mode === "strategy") {
      const history = Array.isArray(body.messages) ? body.messages.filter((m) => m && typeof m.content === "string") : [];
      const waiting = Array.isArray(body.waiting) ? body.waiting : [];
      const context =
        block("THE GRANT", describeFolder(body.folder)) +
        block("THE STORY QUESTIONS WAITING FOR THE CASE (the case must let every one be answered well)", waiting.map((w) => `• ${w.label}${w.help ? " — " + w.help : ""}${w.limit_value ? ` (limit ${w.limit_value} ${w.limit_kind})` : ""}`).join("\n")) +
        (body.caseBrief ? block("THE CASE AS IT STANDS (revise it if the conversation changes it)", describeCase(body.caseBrief)) : "") +
        siteBlock(body) + snapshotBlock(body) + attachmentsBlock(body) + houseExample(body.library) + block("ABOUT NLA LIBRARY", describeLibrary(body.library)) +
        block("THE STORY BANK", describeStories(body.stories ?? [])) +
        block("LIVE NUMBERS (as of today, from the back end)", describeFacts(body.facts)) +
        block("ALREADY WRITTEN IN THIS FOLDER", describeAnswered(body.answered ?? []));
      const transcript = history.length
        ? history.map((m) => `${m.role === "user" ? "JOSH" : "GRANT COACH"}: ${m.content}`).join("\n\n")
        : "(The session is just opening. Come prepared: options, your recommendation, and your one to three questions.)";
      const userContent =
        `${context}\n\n=== THE STRATEGY CONVERSATION SO FAR (reply to the last line) ===\n${transcript}` +
        `\n\nReturn ONLY JSON: {"reply":"<what you say to Josh, short>",` +
        `"options":[{"program":"","fit":8,"why":"<one or two sentences on fit for THIS funder>","proof":["<exact number + period>"],"weak_spots":["<what a reviewer pokes> — <how to answer it>"]}] (only when laying out options; otherwise omit),` +
        `"case":{"program_name":"","pitch":"<one sentence a reviewer remembers>","what_the_money_pays_for":"","ask_amount":null,"total_cost":null,"start_date":null,"end_date":null,"service_frequency":null,"who_is_served":"","proof_points":["<number-backed claim>"],"outcomes":["<measurable outcome with a target>"],"story":null,"reviewer_answers":["<objection> — <answer>"]} (only when proposing or revising the case; otherwise omit),` +
        `"story_draft":{"title":"<a short title>","story":"<Josh's story written up in NLA's voice, 60–140 words, only what he said, first names only>","program":"<which program>","proves":["<what it proves: e.g. discipline, school turnaround, staying off the street, family trust>"],"people":"<first names in it, or empty>"} (ONLY when Josh's last message told a NEW real story worth keeping; otherwise omit)}`;
      const response = await createBest(anthropic, {
        max_tokens: 16000,
        system: systemFor(body.folder, body.funderBrief) + STRATEGY_RULES + STORY_RULES,
        messages: [{ role: "user", content: userContent }],
        // Medium on the best model: deep enough to out-think a field of grant writers, and back inside the function's time limit.
        ...thinking("medium"),
      });
      const parsed = extractJson(textOf(response as never));
      const reply = String(parsed.reply ?? "").trim();
      if (!reply) throw new Error("Grant Coach said nothing. Try again.");
      const options = Array.isArray(parsed.options) && parsed.options.length ? parsed.options : undefined;
      const caseOut = parsed.case && typeof parsed.case === "object" && parsed.case.program_name ? parsed.case : undefined;
      const storyDraft = parsed.story_draft && typeof parsed.story_draft === "object" && parsed.story_draft.story ? parsed.story_draft : undefined;
      return json({ reply, options, case: caseOut, story_draft: storyDraft, model: (response as { model?: string }).model });
    }

    // ── The conversation ──
    if (body.mode === "chat") {
      const history = Array.isArray(body.messages) ? body.messages.filter((m) => m && typeof m.content === "string") : [];
      if (!history.length || history[history.length - 1].role !== "user") return json({ error: "Say something first." }, 400);
      const it = body.item;
      const subject = it
        ? `THE OPEN QUESTION\nSection: ${it.section}\nQuestion: ${it.label}${it.detail ? `\nThe funder's note: ${it.detail}` : ""}\nKind of field: ${it.kind}${limitLine(it)}${body.currentDraft?.trim() ? `\n\nTHE CURRENT DRAFT (the last draft card in this conversation — a requested change is applied to THIS text, word for word, and nothing else moves):\n${body.currentDraft.trim()}` : ""}${it.answer && it.answer.trim() !== (body.currentDraft ?? "").trim() ? `\nThe answer box holds:\n${it.answer}` : !body.currentDraft?.trim() ? "\n(no draft yet)" : ""}`
        : "THE OPEN SUBJECT: the grant as a whole (which program to propose, how much to ask, what to lead with).";
      const sibs = Array.isArray(body.siblings) ? body.siblings : [];
      const context =
        block("THE GRANT", describeFolder(body.folder)) +
        (sibs.length ? block("THE OTHER QUESTIONS ON THIS SCREEN (fill one ONLY when asked, by its number)", sibs.map((q) => `[${q.i}] ${q.label}${q.help ? " — " + q.help : ""}${q.limit_value ? ` (limit ${q.limit_value} ${q.limit_kind})` : ""}\n    now: ${q.answer?.trim() ? q.answer.trim() : "(empty)"}`).join("\n")) : "") +
        (body.caseBrief ? block("THE CASE NLA SETTLED ON", describeCase(body.caseBrief)) : "") +
        sisterBlock(body) +
        siteBlock(body) + snapshotBlock(body) + attachmentsBlock(body) + houseExample(body.library) + block("ABOUT NLA LIBRARY", describeLibrary(body.library)) +
        ((body.stories ?? []).length ? block("THE STORY BANK", describeStories(body.stories ?? [], body.usedStoryIds ?? [])) : "") +
        block("LIVE NUMBERS (as of today, from the back end)", describeFacts(body.facts)) +
        block("ALREADY WRITTEN IN THIS FOLDER", describeAnswered(body.answered ?? []));
      const transcript = history.map((m) => `${m.role === "user" ? "JOSH" : "GRANT COACH"}: ${m.content}`).join("\n\n");
      const userContent =
        `${subject}${context}\n\n=== THE CONVERSATION SO FAR (reply to the last line) ===\n${transcript}` +
        `\n\nReturn ONLY JSON: {"reply":"<what you say back, brief>",` +
        `"answer":"<ONLY when writing the open question's answer now; otherwise omit>",` +
        `"fills":[{"i":<number of another question on this screen>,"answer":"<its answer>"}] (ONLY when asked to fill other questions; otherwise omit),` +
        `"story_draft":{"title":"","story":"<their story, 60-140 words, only what they said, first names only>","program":"","proves":[],"people":""} (ONLY when they just told a new real story; otherwise omit),` +
        `"story_id":"<the story-bank id the answer tells, or null>","left_out":["<what bears on the question but is not in the answer> — <why>"] (only when writing an answer),` +
        `"vault_changes":[{"key":"<the library entry's vault key>","after":"<the entry's full new text>","why":"<one line>"}] (ONLY when Josh asks to change, correct or add a Vault fact, or the Vault contradicts what he just said; otherwise omit)}`;
      // A conversation should feel like one: medium on the best model answers in seconds.
      // When the last line asks for writing, the writing gets the full effort — that is
      // the work that wins or loses the grant (Josh, 2026-10-23).
      const lastLine = history[history.length - 1].content;
      const asksToWrite = /\b(write|draft|rewrite|redo|redraft|tighten|shorten|fill|go ahead|go|do it|make it|polish|fix it|try again)\b/i.test(lastLine);
      const response = await createBest(anthropic, {
        max_tokens: 10000,
        system: systemFor(body.folder, body.funderBrief) + CHAT_RULES + ((body.stories ?? []).length ? STORY_RULES : ""),
        messages: [{ role: "user", content: userContent }],
        ...thinking(asksToWrite ? "high" : "medium"),
      });
      const parsed = extractJson(textOf(response as never));
      const reply = String(parsed.reply ?? "").trim();
      const answer = typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer.trim() : undefined;
      if (!reply && !answer) throw new Error("Grant Coach said nothing. Try again.");
      const sibIds = new Set(sibs.map((q) => q.i));
      const fills = (Array.isArray(parsed.fills) ? parsed.fills : [])
        .filter((x: { i?: number; answer?: string }) => sibIds.has(Number(x.i)) && typeof x.answer === "string" && x.answer.trim())
        .map((x: { i: number; answer: string }) => ({ i: Number(x.i), answer: x.answer.trim() }));
      const storyIds = new Set((body.stories ?? []).map((st) => st.id));
      const story_id = typeof parsed.story_id === "string" && storyIds.has(parsed.story_id) ? parsed.story_id : null;
      const story_draft = parsed.story_draft && typeof parsed.story_draft === "object" && parsed.story_draft.story ? parsed.story_draft : undefined;
      const left_out = Array.isArray(parsed.left_out) ? parsed.left_out.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim()).slice(0, 6) : [];
      const libKeys = new Map(body.library.map((e) => [e.key, e]));
      const vault_changes = (Array.isArray(parsed.vault_changes) ? parsed.vault_changes : [])
        .filter((v: { key?: string; after?: string }) => typeof v?.key === "string" && libKeys.has(v.key) && typeof v.after === "string" && v.after.trim() && v.after.trim() !== (libKeys.get(v.key)?.value ?? "").trim())
        .map((v: { key: string; after: string; why?: string }) => ({ key: v.key, after: v.after.trim(), why: typeof v.why === "string" ? v.why.trim() : "" }))
        .slice(0, 6);
      return json({ reply: reply || "Here it is.", answer, fills: fills.length ? fills : undefined, story_draft, story_id, left_out, words: answer ? answer.split(/\s+/).filter(Boolean).length : undefined, vault_changes: vault_changes.length ? vault_changes : undefined });
    }

    const mode = body.mode === "narrative" ? "narrative" : "item";

    const context =
      block("THE GRANT", describeFolder(body.folder)) +
      (body.caseBrief ? block("THE LOCKED CASE — write this answer FROM it: same program, same numbers, same story; consistent with every other answer", describeCase(body.caseBrief)) : "") +
      sisterBlock(body) +
      siteBlock(body) + snapshotBlock(body) + attachmentsBlock(body) + houseExample(body.library) + block("ABOUT NLA LIBRARY", describeLibrary(body.library)) +
      ((body.stories ?? []).length ? block("THE STORY BANK", describeStories(body.stories ?? [], body.usedStoryIds ?? [])) : "") +
      block("LIVE NUMBERS (as of today, from the back end)", describeFacts(body.facts)) +
      block("ALREADY WRITTEN IN THIS FOLDER", describeAnswered(body.answered ?? []));

    let userContent: string;
    let maxTokens: number;
    let effort: "medium" | "high";

    if (mode === "narrative") {
      const items = body.narrativeItems ?? [];
      if (items.length !== 7) return json({ error: "The narrative needs its seven items." }, 400);
      const list = items.map((it, i) => `${i + 1}. ${it.label.replace(/^\d\.\s*/, "")}${it.detail ? ` — ${it.detail}` : ""}${it.answer ? `\n   (current draft to improve, keep what works: ${it.answer})` : ""}`).join("\n");
      userContent =
        `Write the funder's PROGRAM NARRATIVE: seven items, in this order, each its own section with the funder's heading.\n\n${list}` +
        `\n\nThere is no page or word limit. Each section is as long as it needs to be to prove its point from the record — every program, number and partner that answers the item, with nothing padded. Plain paragraphs (blank line between paragraphs), no bullet lists, no sub-headings.` +
        (body.instruction ? `\n\nJosh's instruction for this draft: ${body.instruction}` : "") +
        context +
        `\n\nReturn ONLY JSON: {"sections":[{"n":1,"heading":"<the funder's heading for item 1>","text":"<the section>"}, … seven entries]}`;
      maxTokens = 14000;
      effort = "high";
    } else {
      const it = body.item;
      if (!it) return json({ error: "Which item?" }, 400);
      userContent =
        `Write the answer for this one application field.\n\nSection: ${it.section}\nQuestion: ${it.label}${it.detail ? `\nThe funder's note: ${it.detail}` : ""}\nKind of field: ${it.kind}${limitLine(it)}` +
        (it.answer ? `\n\nThe current draft, to improve (keep what works):\n${it.answer}` : "") +
        (body.instruction ? `\n\nJosh's instruction for this draft: ${body.instruction}` : "") +
        (it.kind === "field" || it.kind === "choice" ? `\n\nThis is a short form field: answer in a few words or one sentence, nothing more.${it.kind === "choice" ? " Give only the option to choose, worded as listed." : ""}` : "") +
        (it.kind === "acknowledgment" || it.kind === "signature" ? `\n\nThis is a certification or signature: say in one line what to tick or sign and who should, e.g. "Tick the box — certified by Josh Mercado, Program Director." Do not certify anything the library contradicts.` : "") +
        context +
        `\n\nIf a fact the answer needs is missing, keep the [NEED: …] note in the answer and set "needs" to ONE short line asking for it (e.g. "How is 200% FPL income verified at enrollment?"); otherwise "needs" is null.` +
        ((body.caseBrief || !(it.kind === "field" || it.kind === "choice" || it.kind === "acknowledgment" || it.kind === "signature"))
          ? `\n\nWrite it to SCORE: a reviewer reads this against the funder's criteria. Lead with the strongest evidence, name numbers and periods exactly, and make the link to what the funder rewards obvious. Then set "score_note" to ONE line for Josh: which of the funder's scoring criteria this answer earns points on, and the evidence in it that earns them (e.g. "Community need & CSBG alignment — 71% of youth below 200% FPL, Wildwood and Woodbine named"). If the answer is weak on a criterion it should cover, say so in the note.`
          : "") +
        `\n\nReturn ONLY JSON: {"answer":"<the answer, ready to paste into the form>","needs":null,"story_id":"<the id of the story-bank story you told, or null>","score_note":null,"left_out":["<a program, service or number from the library or live numbers that bears on this question but is not in the answer> — <why>"]}`;
      maxTokens = 7000;
      effort = "medium";
    }

    // Every written answer gets the best writer at full effort; short fields,
    // choices and certifications keep the usual model (Josh, 2026-10-23).
    const withStories = (body.stories ?? []).length ? STORY_RULES : "";
    const writes = mode === "item" && !!body.item && !(body.item.kind === "field" || body.item.kind === "choice" || body.item.kind === "acknowledgment" || body.item.kind === "signature");
    const response = (body.caseBrief || writes) && mode === "item"
      ? await createBest(anthropic, { max_tokens: maxTokens, system: systemFor(body.folder, body.funderBrief) + withStories, messages: [{ role: "user", content: userContent }], ...thinking("high") })
      : await anthropic.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemFor(body.folder, body.funderBrief) + withStories,
        messages: [{ role: "user", content: userContent }],
        ...thinking(effort),
      } as never);

    const parsed = extractJson(textOf(response as never));
    if (mode === "narrative") {
      const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
      if (sections.length !== 7) throw new Error("The draft did not come back with seven sections. Try again.");
      const words = sections.reduce((n: number, s: { text?: string }) => n + String(s.text ?? "").trim().split(/\s+/).filter(Boolean).length, 0);
      return json({ sections, words });
    }
    const answer = String(parsed.answer ?? "").trim();
    if (!answer) throw new Error("The draft came back empty. Try again.");
    const needs = typeof parsed.needs === "string" && parsed.needs.trim() ? parsed.needs.trim() : null;
    const storyIds = new Set((body.stories ?? []).map((st) => st.id));
    const story_id = typeof parsed.story_id === "string" && storyIds.has(parsed.story_id) ? parsed.story_id : null;
    const score_note = typeof parsed.score_note === "string" && parsed.score_note.trim() ? parsed.score_note.trim() : null;
    const left_out = Array.isArray(parsed.left_out) ? parsed.left_out.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim()).slice(0, 6) : [];
    return json({ answer, needs, story_id, score_note, left_out, words: answer.split(/\s+/).filter(Boolean).length });
  } catch (err) {
    console.error("grant-writer error:", err);
    return json({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
