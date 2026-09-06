// Daily Duties — the pop-up the youth use on the Gym Board.
//
// Opens over the practice plan after training. Jobs are grouped by zone and
// color-coded like the paper sheet. Tap "Add" on a job, search tonight's
// checked-in kids, tap a name to put them on it. A job holds as many youth as
// you like. Everything is keyed to today, so it opens fresh every night and
// last night is already saved to history.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, Plus, UserPlus, Sparkles, Check, Loader2 } from "lucide-react";
import {
  DutyJob, DutyAssignee, CheckedInYouth, groupJobsByZone, zoneStyle, headshotUrl,
} from "@/lib/dailyDuties";

const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (n: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(name, args);

// Small round avatar with an initial fallback.
const Avatar = ({ url, name, size }: { url: string | null; name: string; size: string }) => {
  const src = headshotUrl(url);
  return (
    <div className={`${size} rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 ring-1 ring-white/15`}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-white/60">{name[0]?.toUpperCase()}</span>
      )}
    </div>
  );
};

const DailyDutiesBoard = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const qc = useQueryClient();
  const [assigningJob, setAssigningJob] = useState<DutyJob | null>(null);

  // Close on Escape (unless the search panel is up — that handles its own).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !assigningJob) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, assigningJob, onClose]);

  // The master job list (active only).
  const { data: jobs = [] } = useQuery({
    queryKey: ["duty-jobs"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duty_jobs" as never)
        .select("id, zone, label, category, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as DutyJob[];
    },
  });

  // Tonight's assignments (names + photos already joined by the RPC).
  const { data: assignees = [] } = useQuery({
    queryKey: ["duty-assignments-today"],
    enabled: open,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await rpc("get_todays_duty_assignments");
      if (error) throw error as Error;
      return (data || []) as DutyAssignee[];
    },
  });

  const byJob = useMemo(() => {
    const map = new Map<string, DutyAssignee[]>();
    for (const a of assignees) {
      if (!map.has(a.job_id)) map.set(a.job_id, []);
      map.get(a.job_id)!.push(a);
    }
    return map;
  }, [assignees]);

  const zones = useMemo(() => groupJobsByZone(jobs), [jobs]);
  const totalAssigned = assignees.length;

  const unassign = useMutation({
    mutationFn: async ({ jobId, regId }: { jobId: string; regId: string }) => {
      const { error } = await rpc("unassign_duty", { _job_id: jobId, _registration_id: regId });
      if (error) throw error as Error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["duty-assignments-today"] }),
  });

  if (!open) return null;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York",
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Daily Duties</h2>
            <p className="text-white/45 text-sm md:text-base">{today} · {totalAssigned} assigned</p>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl h-11 px-4"
        >
          <X className="w-5 h-5 mr-1.5" /> Done
        </Button>
      </div>

      {/* Zones + jobs — a fit-to-screen board. Zones flow into columns (up to
          four on a wide wall) and each zone is kept whole, so the entire
          clean-up list is visible at once with no scrolling on the big board. */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-3">
        {zones.length === 0 ? (
          <p className="text-center text-white/40 py-20 text-lg">
            No jobs set up yet. Add them under Practice Plan → Daily Duties Intelligence.
          </p>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
            {zones.map(({ zone, jobs: zoneJobs }) => {
              const zs = zoneStyle(zone);
              return (
                <section key={zone} className="break-inside-avoid mb-3">
                  <div className={`flex items-center gap-1.5 rounded px-2 py-0.5 mb-1.5 ${zs.headerBg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${zs.dot}`} />
                    <h3 className={`font-bold text-[11px] uppercase tracking-wide ${zs.headerText}`}>{zone}</h3>
                  </div>
                  <div className="space-y-1.5">
                    {zoneJobs.map((job) => {
                      const people = byJob.get(job.id) ?? [];
                      return (
                        <div
                          key={job.id}
                          className={`rounded-lg border ${zs.border} bg-white/[0.03] px-2 py-1.5`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-white/90 leading-tight text-[13px]">{job.label}</p>
                            <Button
                              onClick={() => setAssigningJob(job)}
                              size="sm"
                              className="flex-shrink-0 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold px-2 text-xs"
                            >
                              <Plus className="w-3.5 h-3.5 mr-0.5" /> Add
                            </Button>
                          </div>

                          {/* Assigned youth chips — only shown once someone is on
                              the job, so empty cards stay short and everything fits. */}
                          {people.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {people.map((p) => (
                                <span
                                  key={p.registration_id}
                                  className="inline-flex items-center gap-1 rounded-full bg-white/[0.07] border border-white/10 pl-0.5 pr-1 py-0.5"
                                >
                                  <Avatar url={p.child_headshot_url} name={p.child_first_name} size="w-5 h-5 text-[10px]" />
                                  <span className="text-[11px] font-medium text-white/90">
                                    {p.child_first_name} {p.child_last_name[0]}.
                                  </span>
                                  <button
                                    onClick={() => unassign.mutate({ jobId: job.id, regId: p.registration_id })}
                                    className="text-white/40 hover:text-rose-300 transition-colors"
                                    aria-label={`Remove ${p.child_first_name}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {assigningJob && (
        <AssignPanel
          job={assigningJob}
          assigned={byJob.get(assigningJob.id) ?? []}
          onClose={() => setAssigningJob(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["duty-assignments-today"] })}
        />
      )}
    </div>
  );
};

// The name-search panel: find tonight's checked-in youth and tap to assign.
const AssignPanel = ({
  job, assigned, onClose, onChanged,
}: {
  job: DutyJob;
  assigned: DutyAssignee[];
  onClose: () => void;
  onChanged: () => void;
}) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CheckedInYouth[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.registration_id)), [assigned]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await rpc("search_checked_in_youth", { _search: search });
      setResults(error ? [] : ((data || []) as CheckedInYouth[]));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const toggle = async (y: CheckedInYouth) => {
    setBusyId(y.id);
    const already = assignedIds.has(y.id);
    const fn = already ? "unassign_duty" : "assign_duty";
    const { error } = await rpc(fn, { _job_id: job.id, _registration_id: y.id });
    setBusyId(null);
    if (!error) onChanged();
  };

  const zs = zoneStyle(job.zone);

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-start justify-center p-4 md:pt-20 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-neutral-950 border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-5 py-4 border-b border-white/10 ${zs.headerBg}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-xs uppercase tracking-wide font-bold ${zs.headerText}`}>{job.zone}</p>
              <p className="font-bold text-white text-lg leading-tight truncate">{job.label}</p>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white flex-shrink-0">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a name that checked in tonight"
              className="pl-12 h-14 text-lg bg-white/5 border-2 border-white/15 text-white placeholder:text-white/30 focus:border-white/40 rounded-xl"
            />
          </div>

          <div className="space-y-2 max-h-[45vh] overflow-y-auto">
            {loading && <p className="text-center text-white/40 py-6">Searching…</p>}
            {!loading && search.trim().length >= 2 && results.length === 0 && (
              <div className="text-center py-6 px-4">
                <p className="text-white/50">No match among tonight's check-ins.</p>
                <p className="text-white/35 text-sm mt-1">They may need to check in at the kiosk first.</p>
              </div>
            )}
            {!loading && search.trim().length < 2 && (
              <p className="text-center text-white/30 py-6 flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" /> Type a name to add them to this job
              </p>
            )}
            {results.map((y) => {
              const isOn = assignedIds.has(y.id);
              return (
                <button
                  key={y.id}
                  onClick={() => toggle(y)}
                  disabled={busyId === y.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    isOn ? "border-emerald-500/60 bg-emerald-500/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  <Avatar url={y.child_headshot_url} name={y.child_first_name} size="w-11 h-11 text-base" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{y.child_first_name} {y.child_last_name}</p>
                    <p className="text-sm text-white/45">{y.child_boxing_program}</p>
                  </div>
                  {busyId === y.id ? (
                    <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
                  ) : isOn ? (
                    <span className="flex items-center gap-1 text-emerald-300 font-semibold text-sm">
                      <Check className="w-5 h-5" /> On it
                    </span>
                  ) : (
                    <Plus className="w-5 h-5 text-white/40" />
                  )}
                </button>
              );
            })}
          </div>

          <Button onClick={onClose} className="w-full mt-4 h-12 rounded-xl bg-white text-black hover:bg-white/90 font-bold">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DailyDutiesBoard;
