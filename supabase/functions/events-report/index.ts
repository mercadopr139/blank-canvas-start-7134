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

const SYSTEM =
  "You are a grant-report writer for No Limits Boxing Academy, a youth boxing non-profit in Cape May County, NJ. " +
  "Write a short, professional narrative about an on-site program event (an activity or workshop held at the academy, e.g. a financial-literacy session, guest speaker, or life-skills workshop) suitable for a grant funder or board report. " +
  "Rules:\n" +
  "- Lead with impact, opportunity, and partnership. Frame it around what the event gave the youth (exposure, new skills, mentorship, connection).\n" +
  "- Warm but factual and professional. 1–2 short paragraphs. No headings, no bullet points, no preamble.\n" +
  "- Base it ONLY on the facts provided. Never invent numbers, names, sponsors, or details that aren't given.\n" +
  "- Solutions- and partnership-oriented tone; never disparage schools, families, or other organizations.\n" +
  "- Return ONLY the narrative prose.";

const factsBlock = (t: any): string =>
  `Event name: ${t?.name ?? "Program event"}\n` +
  `Date: ${t?.date ?? "(unspecified)"}\n` +
  (t?.countsAttendance
    ? `Number of youth who attended: ${t?.youthCount ?? 0}\n`
    : `Attendance: not tracked for this event (narrative only).\n`) +
  (t?.description ? `What the event was about (staff notes): ${t.description}\n` : "") +
  (t?.debrief ? `Staff debrief / reflections: ${t.debrief}\n` : "");

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
