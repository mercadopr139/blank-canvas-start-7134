-- Drop the abandoned first Practice Plan table.
--
-- 20260826120000 built a one-timeline-per-night plan. It was never right for
-- an academy that trains three groups at once off a standing weekly pattern,
-- and it has been replaced by 20260905160000_practice_plan.sql.
--
-- Nothing reads this table any more: the pages and routes that used it were
-- removed, and the new Practice Plan shares no columns with it. The only row
-- it holds is a test plan from 2026-08-26.
--
-- Plan: docs/PRACTICE_PLAN_PLAN.md

DROP TABLE IF EXISTS public.practice_plans;
DROP FUNCTION IF EXISTS public.touch_practice_plans_updated_at();
