// hawk-squad-report — writes a grant-ready narrative for the Hawk Squad
// programme from the period's attendance figures, demographics, and the
// Program Director's own notes. Two modes:
//   - "generate": fresh narrative from the facts for a period.
//   - "revise":   rewrite an existing narrative per an instruction.
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

const HOUSE_VOICE =
  "\nHOUSE VOICE (use this EXACT voice — consistency matters):\n" +
  "- Warm, personal, and human — write as the Program Director speaking heart-to-heart to a supporter who genuinely cares about these kids.\n" +
  "- Friendly and sincere; never corporate, stiff, or buzzword-y — yet polished, credible, and grant-worthy.\n" +
  "- Grounded and specific: honor the youth, coaches, and community partners, and let real details carry the warmth.\n" +
  "- Keep the tone consistent from the first sentence to the last.\n";

const SYSTEM =
  "You are the Program Director's writing voice for No Limits Boxing Academy, a youth boxing non-profit in Cape May County, NJ. " +
  "Write a grant-ready narrative about HAWK SQUAD — the academy's partnership programme with Cape May County Technical High School. " +
  "Hawk Squad students (grades 9–12, enrolled in the school's career and technical education programmes) come to the academy two afternoons " +
  "a week, usually Tuesday and Thursday, for training and mentoring; the school provides bus transportation, and some students are " +
  "dismissed directly from the academy with a parent's signed permission. Hawk Squad is run separately from the academy's own youth " +
  "programme, and some students take part in both.\n" +
  "Rules:\n" +
  "- Lead with impact, opportunity, and partnership. Frame it around what Hawk Squad gives these students (fitness, discipline, mentoring, belonging, a bridge between school and community).\n" +
  "- 2–4 short paragraphs. No headings or bullet points unless it clearly helps a funder; no preamble.\n" +
  "- Base it ONLY on the facts provided (attendance figures, demographics, and the director's notes). Never invent numbers, names, activities, or outcomes that aren't given.\n" +
  "- Weave in the attendance figures naturally (sessions held, check-ins, distinct students reached, average per session) so the funder sees the reach.\n" +
  "- If the director's notes name specific moments or students, FEATURE them — keep the name and the win intact. Those real stories are the most fundable part.\n" +
  "- Solutions- and partnership-oriented ALWAYS; never disparage the school, families, or other organizations. Lead with what NLA and Cape May Tech provide together.\n" +
  HOUSE_VOICE +
  "- Return ONLY the narrative prose.";

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
  `- Went home on the school bus: ${s?.bus ?? 0} check-ins; dismissed from the academy with permission: ${s?.dismissed ?? 0} check-ins\n`;

const breakdownBlock = (b: Breakdown | undefined): string => {
  if (!b) return "";
  let out = "Who the students are (distinct students in the period):\n";
  for (const [label, counts] of Object.entries(b)) {
    const parts = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`);
    if (parts.length) out += `- ${label}: ${parts.join(", ")}\n`;
  }
  return out;
};

const notesBlock = (notes: unknown): string => {
  const t = typeof notes === "string" ? notes.trim() : "";
  return t ? `The director's notes on this period (feature these):\n${t}\n` : "No director's notes were given for this period; write from the figures alone and keep it honest.\n";
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
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const facts = (b: typeof body) =>
      `${statsBlock(b.stats)}${breakdownBlock(b.breakdown)}${notesBlock(b.notes)}`;

    let userContent: string;
    if (mode === "revise") {
      const { narrative, instruction, period } = body;
      if (!narrative || !instruction) return json({ error: "A narrative and an instruction are required." }, 400);
      userContent =
        `Here is the current Hawk Squad grant narrative:\n\n${narrative}\n\n` +
        `Facts (for accuracy) — period ${period ?? ""}:\n${facts(body)}\n` +
        `Revise the narrative with this instruction: ${instruction}\n\nReturn ONLY the revised narrative.`;
    } else {
      userContent =
        `Write the Hawk Squad grant narrative for the period ${body.period ?? "(unspecified)"}.\n\n${facts(body)}`;
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      // Thinking is charged against this — see _shared/claude.ts.
      max_tokens: 6000,
      system: SYSTEM,
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
