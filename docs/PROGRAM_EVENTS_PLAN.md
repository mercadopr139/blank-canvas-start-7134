# Program Events & Program Highlights — Build Plan

> **Purpose of this file:** the plan lives *in the repo* so it travels with the
> code between the laptop and desktop. Any Claude Code session (either machine)
> should read this before continuing the feature. Update the checkboxes as
> phases land.

## What we're building

**Program Events** in Attendance Intelligence. An *event* is an on-site program
activity (e.g. *Banking & Boxing*) that staff write up for grant **Program
Highlights**. It's a lighter cousin of an **excursion**: name + overview +
debrief narrative, but **NO transportation**.

Key design decisions (confirmed with Josh):

- An event is an **add-on attached to a calendar day** — a day can be a practice
  day AND host an excursion AND host an event.
- It shows **YELLOW** on the calendar (a marker like the purple excursion — it is
  **not** a 3rd state in the green/red practice dot cycle).
- Each event has a **"count attendance" toggle** (situational). When ON, event
  check-ins are tracked as their **own yellow count**, kept **separate** from the
  green practice averages so they never dilute them. Mirrors how excursions work.
- **Program Highlights** is its **own top-level sidebar feature** (in Operations),
  NOT a button inside Events Intelligence. Three-layer model:
  - **Excursion Intelligence** — one trip → its own grant report
  - **Events Intelligence** — one event → its own grant report
  - **Program Highlights** — rolls up excursions + events across a date range

## Status

### ✅ Phase 1 — Events on the calendar (DONE, on GitHub, DB live in prod)
- `program_events` table + admin-only RLS — `supabase/migrations/20260718000000_program_events.sql`
- `src/components/admin/EditEventModal.tsx` — name, overview, debrief, count-attendance toggle
- Calendar wiring in `src/pages/admin/AdminAttendance.tsx`: yellow marker,
  add/edit/remove via right-click menu and the day pop-up, legend entry

### ✅ Phase 2 — Optional event attendance (DONE, on GitHub, DB live in prod)
- `event_id` on `attendance_records` + `admin_record_event_attendance` RPC —
  `supabase/migrations/20260718001000_event_attendance.sql`
- Event check-ins tagged `program_source = 'Event'` → never touch the `'NLA'`
  practice numbers; shown as their own **yellow count** on the tile
- Day pop-up: **"Add to"** targets Practice / Excursion / Event; roster **grouped
  by activity** with per-section headers + counts

> **Database is ALREADY LIVE in production** (both migrations were applied via the
> Supabase SQL Editor). The migration files are idempotent, so `supabase db push`
> from a linked machine is safe (no-op). **Do NOT re-run the SQL by hand.**

### ✅ Phase 3 — Events Intelligence page (DONE, on GitHub)
Mirrors the Excursion equivalents:
- `src/pages/admin/AdminEventsIntelligence.tsx` — year-scoped list of events with
  stat tiles, Reach & Equity, monthly trend, and a **Grant Report** button per
  event. Honors `count_attendance` (narrative-only events never move the numbers).
- `src/components/admin/EventReportSheet.tsx` — AI narrative → edit → revise → PDF,
  backed by `supabase/functions/events-report/index.ts` (deployed live).
- Route `events-intelligence` in `src/App.tsx`; sidebar tile "Events Intelligence"
  in `src/config/pillarTiles.ts` (under Attendance, after Excursion Intelligence).
- Edit Event opens the shared `EditEventModal`. Roster add/remove stays in the
  calendar day pop-up (Phase 1/2); a modal-roster variant is parked for later.

### ⬜ Phase 4 — Program Highlights page (TO DO)
- New **top-level** page in **Operations** (own route + sidebar tile).
- A **chronological timeline** of excursions 🟣 + events 🟡.
- A **date-range picker + "Generate Program Highlights Report"** → ONE combined
  grant narrative (new or extended edge function like
  `supabase/functions/excursion-report/index.ts`) → edit/revise → PDF via
  `src/lib/generateCornerCoachReportPdf.ts`.

## Files to mirror (stay consistent, don't reinvent)
- `src/components/admin/ExcursionReportSheet.tsx` — the report/AI-narrative UI
- `supabase/functions/excursion-report/index.ts` — the AI narrative generator
- `src/pages/admin/AdminExcursionIntelligence.tsx` — the "one activity → report" page
- `src/lib/generateCornerCoachReportPdf.ts` — the branded PDF generator

## Safety rules
- **Build Events as a parallel to Excursions.** Do NOT change how excursions or
  practice attendance work.
- **Two-device discipline:** `git fetch` + reconcile with `origin/main` BEFORE
  building; commit + push whenever you pause so the other machine stays in sync.
- Event DB tables/columns aren't in the generated Supabase types yet — cast with
  `as never` / `as any` on `.from()`/`.rpc()`, the same pattern already used in
  `AdminAttendance.tsx` and the forms builder.
