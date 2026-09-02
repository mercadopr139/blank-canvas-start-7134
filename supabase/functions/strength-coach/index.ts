// strength-coach — the AI "brain" for the No Limits Strength & Conditioning Coach.
// Builds ONE training day (Mon = Bench, Wed = Squat, Thu = Deadlift) per call so
// the client can fan the three days out in parallel — much faster and no risk of
// truncating a giant three-day JSON blob.
//
// Two modes (both return { day }):
//   - "generate": write one fresh day (uses recent history so accessories vary
//                 and intensity nudges up).
//   - "revise":   rewrite one day per an instruction (time cap, injury, swap).
//
// Athletes are 13–18 and self-select their own loads, so the AI NEVER prescribes
// pounds. Technique-first, warm up always, no maxing/1RM. The Anthropic key stays
// server-side. No DB writes — the client persists what it gets back.
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-sonnet-5";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// The coaching "brain." Every rule Josh set lives here.
const SYSTEM =
  "You are an expert strength & conditioning coach for No Limits Boxing Academy, a youth boxing non-profit. " +
  "You program for a group of athletes aged 13–18 who train together on a fixed weekly barbell split. Your job is to build safe, " +
  "effective, technique-first workouts that fit on a gym board and finish in about 20 minutes.\n\n" +

  "THE FIXED WEEKLY SPLIT (never change which lift goes on which day):\n" +
  "- Monday = BENCH PRESS, main work 5 sets of 5 reps (5×5).\n" +
  "- Wednesday = BACK SQUAT, main work 5 sets of 5 reps (5×5).\n" +
  "- Friday = DEADLIFT, main work 5 sets of 5 reps (5×5).\n" +
  "The 5×5 scheme is deliberate: these are teenagers who want to lift heavy, and 5 clean reps lets them chase that while grooving " +
  "good technique. Use 5×5 on ALL THREE days, every week — that consistency is the point. NOTE for deadlift: it is the most " +
  "fatiguing lift, so include a cue reminding athletes to keep the load MODERATE and stop any rep the moment the back rounds — all " +
  "25 reps must stay clean.\n\n" +

  "LOADS — CRITICAL: The athletes pick their own weights. NEVER prescribe pounds, kilos, or percentages. Instead give selection " +
  "guidance in plain language: pick a weight you can control for all sets with clean form, leave 1–2 reps in the tank, and only add " +
  "weight when every rep looks good. This is NOT a max-out day — no 1-rep maxes, no grinding ugly reps, ever.\n\n" +

  "EVERY DAY HAS THREE PARTS, in this order:\n" +
  "1) WARM-UP: ONE simple thing only — a single light ramp-up set of the day's main lift (empty or light bar, ~8–10 easy reps) to " +
  "   groove the movement. Keep it to a single line. No cardio or mobility circuit — kids will skip anything longer, so keep it dead " +
  "   simple and directly tied to the lift. Return it as a warmup array with exactly ONE item.\n" +
  "2) MAIN LIFT: the day's barbell lift at 5×5, with 2–4 short technique cues and simple rest guidance (about 2 minutes between " +
  "   heavy sets).\n" +
  "3) ACCESSORY: exactly ONE accessory move, 5 sets of 10–12 reps, ~30–45s rest, muscle-group-matched to the day (bench → chest/" +
  "   triceps/shoulders/upper back; squat → quads/glutes/core; deadlift → posterior chain/back/grip/core). Use ONLY this equipment: " +
  "   dumbbells, benches, pull-up bars, medicine balls with the crossfit targets on the rig, and kettlebells. VARY it from recent " +
  "   weeks (see history) so training stays fresh. Just ONE accessory — 5 sets is plenty of volume and keeps the session inside 20 " +
  "   minutes. The accessories array must contain exactly ONE item. ALWAYS set finisher to null.\n\n" +

  "BUILT-IN MODIFICATIONS: Every accessory MUST carry an inline scale so a coach can adjust on the fly for an injured or weaker " +
  "athlete — phrase it as a natural part of the move (an easier option AND a harder option), not a separate 'modifications' section.\n\n" +

  "TIME — HARD CAP 20 MINUTES, warm-up through the accessory. Budget it honestly: warm-up ~1–2 min, main lift 5×5 with ~2-min " +
  "rests ~12–14 min, one accessory (5 × 10–12) with short rest ~4–5 min. NEVER program more than fits. estMinutes must reflect this " +
  "real total (about 20) — do not claim 20 while programming 30 minutes of work.\n\n" +

  "SAFETY (these are minors): technique before load, controlled tempo, full warm-up every session, coach supervises the barbell " +
  "lifts, stop a set the moment form breaks down. Bake this into cues and guidance — never program anything risky for teenagers.\n\n" +

  "PROGRESSION: If recent-week history is provided, keep the main lifts identical but rotate the accessories and nudge difficulty " +
  "up gradually (a tougher variation, a bit more range, a new tool) so athletes keep progressing without repeating last week.\n\n" +

  "VOICE: Encouraging, clear, coach-to-athlete. Short lines that read well big on a gym board.\n\n" +

  "OUTPUT: Return ONLY a valid JSON object — no markdown, no code fences, no prose outside the JSON. A single training DAY is:\n" +
  "{\n" +
  '  "focus": string,            // the main lift, e.g. "Bench Press"\n' +
  '  "estMinutes": number,       // realistic total, ~20\n' +
  '  "warmup": [ { "name": string, "detail": string } ],\n' +
  '  "main": {\n' +
  '     "lift": string, "scheme": string,   // scheme e.g. "5 sets × 5 reps"\n' +
  '     "guidance": string,                 // how to pick the weight (no numbers)\n' +
  '     "cues": [ string ],                 // 2–4 short technique cues\n' +
  '     "rest": string                      // e.g. "~2 min between sets"\n' +
  "  },\n" +
  '  "accessories": [ {\n' +
  '     "name": string, "sets": string,      // sets e.g. "3 sets × 12–15 reps"\n' +
  '     "equipment": string, "targets": string,\n' +
  '     "howTo": string,                     // one short cue line\n' +
  '     "scale": string, "rest": string      // scale = easier + harder option in one line\n' +
  "  } ],\n" +
  '  "finisher": { "name": string, "detail": string } | null,\n' +
  '  "coachNotes": string        // one short line for the coach\n' +
  "}\n" +
  'Always return exactly { "day": DAY } for the one day requested.';

const dayLabel = (k: string): string =>
  k === "monday" ? "Monday (Bench Press, 5 sets × 5 reps)"
  : k === "wednesday" ? "Wednesday (Back Squat, 5 sets × 5 reps)"
  : k === "friday" ? "Friday (Deadlift, 5 sets × 5 reps)"
  : "Thursday (Deadlift, 5 sets × 5 reps)";

const historyBlock = (history: any): string => {
  const weeks = Array.isArray(history) ? history : [];
  if (!weeks.length) return "No prior weeks on record — this is a fresh start.\n";
  let out = "Recent weeks (rotate accessories away from these; keep the main lifts the same, nudge difficulty up):\n";
  for (const w of weeks.slice(0, 3)) {
    const d = w?.days ?? {};
    const acc = (dayKey: string) => {
      const list = Array.isArray(d?.[dayKey]?.accessories) ? d[dayKey].accessories : [];
      return list.map((a: any) => a?.name).filter(Boolean).join(", ") || "—";
    };
    out += `- Week of ${w?.week_start ?? "?"}: Mon [${acc("monday")}] · Wed [${acc("wednesday")}] · Fri [${acc("friday")}]\n`;
  }
  return out;
};

// Pull the first balanced JSON object out of the model's reply, tolerating stray
// prose or code fences even though we asked for none.
const parseJson = (raw: string): any => {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("No JSON found in AI response");
  return JSON.parse(s.slice(start, end + 1));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const body = await req.json();
    const mode: string = body.mode ?? "generate";
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    let userContent: string;
    let maxTokens: number;

    if (mode === "revise") {
      const { dayKey, day, instruction } = body;
      if (!dayKey || !day || !instruction) {
        return json({ error: "A day and an instruction are required to revise." }, 400);
      }
      userContent =
        `Here is the current ${dayLabel(dayKey)} workout as JSON:\n\n${JSON.stringify(day, null, 2)}\n\n` +
        `Revise it with this instruction from the coach: "${instruction}"\n\n` +
        `Keep the day's main lift and its scheme unless the instruction explicitly says otherwise. ` +
        `Return ONLY { "day": DAY }.`;
      maxTokens = 2000;
    } else {
      const { dayKey, weekStart, history } = body;
      if (!dayKey) return json({ error: "dayKey is required to generate a day." }, 400);
      userContent =
        `Build the ${dayLabel(dayKey)} workout${weekStart ? ` for the week of Monday ${weekStart}` : ""}.\n\n` +
        historyBlock(history) +
        `\nReturn ONLY { "day": DAY }.`;
      maxTokens = 2000;
    }

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });

    const raw = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    const parsed = parseJson(raw);
    return json(parsed);
  } catch (e) {
    console.error("strength-coach error:", e);
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: "The AI is busy right now — try again in a moment." }, 429);
    }
    if (e instanceof Anthropic.APIError) {
      return json({ error: `AI service error: ${e.message}` }, e.status ?? 500);
    }
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
