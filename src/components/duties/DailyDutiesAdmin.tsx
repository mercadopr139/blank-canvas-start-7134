// Daily Duties — the admin side, shown as a tab under Practice Plan.
//
// Two jobs here:
//   JOB LIST  the master template — add, rename, recategorize, reorder, hide.
//   REPORT    the funder snapshot — "Denum: Bathrooms x8, Floors x5 this week."
//
// The board reads this same job list; edits here show up on the wall right away.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Pencil, Check, X, ChevronUp, ChevronDown, Eye, EyeOff,
  BarChart3, ClipboardList, Loader2, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { mondayOf, addDays } from "@/lib/practicePlan";
import { generateDutyReportPdf } from "@/lib/generateDutyReportPdf";
import {
  DutyJob, DUTY_ZONES, DUTY_CATEGORIES, groupJobsByZone, zoneStyle, headshotUrl,
} from "@/lib/dailyDuties";

const DailyDutiesAdmin = () => {
  return (
    <Tabs defaultValue="jobs">
      <TabsList className="bg-neutral-900 border border-neutral-800 h-11 p-1 gap-1">
        <TabsTrigger value="jobs" className="px-5 h-9 text-sm font-semibold text-neutral-300 hover:text-white data-[state=active]:bg-white data-[state=active]:text-black">
          <ClipboardList className="w-4 h-4 mr-2" /> Job List
        </TabsTrigger>
        <TabsTrigger value="report" className="px-5 h-9 text-sm font-semibold text-neutral-300 hover:text-white data-[state=active]:bg-white data-[state=active]:text-black">
          <BarChart3 className="w-4 h-4 mr-2" /> Report
        </TabsTrigger>
      </TabsList>
      <TabsContent value="jobs" className="mt-4">
        <JobListEditor />
      </TabsContent>
      <TabsContent value="report" className="mt-4">
        <DutyReport />
      </TabsContent>
    </Tabs>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Job list editor
// ─────────────────────────────────────────────────────────────────────
const JobListEditor = () => {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [newZone, setNewZone] = useState(DUTY_ZONES[0].name);
  const [newLabel, setNewLabel] = useState("");
  const [newCategory, setNewCategory] = useState<string>("Floors");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["duty-jobs-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duty_jobs" as never)
        .select("id, zone, label, category, sort_order, is_active")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as DutyJob[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["duty-jobs-admin"] });
    qc.invalidateQueries({ queryKey: ["duty-jobs"] });
  };

  const patchJob = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<DutyJob> }) => {
      const { error } = await supabase.from("duty_jobs" as never).update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: () => toast.error("Could not save — try again"),
  });

  const removeJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("duty_jobs" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Job removed"); },
    onError: () => toast.error("Could not remove — it may have history; hide it instead"),
  });

  const addJob = useMutation({
    mutationFn: async () => {
      const maxSort = jobs.reduce((m, j) => Math.max(m, j.sort_order), 0);
      const { error } = await supabase.from("duty_jobs" as never).insert({
        zone: newZone, label: newLabel.trim(), category: newCategory, sort_order: maxSort + 10,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); setAdding(false); setNewLabel(""); toast.success("Job added"); },
    onError: () => toast.error("Could not add — try again"),
  });

  // Move a job up/down within its zone by swapping sort_order with its neighbor.
  const move = (job: DutyJob, dir: -1 | 1) => {
    const sameZone = jobs.filter((j) => j.zone === job.zone).sort((a, b) => a.sort_order - b.sort_order);
    const idx = sameZone.findIndex((j) => j.id === job.id);
    const swap = sameZone[idx + dir];
    if (!swap) return;
    patchJob.mutate({ id: job.id, patch: { sort_order: swap.sort_order } });
    patchJob.mutate({ id: swap.id, patch: { sort_order: job.sort_order } });
  };

  const zones = useMemo(() => groupJobsByZone(jobs), [jobs]);

  if (isLoading) return <p className="text-neutral-500 py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-neutral-500">
          The master clean-up list. The board shows every <span className="text-white/80 font-medium">active</span> job, grouped by zone.
        </p>
        <Button onClick={() => setAdding((a) => !a)} size="sm" className="text-white font-bold" style={{ backgroundColor: "#bf0f3e" }}>
          <Plus className="w-4 h-4 mr-1.5" /> Add job
        </Button>
      </div>

      {adding && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr] ">
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">Zone</label>
              <Select value={newZone} onValueChange={setNewZone}>
                <SelectTrigger className="mt-1 bg-neutral-800 border-neutral-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DUTY_ZONES.map((z) => <SelectItem key={z.name} value={z.name}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">Report category</label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="mt-1 bg-neutral-800 border-neutral-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DUTY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-neutral-500 font-semibold">Task</label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Sweep Boxing Facility"
              className="mt-1 bg-neutral-800 border-neutral-700 text-white"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setAdding(false)} className="text-neutral-400">Cancel</Button>
            <Button onClick={() => addJob.mutate()} disabled={!newLabel.trim() || addJob.isPending} className="bg-white text-black hover:bg-white/90 font-bold">
              {addJob.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2 items-start">
        {zones.map(({ zone, jobs: zoneJobs }) => {
          const zs = zoneStyle(zone);
          return (
            <div key={zone}>
              <div className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 mb-1.5 ${zs.headerBg}`}>
                <span className={`w-2 h-2 rounded-full ${zs.dot}`} />
                <h3 className={`font-bold text-[11px] uppercase tracking-wide ${zs.headerText}`}>{zone}</h3>
              </div>
              <div className="space-y-1">
                {zoneJobs.map((job, i) => (
                  <div
                    key={job.id}
                    className={`rounded-lg border px-2 py-1 flex items-center gap-1.5 ${job.is_active ? "border-neutral-800 bg-neutral-900" : "border-neutral-800/60 bg-neutral-900/40 opacity-60"}`}
                  >
                    {/* reorder */}
                    <div className="flex flex-col -my-0.5">
                      <button onClick={() => move(job, -1)} disabled={i === 0} className="text-neutral-600 hover:text-white disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => move(job, 1)} disabled={i === zoneJobs.length - 1} className="text-neutral-600 hover:text-white disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </div>

                    {/* label */}
                    <div className="flex-1 min-w-0">
                      {editingId === job.id ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="bg-neutral-800 border-neutral-700 text-white h-7 text-sm"
                            autoFocus
                          />
                          <button onClick={() => { patchJob.mutate({ id: job.id, patch: { label: editLabel.trim() } }); setEditingId(null); }} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <p className="text-white/90 text-sm font-medium truncate" title={job.label}>{job.label}</p>
                      )}
                    </div>

                    {/* category */}
                    <Select value={job.category} onValueChange={(v) => patchJob.mutate({ id: job.id, patch: { category: v } })}>
                      <SelectTrigger className="w-[96px] h-7 bg-neutral-800 border-neutral-700 text-white text-xs px-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DUTY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    {/* actions */}
                    <button
                      onClick={() => { setEditingId(job.id); setEditLabel(job.label); }}
                      className="text-neutral-500 hover:text-white" title="Rename"
                    ><Pencil className="w-3.5 h-3.5" /></button>
                    <button
                      onClick={() => patchJob.mutate({ id: job.id, patch: { is_active: !job.is_active } })}
                      className="text-neutral-500 hover:text-white" title={job.is_active ? "Hide from board" : "Show on board"}
                    >{job.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
                    <button
                      onClick={() => { if (confirm(`Delete "${job.label}"? Its past history is kept.`)) removeJob.mutate(job.id); }}
                      className="text-neutral-500 hover:text-rose-400" title="Delete"
                    ><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Funder report
// ─────────────────────────────────────────────────────────────────────
interface ReportRow {
  registration_id: string;
  duty_date: string;
  duty_jobs: { zone: string; label: string; category: string } | null;
  youth_registrations: { child_first_name: string; child_last_name: string; child_headshot_url: string | null } | null;
}

type RangeKey = "this_week" | "last_week" | "this_month" | "custom";

const DutyReport = () => {
  const [range, setRange] = useState<RangeKey>("this_week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to, label } = useMemo(() => {
    const thisMon = mondayOf();
    if (range === "this_week") return { from: thisMon, to: addDays(thisMon, 6), label: "This week" };
    if (range === "last_week") return { from: addDays(thisMon, -7), to: addDays(thisMon, -1), label: "Last week" };
    if (range === "this_month") {
      const d = new Date();
      const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const last = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
      return { from: first, to: last, label: "This month" };
    }
    return { from: customFrom, to: customTo, label: "Custom range" };
  }, [range, customFrom, customTo]);

  const ready = !!from && !!to;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["duty-report", from, to],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duty_assignments" as never)
        .select("registration_id, duty_date, duty_jobs(zone,label,category), youth_registrations(child_first_name,child_last_name,child_headshot_url)")
        .gte("duty_date", from)
        .lte("duty_date", to);
      if (error) throw error;
      return (data || []) as unknown as ReportRow[];
    },
  });

  // Aggregate per youth.
  const perYouth = useMemo(() => {
    const map = new Map<string, {
      name: string; photo: string | null; total: number;
      byCategory: Record<string, number>; byJob: Record<string, number>;
    }>();
    for (const r of rows) {
      const y = r.youth_registrations;
      if (!y) continue;
      const key = r.registration_id;
      if (!map.has(key)) {
        map.set(key, {
          name: `${y.child_first_name} ${y.child_last_name}`,
          photo: y.child_headshot_url, total: 0, byCategory: {}, byJob: {},
        });
      }
      const rec = map.get(key)!;
      rec.total += 1;
      const cat = r.duty_jobs?.category ?? "Other";
      const job = r.duty_jobs?.label ?? "—";
      rec.byCategory[cat] = (rec.byCategory[cat] ?? 0) + 1;
      rec.byJob[job] = (rec.byJob[job] ?? 0) + 1;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  const totals = useMemo(() => {
    const byCategory: Record<string, number> = {};
    for (const r of rows) {
      const cat = r.duty_jobs?.category ?? "Other";
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    }
    return { jobs: rows.length, youth: perYouth.length, byCategory };
  }, [rows, perYouth]);

  return (
    <div className="space-y-5">
      {/* Range picker */}
      <div className="flex items-center gap-2 flex-wrap">
        {([["this_week", "This week"], ["last_week", "Last week"], ["this_month", "This month"], ["custom", "Custom"]] as [RangeKey, string][]).map(([k, lbl]) => (
          <Button
            key={k}
            onClick={() => setRange(k)}
            variant={range === k ? "default" : "outline"}
            className={range === k ? "bg-white text-black hover:bg-white/90 font-semibold" : "border-neutral-700 text-neutral-300 hover:text-white bg-transparent"}
          >
            {lbl}
          </Button>
        ))}
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="bg-neutral-800 border-neutral-700 text-white h-10 w-[150px]" />
            <span className="text-neutral-500">→</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="bg-neutral-800 border-neutral-700 text-white h-10 w-[150px]" />
          </div>
        )}

        {/* These are the fundable numbers — they should leave the screen
            without anybody retyping them into a grant application. */}
        <Button
          onClick={() =>
            generateDutyReportPdf({
              periodLabel: label,
              from,
              to,
              totalJobs: totals.jobs,
              totalYouth: totals.youth,
              byCategory: totals.byCategory,
              perYouth,
            })
          }
          disabled={!ready || rows.length === 0}
          className="ml-auto bg-[#bf0f3e] hover:bg-[#bf0f3e]/85 text-white font-semibold"
        >
          <FileDown className="w-4 h-4 mr-1.5" /> Download PDF
        </Button>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-900/40 p-5">
        <p className="text-xs uppercase tracking-wide text-neutral-500 font-semibold mb-3">{label} · facility work</p>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-4xl font-black text-white tabular-nums">{totals.jobs}</p>
            <p className="text-sm text-neutral-400">jobs completed</p>
          </div>
          <div>
            <p className="text-4xl font-black text-white tabular-nums">{totals.youth}</p>
            <p className="text-sm text-neutral-400">youth serving</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {Object.entries(totals.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
              <span key={cat} className="rounded-full bg-white/[0.06] border border-white/10 px-3 py-1.5 text-sm">
                <span className="text-white/90 font-semibold">{cat}</span>{" "}
                <span className="text-white/50">×{n}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Per-youth */}
      {isLoading ? (
        <p className="text-neutral-500 py-8 text-center">Loading…</p>
      ) : perYouth.length === 0 ? (
        <p className="text-neutral-500 py-10 text-center">No duties recorded in this range yet.</p>
      ) : (
        <div className="space-y-2">
          {perYouth.map((y) => (
            <YouthReportRow key={y.name} y={y} />
          ))}
        </div>
      )}
    </div>
  );
};

const YouthReportRow = ({ y }: { y: { name: string; photo: string | null; total: number; byCategory: Record<string, number>; byJob: Record<string, number> } }) => {
  const [open, setOpen] = useState(false);
  const src = headshotUrl(y.photo);
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-3 text-left">
        <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 ring-1 ring-white/10">
          {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <span className="font-bold text-white/60">{y.name[0]}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{y.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {Object.entries(y.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
              <span key={cat} className="text-xs rounded-full bg-white/[0.06] px-2 py-0.5 text-white/70">{cat} ×{n}</span>
            ))}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-black text-white tabular-nums leading-none">{y.total}</p>
          <p className="text-[11px] text-neutral-500 uppercase tracking-wide">jobs</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-neutral-800">
          <div className="grid gap-1.5 sm:grid-cols-2 mt-2">
            {Object.entries(y.byJob).sort((a, b) => b[1] - a[1]).map(([job, n]) => (
              <div key={job} className="flex items-center justify-between text-sm">
                <span className="text-neutral-300 truncate pr-2">{job}</span>
                <span className="text-neutral-500 tabular-nums flex-shrink-0">×{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyDutiesAdmin;
