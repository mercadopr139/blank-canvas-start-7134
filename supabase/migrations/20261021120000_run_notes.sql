-- Trips & Pay: a note on a trip (Chrissy, 2026-10-21).
-- Why a route was created, what is still needed, anything the office should
-- know about that trip. Lives on the run itself so it survives Approve (which
-- clears run_approvals.notes, the dispute reason) and Edit.
alter table public.runs add column if not exists notes text;

comment on column public.runs.notes is
  'Office note on the trip: why the route was created, what is needed. Shown in Trips & Pay; not the dispute reason (that is run_approvals.notes).';
