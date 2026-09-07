// Raffle Intelligence — the season view, across every campaign.
//
// The ledger answers "who owes me money tonight". This answers the question a
// funder asks: does the academy actually require its youth to contribute, and
// can you show me? Participation leads, because a programme where three kids
// do everything is a different programme from one where eighty each do a little.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentAttendanceYear, shortProgramYear } from "@/lib/programYear";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileDown, Search, Ticket, TrendingUp } from "lucide-react";
import {
  RaffleCampaign, RaffleBatch, RaffleReturn, RafflePayment, Pricing,
  youthTotals, seasonSummary, money, pct, countTickets,
} from "@/lib/raffle";
import { generateRaffleSeasonPdf } from "@/lib/generateRaffleSeasonPdf";

const NLA_RED = "#bf0f3e";

interface Youth {
  id: string;
  child_first_name: string;
  child_last_name: string;
}

const RaffleIntelligence = () => {
  const [scope, setScope] = useState("all");
  const [search, setSearch] = useState("");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["raffle-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raffle_campaigns" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as RaffleCampaign[]) || [];
    },
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["raffle-all-batches"],
    queryFn: async () => {
      const { data } = await supabase.from("raffle_batches" as never).select("*");
      return (data as unknown as RaffleBatch[]) || [];
    },
  });

  const { data: returns = [] } = useQuery({
    queryKey: ["raffle-all-returns"],
    queryFn: async () => {
      const { data } = await supabase.from("raffle_returns" as never).select("*");
      return (data as unknown as RaffleReturn[]) || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["raffle-all-payments"],
    queryFn: async () => {
      const { data } = await supabase.from("raffle_payments" as never).select("*");
      return (data as unknown as RafflePayment[]) || [];
    },
  });

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

  const inScope = useMemo(
    () => (scope === "all" ? campaigns : campaigns.filter((c) => c.id === scope)),
    [campaigns, scope]
  );

  const priceById = useMemo(() => {
    const m: Record<string, Pricing> = {};
    campaigns.forEach((c) => {
      m[c.id] = {
        ticketPrice: Number(c.ticket_price),
        bundleQty: c.bundle_qty,
        bundlePrice: c.bundle_price,
      };
    });
    return m;
  }, [campaigns]);

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    youth.forEach((y) => { m[y.id] = `${y.child_first_name} ${y.child_last_name}`; });
    return m;
  }, [youth]);

  /* ───── Per youth, summed across the campaigns in scope ─────
     Each campaign is reconciled on its own — ticket prices differ — and only
     then added up. Mixing books at different prices into one division would
     quietly produce a sell-through nobody could reproduce. */
  const perYouth = useMemo(() => {
    const ids = new Set(inScope.map((c) => c.id));
    const acc: Record<string, {
      issued: number; sold: number; raised: number; owed: number; campaigns: Set<string>;
    }> = {};

    inScope.forEach((c) => {
      const cb = batches.filter((b) => b.campaign_id === c.id);
      const kids = new Set([
        ...cb.map((b) => b.registration_id),
        ...payments.filter((p) => ids.has(p.campaign_id) && p.campaign_id === c.id).map((p) => p.registration_id),
      ]);
      kids.forEach((kid) => {
        const myBatches = cb.filter((b) => b.registration_id === kid);
        const myReturns = returns.filter((r) => myBatches.some((b) => b.id === r.batch_id));
        const myPayments = payments.filter(
          (p) => p.campaign_id === c.id && p.registration_id === kid
        );
        const t = youthTotals(myBatches, myReturns, myPayments, priceById[c.id] ?? { ticketPrice: 0 });
        const row = (acc[kid] ||= { issued: 0, sold: 0, raised: 0, owed: 0, campaigns: new Set() });
        row.issued += t.issued;
        row.sold += t.soldTickets;
        row.raised += t.paid;
        row.owed += Math.max(0, t.balance);
        row.campaigns.add(c.id);
      });
    });

    return Object.entries(acc)
      .map(([id, r]) => ({
        registration_id: id,
        name: nameById[id] || "Unknown youth",
        issued: r.issued,
        sold: r.sold,
        raised: r.raised,
        owed: r.owed,
        campaigns: r.campaigns.size,
        sellThrough: r.issued > 0 ? r.sold / r.issued : 0,
      }))
      .sort((a, b) => b.raised - a.raised || a.name.localeCompare(b.name));
  }, [inScope, batches, returns, payments, priceById, nameById]);

  const summary = useMemo(
    () =>
      seasonSummary(
        perYouth.map((p) => ({
          issued: p.issued,
          returned: 0,
          out: 0,
          owed: 0,
          paid: p.raised,
          balance: p.owed,
          soldTickets: p.sold,
          sellThrough: p.sellThrough,
        }))
      ),
    [perYouth]
  );

  const byCampaign = useMemo(
    () =>
      inScope.map((c) => {
        const cb = batches.filter((b) => b.campaign_id === c.id);
        const cp = payments.filter((p) => p.campaign_id === c.id);
        const cr = returns.filter((r) => cb.some((b) => b.id === r.batch_id));
        const kids = new Set(cb.map((b) => b.registration_id));
        const rows = Array.from(kids).map((kid) => {
          const mb = cb.filter((b) => b.registration_id === kid);
          return youthTotals(
            mb,
            cr.filter((r) => mb.some((b) => b.id === r.batch_id)),
            cp.filter((p) => p.registration_id === kid),
            { ticketPrice: Number(c.ticket_price), bundleQty: c.bundle_qty, bundlePrice: c.bundle_price }
          );
        });
        return {
          name: c.name,
          kind: c.kind,
          ticketsIssued: countTickets(cb),
          ticketsSold: rows.reduce((n, r) => n + r.soldTickets, 0),
          raised: cp.reduce((n, p) => n + Number(p.amount), 0),
          outstanding: rows.reduce((n, r) => n + Math.max(0, r.balance), 0),
          youthParticipating: rows.filter((r) => r.paid > 0).length,
        };
      }),
    [inScope, batches, returns, payments]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? perYouth.filter((p) => p.name.toLowerCase().includes(q)) : perYouth;
  }, [perYouth, search]);

  const periodLabel =
    scope === "all"
      ? `All campaigns · ${shortProgramYear(getCurrentAttendanceYear())}`
      : campaigns.find((c) => c.id === scope)?.name ?? "Raffle";

  const download = () =>
    generateRaffleSeasonPdf({
      periodLabel,
      ...summary,
      campaigns: byCampaign,
      perYouth: perYouth.map((p) => ({
        name: p.name,
        issued: p.issued,
        sold: p.sold,
        raised: p.raised,
        sellThrough: p.sellThrough,
        campaigns: p.campaigns,
      })),
    });

  const hasData = perYouth.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-[260px] bg-neutral-800 border-neutral-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-neutral-700 text-white">
            <SelectItem value="all">All campaigns</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={download}
          disabled={!hasData}
          className="ml-auto text-white font-bold"
          style={{ backgroundColor: NLA_RED }}
        >
          <FileDown className="w-4 h-4 mr-1.5" /> Download PDF
        </Button>
      </div>

      {!hasData ? (
        <div className="text-center py-16 text-neutral-600">
          <Ticket className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nothing to report yet. Issue some tickets and the numbers will build here.</p>
        </div>
      ) : (
        <>
          {/* The sentence for the grant application */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 mt-0.5 shrink-0" style={{ color: NLA_RED }} />
              <p className="text-lg text-white leading-relaxed">
                <span className="font-bold">{summary.youthContributed} of {summary.youthIssued}</span> youth
                entrusted with tickets ({pct(summary.participation)}) contributed money back, raising{" "}
                <span className="font-bold">{money(summary.raised)}</span> toward the cost of the program
                that serves them.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Raised" value={money(summary.raised)} accent="#22c55e" />
            <Stat label="Outstanding" value={money(summary.outstanding)} accent={summary.outstanding > 0 ? "#f59e0b" : undefined} />
            <Stat label="Tickets sold" value={`${summary.ticketsSold} of ${summary.ticketsIssued}`} />
            <Stat label="Sell-through" value={pct(summary.sellThrough)} />
          </div>

          {byCampaign.length > 1 && (
            <div className="rounded-xl border border-neutral-800 overflow-hidden">
              <p className="px-4 py-2 bg-neutral-900 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                By campaign
              </p>
              {byCampaign.map((c) => (
                <div key={c.name} className="border-t border-neutral-800 px-4 py-2.5 flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-white flex-1 min-w-[140px]">{c.name}</span>
                  {c.kind && (
                    <Badge className="bg-white/10 text-white/70 border-white/15 text-[10px]">{c.kind}</Badge>
                  )}
                  <span className="text-sm text-neutral-400 tabular-nums">{c.youthParticipating} youth</span>
                  <span className="text-sm text-neutral-400 tabular-nums">{c.ticketsSold}/{c.ticketsIssued} sold</span>
                  <span className="text-sm font-bold text-emerald-400 tabular-nums w-24 text-right">{money(c.raised)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find a youth…"
              className="pl-9 bg-neutral-800 border-neutral-700 text-white"
            />
          </div>

          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            <div className="grid grid-cols-[1fr_70px_90px_100px_90px] gap-2 px-4 py-2 bg-neutral-900 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
              <span>Youth</span>
              <span className="text-right">Camps</span>
              <span className="text-right">Sold</span>
              <span className="text-right">Raised</span>
              <span className="text-right">Sell-through</span>
            </div>
            {visible.map((p) => (
              <div
                key={p.registration_id}
                className="border-t border-neutral-800 grid grid-cols-[1fr_70px_90px_100px_90px] gap-2 px-4 py-2.5 items-center"
              >
                <span className="text-white truncate">{p.name}</span>
                <span className="text-right text-neutral-500 tabular-nums">{p.campaigns}</span>
                <span className="text-right text-neutral-300 tabular-nums">{p.sold}/{p.issued}</span>
                <span className="text-right font-semibold text-emerald-400 tabular-nums">{money(p.raised)}</span>
                <span className="text-right text-neutral-300 tabular-nums">{pct(p.sellThrough)}</span>
              </div>
            ))}
            {visible.length === 0 && (
              <p className="border-t border-neutral-800 px-4 py-6 text-center text-neutral-600">
                Nobody matches that.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const Stat = ({ label, value, accent }: { label: string; value: string; accent?: string }) => (
  <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5">
    <p className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</p>
    <p className="text-lg font-bold mt-0.5" style={accent ? { color: accent } : { color: "white" }}>{value}</p>
  </div>
);

export default RaffleIntelligence;
