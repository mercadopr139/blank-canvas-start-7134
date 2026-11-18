// nbt-workout — the brain behind the Non-Battle Team S&C board.
//
// Builds ONE training day per call, so the client can fan a week's nights out
// in parallel rather than risk truncating one giant blob.
//
// ONE GROUP since 2026-11-09 (Rev, through Josh): about a dozen athletes, one
// lift for everyone with a simplified version, a warm-up written for that
// lift, then the Cardio Stations.
//
// REV'S ROTATION since 2026-11-18: the lift and the stations arrive DECIDED.
// The client (src/lib/nbtRotation.ts) picks the lift — eight movements in
// Rev's order, one per session, each coming back every eighth — and picks
// each station's movement from Rev's list for that role. This function
// writes the warm-up, the lift's dose and run-it cue, the simplified line,
// the cues, and one short cue on each station. It is told what the group did
// the last time this lift ran, and progresses one variable from there.
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

/* ── The coaching brain. Josh's and Rev's programming rules, condensed to what
      changes the output. Wording that only restates a general principle is
      dropped; every line here should be able to alter a workout. ── */
const SYSTEM =
  "You are the strength and conditioning programming assistant for the No Limits Academy Non-Battle Team, a youth " +
  "boxing program of middle-school and high-school athletes led by Rev (Pastor Bill). You write Monday/Tuesday/" +
  "Thursday sessions that make young athletes stronger, more competent movers, and more confident.\n\n" +

  "THEY BOX IMMEDIATELY AFTERWARDS. Boxing is the sport; this supports it. Never write a session that leaves them " +
  "unable to box well twenty minutes later. That single constraint outranks everything else here.\n\n" +

  "ONE GROUP, ONE LIFT (Rev, 2026-11-09). The Non-Battle Team trains as ONE group of about a dozen athletes. " +
  "There are no tracks and no levels: never write 'Alpha', 'Bravo', 'track', 'group A' or anything that sorts " +
  "the athletes. Everyone warms up together, does the SAME primary lift, then rotates through the Cardio " +
  "Stations together.\n\n" +

  "THE LIFT AND THE STATIONS ARE DECIDED BEFORE YOU ARE ASKED (Rev, 2026-11-18). Every request names THE LIFT " +
  "TODAY — one of the eight movements Rev rotates through, one per session, in his order — and lists THE " +
  "STATIONS with the movement each one does. You do not choose the lift, you do not choose a station's " +
  "movement, and you never add, drop, reorder or rename a station. What you write: the warm-up for the lift, " +
  "the lift's dose and run-it cue, the one simplified line, one or two coaching cues, a short cue on each " +
  "station, and the reset.\n\n" +

  "THE SPACE — A HARD CONSTRAINT, NOT A PREFERENCE. The days are in different rooms and the room decides " +
  "what is physically possible. The exact room and its inventory for THIS day come with every request under " +
  "THE ROOM TODAY — read it first and obey it over anything general here:\n" +
  "- MONDAY and THURSDAY are in the PERFORMANCE CENTER. The usable floor is the basketball court, 75 ft " +
  "  baseline to baseline and 56 ft sideline to sideline; the rest of the building holds equipment and cannot " +
  "  be run on. The longest straight line is one court length — 75 ft, TWENTY-FIVE YARDS. NEVER write a lap, " +
  "  a timed distance run, or any single run longer than the court. There is no outdoor option.\n" +
  "  SAY DISTANCE IN COURT, NEVER IN METERS, YARDS OR FEET, for anything done on the floor — carries, " +
  "  walks, lunges, shuttles, sprints. The only four distances: 'baseline to baseline' (75 ft), " +
  "  'baseline to baseline and back' (150 ft), 'sideline to sideline' (56 ft), 'sideline to sideline and " +
  "  back' (112 ft). Multiply with × for more: 'baseline to baseline and back × 2'. 'Overhead carry 20 m' is " +
  "  wrong; 'overhead carry — baseline to baseline' is right. A kid can see a baseline; nobody can see 20 " +
  "  metres. Rower, bike and ski erg lines keep their metres or calories, because that is what the machine " +
  "  shows. The machines — bikes, rowers, ski ergs — are HERE, on the Machines station. The ONE push sled is " +
  "  for the push station only, two athletes taking turns; it is never anywhere else in the day.\n" +
  "- TUESDAY is in the BOXING FACILITY, half the size, with NO ROOM TO RUN AT ALL. Not a length, not a jog, " +
  "  not a lap, not a shuttle, not a single yard. Tuesday conditioning happens ON THE SPOT. There are NO " +
  "  machines in this room — no bikes, no rowers, no ski ergs; they are in the other building with " +
  "  the Junior Boxers — and no sled. Tuesday's work is jump rope, wall balls, med balls, bands, pull-up bars, " +
  "  dumbbells, kettlebells and bodyweight. Anything that walks — a duck walk, a crab walk, an inch worm — " +
  "  goes a few steps out and back on the open floor, never across the room.\n\n" +

  "THE DAY HAS FOUR PARTS AND THE MINUTES ARE FIXED — you do not choose them and you do not state them. " +
  "Warm-up 5. Lift 10 — fifteen at the very most, so write a dose that finishes in ten for a dozen athletes " +
  "sharing racks. Cardio Stations 3 minutes a station: six stations in the Performance Center, five in the " +
  "boxing facility. Reset 3. They box straight afterwards.\n\n" +

  "1) THE WARM-UP IS FOR THE LIFT (Rev, 2026-11-09) — 5 minutes, 3 to 5 short lines in \"prep\", easy to run with " +
  "a dozen athletes at once. It prepares THIS lift, not the body in general: first the joints and the pattern " +
  "the lift needs, done with bodyweight, a band or a light implement (bench press day: band pull-aparts, " +
  "scapular push-ups, push-ups; squat day: air squats, hip openers, a goblet squat hold; clean day: hip hinge, " +
  "high pulls with an empty bar, front-rack position); then the LAST line is ramp-up sets of the lift itself — " +
  "'Ramp up: 2 easy sets of 5 with the empty bar, then build to your working weight' — or, for a lift with no " +
  "bar, 2 easy sets of the simplified version. Every line carries its count: reps, or a court length on Monday " +
  "and Thursday. No long static stretching, no corrective circuits, no conditioning — nobody should be " +
  "breathing hard before the lift. The room's rules apply to the warm-up too: nothing that travels on Tuesday, " +
  "court language on Monday and Thursday, no dumbbells on Monday.\n\n" +

  "2) THE LIFT — the one named in the request, for the whole group, explained and demonstrated fast, with its " +
  "sets and reps. Quality reps. Never to failure. RACKS ARE SHARED: three or four athletes take turns on one " +
  "bar, alternating sets while the others rest. Write the dose for a GROUP taking turns to finish inside ten " +
  "minutes, not for one athlete alone — 3 × 8 shared four ways is twelve sets on that rack. Put the dose first " +
  "in the detail, then the run-it cue for the coach on the floor: '3 × 8 — four to a rack, rotate every set'. " +
  "THE PULL-UP BARS ARE THE RACKS, and so is an inverted row, a ring row or a band on a post.\n" +
  "THE SIMPLIFIED VERSION — \"easier\" (Rev, 2026-11-18): Rev's simplified counterpart for this lift comes with " +
  "the request, one or two options. Write ONE short line a coach can say out loud: the counterpart movement, " +
  "then its dose — 'Goblet squat with a kettlebell — 3 × 10'. Where two are given, name both: 'Push-ups, or " +
  "incline push-ups on a bench — 3 × 10'. It is the SAME pattern fitted to an athlete still learning it, done " +
  "OFF THE RACKS on the floor beside them with what is in his hands, so it never adds to the line for a bar. " +
  "Never framed as the lesser workout. There is no 'harder' line — do not write one.\n" +
  "CLEANS (Rev, 2026-11-18): barbell cleans and the clean and press are standing lifts in this rotation. The " +
  "group has done curls and presses from day one, so the simplified counterpart is the on-ramp and the barbell " +
  "is for athletes who have shown the catch. Teach the catch — elbows through, soft knees — low reps, full " +
  "rest. Snatches and jerks stay out.\n" +
  "WHEN THE LIFT IS ON HAND WEIGHTS: the hand weights are few at the light end — five dumbbells and three " +
  "kettlebells of each weight — so it is ONE PIECE PER KID: a single dumbbell in both hands pressed from the " +
  "chest; a kettlebell by the horns; a plate for a front raise, a plate press, a goblet hold. Two dumbbells " +
  "only when the count allows. SPREAD the same movement across dumbbells, kettlebells and plates at once so " +
  "nobody waits, and say so in the detail: '3 × 10 — one dumbbell in both hands, or a kettlebell by the " +
  "horns, or a plate'.\n" +
  "MONDAY SHARES THE ROOM WITH THE BATTLE TEAM (Josh, 2026-10-20), who lift at the same time and HAVE THE " +
  "DUMBBELLS. On Monday there are NO DUMBBELLS ANYWHERE IN THE DAY — not in the warm-up, the lift, the " +
  "simplified version, or on a station. Monday's hand weight is the KETTLEBELL, plus barbells, plates, med " +
  "balls, bands, boxes, machines and bodyweight. Tuesday and Thursday are not shared; dumbbells are fine.\n\n" +

  "3) THE CARDIO STATIONS (Rev, 2026-11-18) — each line is GIVEN; you add the cue. The header exactly as given " +
  "('6 stations · 3 min each · rotate on the whistle'), then each station line EXACTLY as given — 'Station 1 · " +
  "The Racks (Pull) — Bent-over rows' — followed by ' — ' and ONE short cue: a pace word or a form cue " +
  "('strong but repeatable', 'chest to the floor', 'land soft', 'flat back, elbows past the ribs'). ON A " +
  "STATION THE CLOCK IS THE DOSE: three minutes at the athlete's own pace, about two athletes to a station, " +
  "so NO count and NO time on the line — not '10 reps', not '30 sec'. The whistle moves everyone. 'Machine of " +
  "choice' and \"Coach's choice\" stay as written, with a cue the coach can use ('steady pace, long pulls'; " +
  "'two core moves, the coach calls them'). The sled line's cue is for two taking turns: 'short pushes, walk " +
  "back easy'.\n" +
  "THE STYLE INSIDE A STATION: work that genuinely raises heart rates — challenging but NOT an exhaustion " +
  "contest. They should finish worked, proud, tired, and able to start bag work after a short rest. No " +
  "kipping, never to failure, and never athletes racing each other.\n\n" +

  "4) RESET — 2 or 3 short lines: put equipment away, water, wrap hands, gloves on. A transition into boxing.\n\n" +

  "THE SIX GOALS: confidence, competency, strength, athleticism, general event readiness (a HYROX-style event, " +
  "Spartan Sprint, 5K or obstacle race), and preparation for eventual Battle Team training. Never sacrifice " +
  "confidence and competency to make a workout harder.\n\n" +

  "CONFIDENCE WITHOUT LOWERING THE BAR: an athlete should look at the board and think 'I can do this', then " +
  "discover 'I can do this better than before'. Simple does not mean easy — simple movements performed well, " +
  "loaded progressively, beat complicated movements performed badly. Avoid: sequences they must memorise, " +
  "repeated failure, anything that embarrasses a beginner, exhaustion presented as success.\n\n" +

  "MOVEMENT COMPLEXITY: light equipment does not make a movement beginner-friendly. Ballistic kettlebell work — " +
  "swings, snatches, Turkish get-ups — only when athletes have been specifically taught it. No snatches, no " +
  "jerks. NEVER program bear crawls: this academy uses them for discipline, not conditioning. NEVER program " +
  "exercise as punishment.\n\n" +

  "LOADING: never prescribe pounds, kilos, percentages or a one-rep max. Athletes choose their own loads. Give " +
  "effort-based instruction — a weight they can move with excellent technique while clearly leaving good reps in " +
  "reserve. Never set athletes competing against each other on weight, pace or reps.\n\n" +

  "PROGRESSION — THE LIFT COMES BACK EVERY EIGHTH SESSION. You are told what the group did the LAST TIME this " +
  "lift ran: its dose and its simplified line. Progress ONE variable from there: reps up a step (5 → 8 → 10 → " +
  "12), or a set, or a little more load and back to 8; the simplified line moves with it. If there is no last " +
  "time, choose a starting dose the whole group can own — 3 × 8, or 4 × 5 for a heavy pattern — not a test. " +
  "Mastery earns progression, not the calendar; never drop the group back to a dose it has already outgrown.\n\n" +

  "EVIDENCE, WHEN THERE IS ANY: you may be given an anonymised summary of what the room actually managed on " +
  "this day recently — how many athletes trained, the movement most of them logged, median top weight, median " +
  "reps completed, and whether the stations result is rising or falling. A room that completed the work " +
  "prescribed and whose result is holding or rising has earned ONE progression. A room whose reps fell short " +
  "or whose result went backwards has NOT: hold the dose and progress technique instead. If the summary is " +
  "marked THIN, or you are given none, progress conservatively on the calendar and do not pretend to be " +
  "responding to anything. NEVER name an athlete, quote an individual's numbers, or write a line that reads " +
  "as a reply to one person.\n\n" +

  "LANGUAGE: these are developing young people, not miniature professionals. Never write anything designed to " +
  "shame or prove toughness — no 'don't be weak', 'man up', 'no pain no gain'. Encourage effort, teachability, " +
  "consistency, quality and intelligent pacing. Never tell an athlete to push through pain, dizziness or illness.\n\n" +

  "BOARD VOICE: this goes on a screen read from across a gym. Short exercise names, sets, reps, and only " +
  "essential cues. No paragraphs of coaching theory.\n\n" +

  "REPS ARE 5, 8, 10 OR 12 — NOTHING ELSE (Josh, 2026-10-20: a kid reads '4 × 9' and stops to think). Every " +
  "lift dose — the lift, and the dose in the simplified line — is sets × one of those four: 5 for heavy work, " +
  "8, 10 or 12 otherwise. Never 6, 7, 9 or 11, and never a range like '10–12'.\n\n" +

  "OUTPUT: valid JSON only, no prose and no markdown fences.\n" +
  "{\n" +
  '  "focus": "short emphasis for the day, e.g. Own the basics",\n' +
  '  "prep": ["Band pull-aparts × 12", "Air squats × 10 — slow down, fast up", "Hip openers × 5 each side", "Ramp up: 2 easy sets of 5 with the empty bar, then build to your working weight"],\n' +
  '  "lift": {\n' +
  '    "pattern": "Squat",\n' +
  '    "main":   { "name": "Back Squat", "detail": "3 × 8 — four to a rack, rotate every set" },\n' +
  '    "easier": "Goblet squat with a kettlebell, or a bodyweight squat — 3 × 10",\n' +
  '    "cues": ["one or two short coaching cues"]\n' +
  "  },\n" +
  '  "work": {\n' +
  '    "emphasis": "one of: steady aerobic | intervals | strength-endurance | carries | grip | obstacle prep",\n' +
  '    "stations": ["6 stations · 3 min each · rotate on the whistle", "Station 1 · The Racks (Pull) — Bent-over rows — flat back, elbows past the ribs", "Station 2 · The Machines (Cardio) — Machine of choice — steady pace, long pulls", "Station 3 · The Mats (Push) — Push-ups — chest to the floor", "Station 4 · Open Court (Core) — Coach\'s choice — two core moves, the coach calls them", "Station 5 · Open Court (Legs) — Lunges — knee kisses the floor", "Station 6 · Open Court (Full Body Cardio) — Burpees — steady, land soft"],\n' +
  '    "result_unit": "rounds — what the athletes write down"\n' +
  "  },\n" +
  '  "reset": ["2-3 short transition lines"]\n' +
  "}";

const strArray = (v: unknown, max = 8): string[] =>
  (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, max);

const movement = (v: unknown) => ({
  name: String((v as { name?: unknown })?.name ?? "").trim(),
  detail: String((v as { detail?: unknown })?.detail ?? "").trim(),
});

/** What the model sends back, before it is checked and tidied. */
type Parsed = {
  focus?: unknown;
  prep?: unknown;
  lift?: { pattern?: unknown; main?: unknown; easier?: unknown; harder?: unknown; cues?: unknown };
  work?: { emphasis?: unknown; stations?: unknown; result_unit?: unknown };
  reset?: unknown;
};

const DAY_BRIEF: Record<string, string> = {
  monday:
    "MONDAY. Performance Center, on the basketball court: 75 ft baseline to baseline, 56 ft sideline to " +
    "sideline. Floor distances are said in court — never in metres, yards or feet. Never a lap. The one sled " +
    "is for the push station only. Warm-up 5 min, lift 10 min, then CARDIO STATIONS: six stations, three " +
    "minutes each. THE BATTLE TEAM HAS THE DUMBBELLS TODAY: no dumbbells anywhere in this day — the warm-up, " +
    "the lift, the simplified version, or any station — kettlebells instead.",
  tuesday:
    "TUESDAY. Boxing facility: NO RUNNING AT ALL — there is no floor for it — and NO machines — no bikes, no " +
    "rowers, no ski ergs — and no sled. Every movement stays on the spot. Warm-up 5 min, lift 10 min, then " +
    "CARDIO STATIONS: five stations, three minutes each.",
  thursday:
    "THURSDAY. Performance Center, on the basketball court: 75 ft baseline to baseline, 56 ft sideline to " +
    "sideline. Floor distances are said in court — never in metres, yards or feet. Never a lap. The one sled " +
    "is for the push station only. Warm-up 5 min, lift 10 min, then CARDIO STATIONS: six stations, three " +
    "minutes each.",
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
    // The room and its inventory, from the client's single source of truth.
    const roomKit = String(body?.roomKit ?? "").trim();
    // THE LIFT, decided by the rotation on the client: its name, its pattern and
    // Rev's simplified counterpart(s) for this day.
    const lift = body?.lift as { name?: unknown; pattern?: unknown; easier?: unknown } | null;
    const liftName = String(lift?.name ?? "").trim();
    const liftPattern = String(lift?.pattern ?? "").trim();
    const easierOptions = strArray(lift?.easier, 3);
    if (!liftName) return json({ error: "No lift was given for this day." }, 400);
    // What the group did the last time this lift ran, if it has.
    const lastTime = body?.lastTime as { date?: unknown; detail?: unknown; easier?: unknown } | null;
    // THE STATIONS, decided on the client: the header and one line per station,
    // each ending at the movement. The model adds " — cue" to each.
    const stations = body?.stations as { header?: unknown; lines?: unknown } | null;
    const header = String(stations?.header ?? "").trim();
    const prefixes = strArray(stations?.lines, 8);
    if (!header || !prefixes.length) return json({ error: "No stations were given for this day." }, 400);
    // Anonymised counts and medians of what the room actually managed. Never a
    // name — see src/lib/nbtCoaching.ts, which builds it.
    const room = body?.room ?? null;
    // A coach asking for something different about this one specific day.
    const instruction = String(body?.instruction ?? "").trim();
    // Why the previous attempt was thrown away. Retrying with the identical
    // prompt just reproduces the same mistake, so the reason comes back in.
    const retryNote = String(body?.retryNote ?? "").trim();
    // Set when only part of an existing day is being rewritten: the lift (with
    // its simplified line and its warm-up), or the Cardio Stations.
    const onlyBlock = ["lift", "work"].includes(String(body?.onlyBlock ?? "")) ? String(body.onlyBlock) : "";
    const keepDay = body?.keepDay ?? null;

    const said = (v: unknown) => { const s = String(v ?? "").trim(); return s && s !== "—" ? s : ""; };

    const liftBrief =
      `THE LIFT TODAY: ${liftName}${liftPattern ? ` — pattern: ${liftPattern}` : ""}. ` +
      `Simplified counterpart${easierOptions.length > 1 ? "s" : ""}: ${easierOptions.join(" / ") || "the same pattern one rung down"}.\n` +
      (lastTime && (said(lastTime.detail) || said(lastTime.date))
        ? `LAST TIME THIS LIFT RAN (${said(lastTime.date) || "earlier"}): ${said(lastTime.detail) || "dose not recorded"}` +
          `${said(lastTime.easier) ? `; simplified: ${said(lastTime.easier)}` : ""}. Progress ONE variable from there.\n`
        : "This lift has not been written in the rotation before: choose a starting dose the whole group can own.\n");

    const stationBrief =
      "THE STATIONS TODAY — write the header exactly as given, then each line exactly as given followed by " +
      "' — ' and one short cue:\n" +
      `${header}\n` +
      prefixes.join("\n") + "\n";

    // What the room actually managed. Medians and counts only.
    const evidence = room && Number(room.athletes)
      ? `\nWHAT THE ROOM ACTUALLY DID on this day, across its last ${room.sessions} session(s) ` +
        `(most recent ${room.lastDate}): ` +
        [
          `${room.athletes} athlete(s)`,
          room.lift ? `mostly ${room.lift}` : null,
          room.medianTopWeight != null ? `median top weight ${room.medianTopWeight} lb` : null,
          room.medianReps != null ? `median ${room.medianReps} total reps` : null,
          room.medianWork != null ? `median stations result ${room.medianWork} ${room.unit ?? ""}`.trim() : null,
        ].filter(Boolean).join(", ") + ".\n" +
        (room.workTrend
          ? `    Stations result across those sessions: ${room.workTrend}.\n`
          : "    Stations results are not comparable across those sessions.\n") +
        (room.thin
          ? "    THIN — too few athletes to autoregulate from. Progress conservatively on the calendar and do " +
            "not write as though you are responding to this.\n"
          : "    Use this to decide whether the room has earned a progression.\n")
      : "";

    // Rewriting ONE part of a day that exists. The rest goes over unchanged
    // and must come back unchanged; the client also puts it back from what it
    // sent, so a model that ignores this still cannot disturb it.
    const partBrief =
      onlyBlock && keepDay
        ? "\nREWRITE ONE PART ONLY. This day already exists. Return the whole day back to me with everything " +
          "you are not asked to change byte-for-byte unchanged.\n" +
          `Here is the current day:\n${JSON.stringify(keepDay)}\n` +
          (onlyBlock === "lift"
            ? `The coach wants the LIFT written again. The lift stays ${liftName} — the rotation decides it, not ` +
              "you. Write a new dose and run-it cue in \"main\", a new simplified line in \"easier\", new cues, " +
              "and a new \"prep\" — the warm-up is for the lift, so it follows the lift. Leave the Cardio " +
              "Stations exactly as they are.\n"
            : "The coach wants the CARDIO STATIONS written again: the new lines are under THE STATIONS TODAY. " +
              "Write the \"stations\" block from them — header, then each line with its cue. Leave the warm-up, " +
              "the lift and its simplified line exactly as they are.\n")
        : "";

    const userPrompt =
      `${DAY_BRIEF[dayKey]}\n` +
      (roomKit ? `${roomKit}\n` : "") +
      `Week ${weekInBlock} of this month.` +
      (blockFocus ? ` The month's coaching emphasis is: "${blockFocus}".` : "") +
      "\n\n" +
      liftBrief + "\n" +
      stationBrief +
      evidence +
      partBrief +
      (instruction ? `\nThe coach asks specifically: ${instruction}\n` : "") +
      (retryNote
        ? `\nYOUR PREVIOUS ATTEMPT WAS REJECTED: ${retryNote}\nFix exactly that. Keep everything else about ` +
          "the session as you would have written it.\n"
        : "") +
      "\nReturn ONLY the JSON shape described.";

    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    /* ── The checks. A prompt rule can be ignored silently, so the day is read
          back and, on a miss, asked for again with the reason attached. Three
          tries, then an honest error. ── */

    // On a part rewrite only the part asked for is judged: the rest is the
    // coach's own day coming back untouched, and may predate these rules.
    const judgeLift = onlyBlock !== "work";
    const judgeStations = onlyBlock !== "lift";

    // Monday shares the room: the Battle Team has the dumbbells.
    const DB = /dumb\s*bell|\bdbs?\b/i;
    const mondayDumbbell = (p: Parsed) => {
      if (dayKey !== "monday") return false;
      const judged = [
        judgeLift ? [p?.focus, p?.prep, p?.lift, p?.reset] : [],
        judgeStations ? [p?.work] : [],
      ];
      return DB.test(JSON.stringify(judged));
    };

    // Reps are 5, 8, 10 or 12: every "sets × reps" in the lift and in its
    // simplified line is read back.
    const REPS_OK = new Set([5, 8, 10, 12]);
    const oddReps = (p: Parsed): string[] => {
      const lines: [string, string][] = [
        ["lift", String((p?.lift?.main as { detail?: unknown })?.detail ?? "")],
        ["easier", String(p?.lift?.easier ?? "")],
      ];
      return lines.flatMap(([where, text]) => {
        const bad: string[] = [];
        for (const m of text.matchAll(/\d+\s*[×x]\s*(\d+)(?:\s*[–-]\s*(\d+))?/g)) {
          if (m[2] || !REPS_OK.has(Number(m[1]))) bad.push(`${where}: ${m[0]}`);
        }
        return bad;
      });
    };

    // The lift is the one given, with a simplified line built on Rev's
    // counterpart, and no word of the retired tracks anywhere in the day.
    const TRACK_WORD = /\b(?:alpha|bravo|charlie)\b/i;
    const firstWords = easierOptions.map((o) => o.split(/\s+/)[0].toLowerCase().replace(/[^a-z-]/g, "")).filter(Boolean);
    const liftProblems = (p: Parsed): string[] => {
      const bad: string[] = [];
      if (!movement(p?.lift?.main).detail) bad.push('"main" has no dose');
      const easier = String(p?.lift?.easier ?? "").trim();
      if (!easier) bad.push('"easier" is empty');
      else if (firstWords.length && !firstWords.some((w) => easier.toLowerCase().includes(w))) {
        bad.push(`"easier" must be Rev's simplified counterpart — ${easierOptions.join(" or ")} — not "${easier}"`);
      }
      if (strArray(p?.prep, 6).length < 2) bad.push('"prep" needs the warm-up for the lift: 3 to 5 lines');
      if (TRACK_WORD.test(JSON.stringify(p ?? {}))) bad.push("it names Alpha or Bravo — there is one group now");
      return bad;
    };

    // The stations: the header as given, each line as given plus its cue, no
    // counts and no times on a station line.
    const stationProblems = (p: Parsed): string[] => {
      const lines = Array.isArray(p?.work?.stations) ? (p!.work!.stations as unknown[]).map((l) => String(l).trim()) : [];
      const bad: string[] = [];
      const n = prefixes.length;
      if (lines.length !== n + 1) bad.push(`${lines.length} lines (need the header and ${n} stations)`);
      if ((lines[0] ?? "") !== header) bad.push(`header "${lines[0] ?? ""}" (must be exactly: ${header})`);
      prefixes.forEach((want, i) => {
        const l = lines[i + 1] ?? "";
        if (!l.startsWith(want)) { bad.push(`"${l}" (must start exactly: ${want})`); return; }
        const rest = l.slice(want.length);
        if (rest && !rest.startsWith(" — ")) bad.push(`"${l}" (after the movement, ' — ' then the cue)`);
        if (/\b\d+\s*(sec|secs|seconds|s|min|mins|minutes|reps?)\b|\d+:\d\d|\b\d+\s*[×x]\s*\d+/i.test(rest)) bad.push(`"${l}" (no counts or times on a station line — the clock is the dose)`);
      });
      return bad;
    };

    /** Why this attempt is refused, written to be handed straight back to the model; "" when it is good. */
    const rejection = (p: Parsed): string => {
      const liftBad = judgeLift ? liftProblems(p) : [];
      if (liftBad.length) {
        return (
          "the lift is not in the required shape: " + liftBad.join("; ") + `. The lift is ${liftName}: write ` +
          "its dose and run-it cue in \"main\", ONE simplified line in \"easier\" built on Rev's counterpart, " +
          "and the warm-up for that lift in \"prep\". Everything else can stay."
        );
      }
      const odd = judgeLift ? oddReps(p) : [];
      if (odd.length) {
        return (
          "these doses use reps that are not 5, 8, 10 or 12, or use a range: " +
          odd.map((l) => `"${l}"`).join(", ") + ". Rewrite each as sets × 5, 8, 10 or 12 — one number. " +
          "Everything else can stay."
        );
      }
      const st = judgeStations ? stationProblems(p) : [];
      if (st.length) {
        return (
          "the Cardio Stations block is not in the required shape: " + st.join("; ") +
          ". Rewrite the block: the header exactly as given, then each station line exactly as given followed " +
          "by ' — ' and one short cue — no counts, no times. Everything else can stay."
        );
      }
      if (mondayDumbbell(p)) {
        return (
          "it is MONDAY and the day uses dumbbells somewhere. The Battle Team has the dumbbells on Monday. " +
          "Replace every dumbbell — in the warm-up, the lift, the simplified line, the stations and the cues — " +
          "with a kettlebell, a barbell, a plate, a med ball, a band or bodyweight. Everything else can stay."
        );
      }
      return "";
    };

    let parsed: Parsed = {};
    let refused = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        // Thinking is charged against this; a full day in a room with no floor
        // is a lot to think about -- see _shared/claude.ts. 9000 leaves room for both.
        max_tokens: 9000,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: userPrompt + (refused ? `\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED: ${refused}` : ""),
        }],
        ...thinking("medium"),
      } as never);
      parsed = extractJson(textOf(response)) as Parsed;
      refused = rejection(parsed);
      if (!refused) break;
    }
    if (refused) {
      if (judgeLift && liftProblems(parsed).length) return json({ error: "The AI kept missing the lift's dose, its simplified line, or the warm-up. Try again." }, 502);
      if (judgeLift && oddReps(parsed).length) return json({ error: "The coach kept writing reps that are not 5, 8, 10 or 12. Try again." }, 502);
      if (judgeStations && stationProblems(parsed).length) return json({ error: "The coach kept writing the Cardio Stations in the wrong shape. Try again." }, 502);
      return json({ error: "The coach kept reaching for dumbbells on Monday, when the Battle Team has them. Try again." }, 502);
    }

    // Fixed (Rev, 2026-11-18): warm-up 5, lift 10, three minutes a station, reset 3.
    const minutes = { prep: 5, lift: 10, work: prefixes.length * 3, reset: 3 };

    // The stations come back exactly as given plus the cue; said again here so
    // a line the model drifted on cannot reach the wall.
    const returned = Array.isArray(parsed?.work?.stations) ? (parsed!.work!.stations as unknown[]).map((l) => String(l).trim()) : [];
    const stationsOut = [header, ...prefixes.map((want, i) => {
      const l = returned[i + 1] ?? "";
      const cue = l.startsWith(want) ? l.slice(want.length).replace(/^\s*—\s*/, "").trim() : "";
      return cue ? `${want} — ${cue}` : want;
    })];

    const work = parsed?.work ?? {};
    const day = {
      focus: String(parsed?.focus ?? "").trim(),
      // The warm-up for the lift.
      prep: strArray(parsed?.prep, 6),
      lift: {
        pattern: liftPattern || String(parsed?.lift?.pattern ?? "").trim(),
        // The rotation's lift, by name; the model wrote the dose.
        main: { name: liftName, detail: movement(parsed?.lift?.main).detail },
        easier: String(parsed?.lift?.easier ?? "").trim(),
        // Retired with the rotation (Rev, 2026-11-18): one simplified line only.
        harder: "",
        cues: strArray(parsed?.lift?.cues, 3),
      },
      work: {
        emphasis: String(work?.emphasis ?? "").trim(),
        title: "Cardio Stations",
        // ONE block for the room, stored once (Josh, 2026-10-22).
        shared: stationsOut,
        bravo: [] as string[],
        alpha: [] as string[],
        result_unit: (["rounds", "reps", "meters", "minutes", "seconds"].find((u) => String(work?.result_unit ?? "").toLowerCase().includes(u)) ?? "rounds"),
      },
      reset: strArray(parsed?.reset, 4),
      minutes,
    };

    return json({ day });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err?.status === 429) return json({ error: "The AI is busy — try again in a moment." }, 429);
    if (err?.status) return json({ error: `AI service error: ${err.message}` }, err.status);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
