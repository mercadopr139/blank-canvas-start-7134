// program-highlights-report — generates and revises ONE combined, grant-ready
// "Program Highlights" narrative that rolls up multiple activities (excursions
// + on-site events) across a date range. Two modes:
//   - "generate": write a fresh combined narrative from the list of highlights.
//   - "revise":   rewrite an existing narrative per an instruction.
//
// The multi-activity cousin of excursion-report / events-report. Access: any
// authenticated admin, or the super-admin. Anthropic key stays server-side.
// No DB writes.
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

const SYSTEM =
  "You are the communications writer for No Limits Academy (also called No Limits Boxing Academy), a youth boxing non-profit in Cape May County, NJ. " +
  "Write a polished, in-depth \"Program Highlights\" report that a Program Director would proudly share with DONORS and funders. It rolls up several activities from a period into ONE cohesive document.\n" +
  "\n" +
  "FORMAT (follow exactly):\n" +
  "- Open with a warm 1–2 sentence introduction to the period. Do NOT put a title line on the intro.\n" +
  "- Then ONE section per activity. Begin each section with a title line formatted EXACTLY as:  ## Activity Name: Short Evocative Tagline\n" +
  "  (e.g. `## Banking & Boxing: Skills for the Ring and Real Life`). Give every section a compelling tagline.\n" +
  "- After the title line, write 3–4 rich, flowing paragraphs. Weave any numbers, partners, sponsors, cadence, and staff names naturally INTO the sentences.\n" +
  "- End each section with a sentence tying it back to No Limits' whole-child mission — using boxing as a vehicle to build discipline, confidence, and life skills.\n" +
  "- Separate sections with a blank line. Use NO bullet points, NO stat boxes, and NO headings other than the `## ` title lines.\n" +
  "\n" +
  "CONTENT RULES:\n" +
  "- Base every SPECIFIC fact (names, partners, sponsors, numbers, dates) ONLY on the facts provided. Never invent them. If a specific isn't given, write around it rather than making it up.\n" +
  "- You MAY add general, true mission framing about No Limits' values and approach, but never invented specifics.\n" +
  "- Warm, vivid, donor-facing, and professional. Solutions- and partnership-oriented; never disparage schools, families, or other organizations.\n" +
  "- Return ONLY the report text (the intro followed by the `## ` sections). No preamble, no closing sign-off.";

const highlightsBlock = (period: string, items: any[]): string => {
  const lines = (items ?? []).map((h, i) => {
    const kind = h?.type === "event" ? "On-site event" : "Excursion";
    const attend = h?.countsAttendance ? `${h?.youthCount ?? 0} youth attended` : "attendance not tracked (narrative only)";
    return (
      `${i + 1}. ${h?.name ?? "Activity"} (${kind}, ${h?.date ?? "date unspecified"}, ${attend})\n` +
      (h?.description ? `   Overview (staff notes): ${h.description}\n` : "") +
      (h?.debrief ? `   Debrief / reflections: ${h.debrief}\n` : "")
    );
  });
  return `Reporting period: ${period}\n\nActivities to feature:\n${lines.join("\n")}`;
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
    const period: string = body.period ?? "the reporting period";
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    let userContent: string;
    if (mode === "revise") {
      const { narrative, instruction, highlights } = body;
      if (!narrative || !instruction) return json({ error: "A narrative and an instruction are required." }, 400);
      userContent =
        `Here is the current Program Highlights report:\n\n${narrative}\n\n` +
        `Facts (for accuracy):\n${highlightsBlock(period, highlights ?? [])}\n\n` +
        `Revise the report with this instruction: ${instruction}\n\n` +
        `Keep the same format (a short intro, then \`## Title: Tagline\` sections with 3–4 paragraphs each, stats woven into the prose). Return ONLY the revised report.`;
    } else {
      const { highlights } = body;
      if (!Array.isArray(highlights) || highlights.length === 0) return json({ error: "Select at least one highlight." }, 400);
      userContent = `Write the Program Highlights report.\n\n${highlightsBlock(period, highlights)}`;
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
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
    console.error("program-highlights-report error:", e);
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: "The AI is busy right now — try again in a moment." }, 429);
    }
    if (e instanceof Anthropic.APIError) {
      return json({ error: `AI service error: ${e.message}` }, e.status ?? 500);
    }
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
