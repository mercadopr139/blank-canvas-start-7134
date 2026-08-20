import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, TrendingUp, Trophy, Dumbbell, Users, Flame, Activity, ChevronDown, ChevronRight, Search, BarChart3 } from "lucide-react";

// S&C Intelligence — turns the raw working-set logs (strength_set_logs) into
// coach-facing insight built around each athlete's PROGRESSION: start → now, the
// change in lbs/%, their average, and a session-by-session history you can pull up
// to show a kid their own program. Read-only, public (same access as the board).

const NLA_RED = "#bf0f3e";

interface LogRow {
  youth_id: string;
  athlete_name: string;
  day_key: "monday" | "wednesday" | "thursday";
  workout_date: string;
  sets: { set: number; weight: number | null; reps: number | null }[];
}

const LIFTS: { key: LogRow["day_key"]; name: string }[] = [
  { key: "monday", name: "Bench Press" },
  { key: "wednesday", name: "Back Squat" },
  { key: "thursday", name: "Deadlift" },
];

const bestSet = (sets: LogRow["sets"]): { weight: number; reps: number } => {
  let bw = 0, br = 0;
  for (const s of sets ?? []) {
    const w = Number(s.weight) || 0, r = Number(s.reps) || 0;
    if (w > bw || (w === bw && r > br)) { bw = w; br = r; }
  }
  return { weight: bw, reps: br };
};

const prettyDate = (iso: string): string =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

interface Session { date: string; weight: number; reps: number }
interface LiftEntry {
  youth_id: string; name: string;
  start: number; latest: number; pr: number; prReps: number; avg: number;
  change: number; pct: number; count: number;
  sessions: Session[];
}
interface AthleteAgg { youth_id: string; name: string; byLift: Record<string, LiftEntry>; totalSessions: number }

const StrengthIntelligence = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<"leaderboards" | "athletes">(searchParams.get("athlete") ? "athletes" : "leaderboards");
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(searchParams.get("athlete"));
  const [athleteQuery, setAthleteQuery] = useState("");

  // Keep the URL in sync so the board's "view progress" deep-link works and the
  // report is shareable.
  const openAthlete = (id: string | null) => {
    setSelectedAthlete(id);
    setView("athletes");
    const next = new URLSearchParams(searchParams);
    if (id) next.set("athlete", id); else next.delete("athlete");
    setSearchParams(next, { replace: true });
  };
  const showLeaderboards = () => {
    setSelectedAthlete(null);
    setView("leaderboards");
    const next = new URLSearchParams(searchParams);
    next.delete("athlete");
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    const a = searchParams.get("athlete");
    if (a && a !== selectedAthlete) { setSelectedAthlete(a); setView("athletes"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["strength-intel"],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await (supabase.from("strength_set_logs" as never) as any)
        .select("youth_id, athlete_name, day_key, workout_date, sets")
        .order("workout_date", { ascending: true });
      if (error) throw error;
      return (data as LogRow[]) ?? [];
    },
  });

  const intel = useMemo(() => {
    // Group key: real youth_id when present, else fall back to name (keeps any
    // roster-less logs from all collapsing into one).
    const gidOf = (l: LogRow) => l.youth_id ?? `guest:${l.athlete_name}`;
    const byLift: Record<string, Record<string, LogRow[]>> = {};
    for (const l of logs) {
      (byLift[l.day_key] ??= {});
      (byLift[l.day_key][gidOf(l)] ??= []).push(l);
    }

    const leaderboards: Record<string, LiftEntry[]> = {};
    const allPairs: (LiftEntry & { lift: string })[] = [];

    for (const lift of LIFTS) {
      const athletes = byLift[lift.key] ?? {};
      const rows: LiftEntry[] = [];
      for (const youthId of Object.keys(athletes)) {
        const sessions: Session[] = athletes[youthId]
          .slice()
          .sort((a, b) => (a.workout_date < b.workout_date ? -1 : 1))
          .map((s) => { const t = bestSet(s.sets); return { date: s.workout_date, weight: t.weight, reps: t.reps }; })
          .filter((s) => s.weight > 0);
        if (!sessions.length) continue;
        const name = athletes[youthId][athletes[youthId].length - 1].athlete_name;
        const start = sessions[0].weight;
        const latest = sessions[sessions.length - 1].weight;
        const prS = sessions.reduce((b, c) => (c.weight > b.weight ? c : b), sessions[0]);
        const avg = Math.round(sessions.reduce((n, s) => n + s.weight, 0) / sessions.length);
        const change = latest - start;
        const pct = start > 0 ? Math.round((change / start) * 100) : 0;
        const entry: LiftEntry = {
          youth_id: youthId, name, start, latest, pr: prS.weight, prReps: prS.reps, avg,
          change, pct, count: sessions.length, sessions,
        };
        rows.push(entry);
        allPairs.push({ ...entry, lift: lift.name });
      }
      rows.sort((a, b) => b.pr - a.pr);
      leaderboards[lift.key] = rows;
    }

    // Improvement metrics — only athlete-lift pairs with 2+ sessions can show a trend.
    const trended = allPairs.filter((p) => p.count >= 2);
    const improving = trended.filter((p) => p.change > 0).length;
    const pctImproving = trended.length ? Math.round((improving / trended.length) * 100) : 0;
    const avgGain = trended.length ? Math.round(trended.reduce((n, p) => n + p.pct, 0) / trended.length) : 0;
    const biggestGains = trended.filter((p) => p.change > 0).sort((a, b) => b.change - a.change).slice(0, 8);

    const athleteSet = new Set(logs.map(gidOf));
    const sessionSet = new Set(logs.map((l) => `${gidOf(l)}|${l.workout_date}`));

    // Roster keyed by athlete, for the alphabetical Athletes view + individual report.
    const sessionsByAthlete: Record<string, Set<string>> = {};
    for (const l of logs) (sessionsByAthlete[gidOf(l)] ??= new Set()).add(l.workout_date);
    const athletesById: Record<string, AthleteAgg> = {};
    for (const lift of LIFTS) {
      for (const e of leaderboards[lift.key] ?? []) {
        (athletesById[e.youth_id] ??= { youth_id: e.youth_id, name: e.name, byLift: {}, totalSessions: sessionsByAthlete[e.youth_id]?.size ?? 0 });
        athletesById[e.youth_id].byLift[lift.key] = e;
      }
    }
    const athleteList = Object.values(athletesById).sort((a, b) => a.name.localeCompare(b.name));

    return {
      leaderboards, biggestGains, athletesById, athleteList,
      overview: { athletes: athleteSet.size, sessions: sessionSet.size, pctImproving, avgGain, trendedCount: trended.length },
      empty: logs.length === 0,
    };
  }, [logs]);

  const athlete = selectedAthlete ? intel.athletesById[selectedAthlete] : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl grid place-items-center" style={{ background: NLA_RED }}>
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">S&amp;C Intelligence</h1>
              <p className="text-white/50 text-sm">Every athlete's progress — pull up a name to show them their program.</p>
            </div>
          </div>
          <button onClick={() => navigate("/strength-coach")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold bg-white/5 hover:bg-white/10 border border-white/15 shrink-0">
            <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to board</span>
          </button>
        </div>

        {isLoading ? (
          <div className="text-white/40 py-20 text-center">Loading…</div>
        ) : intel.empty ? (
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-10 text-center">
            <Activity className="h-10 w-10 mx-auto mb-4 text-white/30" />
            <h2 className="text-xl font-bold mb-1">No sessions logged yet</h2>
            <p className="text-white/50 max-w-md mx-auto">Once athletes log their working sets on the board, their progress and biggest jumps show up here.</p>
          </div>
        ) : (
          <>
            {/* Leaderboards vs. individual Athletes */}
            <div className="inline-flex rounded-xl border border-white/10 bg-neutral-900/60 p-1 mb-5">
              <button onClick={showLeaderboards}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${view === "leaderboards" ? "text-white" : "text-white/50 hover:text-white/80"}`}
                style={view === "leaderboards" ? { background: NLA_RED } : undefined}>
                <BarChart3 className="h-4 w-4" /> Leaderboards
              </button>
              <button onClick={() => setView("athletes")}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${view === "athletes" ? "text-white" : "text-white/50 hover:text-white/80"}`}
                style={view === "athletes" ? { background: NLA_RED } : undefined}>
                <Users className="h-4 w-4" /> Athletes
              </button>
            </div>

            {view === "athletes" ? (
              athlete ? (
                <AthleteReport athlete={athlete} onBack={() => openAthlete(null)} />
              ) : (
                <AthleteList list={intel.athleteList} query={athleteQuery} setQuery={setAthleteQuery} onPick={openAthlete} />
              )
            ) : (
            <>
            {/* Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard icon={<Users className="h-4 w-4" />} label="Athletes logging" value={intel.overview.athletes} />
              <StatCard icon={<Activity className="h-4 w-4" />} label="Sessions logged" value={intel.overview.sessions} />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label="% Improving" value={`${intel.overview.pctImproving}%`}
                caption={intel.overview.trendedCount ? `of ${intel.overview.trendedCount} lifts with 2+ sessions` : "need 2+ sessions"} />
              <StatCard icon={<Trophy className="h-4 w-4" />} label="Avg strength gain" value={`${intel.overview.avgGain >= 0 ? "+" : ""}${intel.overview.avgGain}%`}
                caption="first → latest session" />
            </div>

            {/* Biggest gains */}
            {intel.biggestGains.length > 0 && (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="h-5 w-5 text-emerald-300" />
                  <h2 className="text-lg font-bold">Biggest gains</h2>
                  <span className="text-xs text-white/40">— start → now</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {intel.biggestGains.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                      <div className="min-w-0"><span className="font-semibold truncate">{r.name}</span> <span className="text-white/40 text-sm">· {r.lift}</span></div>
                      <div className="text-emerald-300 font-bold shrink-0 text-sm">{r.start}→{r.latest} <span className="whitespace-nowrap">(▲ +{r.change} lb · +{r.pct}%)</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-lift leaderboards with expandable per-athlete history */}
            <div className="space-y-5">
              {LIFTS.map((lift) => {
                const rows = intel.leaderboards[lift.key] ?? [];
                return (
                  <div key={lift.key} className="rounded-2xl border border-white/10 bg-neutral-900/60 overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2" style={{ background: "linear-gradient(90deg, rgba(191,15,62,0.2), transparent)" }}>
                      <Dumbbell className="h-5 w-5" />
                      <h2 className="text-xl font-extrabold">{lift.name}</h2>
                      <span className="text-xs text-white/40 ml-auto">{rows.length} athlete{rows.length === 1 ? "" : "s"}</span>
                    </div>
                    {rows.length === 0 ? (
                      <div className="px-5 py-6 text-white/40 text-sm">No logs yet.</div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {rows.map((r, i) => {
                          const key = `${lift.key}|${r.youth_id}`;
                          const open = expanded === key;
                          const single = r.count < 2;
                          return (
                            <div key={r.youth_id}>
                              <button onClick={() => setExpanded(open ? null : key)}
                                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors">
                                <div className="w-6 text-center font-bold text-white/40">{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold truncate">{r.name}</div>
                                  <div className="text-[11px] text-white/40">{r.count} session{r.count === 1 ? "" : "s"} · avg {r.avg} lb</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-extrabold text-lg">{r.latest} lb</div>
                                  <div className="text-[11px] text-white/40">now · PR {r.pr}</div>
                                </div>
                                <div className="w-24 text-right shrink-0 text-sm font-semibold">
                                  {single ? <span className="text-white/25">1 session</span>
                                    : r.change > 0 ? <span className="text-emerald-300">▲ +{r.change} lb<br /><span className="text-[11px] font-normal">+{r.pct}%</span></span>
                                    : r.change < 0 ? <span className="text-red-300/80">▼ {r.change} lb<br /><span className="text-[11px] font-normal">{r.pct}%</span></span>
                                    : <span className="text-white/30">even</span>}
                                </div>
                                <ChevronDown className={`h-4 w-4 text-white/30 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                              </button>
                              {open && (
                                <div className="px-5 pb-4 pt-1 bg-black/20">
                                  <div className="text-[11px] uppercase tracking-widest text-white/40 mb-2">Session history</div>
                                  <div className="space-y-1">
                                    {r.sessions.map((s, si) => {
                                      const prevW = si > 0 ? r.sessions[si - 1].weight : null;
                                      const d = prevW != null ? s.weight - prevW : 0;
                                      return (
                                        <div key={si} className="flex items-center justify-between gap-2 text-sm rounded-md bg-white/5 px-3 py-1.5">
                                          <span className="text-white/50">{prettyDate(s.date)}</span>
                                          <span className="font-semibold">{s.weight} lb <span className="text-white/40 font-normal">× {s.reps}</span></span>
                                          <span className="w-16 text-right text-[11px]">
                                            {prevW == null ? <span className="text-white/30">start</span>
                                              : d > 0 ? <span className="text-emerald-300">▲ +{d}</span>
                                              : d < 0 ? <span className="text-red-300/70">▼ {d}</span>
                                              : <span className="text-white/30">=</span>}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="text-[11px] text-white/50 mt-2">
                                    Start <b className="text-white/70">{r.start}</b> · Avg <b className="text-white/70">{r.avg}</b> · Now <b className="text-white/70">{r.latest}</b> · PR <b className="text-white/70">{r.pr}</b>
                                    {!single && <> · Change <b className={r.change >= 0 ? "text-emerald-300" : "text-red-300/80"}>{r.change >= 0 ? "+" : ""}{r.change} lb ({r.change >= 0 ? "+" : ""}{r.pct}%)</b></>}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-white/30 mt-6">Each row shows an athlete's latest working-set weight and their change since their first logged session. Tap a name for the full history. PR = heaviest set ever logged. Main lift only.</p>
            </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Alphabetical roster of everyone who's logged — the "open up an individual" entry point.
const AthleteList = ({ list, query, setQuery, onPick }:
  { list: AthleteAgg[]; query: string; setQuery: (s: string) => void; onPick: (id: string) => void }) => {
  const filtered = query.trim()
    ? list.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()))
    : list;
  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/15 px-3 mb-3">
        <Search className="h-4 w-4 text-white/30 shrink-0" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find an athlete…"
          className="flex-1 bg-transparent py-2.5 text-sm placeholder:text-white/30 focus:outline-none" />
      </div>
      {filtered.length === 0 ? (
        <div className="text-white/40 text-sm py-8 text-center">No athletes match.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const lifts = LIFTS.filter((l) => a.byLift[l.key]);
            return (
              <button key={a.youth_id} onClick={() => onPick(a.youth_id)}
                className="w-full flex items-center gap-3 rounded-xl border border-white/10 bg-neutral-900/60 hover:bg-neutral-800/60 hover:border-white/20 transition-colors px-4 py-3 text-left">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{a.name}</div>
                  <div className="text-[11px] text-white/40">{a.totalSessions} session{a.totalSessions === 1 ? "" : "s"} · {lifts.map((l) => l.name.split(" ")[0]).join(" · ") || "—"}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// One athlete's full program across all three lifts — the thing you show the kid.
const AthleteReport = ({ athlete, onBack }: { athlete: AthleteAgg; onBack: () => void }) => (
  <div>
    <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-4">
      <ArrowLeft className="h-4 w-4" /> All athletes
    </button>
    <h2 className="text-2xl font-extrabold mb-1">{athlete.name}</h2>
    <p className="text-white/50 text-sm mb-5">{athlete.totalSessions} session{athlete.totalSessions === 1 ? "" : "s"} logged</p>

    <div className="space-y-4">
      {LIFTS.map((lift) => {
        const e = athlete.byLift[lift.key];
        return (
          <div key={lift.key} className="rounded-2xl border border-white/10 bg-neutral-900/60 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2" style={{ background: "linear-gradient(90deg, rgba(191,15,62,0.2), transparent)" }}>
              <Dumbbell className="h-4 w-4" />
              <h3 className="font-extrabold">{lift.name}</h3>
              {e && e.count >= 2 && (
                <span className={`ml-auto text-sm font-bold ${e.change >= 0 ? "text-emerald-300" : "text-red-300/80"}`}>
                  {e.change >= 0 ? "▲ +" : "▼ "}{e.change} lb ({e.change >= 0 ? "+" : ""}{e.pct}%)
                </span>
              )}
            </div>
            {!e ? (
              <div className="px-5 py-5 text-white/40 text-sm">No {lift.name.toLowerCase()} logged yet.</div>
            ) : (
              <div className="p-5">
                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                  <Mini label="Start" value={`${e.start}`} />
                  <Mini label="Now" value={`${e.latest}`} highlight />
                  <Mini label="Avg" value={`${e.avg}`} />
                  <Mini label="PR" value={`${e.pr}`} />
                </div>
                <div className="text-[11px] uppercase tracking-widest text-white/40 mb-2">Session history</div>
                <div className="space-y-1">
                  {e.sessions.map((s, si) => {
                    const prevW = si > 0 ? e.sessions[si - 1].weight : null;
                    const d = prevW != null ? s.weight - prevW : 0;
                    return (
                      <div key={si} className="flex items-center justify-between gap-2 text-sm rounded-md bg-white/5 px-3 py-1.5">
                        <span className="text-white/50">{prettyDate(s.date)}</span>
                        <span className="font-semibold">{s.weight} lb <span className="text-white/40 font-normal">× {s.reps}</span></span>
                        <span className="w-16 text-right text-[11px]">
                          {prevW == null ? <span className="text-white/30">start</span>
                            : d > 0 ? <span className="text-emerald-300">▲ +{d}</span>
                            : d < 0 ? <span className="text-red-300/70">▼ {d}</span>
                            : <span className="text-white/30">=</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

const Mini = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="rounded-lg bg-white/5 py-2">
    <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
    <div className="text-xl font-extrabold" style={highlight ? { color: NLA_RED } : undefined}>{value}</div>
  </div>
);

const StatCard = ({ icon, label, value, caption }: { icon: React.ReactNode; label: string; value: string | number; caption?: string }) => (
  <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4">
    <div className="flex items-center gap-1.5 text-white/40 text-[11px] uppercase tracking-wide mb-1">{icon}{label}</div>
    <div className="text-2xl font-extrabold">{value}</div>
    {caption && <div className="text-[10px] text-white/30 mt-0.5">{caption}</div>}
  </div>
);

export default StrengthIntelligence;
