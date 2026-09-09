-- Today's weight, on the 75 Hard day.
--
-- The first participant's goal is fat loss with muscle gain, and the programme
-- runs 75 consecutive days. A weight logged next to the daily photo turns two
-- separate impressions into one record: what the scale said and what he looked
-- like, on the same morning.
--
-- One decimal place, because a scale reads 184.6 and rounding it away would
-- lose most of the week-to-week signal on a body this size.
ALTER TABLE public.hard75_days
  ADD COLUMN IF NOT EXISTS weight_lb numeric(5,1)
    CHECK (weight_lb IS NULL OR (weight_lb > 0 AND weight_lb < 1000));

COMMENT ON COLUMN public.hard75_days.weight_lb IS
  'Bodyweight in pounds for that day. Null on any day it was not weighed — the programme does not require it.';
