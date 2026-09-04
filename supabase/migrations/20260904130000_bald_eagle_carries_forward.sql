-- Bald Eagle status follows the kid across program years.
--
-- Each program year is its own youth_registrations row, so re-registering
-- used to reset a returning Eagle to "not an Eagle" and someone had to
-- re-flag them by hand. Cross-year identity already exists as
-- youth_link_id (set by trg_set_youth_link, matched on normalized first +
-- last name + birthday, so twins stay separate), so we inherit along it.
--
-- Rules, per Josh:
--   * Returning Eagle -> Eagle again.
--   * Re-registering counts as coming back, so they return ACTIVE even if
--     they had been toggled off during the prior year.
--   * Never downgrades a row that was already flagged an Eagle directly.

-- ── Going forward: inherit at re-registration ────────────────────────
CREATE OR REPLACE FUNCTION public.inherit_bald_eagle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _was_eagle boolean;
BEGIN
  -- Already flagged an Eagle on the way in: leave it alone.
  IF COALESCE(NEW.is_bald_eagle, false) THEN
    RETURN NEW;
  END IF;

  -- Most recent earlier registration for the same kid. trg_set_youth_link
  -- runs first (BEFORE INSERT, earlier name), so youth_link_id is already
  -- resolved by the time we get here.
  SELECT COALESCE(o.is_bald_eagle, false)
    INTO _was_eagle
  FROM public.youth_registrations o
  WHERE o.id <> NEW.id
    AND COALESCE(o.youth_link_id, o.id) = COALESCE(NEW.youth_link_id, NEW.id)
  ORDER BY o.program_year DESC NULLS LAST, o.created_at DESC
  LIMIT 1;

  IF COALESCE(_was_eagle, false) THEN
    NEW.is_bald_eagle     := true;
    -- Coming back for a new year reactivates them.
    NEW.bald_eagle_active := true;
  END IF;

  RETURN NEW;
END;
$$;

-- Named to sort AFTER trg_set_youth_link so youth_link_id is populated.
DROP TRIGGER IF EXISTS trg_z_inherit_bald_eagle ON public.youth_registrations;
CREATE TRIGGER trg_z_inherit_bald_eagle
  BEFORE INSERT ON public.youth_registrations
  FOR EACH ROW EXECUTE FUNCTION public.inherit_bald_eagle();

-- ── Backfill: kids who already re-registered for the current year ────
-- Only touches current-year rows that are NOT currently Eagles, so no
-- existing Eagle flag is overwritten.
-- validate_youth_headshot_update() only lets admins change is_bald_eagle,
-- and it decides that from auth.uid() — which is NULL inside a migration,
-- so the guard reads this as a kiosk write and blocks it. Suspend that one
-- trigger for the backfill, then put it straight back.
ALTER TABLE public.youth_registrations DISABLE TRIGGER validate_youth_headshot_update;

WITH prior AS (
  SELECT DISTINCT ON (COALESCE(o.youth_link_id, o.id))
         COALESCE(o.youth_link_id, o.id) AS link_id,
         COALESCE(o.is_bald_eagle, false) AS is_bald_eagle
  FROM public.youth_registrations o
  WHERE o.program_year IS DISTINCT FROM public.current_attendance_program_year()
  ORDER BY COALESCE(o.youth_link_id, o.id),
           o.program_year DESC NULLS LAST,
           o.created_at DESC
)
UPDATE public.youth_registrations cur
   SET is_bald_eagle     = true,
       bald_eagle_active = true
  FROM prior
 WHERE cur.program_year = public.current_attendance_program_year()
   AND COALESCE(cur.is_bald_eagle, false) = false
   AND COALESCE(cur.youth_link_id, cur.id) = prior.link_id
   AND prior.is_bald_eagle = true;

ALTER TABLE public.youth_registrations ENABLE TRIGGER validate_youth_headshot_update;
