// The ledger — one campaign, every youth, what they owe.
//
// This is the screen Chrissy stands in front of. The column that matters is
// Balance: everything else is working out how it got there.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentAttendanceYear } from "@/lib/programYear";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Loader2, Search, ChevronDown, Printer, DollarSign,
  Undo2, Banknote, Trophy, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  RaffleCampaign, RaffleBatch, RaffleReturn, RafflePayment, Pricing,
  PAYMENT_METHODS, youthTotals, formatRange, money, pct, parseRange,
  isOverdue, batchHolding, ticketsIn, priceFor, describePricing, inferTickets,
} from "@/lib/raffle";
import { generateRaffleSlipPdf } from "@/lib/generateRaffleSlipPdf";

const NLA_RED = "#bf0f3e";

interface Youth {
  id: string;
  child_first_name: string;
  child_last_name: string;
}

type Filter = "all" | "outstanding" | "overdue" | "settled";

const RaffleLedger = ({
  campaign,
  onBack,
}: {
  campaign: RaffleCampaign;
  onBack: () => void;
}) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [issuing, setIssuing] = useState(false);
  const [returningFor, setReturningFor] = useState<string | null>(null);
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const [winnerLookup, setWinnerLookup] = useState("");

  // The campaign’s rate card, built once and passed to every calculation so
  // the ledger, the dialogs and the slip can never disagree about a price.
  const pricing: Pricing = {
    ticketPrice: Number(campaign.ticket_price),
    bundleQty: campaign.bundle_qty,
    bundlePrice: campaign.bundle_price,
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["raffle-batches", campaign.id] });
    qc.invalidateQueries({ queryKey: ["raffle-returns", campaign.id] });
    qc.invalidateQueries({ queryKey: ["raffle-payments", campaign.id] });
    qc.invalidateQueries({ queryKey: ["raffle-campaign-raised"] });
  };

  /* ───── Data ───── */
  const { data: youth = [] } = useQuery({
    queryKey: ["raffle-youth"],
    queryFn: async () => {
      const { data } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name")
        .eq("program_year", getCurrentAttendanceYear())
        .is("archived_at", null)
        .order("child_last_name");
      return (data as Youth[]) || [];
    },
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["raffle-batches", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffle_batches" as never)
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("range_start");
      if (error) throw error;
      return (data as unknown as RaffleBatch[]) || [];
    },
  });

  const { data: returns = [] } = useQuery({
    queryKey: ["raffle-returns", campaign.id, batches.length],
    enabled: batches.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffle_returns" as never)
        .select("*")
        .in("batch_id", batches.map((b) => b.id));
      if (error) throw error;
      return (data as unknown as RaffleReturn[]) || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["raffle-payments", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffle_payments" as never)
        .select("*")
        .eq("campaign_id", campaign.id)
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return (data as unknown as RafflePayment[]) || [];
    },
  });

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    youth.forEach((y) => { m[y.id] = `${y.child_first_name} ${y.child_last_name}`; });
    return m;
  }, [youth]);

  /* ───── The reconciliation ───── */
  const rows = useMemo(() => {
    const byYouth: Record<string, { batches: RaffleBatch[]; returns: RaffleReturn[]; payments: RafflePayment[] }> = {};
    batches.forEach((b) => {
      (byYouth[b.registration_id] ||= { batches: [], returns: [], payments: [] }).batches.push(b);
    });
    returns.forEach((r) => {
      const b = batches.find((x) => x.id === r.batch_id);
      if (b) byYouth[b.registration_id]?.returns.push(r);
    });
    payments.forEach((p) => {
      (byYouth[p.registration_id] ||= { batches: [], returns: [], payments: [] }).payments.push(p);
    });

    return Object.entries(byYouth)
      .map(([registration_id, d]) => {
        // A youth's own due date is the earliest deadline they're carrying.
        const due = d.batches
          .map((b) => b.due_date || campaign.due_date)
          .filter(Boolean)
          .sort()[0] as string | undefined;
        const totals = youthTotals(d.batches, d.returns, d.payments, pricing);
        return {
          registration_id,
          name: nameById[registration_id] || "Unknown youth",
          ...d,
          totals,
          due: due ?? null,
          overdue: isOverdue(due ?? null, totals.balance),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, returns, payments, campaign, nameById]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (filter === "outstanding") return r.totals.balance > 0;
      if (filter === "overdue") return r.overdue;
      if (filter === "settled") return r.totals.balance <= 0;
      return true;
    });
  }, [rows, search, filter]);

  const totals = useMemo(() => {
    const issued = rows.reduce((n, r) => n + r.totals.issued, 0);
    const paid = rows.reduce((n, r) => n + r.totals.paid, 0);
    const owedOut = rows.reduce((n, r) => n + Math.max(0, r.totals.balance), 0);
    const sold = rows.reduce((n, r) => n + r.totals.soldTickets, 0);
    return { issued, paid, owedOut, sold, chase: rows.filter((r) => r.totals.balance > 0).length };
  }, [rows]);

  const unposted = useMemo(() => payments.filter((p) => !p.revenue_id), [payments]);
  const unpostedTotal = unposted.reduce((n, p) => n + Number(p.amount), 0);

  const winner = useMemo(() => {
    const n = parseInt(winnerLookup, 10);
    if (!n) return null;
    const b = batchHolding(batches, n);
    return b ? { name: nameById[b.registration_id] || "Unknown youth", batch: b } : "none";
  }, [winnerLookup, batches, nameById]);

  /* ───── Mutations ───── */
  const postToRevenue = useMutation({
    mutationFn: async () => {
      if (unposted.length === 0) throw new Error("Nothing to post.");
      const kids = new Set(unposted.map((p) => p.registration_id)).size;
      const { data, error } = await supabase
        .from("revenue")
        .insert({
          date: new Date().toISOString().slice(0, 10),
          amount: Number(unpostedTotal.toFixed(2)),
          revenue_type: "Fundraising",
          payment_method: "Cash",
          reference_id: `RAFFLE:${campaign.id.slice(0, 8)}`,
          logged_by: user?.email ?? null,
          notes: `Raffle — ${campaign.name} — ${unposted.length} payment${unposted.length === 1 ? "" : "s"} from ${kids} youth`,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      // Stamp every payment in the group so it can never post twice.
      const revenueId = (data as unknown as { id: string }).id;
      const { error: stampErr } = await supabase
        .from("raffle_payments" as never)
        .update({ revenue_id: revenueId, posted_at: new Date().toISOString() } as never)
        .in("id", unposted.map((p) => p.id));
      if (stampErr) throw stampErr;
      return { revenueId, kids };
    },
    onSuccess: ({ kids }) => {
      invalidate();
      toast.success(`Posted ${money(unpostedTotal)} from ${kids} youth to revenue.`);
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't post to revenue."),
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost" size="icon"
            onClick={onBack}
            className="text-neutral-500 hover:text-white h-9 w-9 mt-0.5"
            aria-label="Back to campaigns"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h3 className="text-xl font-bold text-white">{campaign.name}</h3>
            <p className="text-xs text-neutral-500">
              {describePricing(pricing)}
              {campaign.due_date && ` · money due ${campaign.due_date}`}
              {campaign.prize && ` · ${campaign.prize}`}
            </p>
          </div>
        </div>
        <Button onClick={() => setIssuing(true)} className="text-white font-bold" style={{ backgroundColor: NLA_RED }}>
          <Plus className="w-4 h-4 mr-1.5" /> Issue tickets
        </Button>
      </div>

      {/* The five numbers */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="Issued" value={String(totals.issued)} />
        <Stat label="Sold" value={String(totals.sold)} />
        <Stat label="Collected" value={money(totals.paid)} accent="#22c55e" />
        <Stat label="Outstanding" value={money(totals.owedOut)} accent={totals.owedOut > 0 ? "#f87171" : "#22c55e"} />
        <Stat label="Still chasing" value={`${totals.chase} youth`} />
      </div>

      {/* Post to revenue */}
      {unposted.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2.5">
            <Banknote className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-emerald-200 font-semibold">
                {money(unpostedTotal)} collected and not yet in the ledger
              </p>
              <p className="text-xs text-emerald-200/60">
                {unposted.length} payment{unposted.length === 1 ? "" : "s"} — posts as one Fundraising row.
              </p>
            </div>
          </div>
          <Button
            onClick={() => postToRevenue.mutate()}
            disabled={postToRevenue.isPending}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            {postToRevenue.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><DollarSign className="w-4 h-4 mr-1" /> Post to revenue</>}
          </Button>
        </div>
      )}

      {/* Winning ticket lookup — only useful once there's a draw to look up. */}
      {(campaign.draw_date || campaign.winning_ticket) && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 flex items-center gap-3 flex-wrap">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm text-neutral-400">Winning ticket</span>
          <Input
            value={winnerLookup}
            onChange={(e) => setWinnerLookup(e.target.value)}
            placeholder="1372"
            className="w-28 h-8 bg-neutral-800 border-neutral-700 text-white"
          />
          {winner === "none" ? (
            <span className="text-sm text-neutral-500">That number was never issued.</span>
          ) : winner ? (
            <span className="text-sm text-white">
              Sold by <span className="font-bold">{winner.name}</span>
              <span className="text-neutral-500"> ({formatRange(winner.batch)})</span>
            </span>
          ) : null}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a youth…"
            className="pl-9 bg-neutral-800 border-neutral-700 text-white"
          />
        </div>
        {([
          ["all", "All"],
          ["outstanding", "Owes money"],
          ["overdue", "Overdue"],
          ["settled", "Settled"],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`h-9 px-3 rounded-lg text-sm font-semibold border transition-colors ${
              filter === key
                ? "border-white/30 bg-white/10 text-white"
                : "border-neutral-700 text-neutral-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* The table */}
      {rows.length === 0 ? (
        <div className="text-center py-12 text-neutral-600">
          <p>No tickets issued yet. Hit <span className="text-white/70 font-medium">Issue tickets</span> to start.</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-neutral-500 py-8 text-center">Nobody matches that.</p>
      ) : (
        <div className="rounded-xl border border-neutral-800 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_80px_70px_70px_110px_110px_90px_40px] gap-2 px-4 py-2 bg-neutral-900 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
            <span>Youth</span>
            <span className="text-right">Issued</span>
            <span className="text-right">Back</span>
            <span className="text-right">Sold</span>
            <span className="text-right">Collected</span>
            <span className="text-right">Balance</span>
            <span className="text-right">Sell-through</span>
            <span />
          </div>
          {visible.map((r) => {
            const open = expanded === r.registration_id;
            return (
              <div key={r.registration_id} className="border-t border-neutral-800">
                <button
                  onClick={() => setExpanded(open ? null : r.registration_id)}
                  className="w-full grid grid-cols-2 md:grid-cols-[1fr_80px_70px_70px_110px_110px_90px_40px] gap-2 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors items-center"
                >
                  <span className="font-medium text-white flex items-center gap-2 min-w-0">
                    <span className="truncate">{r.name}</span>
                    {r.overdue && (
                      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] shrink-0">
                        Overdue
                      </Badge>
                    )}
                  </span>
                  <span className="text-right text-neutral-300 tabular-nums">{r.totals.issued}</span>
                  <span className="text-right text-neutral-500 tabular-nums">{r.totals.returned}</span>
                  <span className="text-right text-neutral-300 tabular-nums">{r.totals.soldTickets}</span>
                  <span className="text-right font-semibold text-emerald-400 tabular-nums">
                    {money(r.totals.paid)}
                  </span>
                  <span
                    className={`text-right font-bold tabular-nums ${
                      r.totals.balance > 0 ? "text-red-400" : "text-emerald-400"
                    }`}
                  >
                    {money(r.totals.balance)}
                  </span>
                  <span className="text-right text-neutral-300 tabular-nums">{pct(r.totals.sellThrough)}</span>
                  <ChevronDown className={`w-4 h-4 text-neutral-600 justify-self-end transition-transform ${open ? "rotate-180" : ""}`} />
                </button>

                {open && (
                  <div className="px-4 pb-4 pt-1 bg-black/30 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={() => setPayingFor(r.registration_id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-8 text-xs"
                      >
                        <DollarSign className="w-3.5 h-3.5 mr-1" /> Record payment
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setReturningFor(r.registration_id)}
                        className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white h-8 text-xs"
                      >
                        <Undo2 className="w-3.5 h-3.5 mr-1" /> Tickets back
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <DetailList title="Issued">
                        {r.batches.map((b) => (
                          <li key={b.id} className="flex items-center justify-between gap-2">
                            <span>
                              {formatRange(b)}
                              <span className="text-neutral-600"> · {ticketsIn(b)}</span>
                              {b.book_label && <span className="text-neutral-600"> · {b.book_label}</span>}
                            </span>
                            <button
                              onClick={() =>
                                generateRaffleSlipPdf({
                                  campaignName: campaign.name,
                                  youthName: r.name,
                                  range: formatRange(b),
                                  count: ticketsIn(b),
                                  pricing,
                                  dueDate: b.due_date || campaign.due_date,
                                  prize: campaign.prize,
                                  issuedOn: b.issued_on,
                                })
                              }
                              className="text-neutral-500 hover:text-white shrink-0"
                              title="Print hand-off slip"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </DetailList>

                      <DetailList title="Came back" empty="Nothing returned">
                        {r.returns.map((x) => (
                          <li key={x.id}>
                            {formatRange(x)}
                            <span className="text-neutral-600"> · {x.returned_on}</span>
                          </li>
                        ))}
                      </DetailList>

                      <DetailList title="Payments" empty="No money in yet">
                        {r.payments.map((p) => (
                          <li key={p.id} className="flex items-center gap-1.5">
                            <span className="font-semibold text-white">{money(Number(p.amount))}</span>
                            <span className="text-neutral-600">{p.paid_on} · {p.method}</span>
                            {p.revenue_id && (
                              <span className="text-emerald-500/70 text-[10px] uppercase tracking-wide">posted</span>
                            )}
                          </li>
                        ))}
                      </DetailList>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <IssueDialog
        open={issuing}
        onClose={() => setIssuing(false)}
        campaign={campaign}
        pricing={pricing}
        youth={youth}
        batches={batches}
        onDone={invalidate}
      />
      <ReturnDialog
        registrationId={returningFor}
        onClose={() => setReturningFor(null)}
        rows={rows}
        onDone={invalidate}
      />
      <PaymentDialog
        registrationId={payingFor}
        onClose={() => setPayingFor(null)}
        campaign={campaign}
        pricing={pricing}
        rows={rows}
        onDone={invalidate}
      />
    </div>
  );
};

/* ───── Small pieces ───── */

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5">
    <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</p>
    <p className="text-lg font-bold mt-0.5" style={accent ? { color: accent } : { color: "white" }}>{value}</p>
  </div>
);

const DetailList = ({
  title, children, empty = "—",
}: { title: string; children: React.ReactNode; empty?: string }) => {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.filter(Boolean).length === 0;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold mb-1">{title}</p>
      {isEmpty ? (
        <p className="text-xs text-neutral-600 italic">{empty}</p>
      ) : (
        <ul className="text-xs text-neutral-400 space-y-1">{children}</ul>
      )}
    </div>
  );
};

/* ───── Issue ───── */

const IssueDialog = ({
  open, onClose, campaign, pricing, youth, batches, onDone,
}: {
  open: boolean;
  onClose: () => void;
  campaign: RaffleCampaign;
  pricing: Pricing;
  youth: Youth[];
  batches: RaffleBatch[];
  onDone: () => void;
}) => {
  const { user } = useAuth();
  const [pick, setPick] = useState<Youth | null>(null);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("");
  const [book, setBook] = useState("");
  const [due, setDue] = useState(campaign.due_date ?? "");
  const [saving, setSaving] = useState(false);

  const parsed = parseRange(range);
  // The database refuses an overlap outright; catching it here means a clearer
  // message than a constraint violation.
  const clash = parsed
    ? batches.find((b) => parsed.range_start <= b.range_end && parsed.range_end >= b.range_start)
    : undefined;

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return youth.slice(0, 8);
    return youth
      .filter((y) => `${y.child_first_name} ${y.child_last_name}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [youth, search]);

  const reset = () => {
    setPick(null); setSearch(""); setRange(""); setBook("");
    setDue(campaign.due_date ?? "");
  };

  const submit = async () => {
    if (!pick || !parsed) return;
    setSaving(true);
    const { error } = await supabase.from("raffle_batches" as never).insert({
      campaign_id: campaign.id,
      registration_id: pick.id,
      range_start: parsed.range_start,
      range_end: parsed.range_end,
      book_label: book.trim() || null,
      due_date: due || null,
      issued_by: user?.email ?? null,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(
        error.message.includes("no_overlap")
          ? "Some of those tickets are already issued to another youth."
          : error.message
      );
      return;
    }
    toast.success(`${parsed.range_end - parsed.range_start + 1} tickets issued to ${pick.child_first_name}.`);
    onDone();
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Issue tickets</DialogTitle>
          <DialogDescription className="text-neutral-500">
            {campaign.name} · {describePricing(pricing)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-neutral-400">Youth</Label>
            {pick ? (
              <div className="mt-1 flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2">
                <span className="font-semibold">{pick.child_first_name} {pick.child_last_name}</span>
                <button onClick={() => setPick(null)} className="text-xs text-neutral-400 hover:text-white">
                  Change
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Start typing a name…"
                  className="mt-1 bg-neutral-800 border-neutral-700 text-white"
                />
                <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-neutral-800 divide-y divide-neutral-800">
                  {matches.map((y) => (
                    <button
                      key={y.id}
                      onClick={() => setPick(y)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                    >
                      {y.child_first_name} {y.child_last_name}
                    </button>
                  ))}
                  {matches.length === 0 && (
                    <p className="px-3 py-2 text-sm text-neutral-600">No youth match that.</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-neutral-400">Ticket numbers</Label>
              <Input
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder="101-150"
                className="mt-1 bg-neutral-800 border-neutral-700 text-white"
              />
              {range.trim() && !parsed && (
                <p className="text-xs text-amber-400 mt-1">Try something like 101-150.</p>
              )}
              {parsed && !clash && (
                <p className="text-xs text-neutral-500 mt-1">
                  {parsed.range_end - parsed.range_start + 1} tickets ·{" "}
                  {money(priceFor(parsed.range_end - parsed.range_start + 1, pricing))} to collect
                </p>
              )}
              {clash && (
                <p className="text-xs text-amber-400 mt-1 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  Overlaps {formatRange(clash)}, already issued.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-neutral-400">Book (optional)</Label>
              <Input
                value={book}
                onChange={(e) => setBook(e.target.value)}
                placeholder="Book 3"
                className="mt-1 bg-neutral-800 border-neutral-700 text-white"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-neutral-400">Money due back</Label>
            <Input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-1 bg-neutral-800 border-neutral-700 text-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} className="text-neutral-400 hover:text-white">
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!pick || !parsed || !!clash || saving}
            className="text-white font-bold"
            style={{ backgroundColor: NLA_RED }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ───── Returns ───── */

interface LedgerRow {
  registration_id: string;
  name: string;
  batches: RaffleBatch[];
  totals: ReturnType<typeof youthTotals>;
}

const ReturnDialog = ({
  registrationId, onClose, rows, onDone,
}: {
  registrationId: string | null;
  onClose: () => void;
  rows: LedgerRow[];
  onDone: () => void;
}) => {
  const { user } = useAuth();
  const [batchId, setBatchId] = useState("");
  const [range, setRange] = useState("");
  const [saving, setSaving] = useState(false);

  const row = rows.find((r) => r.registration_id === registrationId);
  const parsed = parseRange(range);
  const batch = row?.batches.find((b) => b.id === batchId) ?? row?.batches[0];

  const outsideBatch =
    parsed && batch && (parsed.range_start < batch.range_start || parsed.range_end > batch.range_end);

  const submit = async () => {
    if (!parsed || !batch) return;
    setSaving(true);
    const { error } = await supabase.from("raffle_returns" as never).insert({
      batch_id: batch.id,
      range_start: parsed.range_start,
      range_end: parsed.range_end,
      recorded_by: user?.email ?? null,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(
        error.message.includes("no_overlap")
          ? "Those stubs are already recorded as returned."
          : error.message
      );
      return;
    }
    toast.success("Returned tickets recorded.");
    onDone();
    setRange(""); setBatchId("");
    onClose();
  };

  return (
    <Dialog open={!!registrationId} onOpenChange={(o) => { if (!o) { setRange(""); setBatchId(""); onClose(); } }}>
      <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Tickets back from {row?.name}</DialogTitle>
          <DialogDescription className="text-neutral-500">
            Unsold stubs only. Money goes in under Record payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {(row?.batches.length ?? 0) > 1 && (
            <div>
              <Label className="text-xs text-neutral-400">Which book</Label>
              <Select value={batch?.id ?? ""} onValueChange={setBatchId}>
                <SelectTrigger className="mt-1 bg-neutral-800 border-neutral-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                  {row?.batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {formatRange(b)}{b.book_label ? ` · ${b.book_label}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label className="text-xs text-neutral-400">Ticket numbers coming back</Label>
            <Input
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder={batch ? `${batch.range_start}-${batch.range_end}` : "141-150"}
              className="mt-1 bg-neutral-800 border-neutral-700 text-white"
            />
            {range.trim() && !parsed && (
              <p className="text-xs text-amber-400 mt-1">Try something like 141-150, or a single number.</p>
            )}
            {outsideBatch && batch && (
              <p className="text-xs text-amber-400 mt-1">
                Outside this book ({formatRange(batch)}).
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-neutral-400 hover:text-white">Cancel</Button>
          <Button
            onClick={submit}
            disabled={!parsed || !batch || !!outsideBatch || saving}
            className="bg-white text-black hover:bg-white/90 font-bold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ───── Payments ───── */

const PaymentDialog = ({
  registrationId, onClose, campaign, pricing, rows, onDone,
}: {
  registrationId: string | null;
  onClose: () => void;
  campaign: RaffleCampaign;
  pricing: Pricing;
  rows: LedgerRow[];
  onDone: () => void;
}) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [tickets, setTickets] = useState("");
  const [method, setMethod] = useState<string>("Cash");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const row = rows.find((r) => r.registration_id === registrationId);
  const value = Number(amount);
  const covered = Number(tickets);
  // What that money buys at the campaign’s rate, offered as the default so
  // Chrissy usually just confirms it rather than working it out.
  const suggested = value > 0 ? inferTickets(value, pricing) : 0;

  const submit = async () => {
    if (!registrationId || !(value > 0)) return;
    setSaving(true);
    const { error } = await supabase.from("raffle_payments" as never).insert({
      campaign_id: campaign.id,
      registration_id: registrationId,
      amount: value,
      tickets_covered: covered > 0 ? covered : suggested || null,
      paid_on: paidOn,
      method,
      notes: notes.trim() || null,
      recorded_by: user?.email ?? null,
    } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${money(value)} recorded.`);
    onDone();
    setAmount(""); setTickets(""); setNotes("");
    onClose();
  };

  return (
    <Dialog open={!!registrationId} onOpenChange={(o) => { if (!o) { setAmount(""); setTickets(""); setNotes(""); onClose(); } }}>
      <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Payment from {row?.name}</DialogTitle>
          {row && (
            <DialogDescription className="text-neutral-500">
              Owes {money(row.totals.balance)} · {row.totals.out} tickets out
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-neutral-400">Amount</Label>
              <Input
                type="number" min="0" step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="mt-1 bg-neutral-800 border-neutral-700 text-white"
              />
            </div>
            <div>
              <Label className="text-xs text-neutral-400">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="mt-1 bg-neutral-800 border-neutral-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* How many tickets this money covers. With a bundle rate the amount
              alone can't say — $200 is forty tickets at $5 or fifty at 5-for-$20
              — and guessing low would rob the best sellers in the report. */}
          <div>
            <Label className="text-xs text-neutral-400">Tickets this covers</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number" min="1" step="1"
                value={tickets}
                onChange={(e) => setTickets(e.target.value)}
                placeholder={suggested ? String(suggested) : "—"}
                className="w-24 bg-neutral-800 border-neutral-700 text-white"
              />
              <span className="text-xs text-neutral-500">
                {value > 0
                  ? `${describePricing(pricing)} — that's ${suggested} at the best rate`
                  : "Enter the amount first"}
              </span>
            </div>
            {value > 0 && covered > 0 && covered !== suggested && (
              <p className="text-xs text-neutral-500 mt-1">
                {covered > suggested
                  ? `Recorded as ${covered} — more than the money covers at the listed rate.`
                  : `Recorded as ${covered} — sold at full price rather than the bundle.`}
              </p>
            )}
          </div>

          {row && value > 0 && value > row.totals.balance && row.totals.balance > 0 && (
            <p className="text-xs text-amber-400">
              That&apos;s {money(value - row.totals.balance)} more than they owe — fine if it&apos;s a donation, worth a second look otherwise.
            </p>
          )}

          <div>
            <Label className="text-xs text-neutral-400">Date</Label>
            <Input
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
              className="mt-1 bg-neutral-800 border-neutral-700 text-white"
            />
          </div>

          <div>
            <Label className="text-xs text-neutral-400">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 bg-neutral-800 border-neutral-700 text-white"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-neutral-400 hover:text-white">Cancel</Button>
          <Button
            onClick={submit}
            disabled={!(value > 0) || saving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RaffleLedger;
