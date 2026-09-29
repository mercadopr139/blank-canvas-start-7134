// Youth served, all programs.
//
// One number for a funder: how many youth did No Limits serve in a period,
// across the NLA program and Hawk Squad, with nobody counted twice. Each
// program's own pages report only that program; this is the one deliberate
// place they are put side by side. The counting happens in the database
// (hawk_squad_youth_served): each side is collapsed to a person first, then a
// Hawk Squad student who is also an NLA boxer is matched by name and birthday.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Layers } from "lucide-react";
import { getCurrentAttendanceYear, programYearRange, shortProgramYear } from "@/lib/programYear";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDay = (d: string) => format(new Date(d + "T00:00:00"), "MMM d, yyyy");

type PresetKey = "this-month" | "last-month" | "year" | "custom";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "year", label: `Program year ${shortProgramYear(getCurrentAttendanceYear())}` },
  { key: "custom", label: "Custom range" },
];

const rangeFor = (key: PresetKey, customFrom: string, customTo: string): { from: string; to: string; label: string } => {
  const now = new Date();
  if (key === "custom") {
    const from = customFrom || iso(startOfMonth(now));
    const to = customTo || iso(now);
    return { from, to, label: `${fmtDay(from)} – ${fmtDay(to)}` };
  }
  if (key === "last-month") { const m = subMonths(now, 1); return { from: iso(startOfMonth(m)), to: iso(endOfMonth(m)), label: format(m, "MMMM yyyy") }; }
  if (key === "year") {
    const year = getCurrentAttendanceYear();
    const [s, e] = programYearRange(year);
    return { from: iso(s), to: iso(e), label: `Program year ${shortProgramYear(year)}` };
  }
  return { from: iso(startOfMonth(now)), to: iso(endOfMonth(now)), label: format(now, "MMMM yyyy") };
};

interface Served { nla_youth: number; hawk_youth: number; in_both: number; combined: number; in_both_names: string[] }

const AdminYouthServed = () => {
  const [preset, setPreset] = useState<PresetKey>("year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const { from, to, label } = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const served = useQuery({
    queryKey: ["youth-served", from, to],
    queryFn: async (): Promise<Served> => {
      const { data, error } = await (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "hawk_squad_youth_served", { _from: from, _to: to },
      );
      if (error) throw new Error(error.message);
      return (data as Served[])?.[0] ?? { nla_youth: 0, hawk_youth: 0, in_both: 0, combined: 0, in_both_names: [] };
    },
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto text-white">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Layers className="h-6 w-6 text-emerald-400" /> Youth Served — all programs</h2>
        <p className="text-neutral-400 text-sm mt-1">
          Everyone who checked in to the NLA program or Hawk Squad in the period. A youth in both is counted once.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => setPreset(p.key)}
            className={`text-sm px-3 py-1.5 rounded-lg border ${preset === p.key ? "bg-emerald-500 text-black border-emerald-500 font-semibold" : "bg-white/5 border-white/15 text-white/70 hover:text-white"}`}>
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-3 ml-1">
            <label className="text-sm text-white/60 flex items-center gap-2">From
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg bg-white/5 border border-white/15 px-2 py-1.5 text-sm text-white" />
            </label>
            <label className="text-sm text-white/60 flex items-center gap-2">To
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg bg-white/5 border border-white/15 px-2 py-1.5 text-sm text-white" />
            </label>
          </div>
        )}
        <span className="text-xs text-white/40 ml-auto">{label}</span>
      </div>

      <Card className="bg-white/[0.03] border-white/10 text-white">
        <CardContent className="p-5">
          {served.isError ? (
            <p className="text-rose-300 text-sm">Couldn't count: {(served.error as Error)?.message}</p>
          ) : served.isLoading ? (
            <p className="text-white/40 text-sm">Counting…</p>
          ) : served.data && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { l: "NLA program", v: served.data.nla_youth, sub: "checked in at NLA" },
                  { l: "Hawk Squad", v: served.data.hawk_youth, sub: "checked in to Hawk Squad" },
                  { l: "In both", v: served.data.in_both, sub: "counted once" },
                  { l: "Total youth served", v: served.data.combined, sub: "all of No Limits", hi: true },
                ].map((t) => (
                  <div key={t.l} className={`rounded-xl border p-4 ${t.hi ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10"}`}>
                    <p className={`text-4xl font-black tabular-nums ${t.hi ? "text-emerald-300" : ""}`}>{t.v}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/50 mt-1">{t.l}</p>
                    <p className="text-[11px] text-white/30">{t.sub}</p>
                  </div>
                ))}
              </div>
              {served.data.in_both_names.length > 0 && (
                <p className="text-sm text-white/50 mt-4">In both programs: <span className="text-white/80">{served.data.in_both_names.join(", ")}</span></p>
              )}
              <p className="text-[11px] text-white/30 mt-4">
                Counted as people, not registrations: a youth who re-registered across years is one youth. A Hawk Squad student is matched to an NLA boxer by first name, last name and date of birth.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminYouthServed;
