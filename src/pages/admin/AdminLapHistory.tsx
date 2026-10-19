// The Lap — history (docs/LAP_PLAN.md, step 6). Every lap by date, and
// each one's record: the commitments made, by owner, with what became of
// them; the decisions; what was carried in and what was dropped. Printable:
// the week's meeting record on one page.
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { useAsk } from "@/components/admin/AskDialog";
import { deleteLap } from "@/lib/lap/laps";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Check, Circle, Forward, Trash2, Flag, Trophy } from "lucide-react";
import { PILLAR_LABEL, streak as streakOf, type Pillar } from "@/lib/lap/ring";
import { PILLAR_COLOR } from "@/lib/lap/commitments";

interface Lap { id: string; meeting_date: string; status: string; started_at: string; finished_at: string | null; stats: { visited?: string[]; commitments?: number; decisions?: number; by_pillar?: Record<Pillar, number>; topics?: number } }
interface Topic { id: string; pillar: Pillar; title: string }
interface Row { id: string; title: string; status: string; source: string | null; lap_topic_id: string | null; lap_commitment_id: string | null; carry_count: number; is_archived: boolean; dropped_reason: string | null }
interface Decision { id: string; topic_id: string | null; text: string }
interface Manager { key: string; display_name: string; owner_name: string | null }

const managerKeyOf = (source: string | null) => (!source ? null : source.includes(":") ? source.split(":")[0] : "PD");
const firstName = (m: Manager) => (m.owner_name ?? m.display_name).split(/[\s:]/)[0];
const longDate = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

const AdminLapHistory = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isSuperAdmin } = useStaffPermissions();
  const { ask, dialog } = useAsk();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("lap");

  const { data: laps = [] } = useQuery({
    queryKey: ["laps-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("laps" as never).select("id, meeting_date, status, started_at, finished_at, stats").in("status", ["finished", "incomplete"]).order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Lap[];
    },
  });
  const { data: topics = [] } = useQuery({
    queryKey: ["lap-topics-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_topics" as never).select("id, pillar, title");
      if (error) throw error;
      return (data ?? []) as unknown as Topic[];
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
  const lap = useMemo(() => laps.find((l) => l.id === selectedId) ?? laps[0] ?? null, [laps, selectedId]);
  const { data: rows = [] } = useQuery({
    queryKey: ["lap-history-rows", lap?.id],
    enabled: !!lap,
    queryFn: async () => {
      const { data, error } = await supabase.from("signals").select("id, title, status, source, lap_topic_id, lap_commitment_id, carry_count, is_archived, dropped_reason" as never).eq("lap_id" as never, lap!.id).eq("is_trashed", false).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });
  const { data: decisions = [] } = useQuery({
    queryKey: ["lap-history-decisions", lap?.id],
    enabled: !!lap,
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_decisions" as never).select("id, topic_id, text").eq("lap_id", lap!.id).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Decision[];
    },
  });

  const topicOf = (id: string | null) => topics.find((t) => t.id === id);
  const nameOf = (source: string | null) => { const m = managers.find((x) => x.key === managerKeyOf(source)); return m ? firstName(m) : "?"; };
  const groups = useMemo(() => {
    const by = new Map<string, Row[]>();
    for (const r of rows) { const k = r.lap_commitment_id ?? r.id; (by.get(k) ?? by.set(k, []).get(k)!).push(r); }
    return [...by.values()].map((g) => ({
      key: g[0].lap_commitment_id ?? g[0].id,
      title: g[0].title,
      owners: g.map((r) => nameOf(r.source)).join(" & "),
      topic: topicOf(g[0].lap_topic_id),
      carried: Math.max(...g.map((r) => r.carry_count)),
      dropped: g[0].dropped_reason,
      done: g.every((r) => r.status === "Complete"),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, topics, managers]);
  const byPillar = (p: Pillar) => groups.filter((g) => g.topic?.pillar === p);
  const streak = streakOf(laps.filter((l) => l.status === "finished").map((l) => l.meeting_date));
  /** A test lap, or one that should never have been: gone, with the commitments made in it. Super Admin only. */
  const removeLap = async () => {
    if (!lap) return;
    const made = groups.filter((g) => g.carried === 0).length;
    const ok = await ask.confirm({
      title: `Delete the lap of ${longDate(lap.meeting_date)}?`,
      body: `It leaves the history${made ? `, along with the ${made} commitment${made === 1 ? "" : "s"} made in it` : ""}${decisions.length ? ` and its ${decisions.length} decision${decisions.length === 1 ? "" : "s"}` : ""}. Commitments carried into it go back to waiting. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteLap(lap.id);
      toast.success("Lap deleted.");
      setParams({});
      qc.invalidateQueries({ queryKey: ["laps-history"] });
      qc.invalidateQueries({ queryKey: ["laps-finished"] });
      qc.invalidateQueries({ queryKey: ["lap-last"] });
      qc.invalidateQueries({ queryKey: ["lap-warmup"] });
      qc.invalidateQueries({ queryKey: ["task-manager-home-core"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const [printing, setPrinting] = useState(false);
  const print = () => { setPrinting(true); setTimeout(() => { window.print(); setPrinting(false); }, 50); };

  return (
    <div className="min-h-screen bg-black text-white print:bg-white print:text-black">
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-white/10 print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/admin/the-lap")} className="text-white/50 hover:text-white" aria-label="Back to the Lap"><ArrowLeft className="w-5 h-5" /></button>
          <Flag className="w-5 h-5" style={{ color: "#bf0f3e" }} />
          <div>
            <h1 className="font-black uppercase tracking-[0.18em] text-lg leading-tight">Lap history</h1>
            <p className="text-[11px] text-white/45">Every lap, and what each one committed to.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && <span className="text-xs font-bold text-amber-300 inline-flex items-center gap-1"><Trophy className="w-4 h-4" /> {streak} in a row</span>}
          {lap && <Button size="sm" variant="outline" onClick={print} disabled={printing} className="bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white"><Printer className="w-4 h-4 mr-1.5" /> Print this lap</Button>}
          {lap && isSuperAdmin && <Button size="sm" variant="outline" onClick={() => void removeLap()} className="bg-transparent border-white/20 text-red-300 hover:bg-red-500/10 hover:text-red-200"><Trash2 className="w-4 h-4 mr-1.5" /> Delete this lap</Button>}
        </div>
      </header>

      <main className="grid lg:grid-cols-[280px_1fr] gap-6 p-5 lg:p-8 print:block print:p-0">
        {/* The laps, newest first. */}
        <aside className="space-y-1 print:hidden">
          {laps.length === 0 && <p className="text-sm text-white/40">No laps yet.</p>}
          {laps.map((l) => {
            const on = lap?.id === l.id;
            return (
              <button key={l.id} type="button" onClick={() => setParams({ lap: l.id })} className={`w-full text-left rounded-xl px-3 py-2.5 border ${on ? "border-white/30 bg-white/10" : "border-white/10 hover:bg-white/[0.05]"}`}>
                <p className="text-sm font-semibold">{new Date(`${l.meeting_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
                <p className="text-[11px] text-white/45">
                  {l.status === "incomplete" ? "not finished" : `${l.stats?.commitments ?? 0} commitment${(l.stats?.commitments ?? 0) === 1 ? "" : "s"} · ${l.stats?.decisions ?? 0} decision${(l.stats?.decisions ?? 0) === 1 ? "" : "s"}`}
                </p>
              </button>
            );
          })}
        </aside>

        {/* The record. */}
        {lap && (
          <article className="space-y-6 max-w-3xl print:max-w-none">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 print:text-neutral-500">The Lap · No Limits Academy</p>
              <h2 className="text-2xl font-black mt-0.5">{longDate(lap.meeting_date)}</h2>
              <p className="text-sm text-white/55 print:text-neutral-600 mt-1">
                {lap.status === "incomplete" ? "Not finished. " : ""}
                {(lap.stats?.visited?.length ?? 0)} of {lap.stats?.topics ?? topics.length} checkpoints · {groups.length} commitment{groups.length === 1 ? "" : "s"} · {decisions.length} decision{decisions.length === 1 ? "" : "s"}
                {lap.finished_at && ` · finished ${new Date(lap.finished_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
              </p>
            </div>

            {(["operations", "sales_marketing", "finance"] as Pillar[]).map((p) => {
              const mine = byPillar(p);
              const dec = decisions.filter((d) => topicOf(d.topic_id)?.pillar === p);
              if (!mine.length && !dec.length) return null;
              return (
                <section key={p} className="rounded-2xl border p-5 print:border-neutral-300 print:rounded-none print:break-inside-avoid" style={{ borderColor: `${PILLAR_COLOR[p]}66` }}>
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: PILLAR_COLOR[p] }}>{PILLAR_LABEL[p]}</h3>
                  {mine.length > 0 && (
                    <ul className="space-y-2">
                      {mine.map((g) => (
                        <li key={g.key} className="flex items-start gap-3">
                          <span className={`mt-0.5 shrink-0 ${g.dropped ? "text-red-300" : g.done ? "text-emerald-300" : g.carried ? "text-sky-300" : "text-white/35 print:text-neutral-400"}`}>
                            {g.dropped ? <Trash2 className="w-4 h-4" /> : g.done ? <Check className="w-4 h-4" /> : g.carried ? <Forward className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                          </span>
                          <div className="min-w-0">
                            <p className={`text-sm ${g.dropped ? "line-through text-white/45 print:text-neutral-500" : ""}`}>{g.title}</p>
                            <p className="text-[11px] text-white/45 print:text-neutral-500">
                              {g.owners}{g.topic && ` · ${g.topic.title}`}{g.carried > 0 && ` · carried ${g.carried} lap${g.carried === 1 ? "" : "s"}`}{g.dropped && ` · dropped: ${g.dropped}`}{!g.dropped && (g.done ? " · done" : " · open")}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {dec.length > 0 && (
                    <div className={mine.length ? "mt-4 pt-3 border-t border-white/10 print:border-neutral-200" : ""}>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-white/50 print:text-neutral-500 mb-1">We decided</p>
                      <ul className="space-y-1">{dec.map((d) => <li key={d.id} className="text-sm">• {d.text}{topicOf(d.topic_id) && <span className="text-white/45 print:text-neutral-500"> — {topicOf(d.topic_id)!.title}</span>}</li>)}</ul>
                    </div>
                  )}
                </section>
              );
            })}
            {groups.length === 0 && decisions.length === 0 && <p className="text-sm text-white/40">Nothing was committed or decided on this lap.</p>}
          </article>
        )}
      </main>
      {dialog}
    </div>
  );
};

export default AdminLapHistory;
