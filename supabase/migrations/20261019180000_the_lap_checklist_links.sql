-- The Lap checklist, third pass (Josh, 2026-10-19): a line can open the
-- page it is about — "Create Practice Plan" opens the Practice Plan, "Daily
-- Duties" opens Daily Duties — so the meeting goes straight to the work.
-- The link is an app key from src/config/appRegistry.ts (never a path), so
-- a route can move without the checklist breaking.
ALTER TABLE public.lap_checklist_items ADD COLUMN IF NOT EXISTS link_app text;

-- The obvious ones, seeded once; edit from the line's link picker.
UPDATE public.lap_checklist_items c SET link_app = s.app
  FROM (VALUES
    ('Schedule',                  'Create Practice Plan',          'app_practice_plan'),
    ('Schedule',                  'Daily Duties',                  'app_daily_duties'),
    ('Transportation',            'Review: Trips & Pay',           'app_transport_runs'),
    ('Transportation',            'Review: Drivers'' Schedule',    'app_transport_drivers'),
    ('Registration & Attendance', 'Review Current Registrations',  'app_registrations'),
    ('Meal Train',                'Review Week Ahead',             'app_meal_setup'),
    ('Excursions',                'Upcoming Excursions',           'app_excursion_intelligence')
  ) AS s(topic, line, app)
  JOIN public.lap_topics t ON t.title = s.topic AND t.retired_at IS NULL
 WHERE c.topic_id = t.id AND c.title = s.line AND c.parent_id IS NULL AND c.link_app IS NULL;
