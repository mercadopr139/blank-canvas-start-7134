import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, ShieldCheck, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { getCurrentAttendanceYear, nextProgramYear, shortProgramYear } from "@/lib/programYear";

type Reg = {
  id: string;
  child_first_name: string | null;
  child_last_name: string | null;
  child_date_of_birth: string | null;
  child_boxing_program: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  program_year: string | null;
  approved_for_attendance: boolean | null;
  archived_at: string | null;
  created_at: string | null;
};

/* identity match — same signals as the Readiness view (phone / email / DOB) */
const digits = (s?: string | null) => (s || "").replace(/\D/g, "");
const email = (s?: string | null) => (s || "").trim().toLowerCase();
const nn = (s?: string | null) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function AdminReRegistrationApprovals() {
  const qc = useQueryClient();
  const [targetYear, setTargetYear] = useState<string>(() => nextProgramYear(getCurrentAttendanceYear()));
  const [filter, setFilter] = useState<"all" | "returning" | "new">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["rereg-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, child_date_of_birth, child_boxing_program, parent_phone, parent_email, program_year, approved_for_attendance, archived_at, created_at");
      if (error) throw error;
      return (data || []) as unknown as Reg[];
    },
  });

  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    regs.forEach((r) => r.program_year && set.add(r.program_year));
    set.add(nextProgramYear(getCurrentAttendanceYear()));
    set.add(getCurrentAttendanceYear());
    return [...set].sort().reverse();
  }, [regs]);

  const rows = useMemo(() => {
    // Pending = unapproved, not archived, for the selected year.
    const pending = regs.filter((r) => r.program_year === targetYear && !r.approved_for_attendance && !r.archived_at);

    // "Returning" = matches an APPROVED registration from a different (earlier) year.
    const priorPhones = new Set<string>(), priorEmails = new Set<string>(), priorDobLast = new Set<string>();
    regs.filter((r) => r.program_year !== targetYear && r.approved_for_attendance).forEach((r) => {
      const ph = digits(r.parent_phone); if (ph.length >= 7) priorPhones.add(ph);
      const em = email(r.parent_email); if (em) priorEmails.add(em);
      if (r.child_date_of_birth) priorDobLast.add(`${r.child_date_of_birth}|${nn(r.child_last_name)}`);
    });
    const isReturning = (r: Reg) => {
      const ph = digits(r.parent_phone);
      if (ph.length >= 7 && priorPhones.has(ph)) return true;
      const em = email(r.parent_email);
      if (em && priorEmails.has(em)) return true;
      if (r.child_date_of_birth && priorDobLast.has(`${r.child_date_of_birth}|${nn(r.child_last_name)}`)) return true;
      return false;
    };

    return pending
      .map((r) => ({ reg: r, returning: isReturning(r) }))
      .sort((a, b) => (a.reg.created_at || "").localeCompare(b.reg.created_at || ""));
  }, [regs, targetYear]);

  const visible = rows.filter((x) => filter === "all" || (filter === "returning" ? x.returning : !x.returning));
  const returningCount = rows.filter((x) => x.returning).length;

  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisibleSelected = visible.length > 0 && visible.every((x) => selected.has(x.reg.id));
  const toggleAll = () => setSelected((p) => {
    const n = new Set(p);
    if (allVisibleSelected) visible.forEach((x) => n.delete(x.reg.id));
    else visible.forEach((x) => n.add(x.reg.id));
    return n;
  });

  const approve = async (ids: string[]) => {
    if (ids.length === 0) return;
    setApproving(true);
    let ok = 0, fail = 0;
    // Reuse the same admin RPC the Registrations page uses — one call per row.
    for (const id of ids) {
      const { error } = await supabase.rpc("admin_set_registration_approval" as never, { _registration_id: id, _approved: true } as never);
      if (error) fail++; else ok++;
    }
    setApproving(false);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["rereg-approvals"] });
    qc.invalidateQueries({ queryKey: ["reregistration-readiness"] });
    if (fail === 0) toast.success(`Approved ${ok} youth for check-in`);
    else toast.warning(`Approved ${ok}, but ${fail} failed — try those again`);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto text-white">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-green-400" /> Re-Registration Approvals</h1>
        <p className="text-white/50 text-sm mt-1">Approve re-registered youth for check-in — in bulk. Returning youth are flagged so you can clear them fast.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-white/60 text-xs block mb-1">Program year</label>
          <Select value={targetYear} onValueChange={(v) => { setTargetYear(v); setSelected(new Set()); }}>
            <SelectTrigger className="w-40 bg-white/5 border-white/15 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>{yearOptions.map((y) => <SelectItem key={y} value={y}>{shortProgramYear(y)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["rereg-approvals"] })} className="border-white/15 text-white hover:bg-white/10 gap-1.5 h-9">
          <RotateCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" /></div>
      ) : (
        <>
          {/* KPI + quick actions */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-lg p-4 text-center"><p className="text-3xl font-bold">{rows.length}</p><p className="text-white/50 text-xs mt-1">Pending approval</p></div>
            <div className="bg-white/5 rounded-lg p-4 text-center"><p className="text-3xl font-bold text-green-400">{returningCount}</p><p className="text-white/50 text-xs mt-1">Returning</p></div>
            <div className="bg-white/5 rounded-lg p-4 text-center"><p className="text-3xl font-bold text-sky-400">{rows.length - returningCount}</p><p className="text-white/50 text-xs mt-1">Brand new</p></div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["all", "returning", "new"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${filter === f ? "bg-[#CC0000] text-white" : "bg-white/5 text-white/60 hover:text-white"}`}>
                {f === "all" ? "All pending" : f === "returning" ? "Returning" : "Brand new"}
              </button>
            ))}
            <div className="flex-1" />
            {returningCount > 0 && (
              <Button size="sm" variant="outline" disabled={approving} onClick={() => approve(rows.filter((x) => x.returning).map((x) => x.reg.id))} className="border-green-500/40 text-green-400 hover:bg-green-500/10 gap-1.5">
                Approve all returning ({returningCount})
              </Button>
            )}
            <Button size="sm" disabled={approving || selected.size === 0} onClick={() => approve([...selected])} className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> {approving ? "Approving…" : `Approve selected (${selected.size})`}
            </Button>
          </div>

          {/* list */}
          <div className="rounded-xl border border-white/10 overflow-hidden">
            {visible.length === 0 ? (
              <p className="text-white/40 text-center py-12 text-sm bg-zinc-900/60">Nothing pending here. 🎉</p>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-2 bg-white/5 text-white/50 text-xs">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
                  <span>Select all ({visible.length})</span>
                </div>
                <div className="divide-y divide-white/5 bg-zinc-900/60">
                  {visible.map((x) => (
                    <label key={x.reg.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-white/[0.03]">
                      <Checkbox checked={selected.has(x.reg.id)} onCheckedChange={() => toggle(x.reg.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{x.reg.child_first_name} {x.reg.child_last_name}</p>
                        <p className="text-white/35 text-xs truncate">{x.reg.child_boxing_program || "—"}</p>
                      </div>
                      {x.returning
                        ? <span className="text-green-400 text-xs font-medium shrink-0">Returning</span>
                        : <span className="text-sky-400 text-xs font-medium shrink-0">New</span>}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <p className="text-white/30 text-xs text-center">
            Approving a youth lets them be found at the check-in kiosks. "Returning" = matches an approved registration from a prior year (by parent phone, email, or date of birth).
          </p>
        </>
      )}
    </div>
  );
}
