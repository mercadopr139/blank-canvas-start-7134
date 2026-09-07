-- Raffle Tracker — tickets out on consignment, money back over time.
--
-- Youth are handed books of raffle tickets to sell. This records what went out,
-- what came back unsold, and what got paid for, so that at the end of a season
-- we can say what share of the academy contributed to the cost of their own
-- program. That sentence is the point of the feature.
--
-- Plan: docs/RAFFLE_PLAN.md

-- Needed for the range-exclusion constraint below: it lets a GiST index mix a
-- plain equality column (campaign_id) with a range overlap test.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Campaigns ────────────────────────────────────────────────────────────
-- One per fundraiser: "Ireland Trip 2026", "USA Boxing Nationals". Holds the
-- rules every batch under it inherits.
CREATE TABLE IF NOT EXISTS public.raffle_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  kind            text NOT NULL DEFAULT 'Other',
  ticket_price    numeric(10,2) NOT NULL DEFAULT 0 CHECK (ticket_price >= 0),
  -- Optional bundle rate: "5 for $20". Both columns or neither.
  bundle_qty      integer CHECK (bundle_qty IS NULL OR bundle_qty > 1),
  bundle_price    numeric(10,2) CHECK (bundle_price IS NULL OR bundle_price >= 0),
  prize           text,
  goal_amount     numeric(10,2) CHECK (goal_amount IS NULL OR goal_amount >= 0),
  due_date        date,
  draw_date       date,
  -- Filled in after the draw. The app can then say which youth sold it.
  winning_ticket  integer,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'closed')),
  notes           text,
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT raffle_campaigns_bundle_pair CHECK (
    (bundle_qty IS NULL AND bundle_price IS NULL)
    OR (bundle_qty IS NOT NULL AND bundle_price IS NOT NULL)
  )
);

COMMENT ON COLUMN public.raffle_campaigns.kind IS
  'Which fundraiser this is — e.g. USA Boxing, Ireland. Free text so a new one needs no migration.';
COMMENT ON COLUMN public.raffle_campaigns.winning_ticket IS
  'Set after the draw; look it up against raffle_batches to find the youth who sold it.';

-- ── Batches: tickets issued to a youth ───────────────────────────────────
-- A physical book is sequential, so we store the RANGE rather than one row per
-- ticket. range_end is inclusive: 101–150 is fifty tickets.
CREATE TABLE IF NOT EXISTS public.raffle_batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.raffle_campaigns(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.youth_registrations(id) ON DELETE CASCADE,
  range_start     integer NOT NULL CHECK (range_start > 0),
  range_end       integer NOT NULL CHECK (range_end > 0),
  book_label      text,
  issued_on       date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  -- Usually the campaign's due date, but a kid who gets tickets late can be
  -- given their own deadline.
  due_date        date,
  issued_by       text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT raffle_batches_range_ok CHECK (range_end >= range_start),

  -- The same ticket number can never be issued twice in one campaign. Enforced
  -- by the database, not by app code that a second tab could race past — the
  -- whole system rests on a ticket number identifying exactly one youth.
  CONSTRAINT raffle_batches_no_overlap EXCLUDE USING gist (
    campaign_id WITH =,
    int4range(range_start, range_end, '[]') WITH &&
  )
);

CREATE INDEX IF NOT EXISTS raffle_batches_campaign_idx
  ON public.raffle_batches (campaign_id);
CREATE INDEX IF NOT EXISTS raffle_batches_registration_idx
  ON public.raffle_batches (registration_id);

-- ── Returns: unsold stubs coming back ────────────────────────────────────
-- Also ranges, because scattered numbers are just ranges of one (107–107).
CREATE TABLE IF NOT EXISTS public.raffle_returns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id     uuid NOT NULL REFERENCES public.raffle_batches(id) ON DELETE CASCADE,
  range_start  integer NOT NULL CHECK (range_start > 0),
  range_end    integer NOT NULL CHECK (range_end > 0),
  returned_on  date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  recorded_by  text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT raffle_returns_range_ok CHECK (range_end >= range_start),

  -- The same stub can't come back twice.
  CONSTRAINT raffle_returns_no_overlap EXCLUDE USING gist (
    batch_id WITH =,
    int4range(range_start, range_end, '[]') WITH &&
  )
);

CREATE INDEX IF NOT EXISTS raffle_returns_batch_idx
  ON public.raffle_returns (batch_id);

-- A return has to be inside the batch it belongs to. Catches the typo where
-- "returned 999" gets entered against a 101–150 book, which would otherwise
-- quietly make a youth's numbers nonsense.
CREATE OR REPLACE FUNCTION public.validate_raffle_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b_start integer;
  b_end   integer;
BEGIN
  SELECT range_start, range_end INTO b_start, b_end
  FROM public.raffle_batches WHERE id = NEW.batch_id;

  IF NEW.range_start < b_start OR NEW.range_end > b_end THEN
    RAISE EXCEPTION
      'Tickets %-% are outside this batch (%-%).',
      NEW.range_start, NEW.range_end, b_start, b_end;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_raffle_return_trg ON public.raffle_returns;
CREATE TRIGGER validate_raffle_return_trg
  BEFORE INSERT OR UPDATE ON public.raffle_returns
  FOR EACH ROW EXECUTE FUNCTION public.validate_raffle_return();

-- ── Payments: money in, in installments ──────────────────────────────────
-- Against the campaign and the youth rather than a single batch, because a kid
-- with two books hands over one envelope of cash.
CREATE TABLE IF NOT EXISTS public.raffle_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES public.raffle_campaigns(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.youth_registrations(id) ON DELETE CASCADE,
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),
  -- How many tickets this money covers. Recorded rather than inferred,
  -- because with a bundle rate the money alone cannot tell you: $200 is
  -- forty tickets at $5 or fifty at "5 for $20". Null falls back to the
  -- best rate the buyer could have had.
  tickets_covered integer CHECK (tickets_covered IS NULL OR tickets_covered > 0),
  paid_on         date NOT NULL DEFAULT (now() AT TIME ZONE 'America/New_York')::date,
  method          text NOT NULL DEFAULT 'Cash',
  recorded_by     text,
  notes           text,
  -- Set when this payment has been posted into the revenue ledger as part of a
  -- batch. Stamped payments are never posted again.
  revenue_id      uuid,
  posted_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raffle_payments_campaign_idx
  ON public.raffle_payments (campaign_id, registration_id);
-- The "what still needs posting to revenue" query.
CREATE INDEX IF NOT EXISTS raffle_payments_unposted_idx
  ON public.raffle_payments (campaign_id) WHERE revenue_id IS NULL;

-- ── updated_at ───────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS raffle_campaigns_updated_at ON public.raffle_campaigns;
CREATE TRIGGER raffle_campaigns_updated_at
  BEFORE UPDATE ON public.raffle_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS: admin only, all four ────────────────────────────────────────────
-- Unlike Daily Duties there is no public surface here. Nothing is reachable by
-- anon: this is money and it names children.
ALTER TABLE public.raffle_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_batches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_returns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_payments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage raffle campaigns" ON public.raffle_campaigns;
CREATE POLICY "Admins manage raffle campaigns" ON public.raffle_campaigns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage raffle batches" ON public.raffle_batches;
CREATE POLICY "Admins manage raffle batches" ON public.raffle_batches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage raffle returns" ON public.raffle_returns;
CREATE POLICY "Admins manage raffle returns" ON public.raffle_returns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage raffle payments" ON public.raffle_payments;
CREATE POLICY "Admins manage raffle payments" ON public.raffle_payments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
