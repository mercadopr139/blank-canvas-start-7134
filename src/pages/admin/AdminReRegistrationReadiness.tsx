import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, Search, Download, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { getCurrentAttendanceYear, nextProgramYear, shortProgramYear } from "@/lib/programYear";

/* One registration row, trimmed to what we need for matching. */
type Reg = {
  child_first_name: string | null;
  child_last_name: string | null;
  child_date_of_birth: string | null;
  child_boxing_program: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  program_year: string | null;
  approved_for_attendance: boolean | null;
  archived_at: string | null;
};

type Status = "yes" | "review" | "no";
type Matched = { reg: Reg; status: Status; reason: string; candidate?: string };

/* ── identity helpers: match on identity, not spelling ── */
const digits = (s?: string | null) => (s || "").replace(/\D/g, "");
const email = (s?: string | null) => (s || "").trim().toLowerCase();
// Strip accents, punctuation, spaces, case — so "José M." ≈ "jose m".
const nn = (s?: string | null) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Levenshtein edit distance — how many single-character typos apart two strings are.
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export default function AdminReRegistrationReadiness() {
  const [fromYear, setFromYear] = useState<string>(() => getCurrentAttendanceYear());
  const [toYear, setToYear] = useState<string>(() => nextProgramYear(getCurrentAttendanceYear()));
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["reregistration-readiness"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("child_first_name, child_last_name, child_date_of_birth, child_boxing_program, parent_phone, parent_email, program_year, approved_for_attendance, archived_at");
      if (error) throw error;
      return (data || []) as unknown as Reg[];
    },
  });

  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    regs.forEach((r) => r.program_year && set.add(r.program_year));
    set.add(getCurrentAttendanceYear());
    set.add(nextProgramYear(getCurrentAttendanceYear()));
    return [...set].sort().reverse();
  }, [regs]);

  const { rows, stats } = useMemo(() => {
    // Active (approved, not archived) youth tagged for the "from" year — everyone who can currently check in.
    const fromCohort = regs.filter((r) => r.program_year === fromYear && r.approved_for_attendance && !r.archived_at);
    const toCohort = regs.filter((r) => r.program_year === toYear);

    // Build fast lookup sets from the re-registration cohort.
    const toPhones = new Set<string>();
    const toEmails = new Set<string>();
    const toDobLast = new Set<string>();     // exact: dob + last name
    const toNameExact = new Set<string>();
    const toDobMap = new Map<string, string>(); // dob → a display name (for "same DOB, different name")
    const toArr: { full: string; display: string }[] = [];
    toCohort.forEach((r) => {
      const ph = digits(r.parent_phone); if (ph.length >= 7) toPhones.add(ph);
      const em = email(r.parent_email); if (em) toEmails.add(em);
      const last = nn(r.child_last_name);
      const display = `${r.child_first_name ?? ""} ${r.child_last_name ?? ""}`.trim();
      if (r.child_date_of_birth) {
        toDobLast.add(`${r.child_date_of_birth}|${last}`);
        if (!toDobMap.has(r.child_date_of_birth)) toDobMap.set(r.child_date_of_birth, display);
      }
      const full = nn(`${r.child_first_name}${r.child_last_name}`);
      if (full) { toNameExact.add(full); toArr.push({ full, display }); }
    });

    const classify = (r: Reg): Matched => {
      // Strong identity signals → confident match, even if the name is misspelled.
      const ph = digits(r.parent_phone);
      if (ph.length >= 7 && toPhones.has(ph)) return { reg: r, status: "yes", reason: "matched by parent phone" };
      const em = email(r.parent_email);
      if (em && toEmails.has(em)) return { reg: r, status: "yes", reason: "matched by parent email" };
      const last = nn(r.child_last_name);
      if (r.child_date_of_birth && toDobLast.has(`${r.child_date_of_birth}|${last}`)) return { reg: r, status: "yes", reason: "matched by date of birth" };
      const full = nn(`${r.child_first_name}${r.child_last_name}`);
      if (full && toNameExact.has(full)) return { reg: r, status: "yes", reason: "matched by name" };

      // Uncertain → Review bucket (a human confirms).
      let best: { full: string; display: string } | null = null, bestD = 99;
      for (const t of toArr) { const d = lev(full, t.full); if (d < bestD) { bestD = d; best = t; } }
      if (best && bestD > 0 && bestD <= 2) return { reg: r, status: "review", reason: `spelling close to "${best.display}"?`, candidate: best.display };
      if (r.child_date_of_birth && toDobMap.has(r.child_date_of_birth)) return { reg: r, status: "review", reason: `same birth date as "${toDobMap.get(r.child_date_of_birth)}"?`, candidate: toDobMap.get(r.child_date_of_birth) };

      return { reg: r, status: "no", reason: "" };
    };

    const rows = fromCohort
      .map(classify)
      .sort((a, b) => (nn(a.reg.child_last_name) + nn(a.reg.child_first_name)).localeCompare(nn(b.reg.child_last_name) + nn(b.reg.child_first_name)));

    const yes = rows.filter((x) => x.status === "yes").length;
    const review = rows.filter((x) => x.status === "review").length;
    return { rows, stats: { total: rows.length, yes, review, no: rows.length - yes - review } };
  }, [regs, fromYear, toYear]);

  const visible = rows.filter((x) => {
    if (filter !== "all" && x.status !== filter) return false;
    if (q.trim()) {
      const hay = `${x.reg.child_first_name} ${x.reg.child_last_name}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const exportVisible = () => {
    const label = (s: Status) => (s === "yes" ? "Re-registered" : s === "review" ? "Needs review" : "Not yet");
    const lines = [
      ["First Name", "Last Name", "Program", "Status", "Note"],
      ...visible.map((x) => [x.reg.child_first_name || "", x.reg.child_last_name || "", x.reg.child_boxing_program || "", label(x.status), x.reason]),
    ];
    const csv = lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reregistration-${toYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pct = stats.total > 0 ? Math.round((stats.yes / stats.total) * 100) : 0;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto text-white">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><UserCheck className="w-6 h-6 text-red-400" /> Re-Registration Readiness</h1>
        <p className="text-white/50 text-sm mt-1">
          Who from {shortProgramYear(fromYear)} has re-registered for {shortProgramYear(toYear)} — and who still needs to.
        </p>
      </div>

      {/* year pickers */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-white/60 text-xs block mb-1">Returning from</label>
          <Select value={fromYear} onValueChange={setFromYear}>
            <SelectTrigger className="w-40 bg-white/5 border-white/15 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>{yearOptions.map((y) => <SelectItem key={y} value={y}>{shortProgramYear(y)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-white/60 text-xs block mb-1">Re-registering for</label>
          <Select value={toYear} onValueChange={setToYear}>
            <SelectTrigger className="w-40 bg-white/5 border-white/15 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>{yearOptions.map((y) => <SelectItem key={y} value={y}>{shortProgramYear(y)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" /></div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-white/50 text-xs mt-1">Active {shortProgramYear(fromYear)} youth</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{stats.yes}</p>
              <p className="text-white/50 text-xs mt-1">Re-registered ({pct}%)</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-sky-400">{stats.review}</p>
              <p className="text-white/50 text-xs mt-1">Needs review</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-amber-400">{stats.no}</p>
              <p className="text-white/50 text-xs mt-1">Not yet</p>
            </div>
          </div>

          {/* controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a youth's name…" className="pl-9 bg-white/5 border-white/15 text-white" />
            </div>
            {(["all", "no", "review", "yes"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${filter === f ? "bg-[#CC0000] text-white" : "bg-white/5 text-white/60 hover:text-white"}`}
              >
                {f === "all" ? "All" : f === "no" ? "Not yet" : f === "review" ? "Review" : "Re-registered"}
              </button>
            ))}
            <Button size="sm" variant="outline" onClick={exportVisible} className="border-white/15 text-white hover:bg-white/10 gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export list
            </Button>
          </div>

          {/* list */}
          <Card className="bg-zinc-900/60 border-white/10">
            <CardContent className="p-0 divide-y divide-white/5">
              {visible.length === 0 ? (
                <p className="text-white/40 text-center py-12 text-sm">No youth match.</p>
              ) : (
                visible.map((x, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm truncate">{x.reg.child_first_name} {x.reg.child_last_name}</p>
                      <p className="text-white/35 text-xs truncate">
                        {x.reg.child_boxing_program || "—"}{x.reason ? <span className="text-white/45"> · {x.reason}</span> : null}
                      </p>
                    </div>
                    {x.status === "yes" ? (
                      <span className="flex items-center gap-1.5 text-green-400 text-xs font-medium shrink-0"><CheckCircle2 className="w-4 h-4" /> Re-registered</span>
                    ) : x.status === "review" ? (
                      <span className="flex items-center gap-1.5 text-sky-400 text-xs font-medium shrink-0"><HelpCircle className="w-4 h-4" /> Review</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-400 text-xs font-medium shrink-0"><AlertCircle className="w-4 h-4" /> Not yet</span>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <p className="text-white/30 text-xs text-center">
            Matches use parent phone, parent email, and date of birth first (reliable even when a name is misspelled),
            then fall back to name similarity. "Review" = a likely-but-unconfirmed match for a human to eyeball. Read-only — changes nothing.
          </p>
        </>
      )}
    </div>
  );
}
