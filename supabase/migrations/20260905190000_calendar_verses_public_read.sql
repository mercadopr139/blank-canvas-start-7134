-- Let the Gym Board show the day's verse.
--
-- calendar_verses is admin-only, but the board is a TV in the room with no
-- login — so it could never read the verse it is meant to display. Scripture
-- is not sensitive, and nothing else in the table is: it holds a reference, a
-- verse and a theme per calendar day.
--
-- Read-only, and trashed rows stay hidden. Writing remains admin-only, so the
-- generator and the editor are untouched.
DROP POLICY IF EXISTS "Anyone can read the daily verse" ON public.calendar_verses;
CREATE POLICY "Anyone can read the daily verse"
  ON public.calendar_verses FOR SELECT
  TO anon, authenticated
  USING (is_trashed = false);
