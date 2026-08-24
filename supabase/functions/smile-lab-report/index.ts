// smile-lab-report — writes a grant-ready narrative for the Smile Lab aftercare
// program from the coaches' weekly journals + attendance. Two modes:
//   - "generate": fresh narrative from the journals + stats for a period.
//   - "revise":   rewrite an existing narrative per an instruction.
//
// Access: any authenticated admin (user_roles admin) or the super-admin. Anthropic
// key stays server-side. No DB writes.
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.94.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-sonnet-5";
const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const HOUSE_VOICE =
  "\nHOUSE VOICE (use this EXACT voice — consistency matters):\n" +
  "- Warm, personal, and human — write as the Program Director speaking heart-to-heart to a supporter who genuinely cares about these kids.\n" +
  "- Friendly and sincere; never corporate, stiff, or buzzword-y — yet polished, credible, and grant-worthy.\n" +
  "- Grounded and specific: honor the youth, coaches, and community, and let real details carry the warmth.\n" +
  "- Keep the tone consistent from the first sentence to the last.\n";

const SYSTEM =
  "You are the Program Director's writing voice for No Limits Boxing Academy, a youth boxing non-profit in Cape May County, NJ. " +
  "Write a grant-ready narrative about SMILE LAB — a complimentary Tuesday aftercare program for the academy's Junior Boxing participants (ages 7–10). " +
  "Smile Lab's belief: a healthy smile is more than healthy teeth. Kids rotate between two experiences: 'Caring for Your Smile' (Coach Jaime — oral " +
  "health & hygiene: brushing, flossing, nutrition, daily habits) and 'Sharing Your Smile' (Coach Chrissy — character & everyday skills: manners, " +
  "gratitude, kindness, handling bullying, confidence, serving others, faith & character). The two reinforce each other: caring for yourself and " +
  "caring about others are both healthy habits.\n" +
  "Rules:\n" +
  "- Lead with impact, opportunity, and partnership. Frame it around what Smile Lab gives these kids (healthy habits, character, confidence, belonging).\n" +
  "- 2–4 short paragraphs. No headings or bullet points unless it clearly helps a funder; no preamble.\n" +
  "- Base it ONLY on the facts provided (journals + attendance figures). Never invent numbers, names, or details that aren't given.\n" +
  "- Weave in the attendance figures naturally (sessions held, check-ins, unique youth reached) so the funder sees the reach.\n" +
  "- If standout moments are provided, FEATURE them specifically — keep the kid's name, the win, the quote intact. These real stories are the most fundable part.\n" +
  "- Solutions- and partnership-oriented ALWAYS; never disparage schools, families, dentists, or other organizations. Lead with what NLA and its partners provide.\n" +
  HOUSE_VOICE +
  "- Return ONLY the narrative prose.";

const statsBlock = (s: any): string =>
  `Attendance for the period:\n` +
  `- Sessions held: ${s?.sessions ?? 0}\n` +
  `- Total check-ins: ${s?.checkIns ?? 0}\n` +
  `- Unique youth reached: ${s?.uniqueKids ?? 0}\n`;

const journalsBlock = (arr: any): string => {
  const list = Array.isArray(arr) ? arr : [];
  if (!list.length) return "No weekly journals were recorded for this period.\n";
  let out = "Weekly journals (the coaches' own notes):\n";
  for (const j of list) {
    out += `\n• ${j.date}:\n`;
    if (j.caring?.trim()) out += `  Caring for Your Smile (Jaime): ${j.caring.trim()}\n`;
    if (j.sharing?.trim()) out += `  Sharing Your Smile (Chrissy): ${j.sharing.trim()}\n`;
    const st = Array.isArray(j.standouts) ? j.standouts.filter((x: string) => x && x.trim()) : [];
    if (st.length) out += `  Standout moments: ${st.map((x: string) => `"${x}"`).join("; ")}\n`;
  }
  return out;
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
      const { data: role } = await service.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
      isAdmin = !!role;
    }
    if (!isAdmin) return json({ error: "Admin access required." }, 403);

    const body = await req.json();
    const mode: string = body.mode ?? "generate";
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    let userContent: string;
    if (mode === "revise") {
      const { narrative, instruction, period, stats, journals } = body;
      if (!narrative || !instruction) return json({ error: "A narrative and an instruction are required." }, 400);
      userContent =
        `Here is the current Smile Lab grant narrative:\n\n${narrative}\n\n` +
        `Facts (for accuracy) — period ${period ?? ""}:\n${statsBlock(stats)}${journalsBlock(journals)}\n` +
        `Revise the narrative with this instruction: ${instruction}\n\nReturn ONLY the revised narrative.`;
    } else {
      const { period, stats, journals } = body;
      userContent =
        `Write the Smile Lab grant narrative for the period ${period ?? "(unspecified)"}.\n\n` +
        `${statsBlock(stats)}\n${journalsBlock(journals)}`;
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1600,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const narrative = response.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    return json({ narrative });
  } catch (e) {
    console.error("smile-lab-report error:", e);
    if (e instanceof Anthropic.RateLimitError) return json({ error: "The AI is busy right now — try again in a moment." }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `AI service error: ${e.message}` }, e.status ?? 500);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
