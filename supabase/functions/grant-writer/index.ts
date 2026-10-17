// Grant Coach's writer. Given one checklist item (or the seven narrative
// items), the About NLA library, the live numbers, and what is already
// written in the folder, it drafts the answer in NLA's voice for the funder's
// exact question. It never invents a number: every figure must come from the
// facts it was handed, and anything it does not know it marks [NEED: …] for
// Josh to fill.
//
// Step 3 of docs/grant-coach/README.md.
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";
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
type Req = {
  mode: "item" | "narrative" | "chat" | "read_screens";
  folder: Folder;
  item?: Item;
  narrativeItems?: Item[];
  answered: { section: string; label: string; answer: string }[];
  library: Entry[];
  facts: Fact[];
  instruction?: string;
  /** chat: the conversation so far, oldest first, and the new message last. */
  messages?: Msg[];
  /** read_screens: storage paths of the portal screenshots, in order. */
  screens?: string[];
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
O.C.E.A.N., Inc. is the Community Action Agency for Ocean, Atlantic and Cape May Counties, passing through federal Community Services Block Grant (CSBG) money. CSBG funds work that addresses the causes and conditions of poverty and moves low-income people toward self-sufficiency. Participants must be at or below 200% of the federal poverty level, verified with documents before service, and reported in the EmpowOR system. Funding is reimbursement-based with monthly reimbursement packages. Applications are scored out of 100 on: community need and CSBG alignment; program design, delivery and feasibility; measurable outputs and outcomes with realistic targets; organizational capacity, staffing and partnerships; budget reasonableness and cost effectiveness; data, eligibility, fiscal and compliance capacity; past performance with O.C.E.A.N. Write so a reviewer can tick each of these.

LENGTH
A short form field: one to three sentences. A text-box answer (funding purpose, outcomes, measures, tools, eligibility process, file security): one tight paragraph, 60–140 words. A narrative item: 150–230 words. The whole seven-item narrative must fit three pages: at most ${NARRATIVE_WORD_LIMIT} words in total.`;

const CHAT_RULES = `
HOW YOU WORK IN A CONVERSATION
You are sitting next to Josh (Program Director) or Chrissy (Program Coordinator) while they fill in a funder's application. One question from the application is open, or the grant as a whole is.
- Ask first. On the first turn for a question, do not write the answer yet: say in one or two lines what you would recommend, and ask the one to three things that would make the answer stronger (which program, which number to lead with, a detail only they know). If you already have everything, say so and offer to draft.
- Recommend with reasons, from the live numbers and the library. When asked which program is the strongest ask, compare them on what the funder scores.
- Answer questions about NLA's data from the LIVE NUMBERS; if the number is not there, say so plainly.
- Write when told ("draft it", "write it", "go ahead", or when they have answered your questions). A written answer goes in the "answer" field of your reply, ready to paste into the portal, inside the funder's limit if there is one, and your "reply" says in one line what you did and what they might change.
- Keep replies short. Two to five sentences unless they ask for more. No headings, no bullet walls.
- Every rule above about numbers, the year, young logs, and the library still applies.`;

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
    if (!allowed) return json({ error: "Grant Coach is open to Admins." }, 403);

    const body = (await req.json()) as Req;
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // ── Reading a portal's screens into questions ──
    if (body.mode === "read_screens") {
      const paths = Array.isArray(body.screens) ? body.screens.filter((p) => typeof p === "string") : [];
      if (!paths.length) return json({ error: "Upload at least one screenshot first." }, 400);
      const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const images: { type: "image"; source: { type: "base64"; media_type: string; data: string } }[] = [];
      for (const p of paths.slice(0, 12)) {
        const { data, error } = await service.storage.from("grant-documents").download(p);
        if (error || !data) throw new Error(`Couldn't read ${p}: ${error?.message ?? "no file"}`);
        const buf = new Uint8Array(await data.arrayBuffer());
        let b64 = "";
        for (let i = 0; i < buf.length; i += 0x8000) b64 += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        const media = p.toLowerCase().endsWith(".png") ? "image/png" : p.toLowerCase().endsWith(".webp") ? "image/webp" : "image/jpeg";
        images.push({ type: "image", source: { type: "base64", media_type: media, data: btoa(b64) } });
      }
      const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 8000,
        system: "You read screenshots of a grant funder's online application and list every question or field on them, in order, exactly as the funder worded it. You never answer the questions.",
        messages: [{
          role: "user",
          content: [
            ...images,
            { type: "text", text: `These are screenshots of a funder's online application, in order. List every question, field, checkbox and upload slot a person must fill, in the order shown. For each give: "screen" (the screen or section heading it sits under, e.g. "Proposed Program/Project"; reuse the same heading for every field on that screen), "text" (the question exactly as worded, including any sub-label), "help" (any hint or instruction text under it, or ""), "kind" (one of: field — a short answer; narrative — a text box; upload — a file slot; acknowledgment — a checkbox to certify; signature; choice — a dropdown or set of options, listing the options in "help"), "required" (true if marked with an asterisk or the word required), "limit_kind" ("words" or "characters" or null), "limit_value" (the number, or null). Ignore the applicant's typed answers and any navigation buttons.\n\nReturn ONLY JSON: {"questions":[{"screen":"","text":"","help":"","kind":"","required":true,"limit_kind":null,"limit_value":null}, …]}` },
          ],
        }],
        ...thinking("medium"),
      } as never);
      const parsed = extractJson(textOf(response as never));
      const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
      return json({ questions });
    }

    if (!body?.folder || !Array.isArray(body.library) || !Array.isArray(body.facts)) return json({ error: "Send the folder, the library and the facts." }, 400);

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
        system: SYSTEM + CHAT_RULES,
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
      block("ABOUT NLA LIBRARY", describeLibrary(body.library)) +
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
        context +
        `\n\nReturn ONLY JSON: {"answer":"<the answer, ready to paste into the form>"}`;
      maxTokens = 7000;
      effort = "medium";
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
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
    return json({ answer, words: answer.split(/\s+/).filter(Boolean).length });
  } catch (err) {
    console.error("grant-writer error:", err);
    return json({ error: (err as Error).message || "Internal server error" }, 500);
  }
});
