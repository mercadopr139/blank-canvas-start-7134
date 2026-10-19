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

## Data

- `lap_topics` (id, pillar, title, sort_order, is_active) — seeded from the
  21 `agenda_items` depth-1 rows. Editable from the lap's settings.
- `laps` (id, meeting_date, started_by, finished_at, stats jsonb).
- `signals` gains `lap_id`, `lap_topic_id`, `carried_from_signal_id`,
  `owner_user_ids uuid[]` (two owners on one row; the Workbench shows a row
  in a tile when the manager's owner is in the array **or** `source` matches,
  so existing single-owner behaviour is unchanged).
- `mb_conversations` gains `lap_topic_id` (nullable) so a conversation can be
  pinned to a checkpoint; untagged ones show under their pillar.
- Reuse: `AddWorkbenchModal` (send-to-Workbench), Today's Plan "+", the
  realtime channel pattern, `useAsk()` themed dialogs (no browser pop-ups).
- Retire: `agenda_*` tables and `src/components/admin/agenda/*` after the
  lap has run for two weeks and Josh says so. Keep the data until then.

## Build order (one step at a time; show Josh after each; he says push)

1. **Data + Agenda Meeting tile.** Migration above; seed topics; the tile
   appears on every Workbench; two-owner rows show in both tiles. No lap
   screen yet — Josh can already add a commitment from the Workbench.
2. **The Lap screen, walk-through only.** Ring, checkpoints, runner,
   per-checkpoint panels, Add a commitment, Vision finish, confetti, saved
   lap + streak. Opened from the Operations sidebar as "The Lap".
3. **Warm-up.** Last lap's commitments, done/carry/drop, gate on the start.
4. **Message board link.** Pin a conversation to a checkpoint from the
   board; conversations appear at checkpoints; "send to Workbench" from a
   checkpoint keeps the lap tag.
5. **Record + print.** Lap history page, print view, streak.
6. Retire the old agenda.

**Who starts a lap (Josh, 2026-10-19):** only Josh. The Start button is
the Super Admin's alone; it keeps him present at every meeting. Chrissy
does everything else on the screen once a lap is open.

Open for Josh: the vision statement text for the finish card (the site's
Vision page has one).
