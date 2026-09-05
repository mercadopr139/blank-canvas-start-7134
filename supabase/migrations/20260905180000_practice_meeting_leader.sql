-- Who leads the five-minute team meeting.
--
-- The board announces the spiritual slot as "Chew on this… with Rev", and the
-- team meeting deserves the same treatment — it is the other thing the whole
-- academy does together. A setting rather than a hardcoded name, because the
-- person running it will not always be the same person.
ALTER TABLE public.practice_settings
  ADD COLUMN IF NOT EXISTS meeting_leader text NOT NULL DEFAULT 'Mercado';
