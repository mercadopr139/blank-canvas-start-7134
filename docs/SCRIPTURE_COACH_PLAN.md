# Scripture Coach — Build Plan

**Status:** planning. No code written yet.
**Owner:** Josh Mercado
**Drafted:** 2026-09-05

---

## 1. What it is

A youth mentor is in the office. A kid brings up something real — a first
girlfriend, a hard week at home, a friend who said something cruel, questions
about their sexuality. The mentor types the topic into **Scripture Coach** and
gets, in seconds, a scripturally grounded way to walk the kid through it
instead of offering a personal opinion.

**One screen, five parts:**

| Part | What it gives the mentor |
|---|---|
| 1. Topic | Free-text box: "my girlfriend and I think we're ready for sex" |
| 2. Five passages | 5 ESV passages chosen for that topic |
| 3. Context | 2–3 sentences per passage. Plain, concrete, no jargon |
| 4. Talking points | Questions that carry a 10–20 minute conversation |
| 5. Prayer debrief | A few words on what to pray for — not a script to read aloud |

Then a **journal note** box (auto-dated), and **Save** — which sends the record
to Spiritual Coach Intelligence.

**Design constraint that governs everything:** the kid is 8, or 16, and they
are sitting right there. Nothing on this screen can be long. The mentor has to
be able to glance and talk, not read and recite.

---

## 2. Where it lives

| Piece | Location |
|---|---|
| Scripture Coach | Operations sidebar → `/admin/operations/scripture-coach` |
| Spiritual Coach Intelligence | Operations sidebar → `/admin/operations/scripture-coach-intelligence` |
| Permission | `operations_scripture_coach` |

Follows the existing `Admin[Feature].tsx` + `pillarTiles.ts` + `staff_permissions`
pattern already used by Weight Watchers, Practice Plan, and S&C.

---

## 3. Finding the youth

Same interaction as Weight Watchers and the check-in kiosk: a search box, type
two letters, tap the kid.

**Difference:** this is a logged-in admin page, so it does **not** need the
anonymous `search_kiosk_youth` RPC. It queries `youth_registrations` directly
under the admin RLS policy, filtered to:

- `program_year = current_attendance_program_year()` — this year's kids
- `archived_at IS NULL`

**Recommendation: do NOT require `approved_for_attendance`.** A kid whose
paperwork is still pending can still walk into the office hurting. Pastoral care
shouldn't wait on an approval queue.

The session record links to `registration_id`, so a mentor can see the history:
*"this is the third time this kid has come in about home."* That history is the
whole point — and it's also the sensitive part, which section 7 handles.

---

## 4. Data model

Two new tables.

### `scripture_topics` — the vetted library

Every generated topic is saved here after review, so the second time it comes
up it loads instantly and pre-approved.

| Column | Notes |
|---|---|
| `id` | uuid |
| `topic` | the phrase the mentor typed |
| `topic_normalized` | lowercased/trimmed, for match-on-reuse |
| `age_band` | `junior` / `senior` — derived, never asked (see 5.3) |
| `passages` | jsonb: `[{ref, esv_text, context}]` × 5 |
| `talking_points` | jsonb: string array |
| `prayer_points` | jsonb: string array |
| `reviewed_by` / `reviewed_at` | who approved it |
| `is_approved` | boolean — unapproved drafts are visibly marked in the UI |
| `created_at` | |

### `scripture_sessions` — the journal

| Column | Notes |
|---|---|
| `id` | uuid |
| `registration_id` | FK → `youth_registrations`, `ON DELETE SET NULL` |
| `coach_id` | `auth.uid()` of the mentor |
| `topic` | what was discussed |
| `topic_id` | FK → `scripture_topics`, nullable |
| `session_date` | defaults to today — the auto-date |
| `passages` | jsonb snapshot of the curated set — see section 5.1 |
| `notes` | the mentor's journal entry |
| `follow_up_notes` | added later from the Intelligence table |
| `parents_notified` | boolean, default false |
| `follow_up_needed` | boolean, default false |
| `escalation` | `none` / `parent_notified` / `referred` / `mandated_report` |
| `created_at` / `updated_at` | |

**The session stores its own copy of the passages.** If the topic is
regenerated six months later, past sessions do not change — the record of what
was actually discussed with that child stays accurate.

---

## 5. How the content is generated

**A growing library backed by AI drafting — not AI on every request.**

1. Mentor types a topic.
2. If a `scripture_topics` row matches → load instantly. No API call, no wait.
3. If not → call the `scripture-coach` edge function and save the result to the
   library.

"Saved to the library" means **it loads instantly next time** — not that it is
frozen. Anything can be regenerated at any moment (5.1). The point is that a
mentor with a kid sitting across the desk never waits on a model.

**The library becomes the asset** — after a few months, NLA owns a reviewed body
of youth discipleship material that did not exist before.

### 5.1 Curating the set — two independent passes

The five passages the model returns are a starting point, not a verdict. The
coach controls the set through two separate rounds of clicking that must not be
confused with each other.

**Pass 1 — Keep (before / during the conversation)**

- Each of the 5 passages has a **Keep** checkbox.
- Uncheck the ones that do not fit. Say the coach keeps 3 and drops 2.
- **Regenerate** pulls fresh passages into only the empty slots. The kept ones
  do not move or change.
- Regeneration never returns a reference already shown or already rejected for
  this topic in this session — the coach always gets something new.
- Repeat until the working set is right. It may end up as 2, 4, or 5 passages.

**Pass 2 — Used (after the conversation)**

- A separate **"Used in session"** checkbox on each kept passage.
- The coach may have kept 4 and only actually walked through 2.
- **Only the Used passages appear in the PDF report.**

Two flags per passage, and they mean different things:

| Flag | Question it answers |
|---|---|
| `kept` | Is this passage part of my working set for this conversation? |
| `used` | Did I actually walk the kid through this one? |

Stored per session as jsonb:
`[{ref, esv_text, context, kept: bool, used: bool}]`

### 5.2 Age is derived, not asked

No age toggle. The mentor has already selected the youth, so
`child_date_of_birth` is on hand — the age is computed and passed to the model
automatically.

Selecting the kid is effectively the mentor checking them in for the session,
and it carries everything the model needs. One less click in a moment where the
mentor's attention belongs on the child, not the screen.

Age is passed as an actual number, not just a band, so the model can pitch a
9-year-old differently from a 16-year-old. `age_band` on the library row is
only for cache separation, so a junior's version of a topic is never served to a
senior.

### 5.3 Session report (PDF)

Generated from the saved session, in NLA branding — dark ground, NLA red
`#bf0f3e`, academy logo.

Contents: youth name, date, coach, topic, the **Used** passages with their
context, the coach's notes, and the follow-up fields (parents notified,
further discussion needed).

Reprintable at any time from Spiritual Coach Intelligence, and it always
reflects that session's stored snapshot.

### Edge function

New `supabase/functions/scripture-coach/`, following the existing
`corner-coach` and `strength-coach` pattern (Anthropic SDK, `ANTHROPIC_API_KEY`
already configured in the project).

- **Model:** `claude-opus-5` — decided. Best passage selection and pastoral
  judgment, which is what this feature lives or dies on. Volume is low: a topic
  is generated once and then served from the library.
- **Speed comes from the library, not from a smaller model.** A repeat topic
  loads with no model call at all. Only a genuinely new topic waits, and that
  request streams so passages appear as they are chosen rather than after a
  silent pause.
- **Structured output:** `output_config.format` with a JSON schema, so the five
  passages, contexts, talking points, and prayer points come back in a fixed
  shape rather than parsed out of prose.
- **The model returns references only.** Verse text is fetched separately from
  the ESV API (section 6) — an LLM must never be the source of the scripture
  text itself.

### The theological lane

System prompt holds an expository, historically Reformed line, consistent with
**John MacArthur, Voddie Baucham, Cliffe Knechtle, and Jonny Ardavanis** — and
explicitly:

- Text-driven. The passage governs the point, never the reverse.
- No proof-texting. If a verse is being used outside its context, pick another.
- Grace and truth together — never truth without compassion, never affirmation
  without scripture.
- Speak to the kid in front of you: an 8-year-old and a 16-year-old get the same
  theology in very different words.
- When the honest answer is "the Bible speaks to this indirectly," say that
  instead of forcing a verse to fit.

---

## 6. ESV licensing — the one real blocker

ESV text is copyrighted by Crossway. They run an official API
(**api.esv.org**) that issues free keys for non-commercial use, subject to
their terms.

**Action: Josh registers for an ESV API key.** Everything else can be built
around it, but the app must not ship reproducing ESV text from any other source.

If Crossway declines or the terms do not fit, the fallback is a public-domain
translation (WEB, ASV) — noticeably worse for youth reading level, so this is
plan B, not plan A.

---

## 7. Spiritual Coach Intelligence

A table view of saved sessions. Per row, the mentor can:

- edit the note
- add follow-up comments
- toggle **parents/guardians notified**
- toggle **further discussion needed**
- set **escalation**: none / parent notified / referred / mandated report

Plus filters for "needs follow-up" and "parents not yet notified", so nothing
quietly falls through.

### Access — decided

**Anyone with backend access can read the notes.** Josh's call: the great
majority of these conversations are ordinary youth-work topics, and shared
visibility is what lets the mentor team actually work together on a kid.

RLS therefore matches the rest of the admin surface — admins read and write
`scripture_sessions`; the anon role has no access at all.

Two things this leaves available if the picture ever changes: `coach_id` is on
every row, so "my sessions only" is a filter away, and the
`operations_scripture_coach_lead` permission key can be added later without a
data migration. Not building either now.

### Escalation banner

Certain topics — abuse, self-harm, suicide — surface a banner above the
scripture with NLA's reporting steps and who to call. The mentor still gets the
passages; the kid still needs shepherding. The banner exists so that a
reporting obligation is never missed in an emotional moment.

---

## 8. Build order

| Phase | What ships |
|---|---|
| **0** | Josh gets the ESV API key |
| **1** | Migration: both tables, RLS, permission key, enum |
| **2** | Scripture Coach screen: youth search, topic box, results, journal, Save |
| **3** | `scripture-coach` edge function + structured output + theology prompt |
| **4** | Keep / Regenerate / Used — the two curation passes (5.1) |
| **5** | Spiritual Coach Intelligence table + follow-up fields + filters |
| **6** | Branded PDF session report (5.2) |
| **7** | Escalation banner + reporting steps |

Phases 1–6 are the usable product. 7 hardens it.

---

## 9. Decisions made

- **Notes are readable by anyone with backend access.** (§7)
- **No age toggle** — derived from the selected youth's date of birth. (§5.2)
- **Model is `claude-opus-5`.** Speed comes from the library cache. (§5)
- **Two curation passes**, Keep and Used, driving a branded PDF. (§5.1, §5.3)

## 10. Still open

1. **ESV API key** — Josh registers at api.esv.org (accepting Crossway's licence
   has to be NLA, not the developer), then it is stored as the Supabase secret
   `ESV_API_KEY`. **Blocks phase 3.**
2. **Escalation list** — which topics trigger the banner, and NLA's actual
   reporting steps and phone numbers for PA/NJ. Josh supplies these. Blocks
   phase 7 only.
