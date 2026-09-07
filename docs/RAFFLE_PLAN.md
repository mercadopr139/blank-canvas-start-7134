# Raffle Tracker — build plan

Youth are given raffle tickets to sell. This tracks what went out, what came
back, what got paid for, and — across a whole season — what share of the academy
contributed to the cost of their own program. That last sentence is the reason
the feature exists: it is a funder story, not a spreadsheet.

## The shape of it

Not a check-in system. A **consignment ledger**: tickets leave on trust, money
comes back later. Three quantities per youth per campaign, and one number that
matters.

```
out      = issued − returned          tickets still in the wild
owed     = out × ticket_price
balance  = owed − paid                > 0 means Chrissy is still chasing
```

## Decisions (locked 2026-09-07 with Josh)

| Question | Decision |
| --- | --- |
| Who enters data | Josh and Chrissy only, on the backend. No kiosk, no other coaches. |
| Ticket identity | Number ranges from physical books (`101–150`), not individual rows. |
| Pricing | Single price, plus an optional bundle — "$5 each, or 5 for $20". |
| Tickets sold | Recorded with each payment, not inferred — a bundle rate makes the money ambiguous. |
| Money | Posts to the `revenue` ledger, **batched** — see below. |
| Season metric | Sell-through rate. |
| Partial payments | Yes, installments, each its own dated row. |
| Overdue | Balance stands; youth appears on a chase list. No auto-close, no write-off. |
| Prizes | One prize per campaign, drawn from sold tickets. |
| Gym board leaderboard | No — backend only. |
| Settling a batch | Money decides; stubs reconcile later. A kid can settle up without returning stubs. |

## Sell-through, defined

Two traps here.

The first: "tickets not returned ÷ tickets issued" scores a kid who never brings
anything back at **100%**. A sale has to be evidenced, not assumed.

The second: with a bundle rate the money can't tell you how many tickets moved.
$200 is forty tickets at $5, or **fifty** at 5-for-$20. Inferring from cash alone
would quietly undercount exactly the youth who sold the most.

So the count is **recorded** — Chrissy enters how many tickets a payment covers
when the money comes in, pre-filled with what that amount buys at the best rate.
Where no count was recorded it falls back to that inference. Either way it is
capped at the tickets actually in the youth's hands, so an over-payment can't
invent tickets.

```
sold_tickets = min( Σ tickets_covered, issued − returned )
sell_through = sold_tickets ÷ issued

owed    = price_for(issued − returned)   ← at the BEST rate, bundles applied
balance = owed − paid
```

Pricing the debt at the bundle rate matters: a youth who sold fifty in bundles
and handed over $200 lands on a clean zero instead of a $50 phantom debt.

These numbers go in front of funders, so the maths lives in `src/lib/raffle.ts`
and is unit-tested — including both traps above.

## Money into the ledger

`revenue` is a supporter-level ledger that also mirrors into `donations` for
receipts. Raffle cash is dozens of $20 handoffs from buyers nobody will ever mail
a receipt to. One revenue row per payment would bury the real revenue rows.

So payments accumulate here, and Chrissy hits **Post to revenue** for a group of
them: one `Fundraising` row tagged to the campaign, with every payment in the
group stamped with that `revenue_id`. Stamped payments can never post twice.

## Tables

- `raffle_campaigns` — name, kind (USA Boxing / Ireland / Other), ticket price,
  prize, dates, status, winning ticket after the draw.
- `raffle_batches` — an issue: youth + campaign + ticket range + due date. A
  Postgres range-exclusion constraint makes double-issuing a ticket number
  **impossible**, rather than merely discouraged.
- `raffle_returns` — unsold stubs coming back, as ranges (scattered numbers are
  just ranges of one). A trigger keeps a return inside its batch's range.
- `raffle_payments` — cash in, with `revenue_id` / `posted_at` for the ledger.

All four are admin-only under RLS. Nothing is reachable by `anon` — unlike Daily
Duties, no part of this is public.

## Deliverables

- Migration (tables, RLS, constraints, trigger).
- `src/lib/raffle.ts` — types and the reconciliation maths, pure and unit-tested.
- `src/pages/admin/AdminRaffle.tsx` + `src/components/raffle/RaffleAdmin.tsx`.
- `src/lib/generateRaffleSlipPdf.ts` — the hand-off slip a youth signs for.
- `src/lib/generateRaffleSeasonPdf.ts` — the funder report.
- Route in `App.tsx`, tile + `operations_raffle` permission in `pillarTiles.ts`.

## Nice-to-haves, deliberately parked

- Winning-ticket lookup ("who sold 1372?") — cheap, included in v1.
- Seller incentives / tiered prizes — not asked for.
- Gym board leaderboard — declined.
- Parent SMS reminders — out of scope.
