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
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useAsk } from "@/components/admin/AskDialog";
import LapChecklist from "@/components/lap/LapChecklist";
import { clearLapReturn, markLeavingLap } from "@/lib/lap/links";
import { todayNY } from "@/lib/programYear";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, Flag, Play, Pause, ChevronLeft, ChevronRight, Check, Circle, Maximize2, Minimize2, Settings2, Loader2, Trophy, Sparkles, Forward, Trash2, Split, MessageSquare, Plus, Target, X,
} from "lucide-react";
import { groupForWarmup, warmupGate, mustDecide, type WarmupGroup } from "@/lib/lap/warmup";
import { fetchTopicNumbers } from "@/lib/lap/numbers";
import { deleteLap } from "@/lib/lap/laps";
import LapRing from "@/components/lap/LapRing";
import WeeklyGoalDialog, { type WeeklyGoalSeed } from "@/components/lap/WeeklyGoalDialog";
import { dropGoal, carryGoalNow, archiveDoneGoalsBefore } from "@/lib/lap/goals";
import { runningOrder, checkpoints, crossedPillar, streak as streakOf, PILLAR_LABEL, PILLAR_ORDER, type RingTopic, type Pillar } from "@/lib/lap/ring";
import { PILLAR_COLOR, commitmentSourceFor, carryTone, type CarryTone } from "@/lib/lap/commitments";

const NLA_RED = "#bf0f3e";
const STALE_DAYS = 7;
const LAP_PATH = "https://www.nolimitsboxingacademy.org/admin/the-lap";

// The finish line. From the public Vision page; Josh can hand over his own words.
const VISION_TEXT =
  "No Limits Academy is a long-term model of development that produces lasting outcomes — young people who " +
  "graduate high school with a clear plan, the discipline to execute it, and a network of mentors and partners " +
  "ready to support them. A system that changes life trajectories — and breaks generational cycles, one young " +
  "person at a time.";

interface Topic extends RingTopic { sort_order: number; this_lap_only_lap_id: string | null }
interface Lap { id: string; meeting_date: string; status: "open" | "finished" | "incomplete"; started_at: string; current_topic_id: string | null; stats: { visited?: string[]; at_finish?: boolean } }
interface Manager { key: string; display_name: string; owner_name: string | null }
interface Commitment { id: string; title: string; status: string; source: string | null; lap_topic_id: string | null; lap_commitment_id: string | null; carry_count: number; planned_date: string | null; lap_checklist_item_id: string | null }
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
  useEffect(() => { clearLapReturn(); }, []);

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
  // The lap before this one, and its commitments, for the warm-up. Carried
  // commitments wait between laps with no lap at all.
  const { data: lastLap = null } = useQuery({
    queryKey: ["lap-last"],
    enabled: !lap,
    queryFn: async () => {
      const { data, error } = await supabase.from("laps" as never).select("id, meeting_date, status, stats").in("status", ["finished", "incomplete"]).order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return (data as unknown as { id: string; meeting_date: string; status: string; stats: Record<string, number> } | null) ?? null;
    },
  });
  const { data: warmupRows = [] } = useQuery({
    queryKey: ["lap-warmup", lastLap?.id ?? "none"],
    enabled: !lap,
    queryFn: async () => {
      let q = supabase.from("signals").select("id, title, status, source, lap_id, lap_topic_id, lap_commitment_id, carry_count, is_archived, lap_checklist_item_id" as never).not("lap_commitment_id" as never, "is", null).eq("is_trashed", false);
      q = lastLap ? q.or(`lap_id.eq.${lastLap.id},lap_id.is.null`) : q.is("lap_id" as never, null);
      const { data, error } = await q.order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Parameters<typeof groupForWarmup>[0];
    },
  });
  const warmup = useMemo(() => groupForWarmup(warmupRows, lastLap?.id ?? null), [warmupRows, lastLap?.id]);
  const gate = warmupGate(warmup);
  // One small burst for the commitments that got done, the first time the warm-up shows.
  const burstRef = useRef<string | null>(null);
  useEffect(() => {
    const key = lastLap?.id ?? null;
    if (lap || !key || burstRef.current === key) return;
    if (warmup.some((g) => g.state === "done")) { burstRef.current = key; fireConfetti(["#22c55e", "#ffffff"]); }
  }, [lap, lastLap?.id, warmup]);

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
      const { data, error } = await supabase.from("signals").select("id, title, status, source, lap_topic_id, lap_commitment_id, carry_count, planned_date, lap_checklist_item_id" as never).eq("lap_id" as never, lap!.id).eq("is_archived", false).eq("is_trashed", false).order("created_at");
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

  // The data comes to the checkpoint. Read-only, from the tables the
  // Intelligence pages use; refreshed when the runner moves.
  const { data: numbers = [] } = useQuery({
    queryKey: ["lap-numbers", lap?.current_topic_id ?? "none"],
    enabled: !!lap?.current_topic_id,
    queryFn: () => fetchTopicNumbers(allTopics.find((t) => t.id === lap!.current_topic_id)?.title ?? ""),
  });
  // The next two weeks — a heads-up only.
  // The window for "what moved on the message board": since the last lap
  // finished — or, when there has never been a lap, the last seven days.
  // The label says which, so a first lap never claims a "last lap".
  const { data: window = null } = useQuery({
    queryKey: ["lap-window", lastLap?.id ?? lap?.id ?? "none"],
    enabled: !!(lastLap || lap),
    queryFn: async () => {
      const { data } = await supabase.from("laps" as never).select("finished_at, started_at").in("status", ["finished", "incomplete"]).order("started_at", { ascending: false }).limit(1).maybeSingle();
      const row = data as unknown as { finished_at: string | null; started_at: string } | null;
      const since = row?.finished_at ?? row?.started_at;
      return since ? { since, label: "since the last lap" } : { since: new Date(Date.now() - 7 * 86_400_000).toISOString(), label: "in the last 7 days" };
    },
  });
  // What I archived on the message board stays off the Lap (Josh, 2026-10-19:
  // archived the whole board, the Lap still listed it). Archiving is per
  // person, so this is my list, not Chrissy's.
  const { data: myArchived = [] } = useQuery({
    queryKey: ["mb-my-archived", user?.id ?? "none"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("mb_conversation_members").select("conversation_id, archived_at" as never).eq("user_id", user!.id).not("archived_at" as never, "is", null);
      return ((data ?? []) as unknown as { conversation_id: string }[]).map((m) => m.conversation_id);
    },
  });
  /* What moved on the message board since the last lap — listed ONCE, at the
     start line, by pillar (Josh, 2026-10-19: the same conversations repeated
     at every checkpoint of a pillar). At a checkpoint, only what is pinned there. */
  const { data: boardStart = [] } = useQuery({
    queryKey: ["lap-board-start", window?.since ?? "none", myArchived.length],
    enabled: !lap && !!window,
    queryFn: async () => {
      const { data: msgs } = await supabase.from("mb_messages").select("conversation_id, created_at").gt("created_at", window!.since);
      const lastBy = new Map<string, string>();
      for (const m of (msgs ?? []) as { conversation_id: string; created_at: string }[]) if (!lastBy.has(m.conversation_id) || lastBy.get(m.conversation_id)! < m.created_at) lastBy.set(m.conversation_id, m.created_at);
      const archived = new Set(myArchived);
      const ids = [...lastBy.keys()].filter((id) => !archived.has(id));
      if (!ids.length) return [] as { id: string; name: string | null; pillar: Pillar; last: string }[];
      const { data: convs } = await supabase.from("mb_conversations").select("id, name, pillar" as never).in("id", ids);
      return ((convs ?? []) as unknown as { id: string; name: string | null; pillar: string | null }[])
        .filter((c): c is { id: string; name: string | null; pillar: Pillar } => !!c.pillar && (PILLAR_ORDER as string[]).includes(c.pillar))
        .map((c) => ({ ...c, last: lastBy.get(c.id)! }))
        .sort((a, b) => PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar) || b.last.localeCompare(a.last));
    },
  });
  // The conversations pinned to this checkpoint ("Pin to the Lap" on the
  // board), with the date of their last message in the window, if any.
  const { data: conversations = [] } = useQuery({
    queryKey: ["lap-conversations", lap?.id ?? "none", lap?.current_topic_id ?? "none", window?.since ?? "none", myArchived.length],
    enabled: !!lap?.current_topic_id && !!window,
    queryFn: async () => {
      const topic = allTopics.find((t) => t.id === lap!.current_topic_id);
      if (!topic) return [] as { id: string; name: string | null; pinned: boolean; last: string | null }[];
      const since = window!.since;
      const { data: convs } = await supabase.from("mb_conversations").select("id, name, pillar, lap_topic_id" as never).eq("pillar" as never, topic.pillar);
      const archived = new Set(myArchived);
      const list = ((convs ?? []) as unknown as { id: string; name: string | null; lap_topic_id: string | null }[]).filter((c) => !archived.has(c.id));
      const { data: msgs } = await supabase.from("mb_messages").select("conversation_id, created_at").gt("created_at", since).in("conversation_id", list.map((c) => c.id));
      const lastBy = new Map<string, string>();
      for (const m of (msgs ?? []) as { conversation_id: string; created_at: string }[]) if (!lastBy.has(m.conversation_id) || lastBy.get(m.conversation_id)! < m.created_at) lastBy.set(m.conversation_id, m.created_at);
      return list
        .map((c) => ({ id: c.id, name: c.name, pinned: c.lap_topic_id === topic.id, last: lastBy.get(c.id) ?? null }))
        .filter((c) => c.pinned)
        .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lap-open"] });
    qc.invalidateQueries({ queryKey: ["lap-topics"] });
    qc.invalidateQueries({ queryKey: ["lap-commitments"] });
    qc.invalidateQueries({ queryKey: ["lap-line-goals"] });
    qc.invalidateQueries({ queryKey: ["lap-checklist-ticks"] });
    qc.invalidateQueries({ queryKey: ["lap-decisions"] });
    qc.invalidateQueries({ queryKey: ["laps-finished"] });
    qc.invalidateQueries({ queryKey: ["task-manager-home-core"] });
  };

  /* ───── The lap itself ───── */
  const [busy, setBusy] = useState(false);
  const startLap = async () => {
    if (!order.length) { toast.error("There are no topics on the ring yet."); return; }
    setBusy(true);
    const { data: created, error } = await supabase.from("laps" as never).insert({ meeting_date: todayNY(), started_by: user?.id ?? null, current_topic_id: order[0].id, stats: { visited: [] } } as never).select("id").single();
    if (error || !created) { setBusy(false); toast.error(error?.message ?? "Couldn't start the Lap."); return; }
    // Commitments carried from the last lap join this one at their checkpoint.
    const newId = (created as unknown as { id: string }).id;
    await supabase.from("signals").update({ lap_id: newId } as never).is("lap_id" as never, null).not("lap_commitment_id" as never, "is", null).eq("is_archived", false).eq("is_trashed", false).neq("status", "Complete");
    // Last week's done goals have been reviewed in the warm-up: off the tiles they go.
    const cleared = await archiveDoneGoalsBefore(newId);
    if (cleared) toast.error(`Last week's done goals stayed on the tiles: ${cleared}`);
    setBusy(false);
    fireConfetti([PILLAR_COLOR.operations, "#ffffff"]);
    qc.invalidateQueries({ queryKey: ["lap-last"] });
    qc.invalidateQueries({ queryKey: ["lap-warmup"] });
    invalidate();
  };
  // Arrow keys move the lap on the big screen: → next checkpoint, ← back.
  // Not while typing, and not while a window is open.
  useEffect(() => {
    if (!lap || currentIndex < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      e.preventDefault();
      if (e.key === "ArrowRight") void moveTo(currentIndex + 1);
      else if (currentIndex > 0) void moveTo(currentIndex - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
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
    toast.success(`Lap finished — ${byCommitment.size} weekly goal${byCommitment.size === 1 ? "" : "s"}, ${decisions.length} decision${decisions.length === 1 ? "" : "s"}.`);
    await postSummary();
    invalidate();
  };
  /** The lap's record, posted to the "Agenda Meeting" conversation — what Chrissy reads on her phone that night. */
  const postSummary = async () => {
    if (!lap || !user) return;
    const { data: conv } = await supabase.from("mb_conversations").select("id").eq("name", "Agenda Meeting").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const convId = (conv as unknown as { id: string } | null)?.id;
    if (!convId) return;
    const date = new Date(`${lap.meeting_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const lines: string[] = [`🏁 The Lap — ${date}`, `${visited.size} of ${order.length} checkpoints · ${byCommitment.size} weekly goal${byCommitment.size === 1 ? "" : "s"} · ${decisions.length} decision${decisions.length === 1 ? "" : "s"}`];
    const byOwner = new Map<string, string[]>();
    for (const rows of byCommitment.values()) {
      const topic = order.find((t) => t.id === rows[0].lap_topic_id)?.title;
      const names = rows.map((r) => { const m = managers.find((x) => x.key === managerKeyOf(r.source)); return m ? firstName(m) : "?"; }).join(" & ");
      const carried = rows[0].carry_count > 0 ? ` (carried ${rows[0].carry_count})` : "";
      (byOwner.get(names) ?? byOwner.set(names, []).get(names)!).push(`• ${rows[0].title}${topic ? ` — ${topic}` : ""}${carried}`);
    }
    for (const [names, items] of byOwner) lines.push("", `${names}:`, ...items);
    if (decisions.length) lines.push("", "We decided:", ...decisions.map((d) => { const t = order.find((x) => x.id === d.topic_id)?.title; return `• ${d.text}${t ? ` — ${t}` : ""}`; }));
    lines.push("", LAP_PATH);
    const { error } = await supabase.from("mb_messages").insert({ conversation_id: convId, sender_id: user.id, content: lines.join("\n") } as never);
    if (error) toast.error(`The lap finished, but the summary didn't post to the message board: ${error.message}`);
  };

  /** Start this week over: the open lap goes, with the commitments made in it; carried-in ones go back to waiting. */
  const startOver = async () => {
    if (!lap) return;
    const made = [...byCommitment.values()].filter((rows) => rows[0].carry_count === 0).length;
    const ok = await ask.confirm({
      title: "Start this week over?",
      body: `This lap is thrown away${made ? `, along with the ${made} weekly goal${made === 1 ? "" : "s"} made in it` : ""}${decisions.length ? ` and its ${decisions.length} decision${decisions.length === 1 ? "" : "s"}` : ""}. Anything carried in from last lap goes back to waiting. You can start a fresh lap right after.`,
      confirmLabel: "Start over",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteLap(lap.id);
      toast.success("This week's lap is cleared. Start a fresh one when you're ready.");
      qc.invalidateQueries({ queryKey: ["lap-last"] });
      qc.invalidateQueries({ queryKey: ["lap-warmup"] });
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const pauseLap = async () => {
    if (!lap) return;
    await supabase.from("laps" as never).update({ paused_at: new Date().toISOString() } as never).eq("id", lap.id);
    navigate("/admin");
  };

  /* ───── Weekly goals and decisions ─────
     A weekly goal (Josh, 2026-10-19: "weekly goal", never "commitment") is
     made in one themed window (WeeklyGoalDialog), opened from the + on any
     checklist line or from the gold box at the checkpoint. The line's words
     are prefilled; the topic starts as this checkpoint and can be changed. */
  const [goal, setGoal] = useState<WeeklyGoalSeed | null>(null);
  const openGoal = (title = "", itemId?: string) => { if (current) setGoal({ title, topicId: current.id, itemId }); };
  /* Mid-week moves on a goal (Josh, 2026-10-19): carry it to next week now,
     or drop it with a reason. The warm-up still rules on whatever is left. */
  const carryNow = async (rows: Commitment[]) => {
    const id = rows[0].lap_commitment_id; if (!id) return;
    const ok = await ask.confirm({ title: `Move "${rows[0].title}" to next week?`, body: "It leaves this lap and waits at the start line of the next one, counted as carried once more.", confirmLabel: "Next week" });
    if (!ok) return;
    const err = await carryGoalNow(id);
    if (err) { toast.error(err); return; }
    toast.success("Moved to next week.");
    invalidate();
  };
  const dropNow = async (rows: Commitment[]) => {
    const id = rows[0].lap_commitment_id; if (!id) return;
    const r = await ask.prompt({ title: `Drop "${rows[0].title}"?`, body: "It leaves every owner's tile.", fields: [{ key: "reason", label: "Why", placeholder: "Optional, for the lap history", required: false }], confirmLabel: "Drop" });
    if (!r) return;
    const reason = r.reason.trim() || "Dropped";
    const err = await dropGoal(id, reason);
    if (err) { toast.error(err); return; }
    toast.success("Dropped.");
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

  /* ───── The warm-up: last lap's open weekly goals ───── */
  const refreshWarmup = () => { qc.invalidateQueries({ queryKey: ["lap-warmup"] }); qc.invalidateQueries({ queryKey: ["task-manager-home-core"] }); };
  const carryForward = async (g: WarmupGroup) => {
    for (const r of g.rows) {
      const { error } = await supabase.from("signals").update({ lap_id: null, carry_count: r.carry_count + 1 } as never).eq("id", r.id);
      if (error) { toast.error(error.message); return; }
    }
    refreshWarmup();
  };
  const dropCommitment = async (g: WarmupGroup, presetReason?: string) => {
    let reason = presetReason;
    if (!reason) {
      const r = await ask.prompt({ title: `Drop "${g.title}"?`, body: "It leaves the Workbench.", fields: [{ key: "reason", label: "Why", placeholder: "Optional, for the lap history", required: false }], confirmLabel: "Drop" });
      if (!r) return;
      reason = r.reason.trim() || "Dropped";
    }
    const { error } = await supabase.from("signals").update({ dropped_reason: reason, is_archived: true, archived_at: new Date().toISOString() } as never).in("id", g.rows.map((r) => r.id));
    if (error) { toast.error(error.message); return; }
    refreshWarmup();
  };
  const splitCommitment = async (g: WarmupGroup) => {
    const r = await ask.prompt({ title: `Split "${g.title}"`, body: "Something smaller that can actually get done this week. The old one is dropped.", fields: [{ key: "title", label: "The smaller commitment" }], confirmLabel: "Split" });
    const title = r?.title?.trim();
    if (!title) return;
    const commitmentId = crypto.randomUUID();
    const rows = g.rows.map((old) => ({ title, source: old.source, priority_layer: "Core", signal_type: "Action", status: "Pending", is_archived: false, lap_id: null, lap_topic_id: old.lap_topic_id, lap_checklist_item_id: old.lap_checklist_item_id ?? null, lap_commitment_id: commitmentId, carried_from_signal_id: old.id }));
    const { error } = await supabase.from("signals").insert(rows as never);
    if (error) { toast.error(error.message); return; }
    await dropCommitment(g, `Split into: ${title}`);
  };
  const handTo = async (g: WarmupGroup, managerKey: string) => {
    const m = managers.find((x) => x.key === managerKey);
    if (!m) return;
    const old = g.rows[0];
    const { error } = await supabase.from("signals").insert({ title: g.title, source: commitmentSourceFor(managerKey), priority_layer: "Core", signal_type: "Action", status: "Pending", is_archived: false, lap_id: null, lap_topic_id: old.lap_topic_id, lap_checklist_item_id: old.lap_checklist_item_id ?? null, lap_commitment_id: crypto.randomUUID(), carried_from_signal_id: old.id } as never);
    if (error) { toast.error(error.message); return; }
    await dropCommitment(g, `Handed to ${firstName(m)}`);
  };
  const ownerNames = (g: WarmupGroup) => g.rows.map((r) => { const m = managers.find((x) => x.key === managerKeyOf(r.source)); return m ? firstName(m) : "?"; }).join(" & ");
  const topicTitle = (id: string | null) => allTopics.find((t) => t.id === id)?.title ?? "a retired topic";

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
    const ok = await ask.confirm({ title: `Retire "${t.title}"?`, body: "It leaves the ring from now on. Its history and any open weekly goals are kept.", confirmLabel: "Retire", danger: true });
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
          <Button size="sm" variant="outline" onClick={() => navigate("/admin/the-lap/history")} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">Past laps</Button>
          {lap && <Button size="sm" variant="outline" onClick={() => void pauseLap()} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><Pause className="w-4 h-4 mr-1.5" /> Pause</Button>}
          {lap && isSuperAdmin && <Button size="sm" variant="outline" onClick={() => void startOver()} className="bg-transparent border-white/20 text-red-300 hover:bg-red-500/10 hover:text-red-200">Start this week over</Button>}
          <button onClick={toggleFullscreen} className="text-white/50 hover:text-white p-1.5" aria-label="Fullscreen">{isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}</button>
        </div>
      </header>

      {lapLoading ? (
        <main className="flex-1 grid place-items-center text-white/50"><Loader2 className="w-6 h-6 animate-spin" /></main>
      ) : !lap ? (
        /* ───── Before the start line ───── */
        <main className="flex-1 grid lg:grid-cols-[1fr_1fr] gap-8 p-6 lg:p-10 items-center">
          <div className="max-w-[880px] mx-auto w-full"><LapRing topics={order} currentIndex={-1} visited={new Set()} flags={{}} /></div>
          <div className="space-y-5 max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">Start line</p>
            <h2 className="text-3xl font-black">One lap around NLA.</h2>
            <p className="text-white/60">
              {order.length} checkpoints: {order.filter((t) => t.pillar === "operations").length} in Operations, {order.filter((t) => t.pillar === "sales_marketing").length} in Sales & Marketing, {order.filter((t) => t.pillar === "finance").length} in Finance. The finish line is the Vision.
            </p>


            {lastLap && (
              <p className="text-sm text-white/50">
                Last lap: {new Date(`${lastLap.meeting_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                {lastLap.status === "incomplete" && " · not finished"}
                {lastLap.stats?.commitments != null && ` · ${lastLap.stats.commitments} weekly goal${lastLap.stats.commitments === 1 ? "" : "s"}`}
                {lastLap.stats?.decisions != null && ` · ${lastLap.stats.decisions} decision${lastLap.stats.decisions === 1 ? "" : "s"}`}
              </p>
            )}

            {/* The warm-up: every weekly goal from last lap, touched before the start. */}
            {warmup.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm uppercase tracking-wide text-white/60">Warm-up · last lap's weekly goals</h3>
                  <span className={`text-[11px] font-bold ${gate.ready ? "text-emerald-300" : "text-amber-300"}`}>{gate.ready ? "All reviewed" : `${gate.open} to review`}</span>
                </div>
                <ul className="space-y-2">
                  {warmup.map((g) => {
                    const tone = carryTone(g.carryCount);
                    const decide = g.state === "open" && mustDecide(g.carryCount);
                    return (
                      <li key={g.key} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
                        <div className="flex items-start gap-3">
                          <span className={`mt-0.5 shrink-0 ${g.state === "done" ? "text-emerald-300" : g.state === "carried" ? "text-sky-300" : "text-white/35"}`}>
                            {g.state === "done" ? <Check className="w-5 h-5" /> : g.state === "carried" ? <Forward className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${g.state === "done" ? "line-through text-white/45" : TONE_CLASS[tone]}`}>{g.title}</p>
                            <p className="text-[11px] text-white/40">
                              {ownerNames(g)} · {topicTitle(g.topicId)}
                              {g.carryCount > 0 && ` · carried ${g.carryCount} lap${g.carryCount === 1 ? "" : "s"}`}
                              {g.state === "carried" && " · waits at its checkpoint"}
                            </p>
                            {decide && <p className="text-[11px] text-red-300 mt-0.5">Carried three laps. No more carrying — split it, hand it on, or drop it.</p>}
                          </div>
                          {g.state === "open" && (
                            <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                              {!decide && (
                                <Button size="sm" variant="outline" onClick={() => void carryForward(g)} className="h-8 bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><Forward className="w-3.5 h-3.5 mr-1" /> Carry forward</Button>
                              )}
                              {decide && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => void splitCommitment(g)} className="h-8 bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><Split className="w-3.5 h-3.5 mr-1" /> Split</Button>
                                  {managers.filter((m) => !g.rows.some((r) => managerKeyOf(r.source) === m.key)).map((m) => (
                                    <Button key={m.key} size="sm" variant="outline" onClick={() => void handTo(g, m.key)} className="h-8 bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">→ {firstName(m)}</Button>
                                  ))}
                                </>
                              )}
                              <Button size="sm" variant="outline" onClick={() => void dropCommitment(g)} className="h-8 bg-transparent border-white/20 text-red-300 hover:bg-red-500/10 hover:text-red-200"><Trash2 className="w-3.5 h-3.5 mr-1" /> Drop</Button>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* The message board, once: everything that moved since the last lap, by pillar. */}
            {boardStart.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm uppercase tracking-wide text-white/60">On the message board · {window?.label ?? "recently"}</h3>
                  <span className="text-[11px] text-white/40">{boardStart.length} conversation{boardStart.length === 1 ? "" : "s"}</span>
                </div>
                {PILLAR_ORDER.filter((p) => boardStart.some((c) => c.pillar === p)).map((p) => (
                  <div key={p}>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: PILLAR_COLOR[p] }}>{PILLAR_LABEL[p]}</p>
                    <ul className="space-y-1">
                      {boardStart.filter((c) => c.pillar === p).map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => { markLeavingLap(); navigate(`/admin/message-board?conv=${c.id}`); }} className="w-full text-left text-sm text-white/85 hover:text-white inline-flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 shrink-0" style={{ color: PILLAR_COLOR[p] }} />
                            <span className="truncate">{c.name ?? "Untitled conversation"}</span>
                            <span className="text-[11px] text-white/40 shrink-0 ml-auto">{new Date(c.last).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            {isSuperAdmin ? (
              <div className="space-y-2">
                <Button size="lg" onClick={() => void startLap()} disabled={busy || !order.length || !gate.ready} className="text-white text-base font-bold px-8" style={{ backgroundColor: NLA_RED }}>
                  {busy ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />} Start the Lap
                </Button>
                {!gate.ready && <p className="text-[12px] text-amber-300/90">Carry forward or drop the {gate.open} open weekly goal{gate.open === 1 ? "" : "s"} from last lap to unlock the start.</p>}
              </div>
            ) : (
              <p className="text-sm text-amber-200/90">Waiting for Josh to start the Lap.</p>
            )}
          </div>
        </main>
      ) : atFinish ? (
        /* ───── The finish line ───── */
        <main className="flex-1 grid lg:grid-cols-[1fr_1fr] gap-8 p-6 lg:p-10 items-center">
          <div className="max-w-[880px] mx-auto w-full"><LapRing topics={order} currentIndex={-1} visited={visited} flags={flags} finished /></div>
          <div className="space-y-5 max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">Finish line · the Vision</p>
            <p className="text-xl leading-relaxed text-white/90">{VISION_TEXT}</p>
            <p className="text-sm text-white/50">
              This lap: {byCommitment.size} weekly goal{byCommitment.size === 1 ? "" : "s"} · {decisions.length} decision{decisions.length === 1 ? "" : "s"} · {visited.size} of {order.length} checkpoints
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void moveTo(order.length - 1)} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><ChevronLeft className="w-4 h-4 mr-1" /> Back to the last checkpoint</Button>
              <Button size="lg" onClick={() => void finishLap()} className="text-white font-bold px-8" style={{ backgroundColor: NLA_RED }}><Sparkles className="w-5 h-5 mr-2" /> Finish the Lap</Button>
            </div>
          </div>
        </main>
      ) : current ? (
        /* ───── A checkpoint ───── */
        <main className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6 p-5 lg:p-8 items-start">
          <div className="max-w-[880px] mx-auto w-full">
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

            {/* The standing checklist: what we look at every week here. */}
            <LapChecklist lapId={lap.id} topicId={current.id} ask={ask} onMakeGoal={openGoal} onAllReviewed={() => void moveTo(currentIndex + 1)} />

            {/* The numbers for this topic, this week against last. */}
            {numbers.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
                <h3 className="font-bold text-sm uppercase tracking-wide text-white/60 mb-3">The numbers</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {numbers.map((st) => (
                    <div key={st.label} className="rounded-xl bg-white/[0.04] px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-white/40">{st.label}</p>
                      <p className="text-xl font-black leading-tight mt-0.5">{st.value}</p>
                      {(st.prev || st.note) && <p className="text-[11px] text-white/45 mt-0.5">{st.prev ?? st.note}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Conversations pinned to this checkpoint. */}
            {conversations.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 space-y-2">
                <h3 className="font-bold text-sm uppercase tracking-wide text-white/60">Pinned here from the message board</h3>
                <ul className="space-y-1.5">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => { markLeavingLap(); navigate(`/admin/message-board?conv=${c.id}`); }} className="w-full text-left text-sm text-white/85 hover:text-white inline-flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 shrink-0" style={{ color: PILLAR_COLOR[current.pillar] }} />
                        <span className="truncate">{c.name ?? "Untitled conversation"}</span>
                        {c.last && <span className="text-[11px] text-white/40 shrink-0 ml-auto">{new Date(c.last).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Weekly goals at this checkpoint — gold, their own colour, so
                they pop against the checklist and the board (Josh, 2026-10-19). */}
            <section className="rounded-2xl border border-amber-400/40 bg-amber-400/[0.05] p-5 space-y-3">
              <h3 className="font-bold text-sm uppercase tracking-wide text-amber-300 inline-flex items-center gap-2"><Target className="w-4 h-4" /> Weekly goals</h3>
              {currentRows.length === 0 && <p className="text-sm text-white/35">None yet at this checkpoint.</p>}
              <ul className="space-y-2">
                {currentRows.map((rows) => {
                  const done = rows.every((r) => r.status === "Complete");
                  const names = rows.map((r) => { const m = managers.find((x) => x.key === managerKeyOf(r.source)); return m ? firstName(m) : managerKeyOf(r.source) ?? "?"; });
                  const tone = carryTone(Math.max(...rows.map((r) => r.carry_count)));
                  return (
                    <li key={rows[0].lap_commitment_id ?? rows[0].id} className="group flex items-start gap-3 rounded-lg -mx-1 px-1 hover:bg-amber-400/[0.06]">
                      <button onClick={() => void toggleDone(rows)} className={`mt-0.5 shrink-0 ${done ? "text-amber-300" : "text-amber-300/40 hover:text-amber-300"}`} aria-label={done ? "Reopen" : "Mark done"}>{done ? <Check className="w-5 h-5" /> : <Circle className="w-5 h-5" />}</button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${done ? "line-through text-white/40" : TONE_CLASS[tone]}`}>{rows[0].title}</p>
                        <p className="text-[11px] text-white/40">{names.join(" & ")}{rows[0].carry_count > 0 && ` · carried ${rows[0].carry_count} lap${rows[0].carry_count === 1 ? "" : "s"}`}{rows.some((r) => r.planned_date === todayNY()) && " · on today's plan"}</p>
                      </div>
                      {!done && (
                        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button onClick={() => void carryNow(rows)} title="Move to next week" aria-label="Move to next week" className="p-1 rounded text-white/50 hover:text-amber-300 hover:bg-amber-400/10"><Forward className="w-4 h-4" /></button>
                          <button onClick={() => void dropNow(rows)} title="Drop this goal" aria-label="Drop this goal" className="p-1 rounded text-white/50 hover:text-red-300 hover:bg-red-500/10"><X className="w-4 h-4" /></button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="pt-2 border-t border-amber-400/20 flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={() => openGoal()} className="text-white" style={{ backgroundColor: NLA_RED }}><Plus className="w-4 h-4 mr-1.5" /> Add a weekly goal</Button>
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
      <WeeklyGoalDialog open={!!goal} seed={goal} onClose={() => setGoal(null)} onSaved={invalidate} />
    </div>
  );
};

export default AdminTheLap;
