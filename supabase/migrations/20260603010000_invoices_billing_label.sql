-- Optional per-invoice override for the "Type" column label.
-- When set, this string replaces the auto-computed label (which is
-- derived from each service log's billing_method — "Hourly" /
-- "Per Day" / "Monthly Program Cost" or "Flat Rate") in both the
-- on-screen preview and the generated PDF. Null = use the default.
--
-- Use case: ad-hoc billing scenarios where the standard label is
-- misleading — e.g. invoicing the remaining balance for a yearly
-- program contract should read "Remaining Program Cost" instead of
-- "Monthly Program Cost".

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_label text;
