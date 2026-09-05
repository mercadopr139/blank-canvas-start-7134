-- Scripture Coach: make the safeguarding answers explicit.
--
-- These were booleans behind toggles, which conflates two very different
-- things: "we asked, and the parent was NOT notified" and "nobody ever
-- recorded an answer". On a child-safeguarding record that distinction
-- matters — an unanswered question should be visible, not silently read as No.
--
-- Nullable now: NULL = not answered yet, true = Yes, false = No.
ALTER TABLE public.scripture_sessions
  ALTER COLUMN parents_notified DROP NOT NULL,
  ALTER COLUMN parents_notified DROP DEFAULT,
  ALTER COLUMN follow_up_needed DROP NOT NULL,
  ALTER COLUMN follow_up_needed DROP DEFAULT;
