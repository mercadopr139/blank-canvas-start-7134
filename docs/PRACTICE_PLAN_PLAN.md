# Practice Plan — Build Plan

**Status:** planning. No code written. Replaces the abandoned first attempt.
**Owner:** Josh Mercado
**Drafted:** 2026-09-05
**Source:** Josh's whiteboard (`• BT.pdf`) + design conversation

---

## 1. Why the first attempt failed

The first Practice Plan was **one timeline for one night**. The academy does
not train that way. Three groups train at the same time, each with its own
week, and the week is a standing pattern rather than something built from
scratch every evening.

The unit is **group × day**, and there are two layers, not one:

| Layer | What it holds | How often it changes |
|---|---|---|
| **Template** | *What kind* of session each group does each day | Rarely — once a season |
| **Week** | *What we're actually doing* — the drills | Every week, by Josh |

The template answers "Monday for Battle Team is Weights and Boxing Circuit."
The week answers "…and the circuit is 5 rounds on the bag, doubling the jab."

Keeping them apart is the whole design. Editing next week's drills never
touches the template; changing the template never rewrites a week already
written.

---

## 2. The three groups

Defined by **how they compete**, not by age.

| Group | Focus |
|---|---|
| **Battle Team** | Boxing — preparing for competition |
| **Non-Battle Team** | Boxing 101 — competing other ways: 5K, obstacle races, CrossFit |
| **Littles** | Boxing 101 and soccer |

The Non-Battle Team arrow on the whiteboard matters: these kids are not the
ones who *don't* compete, they compete at something else. The board should
carry that, not bury it.

---

## 3. The standing template

From the whiteboard. Each cell is one or more **blocks**.

| | Battle Team | Non-Battle Team | Littles |
|---|---|---|---|
| **Mon** | Weights · Boxing Circuit | Boxing · Weights | Boxing · Soccer |
| **Tue** | Coaching Juniors · Boxing Bootcamp | Weights · Boxing | Strength · Smile Lab |
| **Wed** | Weights · Sparring and/or Run | Boxing | Boxing · Soccer |
| **Thu** | Boxing Circuit | Instructional Sparring · Weights | Boxing · Soccer |
| **Fri** | Weights · Sparring and/or Run · Fun Friday | Fun Friday (Sparring) | Fun Friday · Sparring |

**Saturday** is excursions and planned events — already built elsewhere in the
app, so the board reads from those tables rather than duplicating them.

### Season and off-season

The week is **Mon–Fri in season** and **Mon–Thu in the off-season**. One toggle
on the template — *In season / Off season* — decides which days a new week
generates and which days the board shows.

Friday's template rows are not deleted in the off-season, just dormant. Flip
back to in-season and Friday returns exactly as it was, Fun Friday and all.

### The three groups are labels, not records

Battle Team / Non-Battle Team / Littles are **loose labels used to separate
youth during practice** — they are not tracked on any registration and nothing
in the app assigns a child to one. So they are simply the board's three
columns, with no roster, no membership, and nothing to keep in sync.

---

## 4. Spiritual Development — a standing marker, not weekly work

It runs across all three groups and gets **no weekly detail**. Josh does not
fill this in; the pastors run their own lessons their own way. The board's job
is simply to tell the youth what is on today.

| Day | On the board |
|---|---|
| Mon | "Chew on this…" — Rev |
| Tue | Smile Lab |
| Wed | "Chew on this…" — Pastor Harris |
| Thu | Bible Study — boys and girls separately |
| Fri | "Chew on this…" — Pastor Harris |

Part of the template. Changes only when the standing arrangement changes.

---

## 5. The 5-minute team meeting

Every practice opens with a short team meeting — general discussion points to
review before anyone moves. This is **not** in the whiteboard but came out of
the design conversation, and it belongs at the **top of the board**, not
buried under the group columns: it is the first thing that happens and the
thing everyone is looking at while it happens.

- Per day, not per group — the whole academy is in the room
- A short list of points, written with the rest of the week
- Displayed large; nothing else competes with it during those five minutes

---

## 6. The weekly rhythm

**Monday, before practice:**

1. Josh opens Practice Plan and sees **last week** — what was actually run.
2. He clicks **Start new week**. Nothing generates automatically; the click is
   deliberate, because reviewing last week is part of the ritual.
3. The new week comes up on the template's skeleton, **pre-filled with last
   week's drills**, each slot carrying **Keep** or **Clear**.
   - Same as last week → Keep, done in seconds.
   - New work → Clear and write it.
   - Everything stays editable regardless.
4. He writes the week's team-meeting points.
5. **Publish** — the Gym Board picks it up.

Past weeks stay intact and readable. Over a season that becomes a genuine
record of what was actually trained.

---

## 7. Two surfaces

### The Gym Board — `/practice-board`
On the TV in the gym. Read-only, no login, big type, readable across the room.

```
        MONDAY · September 8                    "Chew on this…" — Rev

  ┌──────────────────────────────────────────────────────────────┐
  │  TEAM MEETING · 5 min                                        │
  │  • Tournament sign-ups close Friday                          │
  │  • Respect the equipment — gloves back on the rack           │
  └──────────────────────────────────────────────────────────────┘

  BATTLE TEAM          NON-BATTLE TEAM        LITTLES
  ───────────          ───────────────        ───────
  WEIGHTS              BOXING                 BOXING
  5×5 bench, then      Pad work — jab-cross   Stance and footwork,
  accessory circuit    combinations           partner mirror drill

  BOXING CIRCUIT       WEIGHTS                SOCCER
  5 rounds bag,        Bodyweight circuit     Small-sided games
  2 on / 30 off        …                      …
```

- Opens on today automatically; no one touches it
- Saturday shows the excursion or event instead
- Arrow keys / swipe to look at another day

### Start Practice Countdown

A button sits on the board — **Start Practice Countdown**. Josh or Chrissy taps
it when the board goes up and a large countdown to the **5:15 pm** start takes
over the screen.

Its whole job is consistency: practice starts at 5:15, every day, and everyone
in the room can see how long is left.

- One tap to start, and just as easy to leave — Esc, a tap outside, or a
  visible close button. It must never trap the board.
- Big enough to read from across the gym. Minutes and seconds.
- The last minute changes colour so the room feels it coming.
- At zero: **PRACTICE STARTS NOW**, held for a few seconds, then it clears
  itself back to the board.
- Tapped after 5:15, it says how long practice has been underway rather than
  counting to a time that has passed.
- The 5:15 target is a setting, not a constant — it will not be 5:15 forever.

The board underneath keeps working the whole time. The countdown is a layer
over it, never a mode you have to escape.

### The editor — `/admin/operations/practice-plan`
Two tabs:

- **This Week** — the 5 × 3 grid, edit any slot inline, write the meeting
  points, Publish.
- **Template** — the standing skeleton and the spiritual row. Rarely opened.

---

## 8. What makes it fast (the point of the whole thing)

1. **Keep / Clear per slot.** Most weeks are small edits on last week.
2. **Drill library.** Every drill Josh types is remembered. Next time he starts
   typing "5 rounds bag" it offers what he wrote before. The library builds
   itself — no setup, no maintenance.
3. **Apply across groups.** Fun Friday is Fun Friday. Write it once, push it to
   all three columns with one click.
4. **One screen for the week.** The whole 5 × 3 grid visible and editable
   without navigating anywhere.
5. **Links to what already exists.** "Weights" points at the S&C board, Smile
   Lab at Smile Lab, Saturday at Excursions and Events. Written once,
   maintained in one place.
6. **Print / PDF the week** for the coaches who want paper.

---

## 9. Data model (sketch)

- `practice_template_blocks` — group, weekday, position, category
- `practice_spiritual_template` — weekday, label, leader
- `practice_settings` — season mode (in_season | off_season), practice start
  time (default 17:15)
- `practice_weeks` — week_start, status (draft | published), created_by
- `practice_blocks` — week_id, group, weekday, position, category (snapshotted
  from the template), detail
- `practice_meeting_points` — week_id, weekday, points (jsonb)
- `practice_drills` — the self-building library: text, times_used, last_used

The group is a plain enum column (`battle_team | non_battle_team | littles`)
used for ordering the columns. There is no groups table and no membership —
they are labels for splitting the room, nothing more.

Snapshotting the category onto the week is deliberate: a template change must
never rewrite what a past week says was trained.

**Access:** editing behind `operations_practice_plan`. The Gym Board is public
and read-only — it shows drills, never a child's name.

---

## 10. Build order

| Phase | What ships |
|---|---|
| **0** | Delete the abandoned first attempt |
| **1** | Migration + template seeded from the whiteboard + season toggle |
| **2** | Template editor |
| **3** | Week editor — grid, Start new week, Keep/Clear, meeting points, Publish |
| **4** | Gym Board |
| **5** | Start Practice Countdown |
| **6** | Drill library + apply-across-groups |
| **7** | Print / PDF, links out to S&C, Smile Lab, Excursions |

Phases 1–5 are the usable product.

---

## 11. Settled

- Groups are loose labels, not tracked anywhere — three columns, no rosters.
- Mon–Fri in season, Mon–Thu off season, on one toggle.
- No round timer on the board. One countdown to the 5:15 start, opened by a
  button and closed just as easily.
- Josh writes the practice detail. Pastors run their own lessons their own way;
  the board only announces what is on.
