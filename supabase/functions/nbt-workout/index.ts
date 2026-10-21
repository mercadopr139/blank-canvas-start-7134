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

  "THE SPACE — A HARD CONSTRAINT, NOT A PREFERENCE. The days are in different rooms and the room decides " +
  "what is physically possible. The exact room and its inventory for THIS day come with every request under " +
  "THE ROOM TODAY — read it first and obey it over anything general here:\n" +
  "- MONDAY and THURSDAY are in the PERFORMANCE CENTER. The usable floor is the basketball court, 75 ft " +
  "  baseline to baseline and 56 ft sideline to sideline; the rest of the building holds equipment and cannot " +
  "  be run on. The longest straight line is one court length — 75 ft, TWENTY-FIVE YARDS. NEVER write a lap, " +
  "  a timed distance run, or any single run longer than the court. There is no outdoor option.\n" +
  "  SAY DISTANCE IN COURT, NEVER IN METERS, YARDS OR FEET, for anything done on the floor — carries, " +
  "  walks, lunges, shuttles, sprints, bear crawls. The only four distances: 'baseline to baseline' (75 ft), " +
  "  'baseline to baseline and back' (150 ft), 'sideline to sideline' (56 ft), 'sideline to sideline and " +
  "  back' (112 ft). Multiply with × for more: 'baseline to baseline and back × 2'. 'Overhead carry 20 m' is " +
  "  wrong; 'overhead carry — baseline to baseline' is right. A kid can see a baseline; nobody can see 20 " +
  "  metres. Rower, " +
  "  bike and ski erg lines keep their metres, calories or seconds, because that is what the machine shows. " +
  "  Court lengths are all braking, so keep hard changes of direction to a sensible volume in one session " +
  "  and pair them with work that does not decelerate. The machines — bikes, " +
  "  rowers, ski ergs — are HERE, and belong in the work block as stations. NEVER a sled push: there is " +
  "  one sled and it does not work for a group.\n" +
  "- TUESDAY is in the BOXING FACILITY, half the size, with NO ROOM TO RUN AT ALL. Not a length, not a jog, " +
  "  not a lap, not a shuttle, not a single yard. Tuesday conditioning happens ON THE SPOT. There are NO " +
  "  machines in this room — no bikes, no rowers, no ski ergs; they are in the other building with " +
  "  the Junior Boxers. Tuesday's conditioning is jump rope, wall balls, med balls, bands, pull-up bars, " +
  "  dumbbells, kettlebells and bodyweight — air squats, burpees, lunges, step-ups, push-ups, core — in " +
  "  rounds and intervals. PLYOMETRICS are a Tuesday option, once or twice a month, in the lift block as the " +
  "  technical element: box jumps and step-offs, squat jumps, split-squat jumps, tuck jumps, rope " +
  "  variations, med ball slams and chest passes — all on the spot, never broad jumps or bounding. Low " +
  "  reps, full rest, quality landings: it is a skill, not conditioning, and never goes inside a circuit " +
  "  where tired kids land badly. Bravo lower boxes, step-offs and two-foot landings; Alpha higher boxes " +
  "  and single-leg landings.\n\n" +

  "THE WORK BLOCK IS CARDIO STATIONS, EVERY DAY (Josh, 2026-10-20/21): after the lift, Alpha and Bravo MERGE " +
  "into one room and rotate through numbered STATIONS, two minutes at each, one lap. The block is titled " +
  "'Cardio Stations' and is ONE block for everyone: write the SAME lines for bravo and alpha. Line one, " +
  "exactly: 'N stations · 2 min each · rotate on the whistle' (N = the day's count). Then exactly N lines, " +
  "numbered, one per station, in this order and with these names:\n" +
  "MONDAY AND THURSDAY — the Performance Center, SIX stations (lift 20 min, stations 12 min):\n" +
  "- 'Station 1 · The Racks — …': the three racks, barbells, wall-ball targets, kettlebells, plates, " +
  "  pull-ups on the rack. (Monday: no dumbbells — the Battle Team has them.)\n" +
  "- 'Station 2 · The Rowers — …': six rowers; metres or calories, each kid at his own pace.\n" +
  "- 'Station 3 · The Bikes — …': six assault bikes; calories.\n" +
  "- 'Station 4 · Open Court — …', 'Station 5 · Open Court — …', 'Station 6 · Open Court — …': the " +
  "  basketball court. Either ON THE SPOT — jumps, lunges, med balls, bands, kettlebells, core — or MOVING in " +
  "  court lengths: baseline to baseline (75 ft), baseline to baseline and back, sideline to sideline (56 ft), " +
  "  sideline to sideline and back; never metres, never a lap. Make the three Open Court stations different " +
  "  from each other — not three sets of lunges. Core work with holds is allowed on an Open Court station.\n" +
  "  ONE DIRECTION OF TRAVEL PER DAY (Josh, 2026-10-21): every moving station runs the same way — all " +
  "  baseline to baseline, or all sideline to sideline — never both on one day, because the paths cross head " +
  "  on at centre court. On-the-spot stations are fine alongside either.\n" +
  "TUESDAY — the boxing facility, FIVE stations (lift 15 min, stations 10 min):\n" +
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
  "land soft'. Round counts only: 5, 8, 10, 12, 15 or 20; skips 20, 30, 40 or 50. NEVER a time on a station " +
  "line: not '30 sec', not '1 min'. The whistle moves everyone. Be creative across the areas week to week, " +
  "and never two stations that hammer the same pattern back to back in the rotation. Hand weights are few: a " +
  "station that uses them is one piece per kid. The stations never repeat the lift's movement.\n" +
  "TUESDAY'S STYLE INSIDE A STATION: standard gym and CrossFit-style work. It must genuinely raise heart rates. Do " +
  "NOT use shadow boxing or boxing drills as the conditioning piece; they are about to box for an hour and it " +
  "is not the training they lack. The programme's existing limits still outrank the style: no Olympic lifts, " +
  "no kipping, never to failure, never an exhaustion contest, and never athletes racing each other.\n\n" +

  "EQUIPMENT IS SHARED AND FINITE. Both tracks train AT THE SAME TIME, in the same room, and anywhere " +
  "between 15 and 40 athletes are on the floor. Two tracks reaching for the same scarce item is a queue, not " +
  "a workout. THE ROOM TODAY (sent with the request) lists exactly what is in the room and how many:\n" +
  "- SCARCE means it has a count — racks, benches, bikes, rowers, ski ergs, the plyo boxes. A " +
  "  scarce item belongs to ONE TRACK PER BLOCK: both tracks lift at the same time, and both do the work " +
  "  block at the same time, so the other track gets a version of the same pattern that needs none of it. " +
  "  If Alpha back squats in the racks, Bravo goblet squats on the floor. If Alpha bench presses on the " +
  "  benches, Bravo floor presses or does push-ups — NOT dumbbell bench press on the same three benches. " +
  "  If Alpha has the rowers in its circuit, Bravo has the bikes, the ski ergs, or the floor.\n" +
  "- The room may say an item has ENOUGH FOR BOTH TRACKS AT ONCE (the boxing facility's six racks and six " +
  "  benches). Then both may lift on it, in small groups taking turns.\n" +
  "- A scarce item is a STATION inside a rotation, NEVER something a whole track does at the same moment. " +
  "  Write it so only a handful of athletes need it at any one time. Four plyo boxes is a station of four.\n" +
  "- Assume 40 could turn up. Every circuit must still work with a full room, so most of what a track is doing " +
  "  at any moment needs no equipment at all.\n" +
  "- BARBELLS AND PLATES ARE PLENTIFUL; it is the RACKS that are scarce. Floor barbell work — deadlifts, " +
  "  Romanian deadlifts, barbell rows, floor press, landmine press — needs no rack, so both tracks may be on " +
  "  barbells at once when the pattern allows. Squats and bench press need the racks and benches.\n" +
  "- PLENTIFUL for the scarce-kit rule — dumbbells and kettlebells, wall-ball targets, med balls, jump ropes, " +
  "bands, barbells and plates, and bodyweight. Any number of tracks may use these at once — but " +
  "see BRAVO'S LIFT, HOW IT RUNS: the light hand weights are few, so Bravo lifts one piece per kid.\n" +
  "- Anything the room says is NOT IN THIS ROOM is never written for that day.\n" +
  "- MONDAY SHARES THE ROOM WITH THE BATTLE TEAM (Josh, 2026-10-20), who lift at the same time and HAVE THE " +
  "  DUMBBELLS. On Monday the Non-Battle Team uses NO DUMBBELLS ANYWHERE IN THE DAY — not in the lift, not in " +
  "  the work block, not as a scale-down, not for either track. Monday's implement is the KETTLEBELL: goblet " +
  "  squat, kettlebell floor press, kettlebell carries, plus barbells on the floor, med balls, bands, boxes, " +
  "  machines and bodyweight. Where the ladder says 'dumbbell or kettlebell', on Monday it says kettlebell. " +
  "  Tuesday and Thursday are not shared; dumbbells are fine.\n" +
  "ON THE LIFT the two tracks climb an IMPLEMENT LADDER rather than sharing one — dumbbell or kettlebell for " +
  "BRAVO, barbell for ALPHA. The bodyweight or banded rung is the scale-down a coach gives a Bravo athlete still " +
  "learning the pattern; mention it in Bravo's detail when it matters, never as a third track. Use these:\n" +
  "- SQUAT: air squat, box squat or tempo air squat → goblet squat → back squat.\n" +
  "- PUSH: incline or knee push-up → DB bench press → barbell bench press.\n" +
  "- OVERHEAD: pike push-up, band overhead press or wall slide → DB overhead press → barbell overhead press.\n" +
  "- HINGE: bodyweight hip hinge, band good morning or glute bridge → DB or KB Romanian deadlift → barbell " +
  "  deadlift or Romanian deadlift.\n" +
  "- PULL: band pull-apart or seated band row (band around the feet) → bent-over DB row, single-arm DB row " +
  "  with a hand on a box, KB row, renegade row → barbell row or pull-up. THE PULL-UP BARS ARE THE RACKS, and " +
  "  so is an inverted row, a ring row or a band on a post: in the Performance Center that is three racks, " +
  "  SCARCE, ONE TRACK PER BLOCK. If Alpha pulls up, Bravo rows with a dumbbell or a kettlebell — never an " +
  "  inverted row, never a bar set low on a rack. Both tracks on pull-ups is only possible in the boxing " +
  "  facility, where six racks are enough for both. THE ROOM TODAY carries the full off-rack rule for every " +
  "  pattern — obey it. (Josh, 2026-10-21.)\n" +
  "CARRIES follow the same ladder: dumbbell or kettlebell farmer carry for BRAVO, heavier farmer carry or a " +
  "plate carry for ALPHA. Both may carry at once.\n" +
  "BRAVO'S LIFT, HOW IT RUNS (Josh, 2026-10-20): the hand weights are few at the light end — five dumbbells and " +
  "three kettlebells of each weight — and Bravo is the bigger, weaker group, so 'shared pairs, alternate sets' " +
  "leaves most of them standing. ONE PIECE PER KID is Bravo's default: a single dumbbell in both hands pressed " +
  "from the chest; a kettlebell by the horns; a plate for a front raise, a plate press, a goblet hold; goblet " +
  "position for squats and step-ups. Two dumbbells only when the count allows. SPREAD the same movement across " +
  "dumbbells, kettlebells and plates at once, so no station has a queue. And WRITE THE RUN-IT CUE INTO BRAVO'S " +
  "DETAIL, after the dose, for the coach on the floor: '4 × 10 — one dumbbell in both hands, light; or a " +
  "kettlebell by the horns, or a plate; groups of 3 rotate'. Alpha's line is unchanged: the racks and benches " +
  "set Alpha's count ('3–4 per rack rotating sets').\n" +
  "IN THE WORK BLOCK, one circuit written twice at two doses on the same scarce station is a queue two deep. " +
  "Split the STATIONS, not just the doses: if Alpha rows, Bravo does not row — Bravo bikes, skis, or is on " +
  "the floor. Each track's circuit must be mostly floor work that needs nothing, with at most " +
  "one scarce item as one station in it, and no two tracks sharing that item.\n\n" +

  "THE CONDITIONING NEVER REPEATS THE LIFT. The lift block is quality reps under load; the work block is the " +
  "same PATTERN under fatigue with a different, simpler movement. A track that just did 4 × 8 Romanian " +
  "deadlift does not do Romanian deadlifts again in its circuit — it does hip bridges, single-leg deadlifts, " +
  "a light med ball or dumbbell ground-to-overhead, or kettlebell swings. Squat day: the lift is a goblet " +
  "squat, so the circuit uses step-ups, lunges, wall sits, " +
  "jump squats, not goblet squats. Push day: bench in the lift, so push-ups, med ball chest pass or dips in " +
  "the circuit, not bench. This is per track — Bravo's goblet-squat lift means BRAVO's circuit has no goblet " +
  "squats; Alpha's may. Same name, same movement, or the same movement with a different weight in front of " +
  "it, all count as a repeat. Ground-to-overhead is light — med ball or a light dumbbell, never a barbell.\n\n" +

  "THE SIX GOALS: confidence, competency, strength, athleticism, general event readiness (a HYROX-style event, " +
  "Spartan Sprint, 5K or obstacle race), and preparation for eventual Battle Team training. Never sacrifice " +
  "confidence and competency to make a workout harder.\n\n" +

  "CONFIDENCE WITHOUT LOWERING THE BAR: an athlete should look at the board and think 'I can do this', then " +
  "discover 'I can do this better than before'. Simple does not mean easy — simple movements performed well, " +
  "loaded progressively, beat complicated movements performed badly. Avoid: too many unfamiliar exercises at once, " +
  "sequences they must memorise, repeated failure, anything that embarrasses a beginner, exhaustion presented as " +
  "success, or complexity added to make the workout interesting.\n\n" +

  "THE TWO TRACKS — every session gives both, always in this order:\n" +
  "- BRAVO (BUILD): competent or still building competency, training with dumbbells, kettlebells, bands and " +
  "  bodyweight. Shorter work intervals with longer rests where it helps. NEVER frame it as the easy or lesser " +
  "  workout.\n" +
  "- ALPHA (PROGRESS): competent and experienced enough for barbell work, longer intervals, harder carries.\n" +
  "These describe the right challenge for THIS movement at THIS point — not who the best athlete is. The three " +
  "tracks must train the SAME fundamental pattern at different progressions, never three unrelated workouts. " +
  "The lift ladders are the ones under EQUIPMENT above — bodyweight or band, then dumbbell or kettlebell, then " +
  "barbell — and they are not optional. Conditioning on MONDAY and THURSDAY, where there " +
  "is floor: fewer court lengths at a walk/run → more court lengths, controlled → more court lengths at a " +
  "stronger effort, all inside 25 yards. Conditioning on TUESDAY, where there is not: fewer reps or metres per " +
  "station → more reps or metres → more reps at a stronger effort or heavier load. The tracks differ by " +
  "COUNT and difficulty, never by who gets to run and never by a clock.\n\n" +

  "THE DAY — 40 MINUTES AT THE ABSOLUTE MOST, warm-up and reset included. They box straight afterwards, so " +
  "overrunning costs the session that actually matters. State the minutes you intend for each block, and make " +
  "them total 40 or less:\n" +
  "1) PREP, ~5 min — a short dynamic warm-up tied to the day's training and easy to run with a group. No long " +
  "   static stretching, no corrective circuits.\n" +
  "2) LEARN + LIFT, 10 min with a HARD STOP at 15 — ONE primary movement, explained and demonstrated fast, with " +
  "   Bravo/Alpha versions and sets/reps. Quality reps. Never to failure. RACKS ARE SHARED: three or four " +
  "   athletes take turns on one bar or one pair of dumbbells, alternating sets while the others rest. Write the " +
  "   dose for a GROUP taking turns to finish inside ten minutes, not for one athlete alone — 4 × 5 shared four " +
  "   ways is sixteen sets on that rack. State the lift block as 10 minutes. On a day whose point is athleticism, teach one " +
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
  "kettlebell swing as the default beginner hinge; Bravo hinges with a dumbbell RDL, and with bodyweight or " +
  "bands while still learning it. No Olympic lifts. Complexity " +
  "needs a training reason.\n\n" +

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
  "- The number of athletes on each track tells you where the room is. If most of them are Bravo, Bravo's " +
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

  "REPS ARE 5, 8, 10 OR 12 — NOTHING ELSE (Josh, 2026-10-20: a kid reads '4 × 9' and stops to think). Every " +
  "lift dose for either track is sets × one of those four: 5 for heavy work, 8, 10 or 12 otherwise. Never 6, 7, " +
  "9 or 11, and never a range like '10–12'. Progression still moves one variable at a time, on those steps: " +
  "8 → 10 → 12, then a little more load and back to 8; or a set added. Cardio counts are ROUND: 10, 12, 15 or " +
  "20 reps; 40, 50, 60, 80 or 100 skips; whole court lengths; 100, 150, 200 or 250 m; 10, 12 or 15 calories. " +
  "No '18 wall balls'.\n\n" +

  "THE WORK BLOCK IS WRITTEN AS CARDIO STATIONS on every day — see THE WORK BLOCK IS CARDIO STATIONS. There " +
  "is no other shape for it.\n\n" +

  "OUTPUT: valid JSON only, no prose and no markdown fences.\n" +
  "{\n" +
  '  "focus": "short emphasis for the day, e.g. Own the basics",\n' +
  '  "minutes": { "prep": 5, "lift": 10, "work": 20, "reset": 3 },\n' +
  '  "prep": ["3-5 short warm-up lines"],\n' +
  '  "lift": {\n' +
  '    "pattern": "Squat",\n' +
  '    "bravo":   { "name": "Goblet Squat", "detail": "4 × 8 — one kettlebell by the horns, or a plate; groups of 3 rotate" },\n' +
  '    "alpha":   { "name": "Back Squat", "detail": "4 × 5" },\n' +
  '    "cues": ["one or two short coaching cues"]\n' +
  "  },\n" +
  '  "work": {\n' +
  '    "emphasis": "one of: steady aerobic | intervals | strength-endurance | carries | grip | obstacle prep",\n' +
  '    "title": "short name for the circuit",\n' +
  '    "bravo":   ["6 stations · 2 min each · rotate on the whistle", "Station 1 · The Racks — 5 pull-ups, then 10 wall balls, repeat — strong but repeatable", "Station 2 · The Rowers — row — steady pace, long pulls", "Station 3 · The Bikes — bike — strong but repeatable", "Station 4 · Open Court — 10 squat jumps, then baseline to baseline and back, repeat — land soft", "Station 5 · Open Court — 10 KB goblet step-ups each leg, then 15 med ball slams, repeat — controlled", "Station 6 · Open Court — plank shoulder taps — slow, minimal hip sway"],\n' +
  '    "alpha":   ["the SAME six lines as bravo — one block for the whole room"],\n' +
  '    "result_unit": "rounds — what the athletes write down"\n' +
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
    "MONDAY — SQUAT + PUSH. Performance Center, on the basketball court: 75 ft baseline to baseline, 56 ft " +
    "sideline to sideline. Floor distances are said in court — baseline to baseline (75 ft), baseline to " +
    "baseline and back (150 ft), sideline to sideline (56 ft), sideline to sideline and back (112 ft) — never " +
    "in metres, yards or feet. Never a lap. No sled. THE WORK BLOCK IS CARDIO STATIONS: six stations — the " +
    "Racks, the Rowers, the Bikes, three Open Court — two minutes each, one block for the whole room. " +
    "Lift 20 min, stations 12 min. " +
    "THE BATTLE TEAM HAS THE DUMBBELLS TODAY: no dumbbells anywhere in this day, in either track or on any " +
    "station — kettlebells instead.",
  tuesday:
    "TUESDAY — ATHLETIC + OVERHEAD. Boxing facility: NO RUNNING AT ALL — there is no floor for it, and NO " +
    "machines — no bikes, no rowers, no ski ergs. Every conditioning movement stays on the spot. " +
    "Athletic and energetic, not a second heavy strength day. Plyometrics are an option here. " +
    "THE WORK BLOCK IS CARDIO STATIONS: five named stations, two minutes each, one block for the whole room. " +
    "Lift 15 min, stations 10 min.",
  thursday:
    "THURSDAY — HINGE + PULL. Performance Center, on the basketball court: 75 ft baseline to baseline, 56 ft " +
    "sideline to sideline. Floor distances are said in court — baseline to baseline (75 ft), baseline to " +
    "baseline and back (150 ft), sideline to sideline (56 ft), sideline to sideline and back (112 ft) — never " +
    "in metres, yards or feet. Never a lap. No sled. THE WORK BLOCK IS CARDIO STATIONS: six stations — the " +
    "Racks, the Rowers, the Bikes, three Open Court — two minutes each, one block for the whole room. " +
    "Lift 20 min, stations 12 min.",
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
    // of weeks into a programme.
    //
    // Both tracks, not just Alpha. Anchoring continuity to Alpha alone left
    // Bravo's month a fresh guess every week — backwards, since the newer
    // athletes are the group that most needs the repetition. `lift` is the
    // old Alpha-only field, still read so a cached client cannot lose continuity.
    const priorWeeks: Array<{
      week: number; pattern?: string;
      bravo?: string; alpha?: string;
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
    // Set when only one of the two tracks is being rewritten.
    const onlyTrack = String(body?.onlyTrack ?? "").trim().toLowerCase();
    // Narrower still: just that track's lift, or just its work block.
    const onlyBlock = ["lift", "work"].includes(String(body?.onlyBlock ?? "")) ? String(body.onlyBlock) : "";
    const keepDay = body?.keepDay ?? null;

    // Every track spelled out, so "keep the same movement" means both.
    const weekLines = priorWeeks
      .map((p) =>
        `- Week ${p.week} — pattern: ${p.pattern || "?"}\n` +
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
        : "Earlier weeks of THIS block, same day — BOTH TRACKS:\n" +
          weekLines +
          "\n\nKEEP THE SAME PRIMARY MOVEMENT PATTERN and, where it still fits, the same primary exercises — " +
          "for Bravo as strictly as for Alpha. Progress ONE or TWO variables only: a rep, a set, a " +
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

    // Rewriting ONE track. The other goes over unchanged and must come back
    // unchanged — otherwise a regenerated Bravo ends up squatting while Alpha
    // benches, which is the "unrelated workouts" the rules forbid.
    const trackBrief =
      onlyTrack && keepDay
        ? `\nREWRITE ONE TRACK ONLY: ${onlyTrack.toUpperCase()}.\n` +
          `This day already exists and the coach wants a different ${onlyTrack} version. Return the whole day ` +
          "back to me with EVERYTHING else byte-for-byte unchanged: focus, prep, reset, lift pattern, cues, " +
          "work title, work emphasis, result unit, and the track you are not rewriting.\n" +
          `Here is the current day:\n${JSON.stringify(keepDay)}\n` +
          (onlyBlock === "lift"
            ? `Change ONLY the "${onlyTrack}" entry inside "lift" — the lift and its dose. ` +
              "The Cardio Stations block is one block for the whole room: leave it exactly as it is for both " +
              "tracks — unless it is not yet in the Cardio Stations shape, in which case rewrite it into that " +
              "shape now, the same lines for bravo and alpha. "
            : onlyBlock === "work"
            ? "The coach wants the CARDIO STATIONS rewritten. It is ONE block for the whole room, so write a new " +
              "stations block and put the SAME lines in both bravo and alpha. Leave both lifts exactly as they are. "
            : `Change ONLY the "${onlyTrack}" entry inside "lift", and rewrite the Cardio Stations block for the ` +
              "whole room (the same new lines for bravo and alpha). ") +
          "A rewritten lift must remain a progression of the SAME movement pattern as the other track — a " +
          "different exercise or a different dose at that level, never a different pattern.\n"
        : "";

    const userPrompt =
      `${DAY_BRIEF[dayKey]}\n` +
      (roomKit ? `${roomKit}\n` : "") +
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
    // Monday shares the room: the Battle Team has the dumbbells. A prompt rule
    // can be ignored silently, so the day is read back and, on a dumbbell,
    // asked for again with the reason attached. Two tries, then an honest error.
    const DB = /dumb\s*bell|\bdbs?\b/i;
    const mondayDumbbell = (p: unknown) => dayKey === "monday" && DB.test(JSON.stringify(p ?? {}));
    // The cardio is counted, never timed: after the first (structure) line, no
    // station may carry seconds or minutes, and no static hold.
    const TIMED = /\b\d+\s*(sec|secs|seconds|s|min|mins|minutes)\b|\d+:\d\d|\bhold\b|\bplank\b(?!\s*shoulder)/i;
    // Reps are 5, 8, 10 or 12: every "sets × reps" in a lift dose is read back.
    const REPS_OK = new Set([5, 8, 10, 12]);
    const oddReps = (p: { lift?: { bravo?: { detail?: unknown }; alpha?: { detail?: unknown } } } | undefined): string[] =>
      ["bravo", "alpha"].flatMap((t) => {
        const detail = String(p?.lift?.[t as "bravo" | "alpha"]?.detail ?? "");
        const bad: string[] = [];
        for (const m of detail.matchAll(/\d+\s*[×x]\s*(\d+)(?:\s*[–-]\s*(\d+))?/g)) {
          if (m[2] || !REPS_OK.has(Number(m[1]))) bad.push(`${t}: ${m[0]}`);
        }
        return bad;
      });
    // Tuesday: six lines, the fixed header, five named stations in order, no counts or times on a
    // station line, holds only on the two core stations. The whole room does the same block.
    const STATION_NAMES = dayKey === "tuesday"
      ? ["The Racks", "The Open Floor", "The Ring", "The Heavy Bag", "The Uppercut"]
      : ["The Racks", "The Rowers", "The Bikes", "Open Court", "Open Court", "Open Court"];
    const HOLDS_OK = dayKey === "tuesday" ? [2, 4] : [3, 4, 5];
    const stationProblems = (p: { work?: { bravo?: unknown; alpha?: unknown } } | undefined): string[] => {
      const lines = Array.isArray(p?.work?.alpha) ? (p!.work!.alpha as unknown[]).map(String) : [];
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
    const timedStations = (p: { work?: { bravo?: unknown; alpha?: unknown } } | undefined): string[] =>
      ["bravo", "alpha"].flatMap((t) => {
        const lines = p?.work?.[t as "bravo" | "alpha"];
        return Array.isArray(lines) ? lines.slice(1).map(String).filter((l) => TIMED.test(l)) : [];
      });
    let parsed: ReturnType<typeof extractJson> = {};
    let mondayNote = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        // Thinking is charged against this, and three tracks under a 40-minute
        // cap in a room with no floor is a lot to think about. Thursday used to
        // spend the whole budget deliberating and return nothing -- see
        // _shared/claude.ts. 9000 leaves room for both.
        max_tokens: 9000,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt + mondayNote }],
        ...thinking("medium"),
      } as never);
      parsed = extractJson(textOf(response));
      const odd = oddReps(parsed);
      if (odd.length) {
        mondayNote =
          "\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED: these lift doses use reps that are not 5, 8, 10 or 12, or use a " +
          `range: ${odd.map((l) => `"${l}"`).join(", ")}. Rewrite each as sets × 5, 8, 10 or 12 — one number. ` +
          "Everything else can stay.";
        continue;
      }
      const stations = stationProblems(parsed);
      if (stations.length) {
        mondayNote =
          "\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED: the Cardio Stations block is not in the required shape: " +
          stations.join("; ") + ". Rewrite the block: the exact header, then " +
          STATION_NAMES.map((name, i) => `Station ${i + 1} · ${name}`).join(", ") +
          " — work and cue, counts only where movements pair, no times, holds only on the core stations, " +
          "identical for bravo and alpha. Everything else can stay.";
        continue;
      }
      const timed: string[] = [];
      if (timed.length) {
        mondayNote =
          "\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED: these cardio stations are timed or are holds, and the cardio is " +
          `counted, never timed: ${timed.map((l) => `"${l}"`).join(", ")}. Rewrite each as a number of reps, court ` +
          "lengths, metres or calories (a hold becomes a rep movement). The first line alone keeps its minutes and " +
          "nothing else. Everything else can stay.";
        continue;
      }
      if (!mondayDumbbell(parsed)) break;
      mondayNote =
        "\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED: it is MONDAY and the day uses dumbbells somewhere. The Battle " +
        "Team has the dumbbells on Monday. Replace every dumbbell — in the lift, the work block, the cues and " +
        "any scale-down, for both tracks — with a kettlebell, a floor barbell, a med ball, a band or bodyweight. " +
        "Everything else can stay.";
    }
    if (oddReps(parsed).length) {
      return json({ error: "The coach kept writing reps that are not 5, 8, 10 or 12. Try again." }, 502);
    }
    if (stationProblems(parsed).length) {
      return json({ error: "The coach kept writing the Cardio Stations in the wrong shape. Try again." }, 502);
    }
    if (mondayDumbbell(parsed)) {
      return json({ error: "The coach kept reaching for dumbbells on Monday, when the Battle Team has them. Try again." }, 502);
    }

    // The model states its own times and is held to them. 40 is the ceiling
    // because boxing starts straight afterwards, and overrunning costs the
    // session that actually matters.
    const CAP = 40;
    const mins = (v: unknown, fallback: number) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n > 0 && n < 90 ? n : fallback;
    };
    // Fixed by the day (Josh): Tuesday 5 · 15 · 10 · 3; Monday and Thursday 5 · 20 · 12 · 3.
    const minutes = dayKey === "tuesday"
      ? { prep: 5, lift: 15, work: 10, reset: 3 }
      : { prep: 5, lift: 20, work: 12, reset: 3 };
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
        bravo: track(parsed?.lift?.bravo),
        alpha: track(parsed?.lift?.alpha),
        cues: strArray(parsed?.lift?.cues, 3),
      },
      work: {
        emphasis: String(work?.emphasis ?? "").trim(),
        title: "Cardio Stations",
        bravo: strArray(work?.alpha, 8),
        alpha: strArray(work?.alpha, 8),
        result_unit: (["rounds", "reps", "meters", "minutes", "seconds"].find((u) => String(work?.result_unit ?? "").toLowerCase().includes(u)) ?? "rounds"),
      },
      reset: strArray(parsed?.reset, 4),
      minutes,
    };

    if (!day.lift.bravo.name || !day.lift.alpha.name) {
      return json({ error: "The AI missed one of the two tracks. Try again." }, 502);
    }

    return json({ day });
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    if (err?.status === 429) return json({ error: "The AI is busy — try again in a moment." }, 429);
    if (err?.status) return json({ error: `AI service error: ${err.message}` }, err.status);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
