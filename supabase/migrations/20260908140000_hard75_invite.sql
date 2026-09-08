-- 75 Hard invite links.
--
-- The participant is not staff and must never touch the admin backend. So he
-- gets a private link instead of an account: an unguessable token in the URL,
-- plus a PIN he sets himself the first time he opens it.
--
-- The token grants NO table access. Everything the link can do goes through the
-- hard75-access edge function, which validates the token server-side and only
-- ever touches that one run. RLS below stays exactly as it was — owner or
-- super-admin — because the function runs with the service role.
--
-- Plan: docs/HARD75_PLAN.md

ALTER TABLE public.hard75_runs
  -- The link. Unguessable, and rotatable if it ever leaks.
  ADD COLUMN IF NOT EXISTS access_token text UNIQUE,
  -- sha256(token || ':' || pin). Never the PIN itself.
  ADD COLUMN IF NOT EXISTS access_pin_hash text,
  -- A four-digit PIN is brute-forceable in ten thousand tries, so failures are
  -- counted and the link locks itself for a while.
  ADD COLUMN IF NOT EXISTS pin_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;

-- An invite exists before the participant has filled anything in, so a run can
-- now sit in 'pending' with no start date until he opens the link.
ALTER TABLE public.hard75_runs ALTER COLUMN start_date DROP NOT NULL;

ALTER TABLE public.hard75_runs DROP CONSTRAINT IF EXISTS hard75_runs_status_check;
ALTER TABLE public.hard75_runs
  ADD CONSTRAINT hard75_runs_status_check
  CHECK (status IN ('pending', 'active', 'failed', 'complete'));

CREATE INDEX IF NOT EXISTS hard75_runs_token_idx
  ON public.hard75_runs (access_token) WHERE access_token IS NOT NULL;

COMMENT ON COLUMN public.hard75_runs.access_token IS
  'Invite-link credential. Only ever read by the hard75-access edge function; never exposed to the browser except in the link itself.';
