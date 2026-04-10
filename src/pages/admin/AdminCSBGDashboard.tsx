import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const DOC_TYPES = [
  "Invoice", "Payroll Register / General Ledger", "Paystubs",
  "Bank Statement with highlighted transactions", "Rent Receipt",
  "Utility Bills (gas and electric when applicable)", "Vendor Invoices",
  "Cost Allocation Memo (when applicable)", "EmpowOR Outcome Snapshot",
  "Document Cover Checklist",
];

const AdminCSBGDashboard = () => {
  const _qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dashNote, setDashNote] = useState("");
  const [savedNote, setSavedNote] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["csbg-checklist", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("csbg_monthly_checklists")
        .select("*")
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      // Load the dashboard note from the first item with notes starting with "DASH:"
      const dn = data?.find((d: any) => d.document_type === "__dashboard_note__");
      if (dn) { setDashNote(dn.notes || ""); setSavedNote(dn.notes || ""); }
      else { setDashNote(""); setSavedNote(""); }
      return data?.filter((d: any) => d.document_type !== "__dashboard_note__") || [];
    },
  });

  const saveDashNote = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("csbg_monthly_checklists")
        .select("id")
        .eq("month", month)
        .eq("year", year)
        .eq("document_type", "__dashboard_note__")
        .maybeSingle();
      if (existing) {
        const { error } = await supabase.from("csbg_monthly_checklists").update({ notes: dashNote }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("csbg_monthly_checklists").insert({ month, year, document_type: "__dashboard_note__", is_collected: false, notes: dashNote });
        if (error) throw error;
      }
    },
    onSuccess: () => { setSavedNote(dashNote); toast.success("Note saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const isCollected = (doc: string) => items.find((i: any) => i.document_type === doc)?.is_collected ?? false;
  const collected = DOC_TYPES.filter(d => isCollected(d));
  const missing = DOC_TYPES.filter(d => !isCollected(d));
  const pct = Math.round((collected.length / DOC_TYPES.length) * 100);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-full">
      <div className="border-b border-white/10 pb-3">
        <h2 className="text-lg font-semibold">Document Status Dashboard</h2>
        <p className="text-xs text-white/50">{FULL_MONTHS[month - 1]} {year} — At a glance</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{FULL_MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-24 bg-white/5 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{[year - 1, year, year + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/70">Overall Progress</span>
          <span className={`text-lg font-bold ${pct === 100 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : "text-red-400"}`}>{pct}%</span>
        </div>
        <Progress value={pct} className="h-3" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
          <h3 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Collected ({collected.length})</h3>
          {collected.length === 0 ? <p className="text-xs text-white/30">None yet</p> : (
            <ul className="space-y-1">{collected.map(d => <li key={d} className="text-xs text-green-300">• {d}</li>)}</ul>
          )}
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2"><XCircle className="w-4 h-4" /> Missing ({missing.length})</h3>
          {missing.length === 0 ? <p className="text-xs text-white/30">All collected! 🎉</p> : (
            <ul className="space-y-1">{missing.map(d => <li key={d} className="text-xs text-red-300">• {d}</li>)}</ul>
          )}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-medium text-white/70">Notes for Josh</h3>
        <Textarea value={dashNote} onChange={(e) => setDashNote(e.target.value)} placeholder="Leave updates, questions, or flags here…" className="bg-white/5 border-white/10 text-white text-sm min-h-[80px]" />
        <Button size="sm" onClick={() => saveDashNote.mutate()} disabled={dashNote === savedNote} className="bg-sky-600 hover:bg-sky-500">Save Note</Button>
      </div>
    </div>
  );
};

export default AdminCSBGDashboard;
