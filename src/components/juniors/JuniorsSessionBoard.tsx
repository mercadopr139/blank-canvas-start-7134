// The Juniors Session board — what the senior boxers see on the TV on a
// Tuesday: who holds each role tonight, and the setup checklist.
//
// Same full-screen dark overlay as Daily Duties, same tile language as the
// Workout Plans. No login: roles, categories and tasks are public reads of
// active rows; the line-up and completions come through narrow functions;
// checking a task writes today's row only, through a function.
//
// `standalone` renders it as a page (a tablet by the front desk) rather than
// an overlay with a Done button.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Star, Check, Camera, Search, ArrowLeft, Users, ClipboardCheck } from "lucide-react";
import {
  type JuniorsRole, type JuniorsLineupRow, type JuniorsCategory, type JuniorsTask, type JuniorsCompletion,
  juniorsTodayET, groupTasks, groupRoles, youthPhotoUrl,
} from "@/lib/juniors";

const NLA_RED = "#bf0f3e";
const GOLD = "#f2c230";

const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(name, args);
const from = (table: string) => supabase.from(table as never) as never as {
  select: (s: string) => { order: (k: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }> };
};

interface CheckedInYouth { id: string; child_first_name: string; child_last_name: string; child_headshot_url: string | null }

const JuniorsSessionBoard = ({ open = true, onClose, standalone = false }: { open?: boolean; onClose?: () => void; standalone?: boolean }) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const today = juniorsTodayET();
  const [photo, setPhoto] = useState<{ url: string; title: string } | null>(null);
  const [naming, setNaming] = useState<JuniorsTask | null>(null);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const { data: roles = [] } = useQuery({
    queryKey: ["juniors-roles"], enabled: open,
    queryFn: async () => { const { data, error } = await from("juniors_roles").select("*").order("sort_order", { ascending: true }); if (error) throw new Error(error.message); return (data as JuniorsRole[]) ?? []; },
  });
  const { data: lineup = [] } = useQuery({
    queryKey: ["juniors-lineup", today], enabled: open, refetchInterval: 30_000,
    queryFn: async () => { const { data, error } = await rpc("get_juniors_lineup", { _date: today }); if (error) throw new Error(error.message); return (data as JuniorsLineupRow[]) ?? []; },
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["juniors-categories"], enabled: open,
    queryFn: async () => { const { data, error } = await from("juniors_categories").select("*").order("sort_order", { ascending: true }); if (error) throw new Error(error.message); return (data as JuniorsCategory[]) ?? []; },
  });
  const { data: tasks = [], isError, error } = useQuery({
    queryKey: ["juniors-tasks"], enabled: open,
    queryFn: async () => { const { data, error } = await from("juniors_tasks").select("*").order("sort_order", { ascending: true }); if (error) throw new Error(error.message); return (data as JuniorsTask[]) ?? []; },
  });
  const { data: completions = [] } = useQuery({
    queryKey: ["juniors-completions", today], enabled: open, refetchInterval: 30_000,
    queryFn: async () => { const { data, error } = await rpc("get_juniors_completions", { _date: today }); if (error) throw new Error(error.message); return (data as JuniorsCompletion[]) ?? []; },
  });

  const byRole = useMemo(() => new Map(lineup.map((l) => [l.role_id, l])), [lineup]);
  const doneByTask = useMemo(() => new Map(completions.map((c) => [c.task_id, c])), [completions]);
  const groups = useMemo(() => groupTasks(categories, tasks), [categories, tasks]);
  const roleGroups = useMemo(() => groupRoles(roles), [roles]);
  const total = tasks.length;
  const done = tasks.filter((t) => doneByTask.has(t.id)).length;
  const allDone = total > 0 && done === total;

  const refresh = () => qc.invalidateQueries({ queryKey: ["juniors-completions", today] });

  const check = async (t: JuniorsTask, who?: CheckedInYouth) => {
    const { error } = await rpc("juniors_check_task", { _task_id: t.id, _registration_id: who?.id ?? null });
    if (!error) refresh();
  };
  const uncheck = async (t: JuniorsTask) => {
    const { error } = await rpc("juniors_uncheck_task", { _task_id: t.id });
    if (!error) refresh();
  };
  const tap = (t: JuniorsTask) => {
    if (doneByTask.has(t.id)) { uncheck(t); return; }
    setNaming(t); // name first; "Skip" checks it without one
  };

  if (!open) return null;

  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className={`${standalone ? "min-h-screen" : "fixed inset-0 z-50 backdrop-blur-sm animate-in fade-in duration-200"} bg-black/95 text-white flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          {standalone && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/practice-board")} className="text-white/30 hover:text-white hover:bg-white/5 h-9 w-9" title="Gym Board">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${NLA_RED}33` }}>
            <ClipboardCheck className="w-5 h-5" style={{ color: NLA_RED }} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Juniors Session</h2>
            <p className="text-white/45 text-sm md:text-base">{dateLabel} · set up for the Junior Boxers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`rounded-full border px-4 py-1.5 text-sm md:text-base font-bold tabular-nums ${allDone ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300" : "border-white/15 bg-white/5 text-white/80"}`}>
            {allDone ? "All set ✓" : `${done} of ${total} done`}
          </div>
          {onClose && (
            <Button onClick={onClose} variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl h-11 px-4">
              <X className="w-5 h-5 mr-1.5" /> Done
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 space-y-7">
        {/* ── The line-up ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-black" style={{ backgroundColor: GOLD }}>Tonight's line-up</span>
            <p className="text-white/40 text-xs">Filled by the coaches before practice</p>
          </div>
          {roleGroups.length === 0 ? (
            <p className="text-white/35 text-sm">No roles set up yet.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {roleGroups.map((g) => (
                <div key={g.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] uppercase tracking-wider text-white/45 font-bold mb-2 px-1">{g.label}</p>
                  <div className={`grid gap-2 ${g.roles.length > 3 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-3"}`}>
                    {g.roles.map((r) => {
                      const who = byRole.get(r.id);
                      return (
                        <div key={r.id} className={`rounded-xl border p-3 flex items-center gap-3 min-h-[76px] ${who ? "border-white/15 bg-white/[0.05]" : "border-dashed border-white/20 bg-transparent"}`}>
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 shrink-0 ring-2 ring-white/10 flex items-center justify-center">
                            {who && youthPhotoUrl(who.child_headshot_url)
                              ? <img src={youthPhotoUrl(who.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                              : <Users className="w-5 h-5 text-white/25" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-wide text-white/45 font-semibold leading-tight">{r.title}</p>
                            {r.location && <p className="text-[10px] text-white/30">{r.location}</p>}
                            <p className={`font-bold leading-tight mt-0.5 ${who ? "text-white text-base md:text-lg" : "text-white/30 text-sm"}`}>
                              {who ? `${who.child_first_name} ${who.child_last_name}` : "Open"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── The checklist ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-white" style={{ backgroundColor: NLA_RED }}>Setup checklist</span>
            <p className="text-white/40 text-xs">Tap a task when it is done. Tap a photo to see the proper set-up.</p>
          </div>
          {isError ? <p className="text-rose-300 text-sm">Couldn't load the checklist: {(error as Error)?.message}</p>
          : groups.length === 0 ? <p className="text-white/35 text-sm">No tasks set up yet. Add them under Practice Plan → Juniors Session.</p>
          : (
            <div className="columns-1 md:columns-2 xl:columns-3 gap-4">
              {groups.map(({ category, tasks: ts }) => (
                <div key={category.id} className="break-inside-avoid mb-4 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
                    <p className="font-black text-sm uppercase tracking-wider">{category.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40 tabular-nums">{ts.filter((t) => doneByTask.has(t.id)).length}/{ts.length}</span>
                      {category.photo_url && (
                        <button onClick={() => setPhoto({ url: category.photo_url!, title: category.title })} className="text-white/50 hover:text-white" title="See the set-up">
                          <Camera className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="divide-y divide-white/[0.06]">
                    {ts.map((t) => {
                      const c = doneByTask.get(t.id);
                      return (
                        <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 ${c ? "bg-emerald-500/[0.06]" : ""}`}>
                          <button onClick={() => tap(t)}
                            className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all active:scale-95 ${c ? "border-emerald-400 bg-emerald-500 text-black" : "border-white/30 hover:border-white/60"}`}
                            aria-label={c ? "Mark not done" : "Mark done"}>
                            {c && <Check className="w-5 h-5" strokeWidth={3} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm md:text-base leading-snug ${c ? "text-white/50 line-through" : "text-white"}`}>
                              {t.starred && <Star className="inline w-4 h-4 mr-1 -mt-0.5" style={{ color: GOLD, fill: GOLD }} />}
                              {t.title}
                            </p>
                            {t.details && !c && <p className="text-xs text-white/45 mt-0.5">{t.details}</p>}
                            {c && <p className="text-[11px] text-emerald-300/80 mt-0.5">
                              Done {new Date(c.done_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })}
                              {c.child_first_name ? ` · ${c.child_first_name} ${c.child_last_name ?? ""}`.trimEnd() : ""}
                            </p>}
                          </div>
                          {t.photo_url && (
                            <button onClick={() => setPhoto({ url: t.photo_url!, title: t.title })} className="w-12 h-12 rounded-lg overflow-hidden shrink-0 ring-1 ring-white/15 hover:ring-white/40">
                              <img src={t.photo_url} alt="" className="w-full h-full object-cover" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Who did it: the seniors checked in today, like Daily Duties. Skip is fine. */}
      {naming && (
        <NamePicker
          task={naming}
          onPick={(y) => { check(naming, y); setNaming(null); }}
          onSkip={() => { check(naming); setNaming(null); }}
          onClose={() => setNaming(null)}
        />
      )}

      {/* The proper set-up, full screen. */}
      {photo && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex flex-col animate-in fade-in duration-150" onClick={() => setPhoto(null)}>
          <div className="flex items-center justify-between px-6 py-4">
            <p className="font-bold text-lg">{photo.title}</p>
            <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10"><X className="w-5 h-5 mr-1" /> Close</Button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={photo.url} alt={photo.title} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};

const NamePicker = ({ task, onPick, onSkip, onClose }: { task: JuniorsTask; onPick: (y: CheckedInYouth) => void; onSkip: () => void; onClose: () => void }) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CheckedInYouth[]>([]);
  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data, error } = await rpc("search_checked_in_youth", { _search: search.trim() });
      setResults(error ? [] : ((data as CheckedInYouth[]) ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-start justify-center p-4 md:pt-20 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-lg bg-neutral-950 border border-white/15 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-xs uppercase tracking-wide font-bold text-white/45">Who did it?</p>
          <p className="font-bold text-white leading-tight">{task.title}</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus placeholder="Type your name (checked in today)"
              className="pl-9 h-11 bg-neutral-900 border-neutral-700 text-white" />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {results.map((y) => (
              <button key={y.id} onClick={() => onPick(y)} className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/10">
                <span className="w-9 h-9 rounded-full overflow-hidden bg-white/10 shrink-0">
                  {youthPhotoUrl(y.child_headshot_url) && <img src={youthPhotoUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" />}
                </span>
                <span className="font-semibold">{y.child_first_name} {y.child_last_name}</span>
              </button>
            ))}
            {search.trim().length >= 2 && results.length === 0 && <p className="text-white/35 text-sm px-2 py-3">Nobody checked in by that name yet.</p>}
          </div>
          <div className="flex justify-between pt-1">
            <Button variant="ghost" onClick={onClose} className="text-white/50 hover:text-white">Cancel</Button>
            <Button onClick={onSkip} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"><Check className="w-4 h-4 mr-1.5" /> Mark done without a name</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JuniorsSessionBoard;
