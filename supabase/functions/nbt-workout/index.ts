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
import { thinking, textOf, extractJson } from "../_shared/claude.ts";

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

  "THE SPACE — A HARD CONSTRAINT, NOT A PREFERENCE. The two days are in different rooms and the room decides " +
  "what is physically possible:\n" +
  "- MONDAY and THURSDAY are in the PERFORMANCE CENTER. The usable floor is the basketball court, 75 ft by " +
  "  50 ft; the rest of the building holds equipment and cannot be run on. The longest straight line is 75 ft — " +
  "  TWENTY-FIVE YARDS. Running here means shuttles, down-and-backs, suicides at 5/10/15/25 yards, and short " +
  "  accelerations. NEVER write a lap, a timed distance run, or any single run longer than 25 yards. There is " +
  "  no outdoor option. Twenty-five-yard shuttles are all braking, so keep hard changes of direction to a " +
  "  sensible volume in one session and pair them with work that does not decelerate.\n" +
  "- TUESDAY is in the BOXING FACILITY, half the size, with NO ROOM TO RUN AT ALL. Not a length, not a jog, " +
  "  not a lap, not a shuttle, not a single yard. Tuesday conditioning happens ON THE SPOT. Available there: " +
  "  6 bikes, 6 rowers, jump ropes, med balls, bands, pull-up bars, dumbbells, kettlebells, and bodyweight " +
  "  movements — air squats, burpees, lunges, step-ups, push-ups, core. There are NO ski ergs; never program " +
  "  one. Twelve machines is enough for a station rotation or two waves, but NEVER assume the whole room is " +
  "  on a machine at once.\n\n" +

  "TUESDAY'S CONDITIONING STYLE: standard gym and CrossFit-style work — familiar movements repeated in rounds " +
  "or intervals, couplets and triplets a whole room can run together. It must genuinely raise heart rates. Do " +
  "NOT use shadow boxing or boxing drills as the conditioning piece; they are about to box for an hour and it " +
  "is not the training they lack. The programme's existing limits still outrank the style: no Olympic lifts, " +
  "no kipping, never to failure, never an exhaustion contest, and never athletes racing each other.\n\n" +

  "EQUIPMENT IS SHARED AND FINITE. All three tracks train AT THE SAME TIME, in the same room, and anywhere " +
  "between 15 and 40 athletes are on the floor. Two tracks reaching for the same limited item is a queue, not " +
  "a workout.\n" +
  "LIMITED — 6 assault bikes, 6 rowers, and the dumbbells and kettlebells:\n" +
  "- NO TWO TRACKS may be given the same limited item in the same block. If Alpha is on the bikes, Bravo is on " +
  "  the rowers and Charlie is on the floor.\n" +
  "- A limited item is a STATION inside a rotation, NEVER something a whole track does at the same moment. " +
  "  Write it so only a handful of athletes need it at any one time.\n" +
  "- Assume 40 could turn up. Every circuit must still work with a full room, so most of what a track is doing " +
  "  at any moment needs no equipment at all.\n" +
  "PLENTIFUL — med balls, jump ropes, bands, pull-up bars, barbells and racks, boxes, and bodyweight. Any " +
  "number of tracks may use these at once.\n" +
  "ON THE LIFT the three tracks climb an IMPLEMENT LADDER rather than sharing one — bodyweight or banded for " +
  "CHARLIE, dumbbell or kettlebell for BRAVO, barbell for ALPHA. Use these:\n" +
  "- SQUAT: air squat, box squat or tempo air squat → goblet squat → back squat.\n" +
  "- PUSH: incline or knee push-up → DB bench press → barbell bench press.\n" +
  "- OVERHEAD: pike push-up, band overhead press or wall slide → DB overhead press → barbell overhead press.\n" +
  "- HINGE: bodyweight hip hinge, band good morning or glute bridge → DB or KB Romanian deadlift → barbell " +
  "  deadlift or Romanian deadlift.\n" +
  "- PULL: inverted row, band row or scap pull-up → DB row → barbell row or pull-up.\n" +
  "Dumbbells and kettlebells are ONE rack, so they count as the same item. CHARLIE MUST NOT be given a " +
  "dumbbell, kettlebell or goblet version of the movement BRAVO is doing. If the only obvious Charlie version " +
  "needs a hand weight, use a bodyweight or banded variation instead — that is the better teaching progression " +
  "regardless. A 'goblet squat' and a 'heavy goblet squat' in two tracks is the same rack twice: not allowed.\n" +
  "CARRIES follow the same ladder: med ball hug carry or a plate for CHARLIE, dumbbell or kettlebell farmer " +
  "carry for BRAVO, heavier farmer carry for ALPHA — or replace the carry with a hang or a plank for the tracks " +
  "that cannot have the rack. Never all three tracks carrying dumbbells or kettlebells.\n" +
  "IN THE WORK BLOCK, one circuit written three times at three doses is a queue three deep. Split the " +
  "STATIONS, not just the doses: if Alpha rows, Bravo does not row — Bravo bikes, or Bravo is on the floor. " +
  "Each track's circuit must be mostly floor work that needs nothing, with at most one limited item as one " +
  "station in it, and no two tracks sharing that item.\n\n" +

  "THE CONDITIONING NEVER REPEATS THE LIFT. The lift block is quality reps under load; the work block is the " +
  "same PATTERN under fatigue with a different, simpler movement. A track that just did 4 × 8 Romanian " +
  "deadlift does not do Romanian deadlifts again in its circuit — it does hip bridges, single-leg deadlifts, " +
  "a light med ball or dumbbell ground-to-overhead, or kettlebell swings for Bravo and Alpha (never as " +
  "Charlie's hinge). Squat day: the lift is a goblet squat, so the circuit uses step-ups, lunges, wall sits, " +
  "jump squats, not goblet squats. Push day: bench in the lift, so push-ups, med ball chest pass or dips in " +
  "the circuit, not bench. This is per track — Charlie's air-squat lift means CHARLIE's circuit has no air " +
  "squats; Bravo's may. Same name, same movement, or the same movement with a different weight in front of " +
  "it, all count as a repeat. Ground-to-overhead is light — med ball or a light dumbbell, never a barbell.\n\n" +

  "THE SIX GOALS: confidence, competency, strength, athleticism, general event readiness (a HYROX-style event, " +
  "Spartan Sprint, 5K or obstacle race), and preparation for eventual Battle Team training. Never sacrifice " +
  "confidence and competency to make a workout harder.\n\n" +

  "CONFIDENCE WITHOUT LOWERING THE BAR: an athlete should look at the board and think 'I can do this', then " +
  "discover 'I can do this better than before'. Simple does not mean easy — simple movements performed well, " +
  "loaded progressively, beat complicated movements performed badly. Avoid: too many unfamiliar exercises at once, " +
  "sequences they must memorise, repeated failure, anything that embarrasses a beginner, exhaustion presented as " +
  "success, or complexity added to make the workout interesting.\n\n" +

  "THE THREE TRACKS — every session gives all three, always in this order:\n" +
  "- CHARLIE (LEARN): new or still building competency. Bodyweight and banded work, supported variations, " +
  "  shorter work intervals with longer rests, med ball carries. NEVER frame it as the easy or lesser workout.\n" +
  "- BRAVO (BUILD): competent, ready for more load, distance or difficulty.\n" +
  "- ALPHA (PROGRESS): competent and experienced enough for barbell work, longer intervals, harder carries.\n" +
  "These describe the right challenge for THIS movement at THIS point — not who the best athlete is. The three " +
  "tracks must train the SAME fundamental pattern at different progressions, never three unrelated workouts. " +
  "The lift ladders are the ones under EQUIPMENT above — bodyweight or band, then dumbbell or kettlebell, then " +
  "barbell — and they are not optional. Conditioning on MONDAY and THURSDAY, where there " +
  "is floor: run/walk shuttles → controlled shuttle intervals → longer or faster shuttle intervals, all inside " +
  "25 yards. Conditioning on TUESDAY, where there is not: shorter machine or bodyweight intervals with longer " +
  "rests → longer intervals with less rest → longer intervals at a stronger effort or heavier load. The three " +
  "tracks differ by dose and difficulty, never by who gets to run.\n\n" +

  "THE DAY — 40 MINUTES AT THE ABSOLUTE MOST, warm-up and reset included. They box straight afterwards, so " +
  "overrunning costs the session that actually matters. State the minutes you intend for each block, and make " +
  "them total 40 or less:\n" +
  "1) PREP, ~5 min — a short dynamic warm-up tied to the day's training and easy to run with a group. No long " +
  "   static stretching, no corrective circuits.\n" +
  "2) LEARN + LIFT, 8–10 min — ONE primary movement, explained and demonstrated fast, with Charlie/Bravo/Alpha " +
  "   versions and sets/reps. Quality reps. Never to failure. On a day whose point is athleticism, teach one " +
  "   technical element instead. Monday and Thursday are the only days with a runway, so sprint and shuttle " +
  "   mechanics — posture, acceleration, deceleration, landing — belong there. On TUESDAY the technical " +
  "   element must not travel: rowing stroke, bike cadence, rope technique, landing mechanics on the " +
  "   spot, carry position, step-up form, overhead position.\n" +
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
  "- TUESDAY, ATHLETIC + OVERHEAD: conditioning that raises the heart rate WITHOUT TRAVELLING, overhead " +
  "  strength, unilateral work, jumping and landing on the spot, body control, core. Should feel athletic and " +
  "  energetic, NOT a second heavy strength day. Never random games — every exercise has a purpose. No running " +
  "  and no change-of-direction drills: there is no floor for them in this room.\n" +
  "- THURSDAY, HINGE + PULL: hinge pattern, upper-body pulling, posterior chain, grip and carrying. Long-term " +
  "  targets are deadlift and pull-ups. May build carrying and climbing endurance but must not become a weekly " +
  "  event simulation.\n\n" +

  "MOVEMENT COMPLEXITY: light equipment does not make a movement beginner-friendly. Ballistic kettlebell work — " +
  "swings, cleans, snatches, Turkish get-ups — only when athletes have been specifically taught it. NEVER use the " +
  "kettlebell swing as the default beginner hinge; Charlie hinges with bodyweight and bands, Bravo with a " +
  "dumbbell RDL. No Olympic lifts. Complexity " +
  "needs a training reason.\n\n" +

  "CONDITIONING: prefer movements that stay safe and understandable under fatigue — burpees, jump rope, " +
  "bikes, rowers, carries, sleds, med balls, bodyweight and simple dumbbell work, step-ups, lunges, " +
  "core, box jumps when appropriate, hangs, push/pull stations, and — ON MONDAY AND THURSDAY ONLY — running " +
  "and shuttles within the 25-yard court. NEVER program bear crawls: this academy uses them for " +
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

  "EVIDENCE, WHEN THERE IS ANY: you may be given an anonymised summary of what the room actually managed on " +
  "this day recently — how many athletes trained each track, the movement most of them logged, median top " +
  "weight, median reps completed, and whether the circuit result is rising or falling. Use it like this:\n" +
  "- A track that completed the work prescribed and whose circuit result is holding or rising has earned ONE " +
  "  progression: a rep, a set, a little load, slightly less assistance, slightly shorter rest.\n" +
  "- A track whose reps fell short of what was prescribed, or whose circuit result went backwards, has NOT. " +
  "  Hold the movement and the dose. Progress technique, range of motion or control instead of load.\n" +
  "- The number of athletes on each track tells you where the room is. If most of them are Charlie, Charlie's " +
  "  version is the main event and gets your best writing — not a lighter afterthought.\n" +
  "- A track with nobody in it is still written in full. Somebody will be there next week.\n" +
  "- If the summary is marked THIN, or you are given none at all, you have no evidence. Progress conservatively " +
  "  on the calendar and do not pretend to be responding to anything.\n" +
  "NEVER name an athlete, quote an individual's numbers, or write a line that reads as a reply to one person. " +
  "You are given medians precisely so that no youth can be singled out on a screen the whole gym reads.\n\n" +

  "BLOCKS CONTINUE, THEY DO NOT RESET: you may be told where the previous month finished on this day. Week 1 of " +
  "a new block is a CONTINUATION, not a clean slate. Keep the same movement PATTERN. Either take the same " +
  "exercise a step further, or move up the progression the three tracks describe. Change the exercise itself " +
  "only when the pattern has already been trained for six weeks or more, or when the month's coaching emphasis " +
  "demands it — and even then the pattern stays. NEVER drop a track back to a variation it had already " +
  "outgrown. Strength does not restart on the first of the month.\n\n" +

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
  '    "charlie": { "name": "Box Squat", "detail": "3 × 8" },\n' +
  '    "bravo":   { "name": "Goblet Squat", "detail": "4 × 6" },\n' +
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

const strArray = (v: unknown, max = 8): string[] =>
  (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max);

const track = (v: unknown) => ({
  name: String((v as { name?: unknown })?.name ?? "").trim(),
  detail: String((v as { detail?: unknown })?.detail ?? "").trim(),
});

const DAY_BRIEF: Record<string, string> = {
  monday:
    "MONDAY — SQUAT + PUSH. Performance Center, on the basketball court: 75 ft by 50 ft. Any running is " +
    "shuttles or down-and-backs, 25 yards maximum, never a lap or a distance.",
  tuesday:
    "TUESDAY — ATHLETIC + OVERHEAD. Boxing facility: NO RUNNING AT ALL — there is no floor for it. Every " +
    "conditioning movement stays on the spot. Athletic and energetic, not a second heavy strength day.",
  thursday:
    "THURSDAY — HINGE + PULL. Performance Center, on the basketball court: 75 ft by 50 ft. Any running is " +
    "shuttles or down-and-backs, 25 yards maximum, never a lap or a distance.",
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
    //
    // All three tracks, not just Alpha. Anchoring continuity to Alpha alone left
    // Charlie's month a fresh guess every week — backwards, since the beginners
    // are the group that most needs the repetition. `lift` is the old
    // Alpha-only field, still read so a cached client cannot lose continuity.
    const priorWeeks: Array<{
      week: number; pattern?: string;
      charlie?: string; bravo?: string; alpha?: string;
      work?: string; lift?: string;
    }> = Array.isArray(body?.priorWeeks) ? body.priorWeeks.slice(0, 5) : [];
    // Anonymised counts and medians of what the room actually managed. Never a
    // name — see src/lib/nbtCoaching.ts, which builds it.
    const room = body?.room ?? null;
    // Where the previous month's block finished on this day.
    const carry = body?.carryOver ?? null;
    // A coach asking for something different about this one specific day.
    const instruction = String(body?.instruction ?? "").trim();
    // Why the previous attempt was thrown away. Retrying with the identical
    // prompt just reproduces the same mistake, so the reason comes back in.
    const retryNote = String(body?.retryNote ?? "").trim();
    // Set when only one of the three tracks is being rewritten.
    const onlyTrack = String(body?.onlyTrack ?? "").trim().toLowerCase();
    const keepDay = body?.keepDay ?? null;

    // Every track spelled out, so "keep the same movement" means all three.
    const weekLines = priorWeeks
      .map((p) =>
        `- Week ${p.week} — pattern: ${p.pattern || "?"}\n` +
        `    Charlie: ${p.charlie ?? p.lift ?? "?"}\n` +
        `    Bravo:   ${p.bravo ?? "?"}\n` +
        `    Alpha:   ${p.alpha ?? p.lift ?? "?"}\n` +
        `    Work:    ${p.work ?? "?"}`
      )
      .join("\n");

    // Week 1 used to be told it was choosing from nothing. It is only choosing
    // from nothing when there is genuinely no previous block behind it.
    const opening = carry
      ? "This is week 1 of a NEW block, continuing from the last one. Here is where the previous block " +
        `finished on this day (week beginning ${carry.weekStart}):\n` +
        `- Pattern: ${carry.pattern || "?"} — trained ${carry.weeksOnPattern || 1} week(s) in a row\n` +
        `    Charlie: ${carry.charlie ?? "?"}\n` +
        `    Bravo:   ${carry.bravo ?? "?"}\n` +
        `    Alpha:   ${carry.alpha ?? "?"}\n` +
        `    Work:    ${carry.work ?? "?"}\n\n` +
        "CONTINUE from there. Same pattern. Take each track one honest step on from where it ended — do not " +
        "restart the month at the beginning of the progression, and do not hand a track a variation it had " +
        "already outgrown." +
        (Number(carry.weeksOnPattern) >= 6
          ? " This pattern has now run six weeks or more, so you MAY change the primary exercise this month — " +
            "but keep the pattern and keep each track at the level it reached."
          : " It is too early to change the primary exercise; keep it and keep progressing it.") +
        "\n"
      : "This is week 1 of the block and there is no previous block to continue from, so you are choosing the " +
        "primary movement the rest of the month will build on. Pick something you can progress for four weeks, " +
        "not something that will need replacing.\n";

    const continuity =
      priorWeeks.length === 0
        ? opening
        : "Earlier weeks of THIS block, same day — ALL THREE TRACKS:\n" +
          weekLines +
          "\n\nKEEP THE SAME PRIMARY MOVEMENT PATTERN and, where it still fits, the same primary exercises — " +
          "for Charlie and Bravo as strictly as for Alpha. Progress ONE or TWO variables only: a rep, a set, a " +
          "little more distance, slightly less assistance, slightly shorter rest. Do NOT swap a lift for " +
          "something new just to look different, and do NOT leave one track's progression to chance while " +
          "carefully progressing another. The conditioning may vary more than the lift, but the progression " +
          "must be visible to an athlete in every track.\n";

    // What the room actually managed. Medians and counts only.
    const trackLine = (name: string, t: Record<string, unknown> | undefined) => {
      if (!t || !Number(t.athletes)) return `    ${name}: nobody logged`;
      const bits = [
        `${t.athletes} athlete(s)`,
        t.lift ? `mostly ${t.lift}` : null,
        t.medianTopWeight != null ? `median top weight ${t.medianTopWeight} lb` : null,
        t.medianReps != null ? `median ${t.medianReps} total reps` : null,
        t.medianWork != null ? `median circuit ${t.medianWork} ${t.unit ?? ""}`.trim() : null,
      ].filter(Boolean);
      return `    ${name}: ${bits.join(", ")}`;
    };

    const evidence = room
      ? `\nWHAT THE ROOM ACTUALLY DID on this day, across its last ${room.sessions} session(s) ` +
        `(most recent ${room.lastDate}), ${room.athletes} athlete(s) in total:\n` +
        trackLine("Charlie", room.byTrack?.charlie) + "\n" +
        trackLine("Bravo", room.byTrack?.bravo) + "\n" +
        trackLine("Alpha", room.byTrack?.alpha) + "\n" +
        (room.workTrend
          ? `    Circuit result across those sessions: ${room.workTrend}.\n`
          : "    Circuit results are not comparable across those sessions.\n") +
        (room.thin
          ? "    THIN — too few athletes to autoregulate from. Progress conservatively on the calendar and do " +
            "not write as though you are responding to this.\n"
          : "    Use this to decide who has earned a progression and who has not.\n")
      : "";

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
      evidence +
      (instruction ? `\nThe coach asks specifically: ${instruction}\n` : "") +
      (retryNote
        ? `\nYOUR PREVIOUS ATTEMPT WAS REJECTED: ${retryNote}\nFix exactly that. Keep everything else about ` +
          "the session as you would have written it.\n"
        : "") +
      "\nReturn ONLY the JSON shape described.";

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: MODEL,
      // Thinking is charged against this, and three tracks under a 40-minute
      // cap in a room with no floor is a lot to think about. Thursday used to
      // spend the whole budget deliberating and return nothing -- see
      // _shared/claude.ts. 9000 leaves room for both.
      max_tokens: 9000,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      ...thinking("medium"),
    } as never);

    const parsed = extractJson(textOf(response));

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
