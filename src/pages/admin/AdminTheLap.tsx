// The Lap — the weekly agenda as a lap around NLA (docs/LAP_PLAN.md, step 2).
//
// One ring, three pillar stretches in the message board's colours, the 21
// topics as checkpoints in running order. Only Josh starts a lap. At each
// checkpoint: the commitments made there (one Workbench task per owner, in
// their Agenda Meeting tile), a one-line "we decided", and the topic's own
// controls (rename, add after, retire, move). Crossing into a new pillar
// fires confetti in that colour; the finish line is the Vision. A lap left
// open is resumed where it stopped; one older than seven days closes as
// incomplete. No timer, no sound.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useAsk } from "@/components/admin/AskDialog";
import { todayNY } from "@/lib/programYear";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, Flag, Play, Pause, ChevronLeft, ChevronRight, Check, Circle, Maximize2, Minimize2, Settings2, Loader2, Trophy, Sparkles,
} from "lucide-react";
import LapRing from "@/components/lap/LapRing";
import { runningOrder, checkpoints, crossedPillar, streak as streakOf, PILLAR_LABEL, type RingTopic, type Pillar } from "@/lib/lap/ring";
import { PILLAR_COLOR, commitmentSourceFor, carryTone, type CarryTone } from "@/lib/lap/commitments";

const NLA_RED = "#bf0f3e";
const STALE_DAYS = 7;

// The finish line. From the public Vision page; Josh can hand over his own words.
const VISION_TEXT =
  "No Limits Academy is a long-term model of development that produces lasting outcomes — young people who " +
  "graduate high school with a clear plan, the discipline to execute it, and a network of mentors and partners " +
  "ready to support them. A system that changes life trajectories — and breaks generational cycles, one young " +
  "person at a time.";

interface Topic extends RingTopic { sort_order: number; this_lap_only_lap_id: string | null }
interface Lap { id: string; meeting_date: string; status: "open" | "finished" | "incomplete"; started_at: string; current_topic_id: string | null; stats: { visited?: string[]; at_finish?: boolean } }
interface Manager { key: string; display_name: string; owner_name: string | null }
interface Commitment { id: string; title: string; status: string; source: string | null; lap_topic_id: string | null; lap_commitment_id: string | null; carry_count: number; planned_date: string | null }
interface Decision { id: string; topic_id: string | null; text: string; created_at: string }

const managerKeyOf = (source: string | null) => (!source ? null : source.includes(":") ? source.split(":")[0] : "PD");
const firstName = (m: Manager) => (m.owner_name ?? m.display_name).split(/[\s:]/)[0];
const TONE_CLASS: Record<CarryTone, string> = { fresh: "text-white", once: "text-amber-200", warning: "text-red-300", decide: "text-red-400 font-bold" };
const daysSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
const fireConfetti = (colors: string[], big = false) => {
  confetti({ particleCount: big ? 160 : 90, spread: big ? 110 : 70, origin: { y: 0.35 }, colors });
  if (big) setTimeout(() => confetti({ particleCount: 120, spread: 140, origin: { y: 0.5 }, colors }), 300);
};

const AdminTheLap = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isSuperAdmin } = useStaffPermissions();
  const { ask, dialog } = useAsk();

  /* ───── Data ───── */
  const { data: allTopics = [] } = useQuery({
    queryKey: ["lap-topics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_topics" as never).select("id, pillar, title, sort_order, this_lap_only_lap_id").is("retired_at", null).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Topic[];
    },
  });
  const { data: lap = null, isLoading: lapLoading, refetch: refetchLap } = useQuery({
    queryKey: ["lap-open"],
    queryFn: async () => {
      const { data, error } = await supabase.from("laps" as never).select("*").eq("status", "open").order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return (data as unknown as Lap | null) ?? null;
    },
  });
  const { data: finished = [] } = useQuery({
    queryKey: ["laps-finished"],
    queryFn: async () => {
      const { data, error } = await supabase.from("laps" as never).select("id, meeting_date, finished_at, stats").eq("status", "finished").order("meeting_date", { ascending: false }).limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; meeting_date: string; stats: Record<string, number> }[];
    },
  });
  const { data: managers = [] } = useQuery({
    queryKey: ["task-managers-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_managers").select("key, display_name, owner_name").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Manager[];
    },
  });
  const { data: commitments = [] } = useQuery({
    queryKey: ["lap-commitments", lap?.id],
    enabled: !!lap,
    queryFn: async () => {
      const { data, error } = await supabase.from("signals").select("id, title, status, source, lap_topic_id, lap_commitment_id, carry_count, planned_date" as never).eq("lap_id" as never, lap!.id).eq("is_archived", false).eq("is_trashed", false).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Commitment[];
    },
  });
  const { data: decisions = [] } = useQuery({
    queryKey: ["lap-decisions", lap?.id],
    enabled: !!lap,
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_decisions" as never).select("id, topic_id, text, created_at").eq("lap_id", lap!.id).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Decision[];
    },
  });

  // A lap left open for a week is not this week's lap.
  useEffect(() => {
    if (lap && daysSince(lap.started_at) > STALE_DAYS) {
      void supabase.from("laps" as never).update({ status: "incomplete" } as never).eq("id", lap.id).then(() => refetchLap());
    }
  }, [lap, refetchLap]);

  /* ───── Derived ───── */
  const topics = useMemo(() => allTopics.filter((t) => !t.this_lap_only_lap_id || t.this_lap_only_lap_id === lap?.id), [allTopics, lap?.id]);
  const order = useMemo(() => runningOrder(topics) as Topic[], [topics]);
  const cps = useMemo(() => checkpoints(order), [order]);
  const atFinish = !!lap?.stats?.at_finish;
  const currentIndex = lap && !atFinish ? order.findIndex((t) => t.id === lap.current_topic_id) : -1;
  const current = currentIndex >= 0 ? order[currentIndex] : null;
  const visited = useMemo(() => new Set<string>(lap?.stats?.visited ?? []), [lap]);
  const byCommitment = useMemo(() => {
    const m = new Map<string, Commitment[]>();
    for (const c of commitments) { const k = c.lap_commitment_id ?? c.id; (m.get(k) ?? m.set(k, []).get(k)!).push(c); }
    return m;
  }, [commitments]);
  const flags = useMemo(() => {
    const f: Record<string, number> = {};
    for (const rows of byCommitment.values()) { const t = rows[0].lap_topic_id; if (t) f[t] = (f[t] ?? 0) + 1; }
    return f;
  }, [byCommitment]);
  const streak = streakOf(finished.map((l) => l.meeting_date));
  const lastLap = finished[0] ?? null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lap-open"] });
    qc.invalidateQueries({ queryKey: ["lap-topics"] });
    qc.invalidateQueries({ queryKey: ["lap-commitments"] });
    qc.invalidateQueries({ queryKey: ["lap-decisions"] });
    qc.invalidateQueries({ queryKey: ["laps-finished"] });
    qc.invalidateQueries({ queryKey: ["task-manager-home-core"] });
  };

  /* ───── The lap itself ───── */
  const [busy, setBusy] = useState(false);
  const startLap = async () => {
    if (!order.length) { toast.error("There are no topics on the ring yet."); return; }
    setBusy(true);
    const { error } = await supabase.from("laps" as never).insert({ meeting_date: todayNY(), started_by: user?.id ?? null, current_topic_id: order[0].id, stats: { visited: [] } } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    fireConfetti([PILLAR_COLOR.operations, "#ffffff"]);
    invalidate();
  };
  const moveTo = async (toIndex: number) => {
    if (!lap) return;
    const leaving = current?.id;
    const nextVisited = Array.from(new Set([...(lap.stats?.visited ?? []), ...(leaving ? [leaving] : [])]));
    if (toIndex >= order.length) {
      const { error } = await supabase.from("laps" as never).update({ current_topic_id: null, stats: { ...lap.stats, visited: nextVisited, at_finish: true } } as never).eq("id", lap.id);
      if (error) { toast.error(error.message); return; }
      fireConfetti([PILLAR_COLOR.finance, "#ffffff"]);
    } else {
      const { error } = await supabase.from("laps" as never).update({ current_topic_id: order[Math.max(0, toIndex)].id, stats: { ...lap.stats, visited: nextVisited, at_finish: false } } as never).eq("id", lap.id);
      if (error) { toast.error(error.message); return; }
      const crossed = currentIndex >= 0 ? crossedPillar(order, currentIndex, toIndex) : null;
      if (crossed && toIndex > currentIndex) fireConfetti([PILLAR_COLOR[crossed], "#ffffff"]);
    }
    invalidate();
  };
  const finishLap = async () => {
    if (!lap) return;
    const byPillar: Record<Pillar, number> = { operations: 0, sales_marketing: 0, finance: 0 };
    for (const rows of byCommitment.values()) { const t = order.find((x) => x.id === rows[0].lap_topic_id); if (t) byPillar[t.pillar]++; }
    const stats = { ...lap.stats, at_finish: true, commitments: byCommitment.size, decisions: decisions.length, by_pillar: byPillar, topics: order.length };
    const { error } = await supabase.from("laps" as never).update({ status: "finished", finished_at: new Date().toISOString(), stats } as never).eq("id", lap.id);
    if (error) { toast.error(error.message); return; }
    fireConfetti([PILLAR_COLOR.operations, PILLAR_COLOR.sales_marketing, PILLAR_COLOR.finance, "#ffffff"], true);
    toast.success(`Lap finished — ${byCommitment.size} commitment${byCommitment.size === 1 ? "" : "s"}, ${decisions.length} decision${decisions.length === 1 ? "" : "s"}.`);
    invalidate();
  };
  const pauseLap = async () => {
    if (!lap) return;
    await supabase.from("laps" as never).update({ paused_at: new Date().toISOString() } as never).eq("id", lap.id);
    navigate("/admin");
  };

  /* ───── Commitments and decisions ───── */
  const [newTitle, setNewTitle] = useState("");
  const [owners, setOwners] = useState<Record<string, boolean>>({});
  const [onPlan, setOnPlan] = useState(false);
  useEffect(() => { if (managers.length && !Object.keys(owners).length) setOwners(Object.fromEntries(managers.map((m) => [m.key, m.key === "PD" || m.key === "PC"]))); }, [managers, owners]);
  const addCommitment = async () => {
    const title = newTitle.trim();
    const keys = managers.map((m) => m.key).filter((k) => owners[k]);
    if (!lap || !current || !title) return;
    if (!keys.length) { toast.error("Pick at least one owner."); return; }
    setBusy(true);
    const commitmentId = crypto.randomUUID();
    const rows = keys.map((k) => ({
      title, source: commitmentSourceFor(k), priority_layer: "Core", signal_type: "Action", status: "Pending", is_archived: false,
      lap_id: lap.id, lap_topic_id: current.id, lap_commitment_id: commitmentId, planned_date: onPlan ? todayNY() : null,
    }));
    const { error } = await supabase.from("signals").insert(rows as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setNewTitle(""); setOnPlan(false);
    invalidate();
  };
  const toggleDone = async (rows: Commitment[]) => {
    const done = rows.every((r) => r.status === "Complete");
    const { error } = await supabase.from("signals").update({ status: done ? "Pending" : "Complete", completed_at: done ? null : new Date().toISOString() } as never).eq("id", rows[0].id);
    if (error) { toast.error(error.message); return; }
    invalidate();
  };
  const [newDecision, setNewDecision] = useState("");
  const addDecision = async () => {
    const text = newDecision.trim();
    if (!lap || !text) return;
    const { error } = await supabase.from("lap_decisions" as never).insert({ lap_id: lap.id, topic_id: current?.id ?? null, text, created_by: user?.id ?? null } as never);
    if (error) { toast.error(error.message); return; }
    setNewDecision("");
    invalidate();
  };

  /* ───── Topics, edited from the lap ───── */
  const renameTopic = async (t: Topic) => {
    const r = await ask.prompt({ title: "Rename this topic", fields: [{ key: "title", label: "Topic", defaultValue: t.title }] });
    if (!r?.title.trim()) return;
    const { error } = await supabase.from("lap_topics" as never).update({ title: r.title.trim(), updated_at: new Date().toISOString() } as never).eq("id", t.id);
    if (error) toast.error(error.message); else invalidate();
  };
  const addTopicAfter = async (t: Topic, thisLapOnly: boolean) => {
    const r = await ask.prompt({ title: thisLapOnly ? "Add a topic for this lap only" : "Add a topic to every lap", body: `It goes right after ${t.title}, in ${PILLAR_LABEL[t.pillar]}.`, fields: [{ key: "title", label: "Topic" }] });
    if (!r?.title.trim() || !lap) return;
    // Make room after t inside its pillar.
    const after = allTopics.filter((x) => x.pillar === t.pillar && x.sort_order > t.sort_order);
    await Promise.all(after.map((x) => supabase.from("lap_topics" as never).update({ sort_order: x.sort_order + 1 } as never).eq("id", x.id)));
    const { error } = await supabase.from("lap_topics" as never).insert({ pillar: t.pillar, title: r.title.trim(), sort_order: t.sort_order + 1, this_lap_only_lap_id: thisLapOnly ? lap.id : null } as never);
    if (error) toast.error(error.message); else invalidate();
  };
  const retireTopic = async (t: Topic) => {
    const ok = await ask.confirm({ title: `Retire "${t.title}"?`, body: "It leaves the ring from now on. Its history and any open commitments are kept.", confirmLabel: "Retire", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("lap_topics" as never).update({ retired_at: new Date().toISOString() } as never).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    if (current?.id === t.id) await moveTo(currentIndex + 1 < order.length ? currentIndex + 1 : currentIndex - 1);
    invalidate();
  };
  const nudgeTopic = async (t: Topic, dir: -1 | 1) => {
    const mine = allTopics.filter((x) => x.pillar === t.pillar).sort((a, b) => a.sort_order - b.sort_order);
    const i = mine.findIndex((x) => x.id === t.id);
    const j = i + dir;
    if (j < 0 || j >= mine.length) return;
    const other = mine[j];
    await Promise.all([
      supabase.from("lap_topics" as never).update({ sort_order: other.sort_order } as never).eq("id", t.id),
      supabase.from("lap_topics" as never).update({ sort_order: t.sort_order } as never).eq("id", other.id),
    ]);
    invalidate();
  };

  /* ───── Fullscreen, for the wall ───── */
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  const [topicMenu, setTopicMenu] = useState(false);
  const currentRows = current ? [...byCommitment.values()].filter((rows) => rows[0].lap_topic_id === current.id) : [];
  const currentDecisions = current ? decisions.filter((d) => d.topic_id === current.id) : [];

  /* ───── Render ───── */
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin")} className="text-white/50 hover:text-white" aria-label="Back to the admin"><ArrowLeft className="w-5 h-5" /></button>
          <Flag className="w-5 h-5" style={{ color: NLA_RED }} />
          <div>
            <h1 className="font-black uppercase tracking-[0.18em] text-lg leading-tight">The Lap</h1>
            <p className="text-[11px] text-white/45">{lap ? `Meeting of ${new Date(`${lap.meeting_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}` : "The weekly agenda, around all of NLA"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && <span className="text-xs font-bold text-amber-300 inline-flex items-center gap-1"><Trophy className="w-4 h-4" /> {streak} lap{streak === 1 ? "" : "s"} in a row</span>}
          {lap && <Button size="sm" variant="outline" onClick={() => void pauseLap()} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><Pause className="w-4 h-4 mr-1.5" /> Pause</Button>}
          <button onClick={toggleFullscreen} className="text-white/50 hover:text-white p-1.5" aria-label="Fullscreen">{isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}</button>
        </div>
      </header>

      {lapLoading ? (
        <main className="flex-1 grid place-items-center text-white/50"><Loader2 className="w-6 h-6 animate-spin" /></main>
      ) : !lap ? (
        /* ───── Before the start line ───── */
        <main className="flex-1 grid lg:grid-cols-[1fr_1fr] gap-8 p-6 lg:p-10 items-center">
          <div className="max-w-[560px] mx-auto w-full"><LapRing topics={order} currentIndex={-1} visited={new Set()} flags={{}} /></div>
          <div className="space-y-5 max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">Start line</p>
            <h2 className="text-3xl font-black">One lap around NLA.</h2>
            <p className="text-white/60">
              {order.length} checkpoints: {order.filter((t) => t.pillar === "operations").length} in Operations, {order.filter((t) => t.pillar === "sales_marketing").length} in Sales & Marketing, {order.filter((t) => t.pillar === "finance").length} in Finance. The finish line is the Vision.
            </p>
            {lastLap && (
              <p className="text-sm text-white/50">
                Last lap: {new Date(`${lastLap.meeting_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                {lastLap.stats?.commitments != null && ` · ${lastLap.stats.commitments} commitment${lastLap.stats.commitments === 1 ? "" : "s"}`}
                {lastLap.stats?.decisions != null && ` · ${lastLap.stats.decisions} decision${lastLap.stats.decisions === 1 ? "" : "s"}`}
              </p>
            )}
            {isSuperAdmin ? (
              <Button size="lg" onClick={() => void startLap()} disabled={busy || !order.length} className="text-white text-base font-bold px-8" style={{ backgroundColor: NLA_RED }}>
                {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />} Start the lap
              </Button>
            ) : (
              <p className="text-sm text-amber-200/90">Waiting for Josh to start the lap.</p>
            )}
          </div>
        </main>
      ) : atFinish ? (
        /* ───── The finish line ───── */
        <main className="flex-1 grid lg:grid-cols-[1fr_1fr] gap-8 p-6 lg:p-10 items-center">
          <div className="max-w-[560px] mx-auto w-full"><LapRing topics={order} currentIndex={-1} visited={visited} flags={flags} finished /></div>
          <div className="space-y-5 max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">Finish line · the Vision</p>
            <p className="text-xl leading-relaxed text-white/90">{VISION_TEXT}</p>
            <p className="text-sm text-white/50">
              This lap: {byCommitment.size} commitment{byCommitment.size === 1 ? "" : "s"} · {decisions.length} decision{decisions.length === 1 ? "" : "s"} · {visited.size} of {order.length} checkpoints
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void moveTo(order.length - 1)} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><ChevronLeft className="w-4 h-4 mr-1" /> Back to the last checkpoint</Button>
              <Button size="lg" onClick={() => void finishLap()} className="text-white font-bold px-8" style={{ backgroundColor: NLA_RED }}><Sparkles className="w-5 h-5 mr-2" /> Finish the lap</Button>
            </div>
          </div>
        </main>
      ) : current ? (
        /* ───── A checkpoint ───── */
        <main className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 p-5 lg:p-8 items-start">
          <div className="max-w-[560px] mx-auto w-full">
            <LapRing topics={order} currentIndex={currentIndex} visited={visited} flags={flags} onPick={(cp) => void moveTo(cp.index)} />
            <div className="flex items-center justify-center gap-3 mt-2">
              <Button variant="outline" size="sm" disabled={currentIndex === 0} onClick={() => void moveTo(currentIndex - 1)} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><ChevronLeft className="w-4 h-4" /> Back</Button>
              <p className="text-xs text-white/45">Checkpoint {currentIndex + 1} of {order.length}</p>
              <Button size="sm" onClick={() => void moveTo(currentIndex + 1)} className="text-white font-bold" style={{ backgroundColor: PILLAR_COLOR[current.pillar] }}>
                {currentIndex + 1 >= order.length ? "To the finish line" : "Next checkpoint"} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {/* The topic */}
            <div className="rounded-2xl border p-5" style={{ borderColor: `${PILLAR_COLOR[current.pillar]}66`, background: `${PILLAR_COLOR[current.pillar]}10` }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: PILLAR_COLOR[current.pillar] }}>{PILLAR_LABEL[current.pillar]}</p>
                  <h2 className="text-2xl font-black mt-0.5">{current.title}</h2>
                </div>
                <div className="relative">
                  <button onClick={() => setTopicMenu((v) => !v)} className="text-white/40 hover:text-white p-1.5" aria-label="Topic options"><Settings2 className="w-5 h-5" /></button>
                  {topicMenu && (
                    <div className="absolute right-0 mt-1 w-64 rounded-xl border border-white/15 bg-neutral-900 shadow-2xl p-1 z-20 text-sm" onMouseLeave={() => setTopicMenu(false)}>
                      {[
                        { label: "Rename", run: () => renameTopic(current) },
                        { label: "Add a topic after this — every lap", run: () => addTopicAfter(current, false) },
                        { label: "Add a topic after this — this lap only", run: () => addTopicAfter(current, true) },
                        { label: "Move earlier in the pillar", run: () => nudgeTopic(current, -1) },
                        { label: "Move later in the pillar", run: () => nudgeTopic(current, 1) },
                        { label: "Retire this topic", run: () => retireTopic(current), danger: true },
                      ].map((o) => (
                        <button key={o.label} onClick={() => { setTopicMenu(false); void o.run(); }} className={`w-full text-left rounded-lg px-3 py-2 hover:bg-white/10 ${o.danger ? "text-red-300" : "text-white/85"}`}>{o.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Commitments at this checkpoint */}
            <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 space-y-3">
              <h3 className="font-bold text-sm uppercase tracking-wide text-white/60">Commitments</h3>
              {currentRows.length === 0 && <p className="text-sm text-white/35">None yet at this checkpoint.</p>}
              <ul className="space-y-2">
                {currentRows.map((rows) => {
                  const done = rows.every((r) => r.status === "Complete");
                  const names = rows.map((r) => { const m = managers.find((x) => x.key === managerKeyOf(r.source)); return m ? firstName(m) : managerKeyOf(r.source) ?? "?"; });
                  const tone = carryTone(Math.max(...rows.map((r) => r.carry_count)));
                  return (
                    <li key={rows[0].lap_commitment_id ?? rows[0].id} className="flex items-start gap-3">
                      <button onClick={() => void toggleDone(rows)} className={`mt-0.5 shrink-0 ${done ? "text-emerald-300" : "text-white/35 hover:text-white"}`} aria-label={done ? "Reopen" : "Mark done"}>{done ? <Check className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${done ? "line-through text-white/40" : TONE_CLASS[tone]}`}>{rows[0].title}</p>
                        <p className="text-[11px] text-white/40">{names.join(" & ")}{rows[0].carry_count > 0 && ` · carried ${rows[0].carry_count} lap${rows[0].carry_count === 1 ? "" : "s"}`}{rows.some((r) => r.planned_date === todayNY()) && " · on today's plan"}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="pt-2 border-t border-white/10 space-y-2">
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addCommitment(); }} placeholder="Add a commitment…" className="bg-neutral-950 border-neutral-800 text-white" />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {managers.map((m) => (
                    <label key={m.key} className="inline-flex items-center gap-1.5 text-white/70">
                      <input type="checkbox" checked={!!owners[m.key]} onChange={(e) => setOwners((o) => ({ ...o, [m.key]: e.target.checked }))} className="accent-[#bf0f3e]" /> {firstName(m)}
                    </label>
                  ))}
                  <label className="inline-flex items-center gap-1.5 text-white/50 ml-auto"><input type="checkbox" checked={onPlan} onChange={(e) => setOnPlan(e.target.checked)} className="accent-[#bf0f3e]" /> On today's plan</label>
                  <Button size="sm" onClick={() => void addCommitment()} disabled={busy || !newTitle.trim()} className="text-white" style={{ backgroundColor: NLA_RED }}>Add</Button>
                </div>
                <p className="text-[11px] text-white/35">Lands in each owner's Agenda Meeting tile. Done by either is done for both.</p>
              </div>
            </section>

            {/* Decisions */}
            <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 space-y-3">
              <h3 className="font-bold text-sm uppercase tracking-wide text-white/60">We decided</h3>
              {currentDecisions.length === 0 && <p className="text-sm text-white/35">Nothing recorded here yet.</p>}
              <ul className="space-y-1.5">{currentDecisions.map((d) => <li key={d.id} className="text-sm text-white/85">• {d.text}</li>)}</ul>
              <div className="flex gap-2">
                <Input value={newDecision} onChange={(e) => setNewDecision(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addDecision(); }} placeholder="One line — what we decided" className="bg-neutral-950 border-neutral-800 text-white" />
                <Button size="sm" variant="outline" onClick={() => void addDecision()} disabled={!newDecision.trim()} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">Record</Button>
              </div>
            </section>
          </div>
        </main>
      ) : (
        <main className="flex-1 grid place-items-center text-white/50 p-8 text-center">
          <div>
            <p>This lap's checkpoint is gone (the topic was retired).</p>
            <Button className="mt-3 text-white" style={{ backgroundColor: NLA_RED }} onClick={() => void moveTo(0)}>Back to the start line</Button>
          </div>
        </main>
      )}
      {dialog}
    </div>
  );
};

export default AdminTheLap;
