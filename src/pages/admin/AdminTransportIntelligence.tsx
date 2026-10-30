import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, differenceInYears, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, FileText, Bus, Users, DollarSign, ArrowUpRight, ArrowDownRight, UserCheck } from "lucide-react";
import {
  getCurrentAttendanceYear, programYearRange, shortProgramYear, nextProgramYear,
} from "@/lib/programYear";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { isBelowPoverty } from "@/lib/demographics";
import { fetchAllRows } from "@/lib/fetchAllRows";

import { ZONES, ZONE_ACCENT, sortBreakdown, windowRange, periodYear, availableYears, buildIntelligence, type ZoneKey, type Period, type Breakdown, type ZoneStats } from "@/lib/transportIntelligence";

/* ── small UI pieces ── */
const Kpi = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-white/5 rounded-lg p-3 text-center">
    <p className="text-2xl font-bold text-white leading-none">{value}</p>
    <p className="text-white/50 text-[11px] mt-1.5 leading-tight">{label}</p>
  </div>
);

const BreakdownRows = ({ title, items, total }: { title: string; items: Breakdown; total: number }) => (
  <div>
    <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">{title}</p>
    {items.length === 0 ? (
      <p className="text-white/30 text-xs">No data</p>
    ) : (
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-2">
            <span className="text-white/70 text-xs w-28 shrink-0 truncate">{it.label}</span>
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-white/25 rounded-full" style={{ width: `${total > 0 ? (it.count / total) * 100 : 0}%` }} />
            </div>
            <span className="text-white/50 text-xs w-8 text-right shrink-0">{it.count}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const ZoneColumn = ({ name, stats }: { name: ZoneKey; stats: ZoneStats }) => (
  <Card className="bg-zinc-900/60 border-white/10 overflow-hidden">
    <div className="h-1.5" style={{ backgroundColor: ZONE_ACCENT[name] }} />
    <CardHeader className="pb-3">
      <CardTitle className="text-white flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ZONE_ACCENT[name] }} />
        {name}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Trips" value={stats.trips} />
        <Kpi label="Rides Provided" value={stats.rides} />
        <Kpi label="Youth Served" value={stats.uniqueYouth} />
        <Kpi label="Avg Youth / Trip" value={stats.avgYouthPerTrip} />
        <Kpi label="Pickups" value={stats.pickups} />
        <Kpi label="Drop-offs" value={stats.dropoffs} />
      </div>

      <div className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
        <div>
          <p className="text-white/50 text-[11px]">Economically disadvantaged</p>
          <p className="text-white/40 text-[11px]">{stats.povertyCount} of {stats.assessedYouth} assessed</p>
        </div>
        <p className="text-2xl font-bold" style={{ color: ZONE_ACCENT[name] }}>{stats.povertyPct}%</p>
      </div>

      <div>
        <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5" /> Drivers</p>
        {stats.drivers.length === 0 ? <p className="text-white/30 text-xs">No drivers</p> : (
          <div className="space-y-1">
            {stats.drivers.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <span className="text-white/70 truncate">{d.name}</span>
                <span className="text-white/40">{d.trips} trip{d.trips === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BreakdownRows title="Age" items={stats.age.map((a) => ({ label: `Age ${a.label}`, count: a.count }))} total={stats.uniqueYouth} />
      <BreakdownRows title="Gender" items={stats.gender} total={stats.uniqueYouth} />
      <BreakdownRows title="Race / Ethnicity" items={stats.race} total={stats.uniqueYouth} />
      <BreakdownRows title="School District" items={stats.district} total={stats.uniqueYouth} />
      <BreakdownRows
        title="Household"
        items={stats.assessedYouth > 0 ? [{ label: "Single-parent", count: stats.singleParentCount }, { label: "Two-parent / other", count: stats.assessedYouth - stats.singleParentCount }] : []}
        total={stats.assessedYouth}
      />
    </CardContent>
  </Card>
);

/* ── page ── */
export default function AdminTransportIntelligence() {
  const navigate = useNavigate();
  // Defaults to the program year in session, which is what anyone opening this
  // page wants nine times in ten.
  const [period, setPeriod] = useState<Period>(() => getCurrentAttendanceYear());

  const { data: years = [] } = useQuery({
    queryKey: ["transport-intelligence-years"],
    queryFn: availableYears,
    staleTime: 60 * 60 * 1000,
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["transport-intelligence", period],
    queryFn: () => buildIntelligence(period),
    staleTime: 60_000,
  });

  const windowLabel = useMemo(
    () =>
      period === "month"
        ? format(new Date(), "MMMM yyyy")
        : `Program Year ${shortProgramYear(period)}`,
    [period]
  );

  const combined = data?.Combined;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Bus className="w-6 h-6 text-red-400" /> Transportation Intelligence</h1>
          <p className="text-white/50 text-sm mt-1">Live snapshot of who we serve — Woodbine and Wildwood, side by side.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* One control, one answer to "what period am I looking at". */}
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[190px] bg-zinc-900 border-white/15 text-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/15 text-white">
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  Program Year {shortProgramYear(y)}
                </SelectItem>
              ))}
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="border-white/15 text-white hover:bg-white/10 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => navigate("/admin/operations/transportation/impact-reports")} className="bg-[#002868] hover:bg-[#002868]/80 text-white gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Dated Report
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" /></div>
      ) : !combined || combined.trips === 0 ? (
        <Card className="bg-zinc-900/60 border-white/10">
          <CardContent className="py-16 text-center">
            <Bus className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 text-lg">No completed trips in {windowLabel.toLowerCase()}</p>
            <p className="text-white/40 text-sm mt-1">Try a wider window, or check back once trips are logged.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* combined strip */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/70 text-sm font-semibold">Combined · {windowLabel}</p>
              {data?.generatedAt && <p className="text-white/30 text-xs">Updated {format(data.generatedAt, "MMM d, h:mm a")}</p>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label="Total Trips" value={combined.trips} />
              <Kpi label="Rides Provided" value={combined.rides} />
              <Kpi label="Youth Served" value={combined.uniqueYouth} />
              <Kpi label="Avg Youth / Trip" value={combined.avgYouthPerTrip} />
              <Kpi label="% Economically Disadvantaged" value={`${combined.povertyPct}%`} />
            </div>
          </div>

          {/* two zone columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ZoneColumn name="Woodbine" stats={data!.Woodbine} />
            <ZoneColumn name="Wildwood" stats={data!.Wildwood} />
          </div>

          <p className="text-white/30 text-xs text-center">
            Each trip is counted once, in the zone most of its riders came from, so the two zones add up to the total.
            Youth are counted once, in their home pickup zone. Demographics reflect youth matched to a registration record.
          </p>
        </>
      )}
    </div>
  );
}
