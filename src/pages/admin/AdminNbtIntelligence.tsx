// NBT Intelligence — what the Non-Battle Team logs add up to.
//
// Deliberately its own page rather than a second tab on the Battle Team's. A
// 5×5 back squat and a 3×8 goblet squat are not the same measurement, and one
// page averaging both would report an "average strength gain" that means
// nothing. The athlete carries across the two programmes; the numbers do not.
//
// So this measures what THIS programme is for: competency (moving up a track),
// work capacity (the circuit result rising), and showing up.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Search, TrendingUp, Users, Activity, AlertTriangle, Dumbbell, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { NbtLog, Track, TRACKS, TRACK_META, toDateString } from "@/lib/nbt";
import {
  allAthletes, overview, athleteIntel, liftTrend, workTrend, repeatedLifts,
  AthleteIntel, SLIPPING_DAYS,
} from "@/lib/nbtIntel";

const AdminNbtIntelligence = () => {
  const navigate = useNavigate();
  const today = toDateString(new Date());
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["nbt-intel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nbt_logs" as never)
        .select("*")
        .order("workout_date", { ascending: true });
      if (error) throw error;
      return (data as unknown as NbtLog[]) || [];
    },
  });

  const athletes = useMemo(() => allAthletes(logs, today), [logs, today]);
  const stats = useMemo(() => overview(athletes), [athletes]);
  const open = useMemo(
    () => (openId ? athleteIntel(openId, logs, today) : null),
    [openId, logs, today]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? athletes.filter((a) => a.name.toLowerCase().includes(q)) : athletes;
  }, [athletes, search]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-6xl mx-auto text-white">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">NBT Intelligence</h2>
          <p className="text-neutral-400 text-sm mt-1">
            The Non-Battle Team, measured on what the programme is for — competency, work capacity and
            showing up.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate("/admin/operations/nbt-board")}
          className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white"
        >
          <Dumbbell className="w-4 h-4 mr-1.5" /> The board
        </Button>
      </div>

      {isLoading ? (
        <p className="text-neutral-500 py-16 text-center">Loading…</p>
      ) : athletes.length === 0 ? (
        <div className="text-center py-16 text-neutral-600">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nothing logged yet.</p>
          <p className="text-sm mt-1">
            Athletes log from the gym board — this fills in as they do.
          </p>
        </div>
      ) : open ? (
        <AthleteView athlete={open} onBack={() => setOpenId(null)} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat icon={Users} label="Athletes logging" value={String(stats.athletes)} />
            <Stat icon={Activity} label="Sessions logged" value={String(stats.sessions)} />
            <Stat
              icon={TrendingUp}
              label="Moved up a track"
              value={String(stats.movedUp)}
              accent={TRACK_META.alpha.color}
            />
            <Stat
              icon={AlertTriangle}
              label={`Quiet ${SLIPPING_DAYS}+ days`}
              value={String(stats.slipping)}
              accent={stats.slipping > 0 ? "#f59e0b" : undefined}
            />
          </div>

          {/* Where the room sits today. */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 font-semibold mb-3">
              Where they are now
            </p>
            <div className="flex gap-2 flex-wrap">
              {TRACKS.map((t) => (
                <span
                  key={t}
                  className="rounded-lg px-3 py-2 text-sm font-bold"
                  style={{ backgroundColor: `${TRACK_META[t].color}1a`, color: TRACK_META[t].color }}
                >
                  {TRACK_META[t].label} — {stats.byLevel[t]}
                </span>
              ))}
            </div>
          </div>

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
            {visible.map((a) => {
              const m = TRACK_META[a.currentLevel];
              const movedUp = a.moves.some((x) => x.up);
              const quiet = a.daysSince >= SLIPPING_DAYS;
              return (
                <button
                  key={a.registrationId}
                  onClick={() => setOpenId(a.registrationId)}
                  className="w-full border-t border-neutral-800 first:border-t-0 px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <span
                    className="rounded-md px-2 py-1 text-[11px] font-black shrink-0"
                    style={{ backgroundColor: `${m.color}1f`, color: m.color }}
                  >
                    {m.label}
                  </span>
                  <span className="text-white font-medium flex-1 min-w-0 truncate">{a.name}</span>
                  {movedUp && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400/80 shrink-0">
                      Moved up
                    </span>
                  )}
                  <span className="text-sm text-neutral-500 tabular-nums shrink-0">
                    {a.sessions} session{a.sessions === 1 ? "" : "s"}
                  </span>
                  <span
                    className={`text-xs tabular-nums w-24 text-right shrink-0 ${
                      quiet ? "text-amber-400" : "text-neutral-600"
                    }`}
                  >
                    {a.daysSince === 0 ? "today" : `${a.daysSince}d ago`}
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-700 shrink-0" />
                </button>
              );
            })}
            {visible.length === 0 && (
              <p className="px-4 py-6 text-center text-neutral-600">Nobody matches that.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/* ───── One athlete ───── */

const AthleteView = ({ athlete, onBack }: { athlete: AthleteIntel; onBack: () => void }) => {
  const lifts = repeatedLifts(athlete);
  // Only circuits repeated in the same unit can be compared — see workTrend.
  const circuits = useMemo(() => {
    const seen = new Set<string>();
    const out: { title: string; unit: string }[] = [];
    athlete.work.forEach((w) => {
      const key = `${w.title}|${w.unit}`;
      if (!seen.has(key)) { seen.add(key); out.push({ title: w.title, unit: w.unit }); }
    });
    return out;
  }, [athlete]);

  const m = TRACK_META[athlete.currentLevel];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost" size="icon"
          onClick={onBack}
          className="text-neutral-500 hover:text-white h-9 w-9"
          aria-label="Back to everyone"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h3 className="text-xl font-bold">{athlete.name}</h3>
          <p className="text-xs text-neutral-500">
            {athlete.sessions} sessions · {athlete.firstDate} to {athlete.lastDate}
          </p>
        </div>
        <span
          className="ml-auto rounded-lg px-3 py-1.5 text-sm font-bold"
          style={{ backgroundColor: `${m.color}1a`, color: m.color }}
        >
          {m.label} — {m.word}
        </span>
      </div>

      {/* The competency story: where they started and every move since. */}
      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 font-semibold mb-3">
          Track
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Chip track={athlete.startLevel} sub="started" />
          {athlete.moves.map((mv, i) => (
            <span key={i} className="flex items-center gap-2">
              <ChevronRight
                className={`w-4 h-4 ${mv.up ? "text-emerald-400" : "text-neutral-600"}`}
              />
              <Chip
                track={mv.to}
                sub={format(new Date(`${mv.date}T12:00:00`), "d MMM")}
              />
            </span>
          ))}
        </div>
        {athlete.moves.length === 0 && (
          <p className="text-sm text-neutral-500 mt-2">
            Same track throughout — which is fine. Moving up is a coaching call, not a calendar one.
          </p>
        )}
      </section>

      {/* Strength, only on movements actually repeated. */}
      {lifts.length > 0 && (
        <section>
          <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 font-semibold mb-2">
            Strength
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {lifts.map((lift) => {
              const t = liftTrend(athlete, lift);
              if (!t) {
                return (
                  <div key={lift} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                    <p className="font-bold text-white">{lift}</p>
                    <p className="text-sm text-neutral-500 mt-1">
                      Bodyweight — no load logged, so there is no weight trend to show.
                    </p>
                  </div>
                );
              }
              return (
                <div key={lift} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                  <p className="font-bold text-white">{lift}</p>
                  <div className="flex items-baseline gap-4 mt-2">
                    <Figure label="Start" value={`${t.first}`} />
                    <Figure label="Now" value={`${t.last}`} bright />
                    <Figure label="Best" value={`${t.pr}`} />
                    <span
                      className={`ml-auto text-lg font-black tabular-nums ${
                        t.change > 0 ? "text-emerald-400" : t.change < 0 ? "text-amber-400" : "text-neutral-500"
                      }`}
                    >
                      {t.change > 0 ? "+" : ""}{t.change} lb
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Work capacity — the other half of the programme. */}
      {circuits.length > 0 && (
        <section>
          <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 font-semibold mb-2">
            Conditioning
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {circuits.map(({ title, unit }) => {
              const t = workTrend(athlete, title, unit);
              const latest = athlete.work.filter((w) => w.title === title && w.unit === unit).slice(-1)[0];
              return (
                <div key={`${title}|${unit}`} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                  <p className="font-bold text-white">{title || "Circuit"}</p>
                  {t ? (
                    <div className="flex items-baseline gap-4 mt-2">
                      <Figure label="First" value={`${t.first}`} />
                      <Figure label="Latest" value={`${t.last}`} bright />
                      <span
                        className={`ml-auto text-lg font-black tabular-nums ${
                          t.change > 0 ? "text-emerald-400" : t.change < 0 ? "text-amber-400" : "text-neutral-500"
                        }`}
                      >
                        {t.change > 0 ? "+" : ""}{t.change} {unit}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500 mt-1">
                      {latest ? `${latest.result} ${unit} once — ` : ""}
                      not repeated yet, so there is nothing to compare it against.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* The sessions themselves, newest first. */}
      <section>
        <p className="text-[11px] uppercase tracking-[0.15em] text-neutral-500 font-semibold mb-2">
          Sessions
        </p>
        <div className="rounded-xl border border-neutral-800 overflow-hidden">
          {[...athlete.lifts].reverse().map((l, i) => (
            <div
              key={i}
              className="border-t border-neutral-800 first:border-t-0 px-4 py-2.5 flex items-center gap-3 flex-wrap"
            >
              <span className="text-xs text-neutral-500 tabular-nums w-20 shrink-0">
                {format(new Date(`${l.date}T12:00:00`), "d MMM")}
              </span>
              <span
                className="text-[10px] font-black rounded px-1.5 py-0.5 shrink-0"
                style={{
                  backgroundColor: `${TRACK_META[l.level].color}1f`,
                  color: TRACK_META[l.level].color,
                }}
              >
                {TRACK_META[l.level].label}
              </span>
              <span className="text-white flex-1 min-w-0 truncate">{l.lift}</span>
              <span className="text-sm text-neutral-400 tabular-nums shrink-0">
                {l.weight != null ? `${l.weight} lb · ` : ""}
                {l.reps} reps
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

/* ───── Small pieces ───── */

const Stat = ({
  icon: Icon, label, value, accent,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-3">
    <div className="flex items-center gap-1.5 text-neutral-500">
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[10px] uppercase tracking-wider font-semibold">{label}</span>
    </div>
    <p className="text-2xl font-bold mt-1" style={accent ? { color: accent } : undefined}>
      {value}
    </p>
  </div>
);

const Chip = ({ track, sub }: { track: Track; sub: string }) => {
  const m = TRACK_META[track];
  return (
    <span
      className="rounded-lg px-3 py-1.5 text-sm font-bold"
      style={{ backgroundColor: `${m.color}1a`, color: m.color }}
    >
      {m.label}
      <span className="opacity-50 font-normal ml-1.5">{sub}</span>
    </span>
  );
};

const Figure = ({ label, value, bright }: { label: string; value: string; bright?: boolean }) => (
  <span>
    <span className="text-[10px] uppercase tracking-wider text-neutral-600 block">{label}</span>
    <span className={`text-lg font-bold tabular-nums ${bright ? "text-white" : "text-neutral-400"}`}>
      {value}
    </span>
  </span>
);

export default AdminNbtIntelligence;
