# Grant Coach

## RESUME HERE (handoff written 2026-10-17, end of the laptop session)

Read this block first on any computer. Claude's session notes do not travel
between machines; this file does.

**THE PLAN (Josh, 2026-10-17):** Grant Coach is an expert grant writer sitting next to Josh, not a form filler. (1) The library is the **Grant Vault**. (2) Questions come in by **screenshot** of the funder's online portal; Grant Coach reads them in with their limits, in the portal's order. (3) **Each question is a conversation**: ask first, recommend, pull numbers on request, write when told; Josh approves, **copies** the answer into the portal, marks it **pasted**; the folder is NLA's copy of the application. (4) A **reviewer** scores the application against the rubric before submit; the whole Q&A prints to PDF into the folder. (5) **Memory**: approved answers reused for the next grant; the Vault fills itself when gaps are found; each funder's preferences/history kept. (6) **Award → reporting** through the same conversation. (7) Later: pipeline board with asked/won/win rate, one calendar, fit check (go/no-go), budget help, documents that know their age, decline feedback, audit trail; left-rail page layout (Questions · Attachments · Budget · Review · Submit · Reporting); Copy / Download / Print everywhere.

**Guardrails (Josh):** never invent a number. Every statistic about NLA's youth comes from the back end (`liveFacts.ts`), never the CPF proposal or website headline numbers (those are story and flow only). Use the **last complete program year (2025-26)**. Logs are young (kiosk, Meal Tracker and driver app built spring 2026; Meal Train pauses in summer, resumed Oct 1): use **rates from full months**, name the strongest full month as such, never partial totals, never project. Consistency across the back end: **no browser pop-ups**, every confirm/question is the themed dialog (`useAsk()` in `src/components/admin/AskDialog.tsx`).

**STATE (pushed 2026-10-17, laptop):** step 1 is BUILT and PUSHED; Josh has not yet run the full test.
- Home (`AdminGrantCoach.tsx`): tabs Grants · Grant Vault · Documents. Only **New grant** starts a folder (the hand-seeded O.C.E.A.N. template button is gone; `oceanChecklist.ts` stays for the tests only). Josh wiped the old O.C.E.A.N. folder to test the real flow from scratch.
- Folder (`AdminGrantFolder.tsx`): "Questions from the funder's portal" upload box → `grant-writer` mode `read_screens` (claude-sonnet-5 vision) → one checklist row per question under "Portal · <screen>" with its limit; each row opens a `GrantQuestionPanel` (conversation via mode `chat`; Sparkles = write now; Copy / Approve / Mark pasted); "Talk to Grant Coach about this grant" for the whole-grant questions; sidebar "The numbers Grant Coach uses" (last complete program year, Refresh); "Remove this folder" under the three tiles.
- Data: migration `20261017150000_grant_coach_questions.sql` APPLIED (limit_kind/limit_value/source_path/pasted_at on `grant_checklist_items`; `grant_messages`). Edge function `grant-writer` DEPLOYED (modes item · narrative · chat · read_screens).
- Tests: `src/test/grantWriter.test.ts` (16) + `grantCoachChecklist.test.ts`; 366 passing. Pre-existing tsc errors in older files (AdminMessageBoard, ExcursionCoach…) are not ours; Vite builds fine.

**THE VERY NEXT MOVE:** Josh's localhost test of step 1 — New grant (O.C.E.A.N., Inc. / 2027 CSBG Partnership Program) → upload the 12 portal screenshots (`docs/grant-coach/ocean-2027-rfp-form.md` describes every screen) → rows appear → open one → conversation → Approve / Copy / Mark pasted → Remove a throwaway folder (themed confirm). Fix whatever he finds, then step 2 (reviewer vs rubric + Q&A PDF + Submit), step 3 (Vault fills itself, funder memory, answer reuse), step 4 (award → reporting), step 5 (pipeline, calendar, fit check, budget, document age, decline feedback).

**Open facts for Josh to confirm, inside the app when a question needs them, never in chat:** O.C.E.A.N. prior-funding amount ($180,000, from the walk-through); board roles for the five names in the Board box; the exact annual operating budget ($825,000 was entered); how income at or below 200% FPL will be verified at enrollment (screen 7).

**Deadline:** O.C.E.A.N. 2027 due Thu Oct 30, 2026, 5:00 PM. Draft done by
Oct 23, submit by Oct 28. The tool must never block the application: if a
step is not ready, answer with Josh by hand into the rows; the folder is
the record either way.

**Setup check on any machine:** `git pull`, `npm install`, `npm run dev`. The
Supabase CLI must be linked to NLA Production (`npx supabase link
--project-ref rkdkmzjontaufbyjbcku`) before any `functions deploy`; `.env`
must have the VITE_SUPABASE_* values. Migrations: hand Josh the SQL for the
SQL Editor if `db push` has no path from the machine.

---

A sibling to Scripture Coach: one digital folder per grant, from the day a
funder's documents arrive to the day the final report is filed. Specified by
Josh on 2026-10-15. Nothing is built yet; this is the brief to build from.

## Why

NLA runs on about $1M a year with two full-time people and a back end that
already tracks every kid, every check-in, every meal, every ride, every
journal entry and every grant report. Grant Coach turns that into proposals
and reports without starting from a blank page, and keeps every grant in one
place.

## Josh's workflow, in his words and order

1. **Upload** everything the funder gave you (RFP, guidelines, application,
   budget template, scoring rubric, reporting rules).
2. **Grant Coach reads it and builds the checklist** of every requirement.
   Eligibility is a yes/no that comes first.
3. **The checklist is the spine.** As Josh checks items off, Grant Coach keeps
   score: done, left, due when. Everything attached to the grant lives in the
   folder: funder documents, answers, budget, submission, award letter,
   reporting dates, the data owed.
4. **Writing is a tool inside the folder, not the point.** For each question
   the funder asks, draft an answer that hits what their rubric rewards, in
   the length they allow, backed by NLA's real numbers pulled live from the
   back end. Josh and Chrissy edit and approve.
5. **Submit** → folder goes to *Submitted*; wait.
6. **Awarded / Declined** buttons. Awarded opens a pop-up: "Did the
   requirements change, or are they as written in the RFP?" *As written* →
   the reporting requirements already extracted become the reporting
   checklist with due dates. *Changed* → upload the award letter/agreement,
   Grant Coach re-reads it and rebuilds the reporting checklist. Record the
   amount and the grant period. Folder → *Active*.
7. **Reporting** works like applying, pointed at the reporting document:
   when a due date arrives, Grant Coach pulls the period's numbers, reads
   back what the proposal promised, drafts the report, Josh edits, submits,
   logs it. Reminders before due dates (the aftercare 8 PM reminder engine
   already exists).
8. **Final report filed → folder closes.** "Apply again" next year starts a
   new folder with everything carried over.

## Two libraries, one folder

- **About NLA library** (fill once, update when things change). Seeded
  automatically from the public site (Our Story, Vision, Impact, Programs,
  awards, partners). Then the blanks funders always ask for and the site
  does not have: board of directors, staff bios, annual budget, prior-year
  revenue/expenses, audit or 990, fiscal year, EIN, date of 501(c)(3),
  address of record, who signs, outcomes/evaluation language, letters of
  support, MOUs, past grants, funding history with each funder. Plus a
  document vault for the organization-wide attachments (990, determination
  letter, approved operating budget, audit) so they are uploaded once.
- **Grant folder** holds what the funder sent and what NLA wrote for them.
- The questions Claude asked Josh in chat on 2026-10-15 (see the O.C.E.A.N.
  file) are exactly the intake the app must ask; do not ask them in chat.

## The first real grant it is built against

`ocean-2027-rfp-form.md`: O.C.E.A.N., Inc. 2027 CSBG Partnership Program,
every screen and field of the online application, captured from Josh's
walk-through. Due **Oct 30, 2026, 5 PM**. Max $75,000. Jan 1–Dec 31, 2027.
Reimbursement-based with a monthly reimbursement package. Participants must
be verified at or below 200% FPL with documents on file before service.
The old CSBG section in the app (invoice generator, budget vs actual,
checklist, dashboard, submission log) was built for this funder's monthly
package, was never used, and is being replaced, not patched.

## Build order (one step at a time; show Josh after each; he says push)

1. **About NLA library + organization document vault.** — BUILT 2026-10-16.
   `/admin/finance/grant-coach` (app `app_grant_coach`, Finance tile).
   Library fields: `src/lib/grantCoach/orgProfile.ts` (sections, help,
   website seeds); saved values in `grant_org_fields`. Documents:
   `src/lib/grantCoach/orgDocuments.ts` catalog; rows in
   `grant_org_documents`; files in the private `grant-documents` bucket
   (admins only, signed URLs) or a Drive link. The existing Document Vault
   is a Drive-link index, not file storage, so Grant Coach keeps its own.
   Josh fills the blanks (EIN, 501(c)(3) date, fiscal year, mailing
   address, phones, board, budget, 990 year, past grants) and uploads the
   four O.C.E.A.N. attachments.
2. **Grant folder + upload + AI requirement extraction → checklist** with
   due dates and status; the O.C.E.A.N. checklist is the acceptance test.
   — BUILT LEAN 2026-10-16. Grants tab on `/admin/finance/grant-coach`;
   folder page `/admin/finance/grant-coach/:id` (`AdminGrantFolder.tsx`).
   Tables `grant_folders`, `grant_checklist_items`, `grant_documents`
   (files under `grants/<id>/` in the `grant-documents` bucket). The
   O.C.E.A.N. 2027 checklist is written by hand from the captured form in
   `src/lib/grantCoach/oceanChecklist.ts` (eligibility + 12 screens, 66
   items, owner Josh/Chrissy, due Oct 30) and seeds a folder from the
   "Start O.C.E.A.N. 2027" button; `grantCoachChecklist.test.ts` is the
   acceptance test. NOT built yet: AI extraction of a checklist from
   uploaded documents (after Oct 30, on the second grant).
3. **Narrative/answer writer** from library + live data (youth served,
   attendance, demographics, meals, rides, journals, economically
   disadvantaged count) against the funder's exact questions and rubric.
   Budget workbook help.
4. **Submitted / Awarded / Declined**, the award pop-up, reporting checklist,
   reminders, monthly reimbursement package, close and re-apply.
5. Access: Grant Coach is an app in the master app list with its own box in
   Staff Management (see src/config/appRegistry.ts) and database rules.

Deadline reality: the O.C.E.A.N. application is due in two weeks. The tool
must not hold the application hostage; any step the tool is not ready for
gets done with Josh by hand, and the tool catches up. Target a complete
draft by Oct 23 and submission by Oct 28.
