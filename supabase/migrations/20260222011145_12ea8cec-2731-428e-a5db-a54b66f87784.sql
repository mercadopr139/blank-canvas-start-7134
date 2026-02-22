
ALTER TABLE public.supporters
  ADD COLUMN outreach_tags text[] DEFAULT '{}',
  ADD COLUMN email_opt_in boolean NOT NULL DEFAULT true,
  ADD COLUMN sms_opt_in boolean NOT NULL DEFAULT false;
