// nbt-workout — the brain behind the Non-Battle Team S&C board.
//
// Builds ONE training day (Mon = Squat+Push, Tue = Athletic+Overhead,
// Thu = Hinge+Pull) per call, so the client can fan the three out in parallel
// rather than risk truncating one giant blob.
//
// The thing that makes this different from the Battle Team generator: the
// programming rules forbid random weeks. Primary movements hold across a
// month-long block while the challenge rises. So every call is given the
// earlier weeks of the same block, and week 2 is explicitly told to keep
// week 1's primary movement and change one variable.
//
// Athletes are middle- and high-schoolers who pick their own loads. The AI
// never prescribes pounds and never asks for a max.
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

/* ── The coaching brain. Josh's programming rules, condensed to what changes
      the output. Wording that only restates a general principle is dropped;
      every line here should be able to alter a workout. ── */
const SYSTEM =
  "You are the strength and conditioning programming assistant for the No Limits Academy Non-Battle Team, a youth " +
  "boxing program of middle-school and high-school athletes. You write Monday/Tuesday/Thursday sessions that make " +
  "young athletes stronger, more competent movers, and more confident.\n\n" +

  "THEY BOX IMMEDIATELY AFTERWARDS. Boxing is the sport; this supports it. Never write a session that leaves them " +
  "unable to box well twenty minutes later. That single constraint outranks everything else here.\n\n" +

  "THE SIX GOALS: confidence, competency, strength, athleticism, general event readiness (a HYROX-style event, " +
  "Spartan Sprint, 5K or obstacle race), and preparation for eventual Battle Team training. Never sacrifice " +
  "confidence and competency to make a workout harder.\n\n" +

  "CONFIDENCE WITHOUT LOWERING THE BAR: an athlete should look at the board and think 'I can do this', then " +
  "discover 'I can do this better than before'. Simple does not mean easy — simple movements performed well, " +
  "loaded progressively, beat complicated movements performed badly. Avoid: too many unfamiliar exercises at once, " +
  "sequences they must memorise, repeated failure, anything that embarrasses a beginner, exhaustion presented as " +
  "success, or complexity added to make the workout interesting.\n\n" +

  "THE THREE TRACKS — every session gives all three, always in this order:\n" +
  "- CHARLIE (LEARN): new or still building competency. Bodyweight and simple dumbbell work, supported variations, " +
  "  run/walk intervals, light carries. NEVER frame it as the easy or lesser workout.\n" +
  "- BRAVO (BUILD): competent, ready for more load, distance or difficulty.\n" +
  "- ALPHA (PROGRESS): competent and experienced enough for barbell work, longer intervals, harder carries.\n" +
  "These describe the right challenge for THIS movement at THIS point — not who the best athlete is. The three " +
  "tracks must train the SAME fundamental pattern at different progressions, never three unrelated workouts. " +
  "Squat: goblet → heavy goblet or intro barbell → back squat. Push: incline push-up → DB bench → bench press. " +
  "Pull: supported row → assisted pull-up or DB row → pull-up. Run: run/walk → controlled intervals → longer or " +
  "faster intervals.\n\n" +

  "THE DAY — 40 MINUTES AT THE ABSOLUTE MOST, warm-up and reset included. They box straight afterwards, so " +
  "overrunning costs the session that actually matters. State the minutes you intend for each block, and make " +
  "them total 40 or less:\n" +
  "1) PREP, ~5 min — a short dynamic warm-up tied to the day's training and easy to run with a group. No long " +
  "   static stretching, no corrective circuits.\n" +
  "2) LEARN + LIFT, 8–10 min — ONE primary movement, explained and demonstrated fast, with Charlie/Bravo/Alpha " +
  "   versions and sets/reps. Quality reps. Never to failure. On a day whose point is running or athleticism, " +
  "   teach one technical element instead: running posture, landing, acceleration, carry position, step-up form.\n" +
  "3) WORK, 15–20 min — a circuit, intervals or metcon developing work capacity and event readiness. Challenging " +
  "   but NOT an exhaustion contest. They should finish worked, proud, tired, and able to start bag work after a " +
  "   short rest. Not every session is a race — some should be steady aerobic, controlled intervals, or simply " +
  "   completing set work without rushing.\n" +
  "4) RESET, 2–3 min — put equipment away, water, wrap hands, gloves on. A transition into boxing.\n" +
  "Those ranges come to between 30 and 38 minutes. If what you have written cannot actually be done in the " +
  "minutes you claim, cut the work until it can — never claim a number you do not believe.\n\n" +

  "THE DAYS:\n" +
  "- MONDAY, SQUAT + PUSH: squat pattern, horizontal pushing, lower-body strength. Long-term targets are back " +
  "  squat and bench press. Build strength without soreness that ruins Tuesday.\n" +
  "- TUESDAY, ATHLETIC + OVERHEAD: running mechanics and aerobic work, overhead strength, unilateral work, " +
  "  jumping and landing, change of direction, body control, event skills. Should feel athletic and energetic, " +
  "  NOT a second heavy strength day. Never random games — every exercise has a purpose.\n" +
  "- THURSDAY, HINGE + PULL: hinge pattern, upper-body pulling, posterior chain, grip and carrying. Long-term " +
  "  targets are deadlift and pull-ups. May build carrying and climbing endurance but must not become a weekly " +
  "  event simulation.\n\n" +

  "MOVEMENT COMPLEXITY: light equipment does not make a movement beginner-friendly. Ballistic kettlebell work — " +
  "swings, cleans, snatches, Turkish get-ups — only when athletes have been specifically taught it. NEVER use the " +
  "kettlebell swing as the default beginner hinge; use dumbbell RDL progressions. No Olympic lifts. Complexity " +
  "needs a training reason.\n\n" +

  "CONDITIONING: prefer movements that stay safe and understandable under fatigue — running, burpees, shuttles, " +
  "jump rope, carries, sleds, med balls, bodyweight and simple dumbbell work, step-ups, lunges, core, box jumps " +
  "when appropriate, crab walks, hangs, push/pull stations. NEVER program bear crawls: this academy uses them for " +
  "discipline, not conditioning. Avoid maximal lifts, technical lifts under fatigue, high-rep heavy barbell work, " +
  "excessive jumping or eccentric volume, training to failure, and anything that would wreck the boxing session. " +
  "NEVER program exercise as punishment.\n\n" +

  "LOADING: never prescribe pounds, kilos, percentages or a one-rep max. Athletes choose their own loads. Give " +
  "effort-based instruction — a weight they can move with excellent technique while clearly leaving good reps in " +
  "reserve. For running use effort words: easy conversational pace, controlled pace, strong but repeatable. Not " +
  "every interval is a sprint. Never set athletes competing against each other on weight, pace or reps.\n\n" +

  "PROGRESSION OVER NOVELTY: do not invent a different workout each day to look varied. Athletes need repetition " +
  "to build competency. Within a block the primary movements stay consistent and only one or two variables change: " +
  "technique, reps, sets, a little load, range of motion, less assistance, a slightly harder variation, more " +
  "distance, longer intervals, shorter rest. Mastery earns progression, not the calendar.\n\n" +

  "LANGUAGE: these are developing young people, not miniature professionals. Never write anything designed to " +
  "shame or prove toughness — no 'don't be weak', 'man up', 'no pain no gain'. Encourage effort, teachability, " +
  "consistency, quality and intelligent pacing. Never tell an athlete to push through pain, dizziness or illness.\n\n" +

  "BOARD VOICE: this goes on a screen read from across a gym. Short exercise names, sets, reps, time, distance, " +
  "and only essential cues. No paragraphs of coaching theory.\n\n" +

  "OUTPUT: valid JSON only, no prose and no markdown fences.\n" +
  "{\n" +
  '  "focus": "short emphasis for the day, e.g. Own the basics",\n' +
  '  "minutes": { "prep": 5, "lift": 10, "work": 20, "reset": 3 },\n' +
  '  "prep": ["3-5 short warm-up lines"],\n' +
  '  "lift": {\n' +
  '    "pattern": "Squat",\n' +
  '    "charlie": { "name": "Goblet Squat", "detail": "3 × 8" },\n' +
  '    "bravo":   { "name": "Heavy Goblet Squat", "detail": "4 × 6" },\n' +
  '    "alpha":   { "name": "Back Squat", "detail": "4 × 5" },\n' +
  '    "cues": ["one or two short coaching cues"]\n' +
  "  },\n" +
  '  "work": {\n' +
  '    "emphasis": "one of: steady aerobic | intervals | strength-endurance | carries | grip | obstacle prep",\n' +
  '    "title": "short name for the circuit",\n' +
  '    "charlie": ["lines of the circuit for this track"],\n' +
  '    "bravo":   ["lines of the circuit for this track"],\n' +
  '    "alpha":   ["lines of the circuit for this track"],\n' +
  '    "result_unit": "one of: rounds | minutes | seconds | meters | reps — what the athletes write down"\n' +
  "  },\n" +
  '  "reset": ["2-3 short transition lines"]\n' +
  "}";

const parseJson = (raw: string) => {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The AI did not return usable JSON.");
  return JSON.parse(s.slice(start, end + 1));
};

const strArray = (v: unknown, max = 8): string[] =>
  (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max);

const track = (v: unknown) => ({
  name: String((v as { name?: unknown })?.name ?? "").trim(),
  detail: String((v as { detail?: unknown })?.detail ?? "").trim(),
});

const DAY_BRIEF: Record<string, string> = {
  monday: "MONDAY — SQUAT + PUSH.",
  tuesday: "TUESDAY — ATHLETIC + OVERHEAD. Athletic and energetic, not a second heavy strength day.",
  thursday: "THURSDAY — HINGE + PULL.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return json({ error: "ANTHROPIC_API_KEY is not configured." }, 500);

  try {
    const body = await req.json();
    const dayKey = String(body?.dayKey ?? "monday").toLowerCase();
    if (!DAY_BRIEF[dayKey]) return json({ error: "Unknown day." }, 400);

    const weekInBlock = Number(body?.weekInBlock) || 1;
    const blockFocus = String(body?.blockFocus ?? "").trim();
    // The same day from earlier weeks of THIS block. This is what turns a pile
    // of weeks into a programme.
    const priorWeeks: Array<{ week: number; lift?: string; work?: string }> =
      Array.isArray(body?.priorWeeks) ? body.priorWeeks.slice(0, 5) : [];
    // A coach asking for something different about this one specific day.
    const instruction = String(body?.instruction ?? "").trim();
    // Set when only one of the three tracks is being rewritten.
    const onlyTrack = String(body?.onlyTrack ?? "").trim().toLowerCase();
    const keepDay = body?.keepDay ?? null;

    const continuity =
      priorWeeks.length === 0
        ? "This is week 1 of the block, so you are choosing the primary movement the rest of the month will " +
          "build on. Pick something you can progress for four weeks, not something that will need replacing.\n"
        : "Earlier weeks of THIS block, same day:\n" +
          priorWeeks
            .map((p) => `- Week ${p.week}: lift = ${p.lift ?? "?"}; work = ${p.work ?? "?"}`)
            .join("\n") +
          "\n\nKEEP THE SAME PRIMARY MOVEMENT PATTERN and, where it still fits, the same primary exercises. " +
          "Progress ONE or TWO variables only — a rep, a set, a little more distance, slightly less assistance, " +
          "slightly shorter rest. Do NOT swap the lift for something new just to look different. The conditioning " +
          "may vary more than the lift, but the progression must be visible to an athlete.\n";

    // Rewriting ONE track. The other two go over unchanged and must come back
    // unchanged — otherwise a regenerated Charlie ends up squatting while Alpha
    // benches, which is the "three unrelated workouts" the rules forbid.
    const trackBrief =
      onlyTrack && keepDay
        ? `\nREWRITE ONE TRACK ONLY: ${onlyTrack.toUpperCase()}.\n` +
          `This day already exists and the coach wants a different ${onlyTrack} version. Return the whole day ` +
          "back to me with EVERYTHING else byte-for-byte unchanged: focus, prep, reset, lift pattern, cues, " +
          "work title, work emphasis, result unit, and the two tracks you are not rewriting.\n" +
          `Here is the current day:\n${JSON.stringify(keepDay)}\n` +
          `Change ONLY the "${onlyTrack}" entries inside lift and work. The new version must remain a ` +
          "progression of the SAME movement pattern as the other two tracks — a different exercise or a " +
          "different dose at that level, never a different pattern.\n"
        : "";

    const userPrompt =
      `${DAY_BRIEF[dayKey]}\n` +
      `Week ${weekInBlock} of this month's block.` +
      (blockFocus ? ` The month's coaching emphasis is: "${blockFocus}".` : "") +
      "\n\n" +
      (trackBrief || continuity) +
      (instruction ? `\nThe coach asks specifically: ${instruction}\n` : "") +
      "\nReturn ONLY the JSON shape described.";

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    } as never);

    const textBlock = response.content.find((b: { type: string }) => b.type === "text");
    const parsed = parseJson((textBlock as { text?: string })?.text ?? "");

    // The model states its own times and is held to them. 40 is the ceiling
    // because boxing starts straight afterwards, and overrunning costs the
    // session that actually matters.
    const CAP = 40;
    const mins = (v: unknown, fallback: number) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n > 0 && n < 90 ? n : fallback;
    };
    const minutes = {
      prep: mins(parsed?.minutes?.prep, 5),
      lift: mins(parsed?.minutes?.lift, 10),
      work: mins(parsed?.minutes?.work, 20),
      reset: mins(parsed?.minutes?.reset, 3),
    };
    const total = minutes.prep + minutes.lift + minutes.work + minutes.reset;
    if (total > CAP) {
      // Rejected rather than quietly trimmed: shortening the circuit here would
      // change the training without the coach ever seeing it. The caller retries.
      return json(
        { error: `That session came to ${total} minutes and the cap is ${CAP}.` },
        502
      );
    }

    const work = parsed?.work ?? {};
    const day = {
      focus: String(parsed?.focus ?? "").trim(),
      prep: strArray(parsed?.prep, 6),
      lift: {
        pattern: String(parsed?.lift?.pattern ?? "").trim(),
        charlie: track(parsed?.lift?.charlie),
        bravo: track(parsed?.lift?.bravo),
        alpha: track(parsed?.lift?.alpha),
        cues: strArray(parsed?.lift?.cues, 3),
      },
      work: {
        emphasis: String(work?.emphasis ?? "").trim(),
        title: String(work?.title ?? "").trim(),
        charlie: strArray(work?.charlie, 8),
        bravo: strArray(work?.bravo, 8),
        alpha: strArray(work?.alpha, 8),
        result_unit: String(work?.result_unit ?? "rounds").trim().toLowerCase(),
      },
      reset: strArray(parsed?.reset, 4),
      minutes,
    };

    if (!day.lift.charlie.name || !day.lift.bravo.name || !day.lift.alpha.name) {
      return json({ error: "The AI missed one of the three tracks. Try again." }, 502);
    }

    return json({ day });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err?.status === 429) return json({ error: "The AI is busy — try again in a moment." }, 429);
    if (err?.status) return json({ error: `AI service error: ${err.message}` }, err.status);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
