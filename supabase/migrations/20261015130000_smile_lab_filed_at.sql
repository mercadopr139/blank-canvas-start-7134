-- When each half of a Juniors Aftercare session report was turned in
-- (Josh, 2026-10-15): Smile Lab (Jaime) and Life Lab (Chrissy) each get a
-- stamp the first time their half is complete — the note plus at least one
-- of their standout moments, the same test the 8 PM reminder uses. Later
-- edits never move it, so it is an honest record of when the report came
-- in; updated_at still says when it was last touched.
ALTER TABLE public.smile_lab_sessions
  ADD COLUMN IF NOT EXISTS caring_filed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS sharing_filed_at timestamptz;

CREATE OR REPLACE FUNCTION public.smile_lab_sessions_stamp_filed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  smile_done boolean;
  life_done  boolean;
BEGIN
  -- A half is done when its note has text and a moment carries its prefix
  -- with something after it.
  smile_done := coalesce(btrim(NEW.caring_note), '') <> ''
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(coalesce(NEW.highlights, '[]'::jsonb)) h
      WHERE h LIKE 'Smile Lab — %' AND btrim(substr(h, length('Smile Lab — ') + 1)) <> ''
    );
  life_done := coalesce(btrim(NEW.sharing_note), '') <> ''
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(coalesce(NEW.highlights, '[]'::jsonb)) h
      WHERE h LIKE 'Life Lab — %' AND btrim(substr(h, length('Life Lab — ') + 1)) <> ''
    );
  IF smile_done AND NEW.caring_filed_at IS NULL THEN NEW.caring_filed_at := now(); END IF;
  IF life_done  AND NEW.sharing_filed_at IS NULL THEN NEW.sharing_filed_at := now(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS smile_lab_sessions_stamp_filed ON public.smile_lab_sessions;
CREATE TRIGGER smile_lab_sessions_stamp_filed
  BEFORE INSERT OR UPDATE ON public.smile_lab_sessions
  FOR EACH ROW EXECUTE FUNCTION public.smile_lab_sessions_stamp_filed();
