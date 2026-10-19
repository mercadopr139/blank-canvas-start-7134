# The Lap — the weekly agenda, rebuilt

Planned with Josh on 2026-10-19. Planning only; nothing is built. Read this
before touching the agenda, the Workbench's Agenda Meeting tile, or the
message board's pillar tag.

## Why the old agenda failed (from the data, 2026-10-12 and 2026-10-19)

71 items, all created May 26 – Jun 10, none touched by a person since. Every
item still "Pending Review". Sales & Marketing and Finance never got a single
task. Meanwhile the message board had 150 conversations and ~30 active in the
last month — and when the agenda failed, Josh ran the meeting in message
board conversations called "Weekly Agenda" and "Agenda Meeting".

Root causes: (1) nothing was ever *done* — review/reset left no record of
decisions; (2) it was a second task system beside the Workbench, and two task
systems for two people means one dies; (3) four nesting levels and per-pillar
progress for a two-person meeting; (4) the "x of y reviewed" counter could
never finish. Josh's words: "the topics are fine; my issue was the workflow to
get through them."

## What Josh wants (his words, in order)

1. The weekly agenda is when he and Chrissy discuss the week ahead; both
   generate tasks; the agenda should work directly with their task managers
   (Workbenches). Next week they must review last week's tasks and see what
   got done.
2. A weekly focus tile labelled **Agenda Meeting** on each Workbench holding
   the tasks created in the meeting, so each person sees their own tasks and,
   separately, what they committed to in the meeting.
3. Tasks can have **two owners**.
4. The weekly agenda, the Workbench and the message board must **connect** —
   "not three islands".
5. Topics = the three pillars. **Vision is not a fourth bin**: the weekly
   agenda is one circle around all of NLA, and every week should get closer
   to the vision. Vision is the finish line, not a section.
6. **Start each week by reviewing last week** — accountability.
7. Make it **fun and interactive**: a big circle, a LAP around NLA, markers
   along the way, confetti at each marker. Start line = Operations (the
   longest stretch), then Sales & Marketing, finish with Finance and the
   Vision. Keep the existing pillar colours.
8. **No timer** in the meeting. Use the **existing 21 agenda topics** as the
   checkpoints.

## The model — one system, three views of the same tasks

- **Message board = where things get raised.** Already alive, already tagged
  by pillar, already has "send to Workbench". Untouched except: a
  conversation can be linked to a lap checkpoint (see Data).
- **Workbench = where things get done.** Every task lives there once, in the
  owner's tiles. New standing tile **Agenda Meeting** (`key: agenda`) on each
  manager (PD, PC, APC, ATM), not deletable. Two owners → the task shows in
  both tiles; done by either marks it done (one `signals` row, two owners —
  see Data). Done tasks stay in the tile until archived, like every task.
- **The Lap = the meeting view.** A full-width screen (like the Gym Board),
  opened from Operations. Three views, one dataset: a commitment is a
  `signals` row with `source = "<TYPE>:agenda"`, `lap_topic_id`, and the
  meeting date it was made in.

## The screen

**Warm-up (last week's review).** Before the start line: last week's
commitments one by one, with owner(s). Done → check + small burst. Open →
*Carry forward* (it waits at its topic's checkpoint) or *Drop* (archived
with a one-line reason). The lap cannot start until every one is touched.

**The ring.** One big track, segments coloured by pillar in proportion to
checkpoint count (Operations 11, Sales & Marketing 6, Finance 4 of 21 —
Operations ≈ 52% of the circumference). The 21 existing topics are the
checkpoints, in their existing order. A runner marker moves as topics are
hit. Reaching a checkpoint lights it; crossing into the next pillar fills
that segment solid and fires confetti in the pillar's colour (canvas-confetti
is already a dependency). The finish line is **the Vision**: a short card
with NLA's vision statement and the week's big confetti.

**At a checkpoint**, three panels: the open message-board conversations in
that pillar (and any linked to this topic), the carried-forward commitments,
and *Add a commitment* (title, owner(s) Josh/Chrissy, optional note) → lands
in each owner's Agenda Meeting tile and plants a flag on the ring.

**After the finish.** The lap is saved: date, who ran it, commitments made,
per-pillar counts, carried/dropped. A streak counter (laps in a row). A
*Print the lap* button (the week's record). Next meeting starts a fresh lap.

**Colours:** `PILLAR_COLOR` from AdminMessageBoard — operations #bf0f3e,
sales_marketing #22c55e, finance #38bdf8 — everywhere: ring, checkpoints,
flags, confetti.

**Not in it:** a timer; sound; sub-tasks; Pending Review/Reviewed; Reset
Week; the agenda_items tree.

## What makes it a real operating tool (added 2026-10-19, "operations cap")

**Flexibility**
- Topics are editable from the lap: add one mid-meeting (joins the ring at
  the current spot), rename in place, drag to reorder, retire (never delete —
  history and open commitments survive under it). A new topic is either
  *this lap only* or *added to the template*; template changes apply from
  the next lap, never mid-lap.
- Pause and resume: an interrupted lap resumes where it stopped. A lap open
  more than 7 days closes as *incomplete* so it never blocks the next one.
- A lap can be run by Josh alone; the other's commitments wait in their tile.

**The data comes to the checkpoint (no one has to remember)**
- Live numbers per topic, this week vs last: Registration & Attendance →
  unique youth; Meal Train → meals and nights; Transportation → trips and
  unclosed trips; Hawk Squad / BAM → attendance; Budget → month-to-date
  revenue; Excursions → next trip and roster count. Read-only, from the same
  queries the Intelligence pages use.
- A **"coming up" strip — the next two weeks** (Josh, 2026-10-19: the meeting
  is weekly; the strip is a heads-up, never something the lap asks you to act
  on) at the start line, repeated at the matching checkpoint: program events, excursions, grant deadlines (O.C.E.A.N. Oct
  30), 990 and insurance renewals, USA Boxing deadlines. Source: a small
  `lap_dates` table (title, date, pillar, topic, recurring) plus program
  events and grant folders' due dates.
- Message-board conversations with **new messages since the last lap** are
  flagged at their pillar; the rest sit quietly.

**Accountability on the week it matters**
- A commitment carried forward twice turns red; carried three times the lap
  asks for a decision: split it, reassign it, or drop it with a reason.
- **Decisions, not just tasks**: a checkpoint can hold a one-line "we
  decided" with a date, kept on the lap record. Why the schedule changed is
  findable six months later.
- A commitment can be put straight onto Today's Plan (or a day this week)
  as it is created — the Workbench "+" without leaving the lap.
- **Morning-of reminder** to both at 8 AM on lap day (the aftercare
  reminder engine), listing last week's open commitments.

**Visibility after the meeting**
- The lap summary is **posted to the message board** in the existing
  "Agenda Meeting" conversation: date, commitments by owner, decisions,
  carried/dropped. That is what Chrissy reads on her phone that night.
- **Lap history**: every past lap by date, printable, with its commitments
  and decisions. Streak counter.

**Left out on purpose (first version):** timer, sound, scoring people
against each other, AI summaries, a phone layout (the message board already
covers the phone). Add only if a real week demands it.

## Data

- `lap_topics` (id, pillar, title, sort_order, is_active) — seeded from the
  21 `agenda_items` depth-1 rows. Editable from the lap's settings.
- `laps` (id, meeting_date, started_by, started_at, paused_at, finished_at,
  status applying|open|finished|incomplete, current_topic_id, stats jsonb).
- `lap_topics` also: `retired_at`, `this_lap_only_lap_id`.
- `lap_decisions` (id, lap_id, topic_id, text, created_by, created_at).
- `lap_dates` (id, title, on_date, pillar, topic_id, recurring_every text
  null, source text) — the horizon; seeded with O.C.E.A.N. Oct 30, the 990
  and insurance renewals once Josh gives the dates.
- `signals` also: `carry_count` (turns red at 2, forces a decision at 3),
  `dropped_reason`.
- `signals` gains `lap_id`, `lap_topic_id`, `lap_commitment_id`,
  `carried_from_signal_id`, `carry_count`, `dropped_reason`. **Two owners =
  one row per owner**, tied by `lap_commitment_id`, each in its owner's
  Agenda Meeting tile with the Workbench's normal `source` ("Agenda Meeting"
  for PD, "PC:Agenda Meeting" for PC…). A trigger keeps the rows' status in
  step, so done by either is done for both, and each owner still plans it on
  their own day. (Built 2026-10-19 this way instead of an owner array so every
  existing Workbench read — tile grouping, Today's Plan, the tile page — stays
  exactly as it is.)
- `mb_conversations` gains `lap_topic_id` (nullable) so a conversation can be
  pinned to a checkpoint; untagged ones show under their pillar.
- Reuse: `AddWorkbenchModal` (send-to-Workbench), Today's Plan "+", the
  realtime channel pattern, `useAsk()` themed dialogs (no browser pop-ups).
- Retire: `agenda_*` tables and `src/components/admin/agenda/*` after the
  lap has run for two weeks and Josh says so. Keep the data until then.

## Build order (one step at a time; show Josh after each; he says push)

1. **Data + Agenda Meeting tile.** — BUILT 2026-10-19. Migration
   `20261019120000_the_lap_step1.sql` (applied): `lap_topics` seeded with the
   21 topics, `laps`, the `signals` columns and the status-sync trigger, and
   the Agenda Meeting tile (key `agenda`, flag icon) on every Workbench right
   after NLA, not deletable. Helpers in `src/lib/lap/commitments.ts`. Josh can
   already add a commitment from the tile; two-owner rows arrive with step 2.
2. **The Lap screen, walk-through.** — BUILT 2026-10-19. `/admin/the-lap`
   (`AdminTheLap.tsx`, app `app_the_lap` in Command Center, a button at the
   top of the Operations sidebar). Ring (`LapRing.tsx`, geometry in
   `src/lib/lap/ring.ts`), checkpoints in running order, runner, Back /
   Next / tap-a-marker, per-checkpoint commitments (one row per owner,
   owners = the task managers, "On today's plan"), "We decided"
   (`lap_decisions`, migration `20261019130000` applied), topic menu
   (rename, add after — every lap or this lap only, move, retire),
   Pause (back to the admin; resumes on return), a lap open > 7 days closes
   as incomplete, the Vision finish card (text from the public Vision page
   until Josh gives his own), confetti per pillar crossing and at the finish,
   streak in the header. Only the Super Admin sees Start. Exercised against
   production as Josh, rolled back.
3. **Warm-up.** Last lap's commitments, done / carry / drop with reason,
   carry_count colouring and the forced decision at three; gate on the
   start.
4. **Numbers and the horizon.** Live per-topic numbers; the two-week strip and
   `lap_dates`; new-messages flags from the message board.
5. **Message board link.** Pin a conversation to a checkpoint; the lap
   summary posted to the "Agenda Meeting" conversation; the morning-of
   reminder.
6. **Record + print.** Lap history, print view.
7. Retire the old agenda after two laps.

**Who starts a lap (Josh, 2026-10-19):** only Josh. The Start button is
the Super Admin's alone; it keeps him present at every meeting. Chrissy
does everything else on the screen once a lap is open.

Open for Josh: the vision statement text for the finish card (the site's
Vision page has one).
