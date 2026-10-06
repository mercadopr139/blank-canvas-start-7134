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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Star, Check, Camera, Search, ArrowLeft, Users, ClipboardCheck } from "lucide-react";
import {
  type JuniorsRole, type JuniorsLineupRow, type JuniorsCategory, type JuniorsTask, type JuniorsCompletion,
  juniorsTodayET, groupTasks, groupRoles, youthPhotoUrl, lineupName, initials,
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
  const [filling, setFilling] = useState<JuniorsRole | null>(null);

  // A TV board never scrolls: anything below the fold is invisible to the
  // room. The content is packed tight, then zoomed down until the whole
  // line-up and every task fit the screen. Same idea as the NBT board.
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const fit = useCallback(() => {
    const outer = outerRef.current, inner = innerRef.current;
    if (!outer || !inner) return;
    const style = inner.style as CSSStyleDeclaration & { zoom?: string };
    let zoom = 1;
    style.zoom = "1";
    const fits = () => outer.scrollHeight <= outer.clientHeight + 2 && outer.scrollWidth <= outer.clientWidth + 2;
    while (zoom > 0.45 && !fits()) { zoom -= 0.02; style.zoom = zoom.toFixed(2); }
  }, []);

  // Escape closes the photo first, then the board.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (photo) { setPhoto(null); return; }
      onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, photo]);

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
  const refreshLineup = () => qc.invalidateQueries({ queryKey: ["juniors-lineup", today] });

  // Filling a role from the board: a youth from the roster or a typed adult.
  const fillRole = async (role: JuniorsRole, y: CheckedInYouth | null, name?: string) => {
    const { error } = await rpc("juniors_assign_role", { _role_id: role.id, _registration_id: y?.id ?? null, _person_name: y ? null : (name ?? "").trim() || null });
    if (!error) { refreshLineup(); setFilling(null); }
  };
  const clearRole = async (role: JuniorsRole) => {
    const { error } = await rpc("juniors_clear_role", { _role_id: role.id });
    if (!error) { refreshLineup(); setFilling(null); }
  };

  const check = async (t: JuniorsTask) => {
    const { error } = await rpc("juniors_check_task", { _task_id: t.id, _registration_id: null });
    if (!error) refresh();
  };
  const uncheck = async (t: JuniorsTask) => {
    const { error } = await rpc("juniors_uncheck_task", { _task_id: t.id });
    if (!error) refresh();
  };
  // One tap: done. Tap again: not done. No questions asked.
  const tap = (t: JuniorsTask) => (doneByTask.has(t.id) ? uncheck(t) : check(t));

  // Re-fit before paint whenever the content or the window changes.
  useLayoutEffect(() => {
    if (!open) return;
    fit();
    const ro = new ResizeObserver(() => fit());
    if (outerRef.current) ro.observe(outerRef.current);
    window.addEventListener("resize", fit);
    const timers = [150, 600].map((ms) => setTimeout(fit, ms)); // images and fonts settle a beat later
    return () => { ro.disconnect(); window.removeEventListener("resize", fit); timers.forEach(clearTimeout); };
  }, [open, fit, groups, roleGroups, lineup, completions]);

  if (!open) return null;

  const dateLabel = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className={`${standalone ? "h-screen overflow-hidden" : "fixed inset-0 z-50 backdrop-blur-sm animate-in fade-in duration-200"} bg-black/95 text-white flex flex-col`}>
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

      <div ref={outerRef} className="flex-1 overflow-hidden px-4 md:px-6 py-3">
      <div ref={innerRef} className="space-y-4">
        {/* ── The line-up ── */}
        <section className="rounded-2xl border p-3" style={{ borderColor: `${GOLD}55`, backgroundImage: `linear-gradient(135deg, ${GOLD}1f, ${GOLD}05)` }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-black" style={{ backgroundColor: GOLD }}>Tonight's line-up</span>
            <p className="text-white/40 text-xs">Coaches: tap a role to fill or change it</p>
          </div>
          {roleGroups.length === 0 ? (
            <p className="text-white/35 text-sm">No roles set up yet.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[3fr_5fr]">
              {roleGroups.map((g) => (
                <div key={g.label} className="rounded-xl border p-2.5" style={{ borderColor: `${GOLD}33`, backgroundColor: "rgba(0,0,0,0.35)" }}>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-black mb-1.5 px-1" style={{ color: GOLD }}>{g.label}</p>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(g.roles.length, 5)}, minmax(0, 1fr))` }}>
                    {g.roles.map((r) => {
                      const who = byRole.get(r.id);
                      return (
                        <button key={r.id} onClick={() => setFilling(r)}
                          className={`text-left rounded-xl border p-2 flex items-center gap-2 min-h-[58px] transition-colors active:scale-[0.98] ${who ? "border-white/15 bg-white/[0.06] hover:bg-white/[0.1]" : "border-dashed bg-transparent hover:bg-white/[0.04]"}`}
                          style={who ? undefined : { borderColor: `${GOLD}40` }}>
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 shrink-0 ring-2 flex items-center justify-center" style={{ boxShadow: `0 0 0 2px ${who ? GOLD : "rgba(255,255,255,0.12)"}` }}>
                            {who && youthPhotoUrl(who.child_headshot_url)
                              ? <img src={youthPhotoUrl(who.child_headshot_url)!} alt="" className="w-full h-full object-cover" />
                              : who
                              ? <span className="text-xs font-black text-white/70">{initials(lineupName(who))}</span>
                              : <Users className="w-4 h-4 text-white/25" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-white/45 font-semibold leading-tight truncate">{r.title}</p>
                            {r.location && <p className="text-[10px] text-white/30 truncate">{r.location}</p>}
                            <p className={`font-bold leading-tight mt-0.5 truncate ${who ? "text-white text-sm md:text-base" : "text-white/30 text-xs"}`}>
                              {who ? lineupName(who) : "Open"}
                            </p>
                          </div>
                        </button>
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
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-white" style={{ backgroundColor: NLA_RED }}>Setup checklist</span>
            <p className="text-white/40 text-xs">Tap the box when a task is done. Tap a photo to see the proper set-up.</p>
          </div>
          {isError ? <p className="text-rose-300 text-sm">Couldn't load the checklist: {(error as Error)?.message}</p>
          : groups.length === 0 ? <p className="text-white/35 text-sm">No tasks set up yet. Add them under Practice Plan → Juniors Session.</p>
          : (
            <div className="flex flex-wrap gap-3 items-start">
              {groups.map(({ category, tasks: ts }) => (
                <div key={category.id} className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden min-w-[300px]" style={{ flex: `${Math.max(ts.length, 4)} 1 0` }}>
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-white/[0.03]">
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
                  <div className={ts.length > 8 ? "columns-1 lg:columns-2 gap-0" : ""}>
                    {ts.map((t) => {
                      const c = doneByTask.get(t.id);
                      return (
                        <div key={t.id} className={`break-inside-avoid flex items-center gap-2.5 px-2.5 py-1.5 border-b border-white/[0.06] ${c ? "bg-emerald-500/[0.06]" : ""}`}>
                          <button onClick={() => tap(t)}
                            className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all active:scale-95 ${c ? "border-emerald-400 bg-emerald-500 text-black" : "border-white/30 hover:border-white/60"}`}
                            aria-label={c ? "Mark not done" : "Mark done"}>
                            {c && <Check className="w-5 h-5" strokeWidth={3} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm leading-snug ${c ? "text-white/40 line-through" : "text-white"}`}>
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
                            <button onClick={() => setPhoto({ url: t.photo_url!, title: t.title })} className="w-10 h-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-white/15 hover:ring-white/40">
                              <img src={t.thumb_url ?? t.photo_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
      </div>

      {/* A coach filling a role from the board: the roster, or a typed adult. */}
      {filling && (
        <RolePicker
          role={filling}
          current={byRole.get(filling.id) ?? null}
          onPickYouth={(y) => fillRole(filling, y)}
          onPickName={(n) => fillRole(filling, null, n)}
          onClear={() => clearRole(filling)}
          onClose={() => setFilling(null)}
        />
      )}

      {/* The proper set-up: a pop-up that always shows the whole photo. Tap
          outside it, the Close button, or Escape to get back. */}
      {photo && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-150" onClick={() => setPhoto(null)}>
          <div className="relative max-w-[92vw] max-h-[92vh] rounded-2xl bg-neutral-950 border border-white/15 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-white/10 shrink-0">
              <p className="font-bold text-base md:text-lg truncate">{photo.title}</p>
              <Button onClick={() => setPhoto(null)} className="h-10 px-4 font-bold text-white shrink-0" style={{ backgroundColor: NLA_RED }}>
                <X className="w-5 h-5 mr-1.5" /> Close
              </Button>
            </div>
            <div className="min-h-0 flex items-center justify-center bg-black">
              <img src={photo.url} alt={photo.title} className="block object-contain" style={{ maxWidth: "92vw", maxHeight: "calc(92vh - 64px)" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Fill a role from the board. The youth list is the kiosk search: approved,
// current year, whole roster -- the kids have not signed in yet.
const RolePicker = ({ role, current, onPickYouth, onPickName, onClear, onClose }: {
  role: JuniorsRole; current: JuniorsLineupRow | null;
  onPickYouth: (y: CheckedInYouth) => void; onPickName: (name: string) => void; onClear: () => void; onClose: () => void;
}) => {
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [results, setResults] = useState<CheckedInYouth[]>([]);
  const isCoach = role.group_label === "Coaching";
  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data, error } = await rpc("search_kiosk_youth", { _search: search.trim() });
      setResults(error ? [] : ((data as CheckedInYouth[]) ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-start justify-center p-4 md:pt-20 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-lg bg-neutral-950 border border-white/15 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide font-bold text-white/45">{role.group_label}{role.location ? ` · ${role.location}` : ""}</p>
            <p className="font-bold text-white text-lg leading-tight">{role.title}</p>
            {current && <p className="text-xs text-white/45 mt-0.5">Now: {lineupName(current)}</p>}
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus={isCoach}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onPickName(name); }}
              placeholder="Type a coach's name (an adult)…" className="h-11 bg-neutral-900 border-neutral-700 text-white" />
            <Button onClick={() => onPickName(name)} disabled={!name.trim()} className="h-11 text-white font-bold" style={{ backgroundColor: NLA_RED }}>Assign</Button>
          </div>
          <p className="text-[11px] uppercase tracking-wider text-white/35">or a youth from the roster</p>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} autoFocus={!isCoach} placeholder="Search by name"
              className="pl-9 h-11 bg-neutral-900 border-neutral-700 text-white" />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {results.map((y) => (
              <button key={y.id} onClick={() => onPickYouth(y)} className="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/10">
                <span className="w-9 h-9 rounded-full overflow-hidden bg-white/10 shrink-0">
                  {youthPhotoUrl(y.child_headshot_url) && <img src={youthPhotoUrl(y.child_headshot_url)!} alt="" className="w-full h-full object-cover" />}
                </span>
                <span className="font-semibold">{y.child_first_name} {y.child_last_name}</span>
              </button>
            ))}
            {search.trim().length >= 2 && results.length === 0 && <p className="text-white/35 text-sm px-2 py-3">Nobody on the roster by that name.</p>}
          </div>
          {current && (
            <div className="flex justify-end pt-1">
              <Button variant="ghost" onClick={onClear} className="text-white/50 hover:text-rose-300"><X className="w-4 h-4 mr-1" /> Clear this role</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JuniorsSessionBoard;
