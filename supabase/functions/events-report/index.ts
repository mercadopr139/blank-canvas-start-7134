// events-report — generates and revises a short, grant-ready narrative for an
// on-site program event, from facts the client provides. Two modes:
//   - "generate": write a fresh narrative from the event facts.
//   - "revise":   rewrite an existing narrative per an instruction.
//
// The events analog of excursion-report. An "event" is an on-site program
// activity (e.g. "Banking & Boxing") — no transportation, sometimes narrative
// only. Access: any authenticated admin (a user_roles row with role='admin'),
// or the super-admin. The Anthropic key stays server-side. No DB writes.
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-sonnet-5";
const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Shared "house voice" — kept identical across excursion-report, events-report
// and program-highlights-report so everything NLA generates sounds like the
// same caring person wrote it.
const HOUSE_VOICE =
  "\nHOUSE VOICE (use this EXACT voice in every report, every time — consistency matters):\n" +
  "- Warm, personal, and human — write as the Program Director speaking heart-to-heart to a supporter who genuinely cares about these kids.\n" +
  "- Friendly and sincere; never corporate, stiff, or buzzword-y — yet polished, credible, and grant-worthy.\n" +
  "- Grounded and specific: honor the youth, coaches, and community, and let real details carry the warmth.\n" +
  "- Keep the tone consistent from the first sentence to the last.\n";

const SYSTEM =
  "You are the Program Director's writing voice for No Limits Academy (also called No Limits Boxing Academy), a youth boxing non-profit in Cape May County, NJ. " +
  "Write a short narrative about an on-site program event (an activity or workshop held at the academy, e.g. a financial-literacy session, guest speaker, or life-skills workshop) suitable for a grant funder or supporter. " +
  "Rules:\n" +
  "- Lead with impact, opportunity, and partnership. Frame it around what the event gave the youth (exposure, new skills, mentorship, connection).\n" +
  "- 1–3 short paragraphs. No headings, no bullet points, no preamble.\n" +
  "- Base it ONLY on the facts provided. Never invent numbers, names, sponsors, or details that aren't given.\n" +
  "- If a 'YOUTH REACHED breakdown' is provided, weave those exact figures into the narrative so the funder sees who was reached — one natural extra short paragraph is fine. Use ONLY the numbers given; never invent demographic figures.\n" +
  "- Solutions- and partnership-oriented tone; never disparage schools, families, or other organizations.\n" +
  HOUSE_VOICE +
  "- Return ONLY the narrative prose.";

// Optional "Youth Reached" breakdown — included only when the client opts in.
const youthReachedBlock = (yr: any): string => {
  if (!yr) return "";
  let out = "\nYOUTH REACHED breakdown (weave these EXACT figures into the narrative):\n";
  let any = false;
  if (yr.total != null) { out += `- Total youth reached: ${yr.total}\n`; any = true; }
  if (yr.belowPovertyPct != null) { out += `- From households at or below the poverty line: ${yr.belowPovertyPct}%\n`; any = true; }
  if (yr.minorityPct != null) { out += `- Minority (non-white): ${yr.minorityPct}%\n`; any = true; }
  if (yr.boysPct != null || yr.girlsPct != null) { out += `- Boys: ${yr.boysPct ?? 0}%, Girls: ${yr.girlsPct ?? 0}%\n`; any = true; }
  if (Array.isArray(yr.races) && yr.races.length) {
    out += `- Backgrounds: ${yr.races.map((r: any) => `${r.label} (${r.pct}%)`).join(", ")}\n`;
    any = true;
  }
  return any ? out : "";
};

const factsBlock = (t: any): string =>
  `Event name: ${t?.name ?? "Program event"}\n` +
  `Date: ${t?.date ?? "(unspecified)"}\n` +
  (t?.countsAttendance
    ? `Number of youth who attended: ${t?.youthCount ?? 0}\n`
    : `Attendance: not tracked for this event (narrative only).\n`) +
  (t?.description ? `What the event was about (staff notes): ${t.description}\n` : "") +
  (t?.debrief ? `Staff debrief / reflections: ${t.debrief}\n` : "") +
  youthReachedBlock(t?.youthReached);

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

    // Admin gate: super-admin, or a user_roles admin row (same check AuthContext uses).
    let isAdmin = email === SUPER_ADMIN_EMAIL;
    if (!isAdmin && uid) {
      const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: role } = await service
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      isAdmin = !!role;
    }
    if (!isAdmin) return json({ error: "Admin access required." }, 403);

    const body = await req.json();
    const mode: string = body.mode ?? "generate";
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    let userContent: string;
    if (mode === "revise") {
      const { narrative, instruction, event } = body;
      if (!narrative || !instruction) return json({ error: "A narrative and an instruction are required." }, 400);
      userContent =
        `Here is the current grant-report narrative for a program event:\n\n${narrative}\n\n` +
        `Event facts (for accuracy):\n${factsBlock(event)}\n` +
        `Revise the narrative with this instruction: ${instruction}\n\n` +
        `Return ONLY the revised narrative.`;
    } else {
      const { event } = body;
      if (!event?.name) return json({ error: "Event details are required." }, 400);
      userContent = `Write the grant-report narrative for this program event.\n\n${factsBlock(event)}`;
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const narrative = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    return json({ narrative });
  } catch (e) {
    console.error("events-report error:", e);
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: "The AI is busy right now — try again in a moment." }, 429);
    }
    if (e instanceof Anthropic.APIError) {
      return json({ error: `AI service error: ${e.message}` }, e.status ?? 500);
    }
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
