-- ═══════════════════════════════════════════════════════════════════
-- Standout Moments — real stories that enrich the Program Highlights report
-- ═══════════════════════════════════════════════════════════════════
-- A JSON array of short free-text entries (one per row in the editor UI), e.g.
--   ["Justin Banks won the most-spirited award", "First bus trip for 6 youth"]
-- Staff (Josh / Coach Chrissy) add these in the Edit Excursion / Edit Event
-- editors; they feed straight into the Program Highlights report generator so
-- the narrative has real substance, not just fluff + data.
--
-- Additive and idempotent — safe to run via SQL Editor or `supabase db push`.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.excursions
  ADD COLUMN IF NOT EXISTS highlights JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.program_events
  ADD COLUMN IF NOT EXISTS highlights JSONB NOT NULL DEFAULT '[]'::jsonb;
