// hawk-squad-report — writes a Hawk Squad report from the period's attendance
// figures, demographics, and the director's highlights. Two formats:
//   - "letter":    a letter to Cape May Tech administration (the mid-year
//                  report Josh sends the school's point of contact).
//   - "narrative": a grant-ready narrative for a funder.
// Two modes: "generate" (fresh) and "revise" (rewrite per an instruction).
//
// Access: any authenticated admin (user_roles admin) or a super-admin. The
// Anthropic key stays server-side. No DB writes.
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";
import { thinking, textOf } from "../_shared/claude.ts";
import { isSuperAdmin } from "../_shared/superAdmins.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-sonnet-5";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// What Hawk Squad is. Taken from the 2026 mid-year report to Cape May Tech
// and the programme's own flyers, so the writer describes the real programme
// and not a guess at one. Facts only; the period's figures come in the request.
const PROGRAM_FACTS =
  "ABOUT HAWK SQUAD (established facts — use freely, never contradict):\n" +
  "- Hawk Squad is a partnership between Cape May County Technical High School (CMT, 'Cape May Tech') and No Limits Academy (NLA), a youth boxing non-profit in Cape May County, NJ. It launched on September 19, 2022.\n" +
  "- Tagline: 'The Ultimate Afterschool Experience.' Branding is Hawk Squad green and gold, with the hawk.\n" +
  "- CMT students (grades 9–12, enrolled in the school's career and technical education programmes) come to NLA after school, usually Tuesday and Thursday. The school bus brings them; some students are dismissed directly from NLA with a parent's signed permission instead of riding the bus back.\n" +
  "- On arrival, students check in at the Learning Center, where they receive a snack and homework support or tutoring as needed.\n" +
  "- Then it is structured, choice-based programming: social time in the Teen Center; the game room (arcade games, pool, air hockey); skill-based competition and open gym in the Performance Center (basketball, football, other sports); individualized training in the fitness facility built to develop physical strength, psychological resilience, and mental endurance; and boxing.\n" +
  "- The programme is designed for social-emotional, mental, and physical well-being: a consistent, positive place to decompress, connect, and grow, with mentorship and social connection at its core.\n" +
  "- Coach Chrissy Casiello and Coach Josh Mercado stay in regular contact with CMT faculty and administration, sharing what each side needs to know so students are supported holistically.\n" +
  "- The partnership reflects New Jersey Department of Education guidance encouraging schools to work with local, off-site partners to support students beyond the classroom.\n" +
  "- CMT students are also welcome in NLA's evening programme, which starts at 5:15 p.m. and provides dinner five days a week along with academic support, mentorship, physical training, and a safe, supervised setting.\n";

const HOUSE_VOICE =
  "\nHOUSE VOICE (use this EXACT voice — consistency matters):\n" +
  "- Warm, personal, and human — write as Program Director Josh Mercado, speaking to someone who genuinely cares about these students.\n" +
  "- Friendly and sincere; never corporate, stiff, or buzzword-y — yet polished, credible, and grant-worthy.\n" +
  "- Grounded and specific: honor the students, coaches, and school partners, and let real details carry the warmth.\n" +
  "- Keep the tone consistent from the first sentence to the last.\n";

const RULES =
  "Rules:\n" +
  "- Lead with impact, opportunity, and partnership. Frame it around what Hawk Squad gives these students and what CMT and NLA build together.\n" +
  "- Base every figure, name, and story ONLY on the facts and highlights provided. Never invent numbers, names, activities, or outcomes. If a highlight names a student, keep the name and the win intact — those real stories are the most persuasive part.\n" +
  "- Weave the period's figures in naturally (sessions held, check-ins, distinct students, average per session, how students got home) and, where it helps, who the students are (grades, CTE programmes). Do not list every demographic; pick what tells the story.\n" +
  "- Solutions- and partnership-oriented ALWAYS; never disparage the school, families, or other organizations.\n" +
  "- Plain prose paragraphs. No headings, bullet points, tables, or markdown.\n";

const LETTER_FORMAT =
  "FORMAT: a letter to Cape May Tech. Start with the salutation on its own line (e.g. 'Dear Kristen,' if a recipient is named, otherwise 'To Cape May Tech Administration:'). " +
  "Then 3–5 paragraphs: (1) the partnership and what the period showed; (2) what a Hawk Squad afternoon looks like; (3) the collaboration between NLA staff and CMT faculty, with any highlight or special moment provided; (4) the period's figures and the evening programme; (5) gratitude and looking forward. " +
  "End with 'Sincerely,' then 'Josh Mercado' then 'No Limits Academy' on separate lines. Do not write the address block or the date — the letterhead carries those.";

const NARRATIVE_FORMAT =
  "FORMAT: a grant-ready narrative for a funder. 2–4 paragraphs of prose, no salutation, no sign-off. Return ONLY the narrative.";

type Stats = {
  sessionsHeld?: number; sessionsPlanned?: number; checkIns?: number; students?: number;
  avgPerSession?: number; bus?: number; dismissed?: number;
};
type Breakdown = Record<string, Record<string, number>>;

const statsBlock = (s: Stats | undefined): string =>
  `Attendance for the period:\n` +
  `- Sessions held: ${s?.sessionsHeld ?? 0}${s?.sessionsPlanned ? ` (of ${s.sessionsPlanned} planned)` : ""}\n` +
  `- Total check-ins: ${s?.checkIns ?? 0}\n` +
  `- Distinct students reached: ${s?.students ?? 0}\n` +
  `- Average students per session: ${s?.avgPerSession ?? 0}\n` +
  `- Went home on the school bus: ${s?.bus ?? 0} check-ins; dismissed from NLA with permission: ${s?.dismissed ?? 0} check-ins\n`;

const breakdownBlock = (b: Breakdown | undefined): string => {
  if (!b) return "";
  let out = "Who the students are (distinct students in the period):\n";
  for (const [label, counts] of Object.entries(b)) {
    const parts = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`);
    if (parts.length) out += `- ${label}: ${parts.join(", ")}\n`;
  }
  return out;
};

const highlightsBlock = (h: unknown): string => {
  const t = typeof h === "string" ? h.trim() : "";
  return t
    ? `Key highlights and special moments from the director (feature these):\n${t}\n`
    : "No highlights were given for this period; write from the figures and the programme facts alone, and keep it honest.\n";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const email = String(claimsData.claims.email ?? "").toLowerCase();
    const uid = String(claimsData.claims.sub ?? "");
    let isAdmin = isSuperAdmin(email);
    if (!isAdmin && uid) {
      const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: role } = await service.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      isAdmin = !!role;
    }
    if (!isAdmin) return json({ error: "Admin access required." }, 403);

    const body = await req.json();
    const mode: string = body.mode ?? "generate";
    const format: "letter" | "narrative" = body.format === "letter" ? "letter" : "narrative";
    const recipient = typeof body.recipient === "string" ? body.recipient.trim() : "";
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const system =
      "You are the writing voice of Josh Mercado, Program Director of No Limits Boxing Academy.\n" +
      PROGRAM_FACTS + RULES + HOUSE_VOICE +
      (format === "letter" ? LETTER_FORMAT : NARRATIVE_FORMAT);

    const facts = (b: typeof body) =>
      `${statsBlock(b.stats)}${breakdownBlock(b.breakdown)}${highlightsBlock(b.highlights ?? b.notes)}` +
      (format === "letter" && recipient ? `The letter is addressed to: ${recipient}\n` : "");

    let userContent: string;
    if (mode === "revise") {
      const { narrative, instruction, period } = body;
      if (!narrative || !instruction) return json({ error: "A narrative and an instruction are required." }, 400);
      userContent =
        `Here is the current Hawk Squad ${format}:\n\n${narrative}\n\n` +
        `Facts (for accuracy) — period ${period ?? ""}:\n${facts(body)}\n` +
        `Revise it with this instruction: ${instruction}\n\nReturn ONLY the revised ${format}.`;
    } else {
      userContent =
        `Write the Hawk Squad ${format} for the period ${body.period ?? "(unspecified)"}.\n\n${facts(body)}`;
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      // Thinking is charged against this — see _shared/claude.ts.
      max_tokens: 7000,
      system,
      messages: [{ role: "user", content: userContent }],
      ...thinking("medium"),
    } as never);

    return json({ narrative: textOf(response) });
  } catch (e) {
    console.error("hawk-squad-report error:", e);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "The AI is busy right now — try again in a moment." }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `AI service error: ${e.message}` }, e.status ?? 500);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
