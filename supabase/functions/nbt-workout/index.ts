// nbt-workout — the brain behind the Non-Battle Team S&C board.
//
// Builds ONE training day (Mon = Squat+Push, Tue = Athletic+Overhead,
// Thu = Hinge+Pull) per call, so the client can fan the three out in parallel
// rather than risk truncating one giant blob.
//
// ONE GROUP since 2026-11-09 (Rev, through Josh): about a dozen athletes, one
// lift for everyone with an easier and a harder version, a warm-up written
// for that lift, then the Cardio Stations. Alpha and Bravo are retired.
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

  "ONE GROUP, ONE LIFT (Rev, 2026-11-09). The Non-Battle Team trains as ONE group of about a dozen athletes. " +
  "There are no tracks and no levels: never write 'Alpha', 'Bravo', 'track', 'group A' or anything that sorts " +
  "the athletes. Everyone warms up together, does the SAME primary lift, then rotates through the Cardio " +
  "Stations together.\n\n" +

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
  "  shows. Court lengths are all braking, so keep hard changes of direction to a sensible volume in one " +
  "  session and pair them with work that does not decelerate. The machines — bikes, rowers, ski ergs — are " +
  "  HERE, and belong in the Cardio Stations. NEVER a sled push: there is one sled and it does not work for " +
  "  a group.\n" +
  "- TUESDAY is in the BOXING FACILITY, half the size, with NO ROOM TO RUN AT ALL. Not a length, not a jog, " +
  "  not a lap, not a shuttle, not a single yard. Tuesday conditioning happens ON THE SPOT. There are NO " +
  "  machines in this room — no bikes, no rowers, no ski ergs; they are in the other building with " +
  "  the Junior Boxers. Tuesday's conditioning is jump rope, wall balls, med balls, bands, pull-up bars, " +
  "  dumbbells, kettlebells and bodyweight — air squats, burpees, lunges, step-ups, push-ups, core. " +
  "  PLYOMETRICS are a Tuesday option, once or twice a month, in the lift block as the " +
  "  technical element: box jumps and step-offs, squat jumps, split-squat jumps, tuck jumps, rope " +
  "  variations, med ball slams and chest passes — all on the spot, never broad jumps or bounding. Low " +
  "  reps, full rest, quality landings: it is a skill, not conditioning, and never goes inside a station " +
  "  where tired kids land badly. Easier: lower boxes, step-offs and two-foot landings. Harder: higher boxes " +
  "  and single-leg landings.\n\n" +

  "THE DAY HAS FOUR PARTS AND THE MINUTES ARE FIXED — you do not choose them and you do not state them. " +
  "MONDAY and THURSDAY: warm-up 5, lift 20, Cardio Stations 12, reset 3 — forty minutes. TUESDAY: warm-up 5, " +
  "lift 15, Cardio Stations 10, reset 3. They box straight afterwards, so write only what genuinely fits those " +
  "minutes for a dozen athletes sharing equipment.\n\n" +

  "1) THE WARM-UP IS FOR THE LIFT (Rev, 2026-11-09) — 5 minutes, 3 to 5 short lines in \"prep\", easy to run with " +
  "a dozen athletes at once. It prepares THIS lift, not the body in general: first the joints and the pattern " +
  "the lift needs, done with bodyweight, a band or a light implement (bench press day: band pull-aparts, " +
  "scapular push-ups, push-ups; squat day: air squats, hip openers, a goblet squat hold); then the LAST line " +
  "is ramp-up sets of the lift itself — 'Ramp up: 2 easy sets of 5 with the empty bar, then build to your " +
  "working weight' — or, for a lift with no bar, 2 easy sets of the easier version. Every line carries its " +
  "count: reps, or a court length on Monday and Thursday. No long static stretching, no corrective circuits, " +
  "no conditioning — nobody should be breathing hard before the lift. The room's rules apply to the warm-up " +
  "too: nothing that travels on Tuesday, court language on Monday and Thursday, no dumbbells on Monday.\n\n" +

  "2) LEARN + LIFT — ONE primary movement for the whole group, explained and demonstrated fast, with its sets " +
  "and reps. Quality reps. Never to failure. RACKS ARE SHARED: three or four athletes take turns on one bar, " +
  "alternating sets while the others rest. Write the dose for a GROUP taking turns to finish inside the lift's " +
  "minutes, not for one athlete alone — 4 × 5 shared four ways is sixteen sets on that rack. Put the dose " +
  "first in the detail, then the run-it cue for the coach on the floor: '4 × 5 — four to a rack, rotate every " +
  "set'. On a day whose point is athleticism, teach one technical element instead. Monday and Thursday are the " +
  "only days with a runway, so sprint and shuttle mechanics — posture, acceleration, deceleration, landing — " +
  "belong there. On TUESDAY the technical element must not travel: rope technique, landing mechanics on the " +
  "spot, carry position, step-up form, overhead position.\n" +
  "WHICH LIFT: the lift is the version most of the group can do well, and the long-term targets are the back " +
  "squat, the bench press, the deadlift, the overhead press and the pull-up. A dozen athletes fit the racks in " +
  "rotation, so a rack lift is fine. The implement ladders, easiest to hardest:\n" +
  "- SQUAT: air squat, box squat or tempo air squat → goblet squat → back squat.\n" +
  "- PUSH: incline or knee push-up → DB bench press, floor press → barbell bench press.\n" +
  "- OVERHEAD: pike push-up, band overhead press or wall slide → DB overhead press → barbell overhead press.\n" +
  "- HINGE: bodyweight hip hinge, band good morning or glute bridge → DB or KB Romanian deadlift → barbell " +
  "  deadlift or Romanian deadlift.\n" +
  "- PULL: band pull-apart or seated band row (band around the feet) → bent-over DB row, single-arm DB row " +
  "  with a hand on a box, KB row, renegade row → barbell row or pull-up. THE PULL-UP BARS ARE THE RACKS, and " +
  "  so is an inverted row, a ring row or a band on a post.\n" +
  "- CARRIES: dumbbell or kettlebell farmer carry → heavier farmer carry or a plate carry.\n" +
  "WHEN THE LIFT IS ON HAND WEIGHTS: the hand weights are few at the light end — five dumbbells and three " +
  "kettlebells of each weight — so it is ONE PIECE PER KID: a single dumbbell in both hands pressed from the " +
  "chest; a kettlebell by the horns; a plate for a front raise, a plate press, a goblet hold. Two dumbbells " +
  "only when the count allows. SPREAD the same movement across dumbbells, kettlebells and plates at once so " +
  "nobody waits, and say so in the detail: '4 × 10 — one dumbbell in both hands, or a kettlebell by the " +
  "horns, or a plate'.\n" +
  "MONDAY SHARES THE ROOM WITH THE BATTLE TEAM (Josh, 2026-10-20), who lift at the same time and HAVE THE " +
  "DUMBBELLS. On Monday there are NO DUMBBELLS ANYWHERE IN THE DAY — not in the warm-up, the lift, the easier " +
  "or harder version, or on a station. Monday's hand weight is the KETTLEBELL: goblet squat, kettlebell floor " +
  "press, kettlebell carries, plus barbells, med balls, bands, boxes, machines and bodyweight. Where a ladder " +
  "says 'dumbbell or kettlebell', on Monday it says kettlebell. Tuesday and Thursday are not shared; dumbbells " +
  "are fine.\n\n" +

  "THE MODIFICATION — EVERY LIFT HAS AN EASIER AND A HARDER VERSION (Josh, 2026-11-09). One group is not one " +
  "ability: a twelve-year-old in his first month and a seventeen-year-old in his second year do the same lift " +
  "today, and the coach hands out the version each one needs. So with the lift, always write:\n" +
  "- \"easier\": the SAME pattern one rung down the ladder, for an athlete still learning it — done OFF THE " +
  "  RACKS, on the floor beside them, with what is in his hands, so it never adds to the line for a bar. Back " +
  "  squat → 'Goblet squat with a kettlebell — same sets, 8 reps'. Bench press → 'Floor press with a " +
  "  kettlebell, or push-ups'. Pull-up → 'Single-arm dumbbell row, hand on a box'.\n" +
  "- \"harder\": ONE step up for an athlete who owns today's version — a pause, a slower lowering, a little " +
  "  more load, a harder variation of the same lift. 'Add a 3-second pause at the bottom of every rep'. Never " +
  "  more sets, never to failure, never a max.\n" +
  "Each is ONE short line a coach can say out loud: the movement, then what changes. Reps on either follow the " +
  "reps rule below. Neither is ever framed as the lesser or the better workout — it is the same lift, fitted " +
  "to the athlete. The room's rules apply to both.\n\n" +

  "3) THE WORK BLOCK IS CARDIO STATIONS, EVERY DAY (Josh, 2026-10-20/21): after the lift the whole group " +
  "rotates through numbered STATIONS, two minutes at each, one lap, about two athletes to a station. Write it " +
  "in \"stations\". Line one, exactly: 'N stations · 2 min each · rotate on the whistle' (N = the day's count). " +
  "Then exactly N lines, numbered, one per station, in this order and with these names:\n" +
  "MONDAY AND THURSDAY — the Performance Center, SIX stations:\n" +
  "- 'Station 1 · The Racks — …': the three racks, barbells, wall-ball targets, kettlebells, plates, " +
  "  pull-ups on the rack. (Monday: no dumbbells — the Battle Team has them.)\n" +
  "- 'Station 2 · The Rowers — …': six rowers; each kid at his own pace.\n" +
  "- 'Station 3 · The Bikes — …': six assault bikes.\n" +
  "- 'Station 4 · Open Court — …', 'Station 5 · Open Court — …', 'Station 6 · Open Court — …': the " +
  "  basketball court. Either ON THE SPOT — jumps, lunges, med balls, bands, kettlebells, core — or MOVING in " +
  "  court lengths: baseline to baseline (75 ft), baseline to baseline and back, sideline to sideline (56 ft), " +
  "  sideline to sideline and back; never metres, never a lap. Make the three Open Court stations different " +
  "  from each other — not three sets of lunges. Core work with holds is allowed on an Open Court station.\n" +
  "  ONE DIRECTION OF TRAVEL PER DAY (Josh, 2026-10-21): every moving station runs the same way — all " +
  "  baseline to baseline, or all sideline to sideline — never both on one day, because the paths cross head " +
  "  on at centre court. On-the-spot stations are fine alongside either.\n" +
  "TUESDAY — the boxing facility, FIVE stations:\n" +
  "- 'Station 1 · The Racks — …': six racks with wall-ball targets. Barbell and rack work, pull-ups on the " +
  "  rack, wall balls, kettlebells, dumbbells, med balls, lunges, jump rope.\n" +
  "- 'Station 2 · The Open Floor — …': 12 by 30 feet, open. Plyo and the tough bodyweight work: tuck jumps, " +
  "  burpees, split jumps, jumping jacks, air squats, lunges, jump rope, med balls, kettlebells.\n" +
  "- 'Station 3 · The Ring — …': 20 by 20, padded. Core and abs. Plank holds and other holds are ALLOWED here.\n" +
  "- 'Station 4 · The Heavy Bag — …': long benches. Step-ups, a dumbbell press, push-ups, mountain climbers, " +
  "  squat to squat jump, jump rope, kettlebells, med balls. Not bag work — they box straight afterwards.\n" +
  "- 'Station 5 · The Uppercut — …': core and abs again, a different pair from Station 3. Holds ALLOWED.\n" +
  "ON A STATION THE CLOCK IS THE DOSE. ONE movement: no count — write the movement and a pace word or a form " +
  "cue, and the kid works the two minutes at his own pace. 'Station 2 · The Rowers — row — steady pace, long " +
  "pulls'. TWO OR MORE movements: give each its COUNT, because the count is the switch point (without it " +
  "nobody knows when to change) — 'Station 1 · The Racks — 5 pull-ups, then 10 wall balls, repeat — strong " +
  "but repeatable'; 'Station 4 · Open Court — 10 squat jumps, then baseline to baseline and back, repeat — " +
  "land soft'. Counts are ROUND: 5, 8, 10, 12, 15 or 20 reps; 20, 30, 40 or 50 skips; whole court lengths; on " +
  "a machine 100, 150, 200 or 250 m, or 10, 12 or 15 calories. No '18 wall balls'. NEVER a time on a station " +
  "line: not '30 sec', not '1 min'. The whistle moves everyone. Be creative across the areas week to week, " +
  "and never two stations that hammer the same pattern back to back in the rotation. Hand weights are few: a " +
  "station that uses them is one piece per kid.\n" +
  "THE STYLE INSIDE A STATION: standard gym and CrossFit-style work that genuinely raises heart rates — " +
  "challenging but NOT an exhaustion contest. They should finish worked, proud, tired, and able to start bag " +
  "work after a short rest. Do NOT use shadow boxing or boxing drills as the conditioning piece; they are " +
  "about to box for an hour and it is not the training they lack. No Olympic lifts, no kipping, never to " +
  "failure, and never athletes racing each other.\n" +
  "THE STATIONS NEVER REPEAT THE LIFT. The lift block is quality reps under load; a station is the same " +
  "PATTERN under fatigue with a different, simpler movement. After 4 × 8 Romanian deadlift no station has " +
  "Romanian deadlifts — it has hip bridges, single-leg deadlifts, a light med ball ground-to-overhead. Squat " +
  "day with a back squat or goblet squat: the stations use step-ups, lunges, wall sits, jump squats. Push day " +
  "with a bench press: push-ups or a med ball chest pass, not bench. Same name, same movement, or the same " +
  "movement with a different weight in front of it, all count as a repeat. Ground-to-overhead is light — a " +
  "med ball or a light dumbbell, never a barbell.\n\n" +

  "4) RESET — 2 or 3 short lines: put equipment away, water, wrap hands, gloves on. A transition into boxing.\n\n" +

  "THE SIX GOALS: confidence, competency, strength, athleticism, general event readiness (a HYROX-style event, " +
  "Spartan Sprint, 5K or obstacle race), and preparation for eventual Battle Team training. Never sacrifice " +
  "confidence and competency to make a workout harder.\n\n" +

  "CONFIDENCE WITHOUT LOWERING THE BAR: an athlete should look at the board and think 'I can do this', then " +
  "discover 'I can do this better than before'. Simple does not mean easy — simple movements performed well, " +
  "loaded progressively, beat complicated movements performed badly. Avoid: too many unfamiliar exercises at once, " +
  "sequences they must memorise, repeated failure, anything that embarrasses a beginner, exhaustion presented as " +
  "success, or complexity added to make the workout interesting.\n\n" +

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
  "kettlebell swing as the lift or as the easier version of a hinge; the easier hinge is a dumbbell or kettlebell " +
  "Romanian deadlift, or bodyweight and bands while still learning it. No Olympic lifts. Complexity needs a " +
  "training reason.\n\n" +

  "CONDITIONING: prefer movements that stay safe and understandable under fatigue — burpees, jump rope, " +
  "bikes, rowers, carries, med balls, bodyweight and simple dumbbell work, step-ups, lunges, " +
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
  "to build competency. Within a block the primary movement stays consistent and only one or two variables change: " +
  "technique, reps, sets, a little load, range of motion, less assistance, a slightly harder variation, more " +
  "distance, shorter rest. The easier and harder versions progress with the lift — they are not a fresh guess " +
  "each week. Mastery earns progression, not the calendar.\n\n" +

  "EVIDENCE, WHEN THERE IS ANY: you may be given an anonymised summary of what the room actually managed on " +
  "this day recently — how many athletes trained, the movement most of them logged, median top weight, median " +
  "reps completed, and whether the stations result is rising or falling. Use it like this:\n" +
  "- A room that completed the work prescribed and whose result is holding or rising has earned ONE " +
  "  progression: a rep, a set, a little load, slightly less assistance.\n" +
  "- A room whose reps fell short of what was prescribed, or whose result went backwards, has NOT. " +
  "  Hold the movement and the dose. Progress technique, range of motion or control instead of load.\n" +
  "- If the summary is marked THIN, or you are given none at all, you have no evidence. Progress conservatively " +
  "  on the calendar and do not pretend to be responding to anything.\n" +
  "NEVER name an athlete, quote an individual's numbers, or write a line that reads as a reply to one person. " +
  "You are given medians precisely so that no youth can be singled out on a screen the whole gym reads.\n\n" +

  "BLOCKS CONTINUE, THEY DO NOT RESET: you may be told where the previous month finished on this day. Week 1 of " +
  "a new block is a CONTINUATION, not a clean slate. Keep the same movement PATTERN. Either take the same " +
  "exercise a step further, or move up the ladder. Change the exercise itself only when the pattern has already " +
  "been trained for six weeks or more, or when the month's coaching emphasis demands it — and even then the " +
  "pattern stays. NEVER drop the group back to a variation it had already outgrown. Strength does not restart " +
  "on the first of the month. Weeks written before 2026-11-09 were for two tracks: the 'Lift' you are shown from " +
  "those weeks is what the stronger track did and the 'Easier' is what the other track did. Carry on from them " +
  "as one group.\n\n" +

  "LANGUAGE: these are developing young people, not miniature professionals. Never write anything designed to " +
  "shame or prove toughness — no 'don't be weak', 'man up', 'no pain no gain'. Encourage effort, teachability, " +
  "consistency, quality and intelligent pacing. Never tell an athlete to push through pain, dizziness or illness.\n\n" +

  "BOARD VOICE: this goes on a screen read from across a gym. Short exercise names, sets, reps, distance, " +
  "and only essential cues. No paragraphs of coaching theory.\n\n" +

  "REPS ARE 5, 8, 10 OR 12 — NOTHING ELSE (Josh, 2026-10-20: a kid reads '4 × 9' and stops to think). Every " +
  "lift dose — the lift, and any dose in the easier or harder line — is sets × one of those four: 5 for heavy " +
  "work, 8, 10 or 12 otherwise. Never 6, 7, 9 or 11, and never a range like '10–12'. Progression still moves " +
  "one variable at a time, on those steps: 8 → 10 → 12, then a little more load and back to 8; or a set added.\n\n" +

  "OUTPUT: valid JSON only, no prose and no markdown fences.\n" +
  "{\n" +
  '  "focus": "short emphasis for the day, e.g. Own the basics",\n' +
  '  "prep": ["Band pull-aparts × 12", "Air squats × 10 — slow down, fast up", "Hip openers × 5 each side", "Ramp up: 2 easy sets of 5 with the empty bar, then build to your working weight"],\n' +
  '  "lift": {\n' +
  '    "pattern": "Squat",\n' +
  '    "main":   { "name": "Back Squat", "detail": "4 × 5 — four to a rack, rotate every set" },\n' +
  '    "easier": "Goblet squat with a kettlebell — same sets, 8 reps",\n' +
  '    "harder": "Add a 3-second pause at the bottom of every rep",\n' +
  '    "cues": ["one or two short coaching cues"]\n' +
  "  },\n" +
  '  "work": {\n' +
  '    "emphasis": "one of: steady aerobic | intervals | strength-endurance | carries | grip | obstacle prep",\n' +
  '    "stations": ["6 stations · 2 min each · rotate on the whistle", "Station 1 · The Racks — 5 pull-ups, then 10 wall balls, repeat — strong but repeatable", "Station 2 · The Rowers — row — steady pace, long pulls", "Station 3 · The Bikes — bike — strong but repeatable", "Station 4 · Open Court — 10 squat jumps, then baseline to baseline and back, repeat — land soft", "Station 5 · Open Court — 10 KB goblet step-ups each leg, then 15 med ball slams, repeat — controlled", "Station 6 · Open Court — plank shoulder taps — slow, minimal hip sway"],\n' +
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
    "MONDAY — SQUAT + PUSH. Performance Center, on the basketball court: 75 ft baseline to baseline, 56 ft " +
    "sideline to sideline. Floor distances are said in court — baseline to baseline (75 ft), baseline to " +
    "baseline and back (150 ft), sideline to sideline (56 ft), sideline to sideline and back (112 ft) — never " +
    "in metres, yards or feet. Never a lap. No sled. Warm-up 5 min, lift 20 min, then CARDIO STATIONS: six " +
    "stations — the Racks, the Rowers, the Bikes, three Open Court — two minutes each. " +
    "THE BATTLE TEAM HAS THE DUMBBELLS TODAY: no dumbbells anywhere in this day — the warm-up, the lift, the " +
    "easier or harder version, or any station — kettlebells instead.",
  tuesday:
    "TUESDAY — ATHLETIC + OVERHEAD. Boxing facility: NO RUNNING AT ALL — there is no floor for it, and NO " +
    "machines — no bikes, no rowers, no ski ergs. Every movement stays on the spot. " +
    "Athletic and energetic, not a second heavy strength day. Plyometrics are an option here. " +
    "Warm-up 5 min, lift 15 min, then CARDIO STATIONS: five named stations, two minutes each.",
  thursday:
    "THURSDAY — HINGE + PULL. Performance Center, on the basketball court: 75 ft baseline to baseline, 56 ft " +
    "sideline to sideline. Floor distances are said in court — baseline to baseline (75 ft), baseline to " +
    "baseline and back (150 ft), sideline to sideline (56 ft), sideline to sideline and back (112 ft) — never " +
    "in metres, yards or feet. Never a lap. No sled. Warm-up 5 min, lift 20 min, then CARDIO STATIONS: six " +
    "stations — the Racks, the Rowers, the Bikes, three Open Court — two minutes each.",
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
    // The same day from earlier weeks of THIS block. This is what turns a pile
    // of weeks into a programme. `alpha` and `bravo` are the two-track names
    // for the same two lines, still read so a cached client cannot lose
    // continuity.
    const priorWeeks: Array<{
      week: number; pattern?: string;
      lift?: string; easier?: string; harder?: string;
      alpha?: string; bravo?: string;
      work?: string;
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
    // Set when only part of an existing day is being rewritten: the lift (with
    // its modification and its warm-up), or the Cardio Stations.
    const onlyBlock = ["lift", "work"].includes(String(body?.onlyBlock ?? "")) ? String(body.onlyBlock) : "";
    const keepDay = body?.keepDay ?? null;

    const said = (v: unknown) => { const s = String(v ?? "").trim(); return s && s !== "—" ? s : ""; };
    const liftLines = (p: { lift?: string; easier?: string; harder?: string; alpha?: string; bravo?: string }) =>
      `    Lift:    ${said(p.lift) || said(p.alpha) || "?"}\n` +
      `    Easier:  ${said(p.easier) || said(p.bravo) || "—"}\n` +
      `    Harder:  ${said(p.harder) || "—"}\n`;

    const weekLines = priorWeeks
      .map((p) =>
        `- Week ${p.week} — pattern: ${p.pattern || "?"}\n` +
        liftLines(p) +
        `    Work:    ${p.work ?? "?"}`
      )
      .join("\n");

    // Week 1 used to be told it was choosing from nothing. It is only choosing
    // from nothing when there is genuinely no previous block behind it.
    const opening = carry
      ? "This day has not been written yet in this month's block, so it CONTINUES from the last one. Here is " +
        `where the previous block finished on this day (week beginning ${carry.weekStart}):\n` +
        `- Pattern: ${carry.pattern || "?"} — trained ${carry.weeksOnPattern || 1} week(s) in a row\n` +
        liftLines(carry) +
        `    Work:    ${carry.work ?? "?"}\n\n` +
        "CONTINUE from there. Same pattern. Take the lift one honest step on from where it ended — do not " +
        "restart the month at the beginning of the progression, and do not hand the group a variation it had " +
        "already outgrown." +
        (Number(carry.weeksOnPattern) >= 6
          ? " This pattern has now run six weeks or more, so you MAY change the primary exercise this month — " +
            "but keep the pattern and keep the group at the level it reached."
          : " It is too early to change the primary exercise; keep it and keep progressing it.") +
        "\n"
      : "There is no earlier week of this block, and no previous block, to continue from on this day, so you are " +
        "choosing the primary movement the rest of the month will build on. Pick something you can progress for " +
        "four weeks, not something that will need replacing.\n";

    const continuity =
      priorWeeks.length === 0
        ? opening
        : "Earlier weeks of THIS block, same day:\n" +
          weekLines +
          "\n\nKEEP THE SAME PRIMARY MOVEMENT PATTERN and, where it still fits, the same primary exercise. " +
          "Progress ONE or TWO variables only: a rep, a set, a little more distance, slightly less assistance. " +
          "Do NOT swap the lift for something new just to look different, and keep the easier and harder " +
          "versions in step with it. The stations may vary more than the lift, but the progression must be " +
          "visible to an athlete.\n";

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
            ? "The coach wants a different LIFT. Write a new \"main\", new \"easier\" and \"harder\" versions of " +
              "it, new cues, and a new \"prep\" — the warm-up is for the lift, so it follows the lift. Keep the " +
              "SAME movement pattern: a different exercise or a different dose, never a different pattern. Leave " +
              "the Cardio Stations exactly as they are — and make sure the new lift is not a movement one of " +
              "those stations already uses.\n"
            : "The coach wants the CARDIO STATIONS rewritten: write a new \"stations\" block. Leave the warm-up, " +
              "the lift and its easier and harder versions exactly as they are.\n")
        : "";

    const userPrompt =
      `${DAY_BRIEF[dayKey]}\n` +
      (roomKit ? `${roomKit}\n` : "") +
      `Week ${weekInBlock} of this month's block.` +
      (blockFocus ? ` The month's coaching emphasis is: "${blockFocus}".` : "") +
      "\n\n" +
      (partBrief || continuity) +
      evidence +
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

    // Reps are 5, 8, 10 or 12: every "sets × reps" in the lift, and in its
    // easier and harder versions, is read back.
    const REPS_OK = new Set([5, 8, 10, 12]);
    const oddReps = (p: Parsed): string[] => {
      const lines: [string, string][] = [
        ["lift", String((p?.lift?.main as { detail?: unknown })?.detail ?? "")],
        ["easier", String(p?.lift?.easier ?? "")],
        ["harder", String(p?.lift?.harder ?? "")],
      ];
      return lines.flatMap(([where, text]) => {
        const bad: string[] = [];
        for (const m of text.matchAll(/\d+\s*[×x]\s*(\d+)(?:\s*[–-]\s*(\d+))?/g)) {
          if (m[2] || !REPS_OK.has(Number(m[1]))) bad.push(`${where}: ${m[0]}`);
        }
        return bad;
      });
    };

    // The lift is one movement with both versions of its modification, and no
    // word of the retired tracks anywhere in the day.
    const TRACK_WORD = /\b(?:alpha|bravo|charlie)\b/i;
    const liftProblems = (p: Parsed): string[] => {
      const bad: string[] = [];
      if (!movement(p?.lift?.main).name) bad.push('"main" has no lift name');
      if (!String(p?.lift?.easier ?? "").trim()) bad.push('"easier" is empty');
      if (!String(p?.lift?.harder ?? "").trim()) bad.push('"harder" is empty');
      if (strArray(p?.prep, 6).length < 2) bad.push('"prep" needs the warm-up for the lift: 3 to 5 lines');
      if (TRACK_WORD.test(JSON.stringify(p ?? {}))) bad.push("it names Alpha or Bravo — there is one group now");
      return bad;
    };

    // The stations: the fixed header, the named stations in order, no times on
    // a station line, counts where movements pair, holds only on the core stations.
    const STATION_NAMES = dayKey === "tuesday"
      ? ["The Racks", "The Open Floor", "The Ring", "The Heavy Bag", "The Uppercut"]
      : ["The Racks", "The Rowers", "The Bikes", "Open Court", "Open Court", "Open Court"];
    const HOLDS_OK = dayKey === "tuesday" ? [2, 4] : [3, 4, 5];
    const stationProblems = (p: Parsed): string[] => {
      const lines = Array.isArray(p?.work?.stations) ? (p!.work!.stations as unknown[]).map(String) : [];
      const bad: string[] = [];
      const n = STATION_NAMES.length;
      if (lines.length !== n + 1) bad.push(`${lines.length} lines (need the header and ${n} stations)`);
      if (!new RegExp(`^${n} stations`, "i").test(lines[0] ?? "")) bad.push(`header "${lines[0] ?? ""}" (must be: ${n} stations · 2 min each · rotate on the whistle)`);
      lines.slice(1, n + 1).forEach((l, i) => {
        const want = `Station ${i + 1} · ${STATION_NAMES[i]} —`;
        if (!l.startsWith(want)) { bad.push(`"${l}" (must start: ${want})`); return; }
        const rest = l.slice(want.length);
        if (/\b\d+\s*(sec|secs|seconds|s|min|mins|minutes)\b|\d+:\d\d/i.test(rest)) bad.push(`"${l}" (no times on a station line)`);
        const workPart = rest.split(" — ")[0] ?? rest;
        const movesTwo = /\bthen\b|→|\brepeat\b/i.test(workPart);
        if (movesTwo && !/\d/.test(workPart)) bad.push(`"${l}" (two movements need their counts — the switch point)`);
        if (/\b(hold|plank)\b/i.test(rest) && !HOLDS_OK.includes(i)) bad.push(`"${l}" (holds only on the core stations)`);
      });
      return bad;
    };

    /** Why this attempt is refused, written to be handed straight back to the model; "" when it is good. */
    const rejection = (p: Parsed): string => {
      const lift = judgeLift ? liftProblems(p) : [];
      if (lift.length) {
        return (
          "the day is not in the one-group shape: " + lift.join("; ") + ". Write ONE lift in \"main\" for the " +
          "whole group, its \"easier\" and \"harder\" versions as one short line each, and the warm-up for that " +
          "lift in \"prep\". Everything else can stay."
        );
      }
      const odd = judgeLift ? oddReps(p) : [];
      if (odd.length) {
        return (
          "these lift doses use reps that are not 5, 8, 10 or 12, or use a range: " +
          odd.map((l) => `"${l}"`).join(", ") + ". Rewrite each as sets × 5, 8, 10 or 12 — one number. " +
          "Everything else can stay."
        );
      }
      const stations = judgeStations ? stationProblems(p) : [];
      if (stations.length) {
        return (
          "the Cardio Stations block is not in the required shape: " + stations.join("; ") +
          ". Rewrite the block: the exact header, then " +
          STATION_NAMES.map((name, i) => `Station ${i + 1} · ${name}`).join(", ") +
          " — work and cue, counts only where movements pair, no times, holds only on the core stations. " +
          "Everything else can stay."
        );
      }
      if (mondayDumbbell(p)) {
        return (
          "it is MONDAY and the day uses dumbbells somewhere. The Battle Team has the dumbbells on Monday. " +
          "Replace every dumbbell — in the warm-up, the lift, the easier and harder versions, the stations and " +
          "the cues — with a kettlebell, a barbell, a med ball, a band or bodyweight. Everything else can stay."
        );
      }
      return "";
    };

    let parsed: Parsed = {};
    let refused = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        // Thinking is charged against this, and a full day under fixed minutes
        // in a room with no floor is a lot to think about. Thursday used to
        // spend the whole budget deliberating and return nothing -- see
        // _shared/claude.ts. 9000 leaves room for both.
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
      if (judgeLift && liftProblems(parsed).length) return json({ error: "The AI kept missing the lift, its easier and harder versions, or the warm-up. Try again." }, 502);
      if (judgeLift && oddReps(parsed).length) return json({ error: "The coach kept writing reps that are not 5, 8, 10 or 12. Try again." }, 502);
      if (judgeStations && stationProblems(parsed).length) return json({ error: "The coach kept writing the Cardio Stations in the wrong shape. Try again." }, 502);
      return json({ error: "The coach kept reaching for dumbbells on Monday, when the Battle Team has them. Try again." }, 502);
    }

    // Fixed by the day (Josh): Tuesday 5 · 15 · 10 · 3; Monday and Thursday 5 · 20 · 12 · 3.
    const minutes = dayKey === "tuesday"
      ? { prep: 5, lift: 15, work: 10, reset: 3 }
      : { prep: 5, lift: 20, work: 12, reset: 3 };

    const work = parsed?.work ?? {};
    const day = {
      focus: String(parsed?.focus ?? "").trim(),
      // The warm-up for the lift.
      prep: strArray(parsed?.prep, 6),
      lift: {
        pattern: String(parsed?.lift?.pattern ?? "").trim(),
        // ONE lift for the group, and its modification either way (2026-11-09).
        main: movement(parsed?.lift?.main),
        easier: String(parsed?.lift?.easier ?? "").trim(),
        harder: String(parsed?.lift?.harder ?? "").trim(),
        cues: strArray(parsed?.lift?.cues, 3),
      },
      work: {
        emphasis: String(work?.emphasis ?? "").trim(),
        title: "Cardio Stations",
        // ONE block for the room, stored once (Josh, 2026-10-22).
        shared: strArray(work?.stations, 8),
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
