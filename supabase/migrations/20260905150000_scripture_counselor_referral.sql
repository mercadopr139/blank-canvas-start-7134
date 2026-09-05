-- Scripture Coach: replace the abstract "escalation" picker with the one
-- question that actually matters in the room.
--
-- A mentor deciding whether a child needs more than a mentor can give does not
-- need a taxonomy — they need to contact Nikki, NLA's onsite counselor from
-- Cape Assist, and record that they did. So the dropdown goes and a single
-- explicit question takes its place.
--
-- Nullable on purpose: NULL = not answered, true = Yes, false = No. On a
-- safeguarding record "nobody recorded this" must not read as "No".
--
-- The old `escalation` column is left in place rather than dropped — it is
-- harmless, and dropping a column is not worth the risk to existing rows.
ALTER TABLE public.scripture_sessions
  ADD COLUMN IF NOT EXISTS nikki_notified boolean;

COMMENT ON COLUMN public.scripture_sessions.nikki_notified IS
  'Was Nikki (onsite counselor, Cape Assist) notified? NULL = not answered.';
