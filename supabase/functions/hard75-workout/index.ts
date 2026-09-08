// hard75-workout — rewrite ONE session on the 75 Hard calendar.
//
// The 75-day plan itself is generated in code (src/lib/hard75.ts): it has to
// exist the instant someone signs up, and progressive overload across twelve
// cycles is arithmetic. This is the other half — the day he looks at Thursday
// and doesn't want it. Same body part, same place in the progression, different
// session, and nothing else on the calendar moves.
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "claude-opus-5";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM =
  "You are a strength and conditioning coach writing a single training session for someone part-way through " +
  "75 Hard — 75 consecutive days, two sessions every day, no rest days at all.\n\n" +

  "THAT CONSTRAINT GOVERNS EVERYTHING. There is no rest day coming. A session that leaves someone unable to " +
  "train tomorrow has failed, however good it looks on paper. Volume that a well-rested lifter could handle is " +
  "wrong here. Respect the athlete's age: recovery at 45 is not recovery at 22, and the programme has to still " +
  "be working in week ten.\n\n" +

  "EQUIPMENT: assume a full commercial gym, but give EVERY movement a home/firehouse substitute using only " +
  "dumbbells, bands, a bench, a pull-up bar or bodyweight. A shift away from the gym must cost the equipment, " +
  "never the session.\n\n" +

  "STRENGTH SESSIONS:\n" +
  "- Hit the body parts you are given and nothing else. This is one day in a rotation; the other muscles have " +
  "  their own days.\n" +
  "- Two compound movements first, then two or three accessories.\n" +
  "- ALWAYS finish with core work. Every strength session includes abs, without exception.\n" +
  "- Use the sets and reps given for the phase. Do not invent a different scheme.\n" +
  "- Name real, standard exercises. No branded names, no invented movements.\n\n" +

  "CARDIO SESSIONS:\n" +
  "- Match the intensity you are told. If it says recovery, write recovery — the legs did their work already.\n" +
  "- Give concrete durations and efforts a person can follow without interpreting them.\n\n" +

  "MOBILITY SESSIONS are a genuine deload: no loaded compound lifting, no conditioning finisher. The point is " +
  "that it still ticks the box while the body recovers.\n\n" +

  "TONE: plain, direct, no cheerleading. Detail lines are short — '4 × 8–10', '45 minutes, conversational " +
  "pace'. Notes are optional and at most one sentence.\n\n" +

  "OUTPUT: valid JSON only. No prose before or after, no markdown fences.\n" +
  "{\n" +
  '  "title": "Chest + Triceps",\n' +
  '  "focus": "Build",\n' +
  '  "blocks": [ { "name": "Barbell bench press", "detail": "4 × 8-10", "home": "Dumbbell floor press" } ],\n' +
  '  "notes": "optional, one sentence, omit if there is nothing worth saying"\n' +
  "}";

const parseJson = (raw: string) => {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI did not return usable JSON.");
  return JSON.parse(s.slice(start, end + 1));
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not configured." }, 500);

  try {
    const body = await req.json();
    const kind = body?.kind === "cardio" ? "cardio" : "strength";
    const title = String(body?.title ?? "").trim();
    const focus = String(body?.focus ?? "").trim();
    const dayNumber = Number(body?.dayNumber) || 1;
    const sets = Number(body?.sets) || 4;
    const reps = String(body?.reps ?? "8–10");
    const accessoryReps = String(body?.accessoryReps ?? "10–12");
    const mobility = !!body?.mobility;

    const age = body?.age ? Number(body.age) : null;
    const goal = String(body?.goal ?? "").trim();
    const limitations = String(body?.limitations ?? "").trim();
    // What he's already been given this week, so a replacement isn't the same
    // session he just rejected.
    const avoid: string[] = Array.isArray(body?.avoid) ? body.avoid.slice(0, 30) : [];

    const who =
      `The athlete is ${age ? `${age} years old` : "an adult"}` +
      (goal ? `, training for: ${goal}` : "") +
      (limitations ? `. Must work around: ${limitations}` : "") +
      ".";

    const userPrompt =
      `${who}\n` +
      `This is day ${dayNumber} of 75. There is no rest day before or after it.\n\n` +
      (kind === "strength"
        ? mobility
          ? "Write the MOBILITY + CORE session. It is the deload in a six-day rotation — the only easy day in " +
            "six — so nothing loaded or heavy. Mobility work, carries or holds, and core.\n"
          : `Write the STRENGTH session for: ${title}.\n` +
            `Phase: ${focus}. Use ${sets} sets of ${reps} on the compounds and 3 sets of ${accessoryReps} on ` +
            `the accessories. Finish with core work.\n`
        : `Write the CARDIO session. Intended character: ${title} — ${focus}.\n` +
          "Do not make it harder than that character calls for; it is scheduled against a strength day.\n") +
      (avoid.length
        ? `\nHe has just rejected this session, so choose different movements:\n- ${avoid.join("\n- ")}\n`
        : "") +
      "\nReturn ONLY the JSON shape described.";

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { effort: "low" },
    } as never);

    const textBlock = response.content.find((b: { type: string }) => b.type === "text");
    const parsed = parseJson((textBlock as { text?: string })?.text ?? "");

    const blocks = (Array.isArray(parsed?.blocks) ? parsed.blocks : [])
      .map((b: { name?: unknown; detail?: unknown; home?: unknown }) => ({
        name: String(b?.name ?? "").trim(),
        detail: String(b?.detail ?? "").trim(),
        home: String(b?.home ?? "").trim() || undefined,
      }))
      .filter((b: { name: string }) => b.name)
      .slice(0, 10);

    if (blocks.length === 0) {
      return json({ error: "Nothing usable came back. Try again." }, 502);
    }

    return json({
      workout: {
        kind,
        title: String(parsed?.title ?? title).trim() || title,
        focus: String(parsed?.focus ?? focus).trim() || focus,
        blocks,
        notes: String(parsed?.notes ?? "").trim() || undefined,
        ...(kind === "cardio" ? { outdoor: !!body?.outdoor } : {}),
      },
    });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err?.status === 429) {
      return json({ error: "The AI is busy right now — try again in a moment." }, 429);
    }
    if (err?.status) return json({ error: `AI service error: ${err.message}` }, err.status);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
