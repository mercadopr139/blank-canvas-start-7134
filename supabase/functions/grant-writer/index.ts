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
  mode: "item" | "narrative" | "chat" | "read_screens" | "classify" | "strategy" | "story" | "review" | "funder_brief";
  folder: Folder;
  item?: Item;
  narrativeItems?: Item[];
  answered: { section: string; label: string; answer: string }[];
  library: Entry[];
  facts: Fact[];
  instruction?: string;
  /** chat: the conversation so far, oldest first, and the new message last. */
  messages?: Msg[];
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
  /** review: the whole application in portal order, as it will be submitted. */
  application?: { i: number; section: string; label: string; help: string | null; kind: string; required: boolean; answer: string | null; limit_kind?: string | null; limit_value?: number | null }[];
  /** story: Josh's own words, to be written up. */
  raw?: string;
  /** item / strategy: the case Josh locked — every story answer is written from it. */
  caseBrief?: CaseBrief | null;
  /** strategy: the story questions waiting for the case, so the brief covers all of them. */
  waiting?: { label: string; help: string | null; kind: string; limit_kind?: string | null; limit_value?: number | null }[];
  /** classify: questions NLA has answered and approved before (id + the question as asked). */
  memory?: { id: string; question: string; funder: string | null }[];
};

const NARRATIVE_WORD_LIMIT = 1350;

const SYSTEM = `You are Grant Coach, the grant writer for No Limits Academy (NLA), a free, year-round youth development center in Rio Grande, Cape May County, New Jersey. You write in NLA's own voice: first person plural ("we"), plain and concrete, confident without boasting, no jargon, no filler, no buzzwords. American English.

HARD RULES
1. Every number you write must come from the LIVE NUMBERS or the ABOUT NLA LIBRARY you are given. Never invent, round up, or extrapolate a figure. If a figure the question needs is not provided, write a short bracketed note in its place like [NEED: number of Meal Train volunteers] and move on.
1a. THE YEAR. The live numbers cover NLA's last complete program year (September 1 to August 31). Use that year for every count of youth, check-ins, meals, rides and demographics, and name it the first time ("in the 2025–26 program year…"). A complete year is an honest picture; never present a partial year as if it were a year.
1c. YOUNG LOGS: USE RATES, NOT TOTALS. NLA's logging systems (the check-in kiosk, the Meal Tracker, the driver app) are new, so some live numbers say "records on file <date> to <date> only, not the whole year". For those, do NOT cite the total as if it were the year's. Instead cite the RATES the fact gives from its full months: "NLA serves an average of 58 meals a night" or "in May 2026, a full month of logging, NLA served 62 meals a night over 20 nights". You may lead with the strongest full month, named as such; you may give the average across full months; you may say the rate was measured in the school year and that these months were not peak season (January and February are NLA's busiest), but never project a number beyond what was measured and never state a year's total from a partial log. Take the program's shape (five dinners a week in the school year, year-round programming) from the library. Never propose to "expand" from a partial count: NLA already runs at full size; the log is what is new.
1b. WHERE NUMBERS COME FROM. Every statistic about NLA's youth — how many served or registered, attendance, nights, meals, rides, ages, sex, race, school districts, single-parent homes, economically disadvantaged share, Wildwood and Woodbine counts — comes ONLY from the LIVE NUMBERS section. The ABOUT NLA LIBRARY is for story, voice, programs, partners, people, money and history. Library entries marked [STORY AND CONTEXT ONLY] were written from the website and an earlier proposal and contain youth statistics from another moment: take their wording and flow, never their figures, even where the live numbers have no match (write [NEED: …] instead). Numbers that are not about NLA's youth — county or school-district poverty rates from the census, the facility's size, revenue and budget figures, award amounts, dates — may be cited from the library, naming the source the library gives.
2. NLA is year-round, five days a week in the school year and four in summer. Never call it a 10-month or seasonal program.
3. Solutions and partnerships, never blame. Describe the community's need with facts and respect, never as a failing of families, schools or towns.
4. Two full-time staff running a program of this size on this revenue is efficiency; say so plainly where capacity or staffing is asked about.
5. Stay consistent with what is ALREADY WRITTEN in this folder (program name, amount, counts, dates). If something already written conflicts with a fact, follow the fact and note the conflict in brackets.
6. Answer the funder's question as asked, in the order asked, and nothing else. No preamble, no headings inside a single answer, no sign-off.

THE FUNDER
(This section describes O.C.E.A.N.; it is replaced for any other funder.)
O.C.E.A.N., Inc. is the Community Action Agency for Ocean, Atlantic and Cape May Counties, passing through federal Community Services Block Grant (CSBG) money. CSBG funds work that addresses the causes and conditions of poverty and moves low-income people toward self-sufficiency. Participants must be at or below 200% of the federal poverty level, verified with documents before service, and reported in the EmpowOR system. Funding is reimbursement-based with monthly reimbursement packages. Applications are scored out of 100 on: community need and CSBG alignment; program design, delivery and feasibility; measurable outputs and outcomes with realistic targets; organizational capacity, staffing and partnerships; budget reasonableness and cost effectiveness; data, eligibility, fiscal and compliance capacity; past performance with O.C.E.A.N. Write so a reviewer can tick each of these.

LENGTH
A short form field: one to three sentences. A text-box answer (funding purpose, outcomes, measures, tools, eligibility process, file security): one tight paragraph, 60–140 words. A narrative item: 150–230 words. The whole seven-item narrative must fit three pages: at most ${NARRATIVE_WORD_LIMIT} words in total.`;

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
You are sitting next to Josh (Program Director) or Chrissy (Program Coordinator) while they fill in a funder's application. One question from the application is open, or the grant as a whole is.
- Ask first. On the first turn for a question, do not write the answer yet: say in one or two lines what you would recommend, and ask the one to three things that would make the answer stronger (which program, which number to lead with, a detail only they know). If you already have everything, say so and offer to draft.
- Recommend with reasons, from the live numbers and the library. When asked which program is the strongest ask, compare them on what the funder scores.
- Answer questions about NLA's data from the LIVE NUMBERS; if the number is not there, say so plainly.
- Write when told ("draft it", "write it", "go ahead", or when they have answered your questions). A written answer goes in the "answer" field of your reply, ready to paste into the portal, inside the funder's limit if there is one, and your "reply" says in one line what you did and what they might change.
- Keep replies short. Two to five sentences unless they ask for more. No headings, no bullet walls.
- Every rule above about numbers, the year, young logs, and the library still applies.`;

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

const describeLibrary = (lib: Entry[]) => lib.map((e) => `• ${e.label}${e.storyOnly ? " [STORY AND CONTEXT ONLY — do not cite its youth statistics; use LIVE NUMBERS]" : ""}:\n${e.value}`).join("\n\n");
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

    if (!body?.folder || !Array.isArray(body.library) || !Array.isArray(body.facts)) return json({ error: "Send the folder, the library and the facts." }, 400);

    // ── The funder's documents, read once into the brief ──
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
        block("LIVE NUMBERS (the only true figures about NLA's youth — check every number in the answers against these)", describeFacts(body.facts)) +
        block("THE APPLICATION, AS IT WILL BE SUBMITTED", listed);
      const response = await createBest(anthropic, {
        max_tokens: 14000,
        system: systemFor(body.folder, body.funderBrief) + `

YOU ARE NOW THE REVIEWER, NOT THE WRITER
Read this application the way the funder's scoring panel will: experienced, skeptical, reading forty applications this week, scoring against the criteria above. You want to fund programs that deliver; you have been fooled before by polished writing from weak programs, so you reward PROOF — specific numbers with periods, named places, measured outcomes with targets, a real example — and you mark down adjectives, vague claims, unmeasured promises and answers that don't answer the question asked.
Be honest and specific. A generous score helps no one: Josh wants to know where it would lose points while there is still time to fix it.
Check: every criterion the funder scores; whether each answer answers exactly what was asked, within its limit; contradictions between answers (program name, amounts, counts, dates, who is served); any number that doesn't match the live numbers; required questions left blank.`,
        messages: [{ role: "user", content: context +
          `\n\nReturn ONLY JSON: {"overall":<0-100, your honest total>,"verdict":"<two sentences: would you fund it as written, and the one thing that would move the score most>",` +
          `"criteria":[{"name":"<the funder's criterion>","score":<points>,"max":<points available>,"why":"<one line: what earned or lost points, citing the answer>"}],` +
          `"weakest":[{"i":<question index>,"problem":"<what a reviewer marks down, one line>","fix":"<how to fix it, one line>","instruction":"<the instruction to give the writer to rewrite it, e.g. 'Lead with the 71% low-income share; cut the second paragraph; add the 2025-26 retention figure'>"}] (the three answers that cost the most points, worst first),` +
          `"contradictions":["<answer [i] says X; answer [j] says Y>"],"wrong_numbers":["<answer [i] says N; the live numbers say M>"]}` }],
        // Medium on the best model keeps a full-application read inside the function's time limit.
        ...thinking("medium"),
      });
      const parsed = extractJson(textOf(response as never));
      if (typeof parsed.overall !== "number" && !Array.isArray(parsed.criteria)) throw new Error("The review came back empty. Try again.");
      const ids = new Set(app.map((q) => q.i));
      const weakest = (Array.isArray(parsed.weakest) ? parsed.weakest : []).filter((w: { i?: number }) => ids.has(Number(w.i))).slice(0, 3);
      return json({
        review: {
          overall: Number(parsed.overall ?? 0), verdict: String(parsed.verdict ?? ""),
          criteria: Array.isArray(parsed.criteria) ? parsed.criteria : [],
          weakest, contradictions: Array.isArray(parsed.contradictions) ? parsed.contradictions : [],
          wrong_numbers: Array.isArray(parsed.wrong_numbers) ? parsed.wrong_numbers : [],
          model: (response as { model?: string }).model ?? null,
        },
      });
    }

    // ── The strategy session: pick the program, build the case ──
    if (body.mode === "strategy") {
      const history = Array.isArray(body.messages) ? body.messages.filter((m) => m && typeof m.content === "string") : [];
      const waiting = Array.isArray(body.waiting) ? body.waiting : [];
      const context =
        block("THE GRANT", describeFolder(body.folder)) +
        block("THE STORY QUESTIONS WAITING FOR THE CASE (the case must let every one be answered well)", waiting.map((w) => `• ${w.label}${w.help ? " — " + w.help : ""}${w.limit_value ? ` (limit ${w.limit_value} ${w.limit_kind})` : ""}`).join("\n")) +
        (body.caseBrief ? block("THE CASE AS IT STANDS (revise it if the conversation changes it)", describeCase(body.caseBrief)) : "") +
        block("ABOUT NLA LIBRARY", describeLibrary(body.library)) +
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
        ? `THE OPEN QUESTION\nSection: ${it.section}\nQuestion: ${it.label}${it.detail ? `\nThe funder's note: ${it.detail}` : ""}\nKind of field: ${it.kind}${limitLine(it)}${it.answer ? `\nCurrent answer in the box:\n${it.answer}` : "\n(no answer yet)"}`
        : "THE OPEN SUBJECT: the grant as a whole (which program to propose, how much to ask, what to lead with).";
      const context =
        block("THE GRANT", describeFolder(body.folder)) +
        block("ABOUT NLA LIBRARY", describeLibrary(body.library)) +
        block("LIVE NUMBERS (as of today, from the back end)", describeFacts(body.facts)) +
        block("ALREADY WRITTEN IN THIS FOLDER", describeAnswered(body.answered ?? []));
      const transcript = history.map((m) => `${m.role === "user" ? "JOSH" : "GRANT COACH"}: ${m.content}`).join("\n\n");
      const userContent =
        `${subject}${context}\n\n=== THE CONVERSATION SO FAR (reply to the last line) ===\n${transcript}` +
        `\n\nReturn ONLY JSON: {"reply":"<what you say back, short>","answer":"<ONLY if you are writing or rewriting the answer now: the full answer ready to paste; otherwise omit this key>"}`;
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: systemFor(body.folder, body.funderBrief) + CHAT_RULES,
        messages: [{ role: "user", content: userContent }],
        ...thinking("medium"),
      } as never);
      const parsed = extractJson(textOf(response as never));
      const reply = String(parsed.reply ?? "").trim();
      const answer = typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer.trim() : undefined;
      if (!reply && !answer) throw new Error("Grant Coach said nothing. Try again.");
      return json({ reply: reply || "Here is a draft.", answer, words: answer ? answer.split(/\s+/).filter(Boolean).length : undefined });
    }

    const mode = body.mode === "narrative" ? "narrative" : "item";

    const context =
      block("THE GRANT", describeFolder(body.folder)) +
      (body.caseBrief ? block("THE LOCKED CASE — write this answer FROM it: same program, same numbers, same story; consistent with every other answer", describeCase(body.caseBrief)) : "") +
      block("ABOUT NLA LIBRARY", describeLibrary(body.library)) +
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
        `Write the funder's three-page PROGRAM NARRATIVE: seven items, in this order, each its own section with the funder's heading.\n\n${list}` +
        `\n\nTotal across all seven: at most ${NARRATIVE_WORD_LIMIT} words. Each section 150–230 words, plain paragraphs (blank line between paragraphs), no bullet lists, no sub-headings.` +
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
        ((body.caseBrief || it.kind === "narrative")
          ? `\n\nWrite it to SCORE: a reviewer reads this against the funder's criteria. Lead with the strongest evidence, name numbers and periods exactly, and make the link to what the funder rewards obvious. Then set "score_note" to ONE line for Josh: which of the funder's scoring criteria this answer earns points on, and the evidence in it that earns them (e.g. "Community need & CSBG alignment — 71% of youth below 200% FPL, Wildwood and Woodbine named"). If the answer is weak on a criterion it should cover, say so in the note.`
          : "") +
        `\n\nReturn ONLY JSON: {"answer":"<the answer, ready to paste into the form>","needs":null,"story_id":"<the id of the story-bank story you told, or null>","score_note":null}`;
      maxTokens = 7000;
      effort = "medium";
    }

    // Story answers written from the case get the best writer; everything else the usual model.
    const withStories = (body.stories ?? []).length ? STORY_RULES : "";
    const response = body.caseBrief && mode === "item"
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
    return json({ answer, needs, story_id, score_note, words: answer.split(/\s+/).filter(Boolean).length });
  } catch (err) {
    console.error("grant-writer error:", err);
    return json({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
