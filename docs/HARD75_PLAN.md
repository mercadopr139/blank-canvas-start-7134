# 75 Hard — build plan

A 75-day tracker. Two sessions every day — one cardio, one strength, in either
order — plus the rest of the 75 Hard checklist, a daily progress photo, and a
calendar that shows the whole thing at a glance.

First participant: **Rob**, 45, fireman. Solid shape, mentally tough. Goal is
fat loss with muscle gain. Started **8 September 2026**, so Day 75 is
**21 November 2026**.

## Decisions (locked 2026-09-08 with Josh)

| Question | Decision |
| --- | --- |
| Daily rules tracked | The full checklist: two workouts, one outdoors, water, 10 pages read, diet followed, progress photo. |
| Missing a day | Reset to Day 1, as the program is written. The failed attempt is kept in history. |
| Equipment | Generate for a full gym, with a home/firehouse substitute named for every lift. |
| Photos | Private bucket. Rob and the super-admin, nobody else. |
| Participants | Built multi-participant from the start, though only Rob runs it today. |

## The programming problem

75 Hard means 75 consecutive strength sessions with no rest day. At 45 that is
how a shoulder stops working in week four. So recovery is built into the
rotation rather than assumed:

```
1  Chest + Triceps       + abs
2  Back + Biceps         + abs
3  Legs — quad focus     + abs
4  Shoulders + Arms      + abs
5  Legs — posterior      + abs
6  Mobility + core          ← the deload that still counts
```

Every sixth day is a genuine recovery session that still ticks the box, so he
never has to break the streak to recover — the recovery *is* the session. Abs
in all of them, as asked.

Cardio runs on its own rhythm underneath: steady-state, intervals and a long
effort, arranged so a hard cardio day never lands on the heaviest leg day.

## Generation

The 75-day plan is built **deterministically in `src/lib/hard75.ts`** — not by
a model. Three reasons:

1. The whole calendar exists the moment he signs up. Seeing Day 40 on Day 1 is
   most of the motivation.
2. Progressive overload across the twelve and a half cycles is arithmetic, and
   arithmetic should not be delegated to a language model.
3. It is pure, so it is unit-tested.

The AI earns its place elsewhere: **regenerating one session**. When Rob doesn't
fancy the Thursday workout, the edge function writes a fresh one for that day's
body parts and equipment, and nothing else on the calendar moves.

## Tables

- `hard75_runs` — one attempt: participant details, start date, status
  (`active` / `failed` / `complete`), and a link to the attempt it replaced.
- `hard75_days` — 75 rows per run: day number, date, the cardio and strength
  sessions as jsonb, the six checklist booleans, and the photo path.
- Photos live in a private `hard75-photos` storage bucket, keyed by run.

## Deliverables

- Migration: tables, RLS, private bucket + policies.
- `src/lib/hard75.ts` — rotation, plan generation, progression, day maths,
  status colours. Pure and tested.
- `supabase/functions/hard75-workout/index.ts` — regenerate one session.
- Calendar + day detail + photo timeline under Strength & Conditioning.
