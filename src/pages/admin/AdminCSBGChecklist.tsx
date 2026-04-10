import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const DOC_TYPES = [
  "Invoice",
  "Payroll Register / General Ledger",
  "Paystubs",
  "Bank Statement with highlighted transactions",
  "Rent Receipt",
  "Utility Bills (gas and electric when applicable)",
  "Vendor Invoices",
  "Cost Allocation Memo (when applicable)",
  "EmpowOR Outcome Snapshot",
  "Document Cover Checklist",
];

const AdminCSBGChecklist = () => {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: items = [] } = useQuery({
    queryKey: ["csbg-checklist", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("csbg_monthly_checklists")
        .select("*")
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return data;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (docType: string) => {
      const existing = items.find((i: any) => i.document_type === docType);
      if (existing) {
        const { error } = await supabase.from("csbg_monthly_checklists").update({ is_collected: !existing.is_collected }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("csbg_monthly_checklists").insert({ month, year, document_type: docType, is_collected: true });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["csbg-checklist", month, year] }),
    onError: (e: any) => toast.error(e.message),
  });

  const isCollected = (docType: string) => items.find((i: any) => i.document_type === docType)?.is_collected ?? false;
  const collectedCount = DOC_TYPES.filter(d => isCollected(d)).length;
  const pct = Math.round((collectedCount / DOC_TYPES.length) * 100);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-full">
      <div className="border-b border-white/10 pb-3">
        <h2 className="text-lg font-semibold">Monthly Document Checklist</h2>
        <p className="text-xs text-white/50">Track required documents for each monthly packet</p>
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
          <span className="text-sm text-white/70">Packet Completion</span>
          <span className={`text-sm font-bold ${pct === 100 ? "text-green-400" : "text-white"}`}>{pct}%</span>
        </div>
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-white/40 mt-1">{collectedCount} of {DOC_TYPES.length} documents collected</p>
      </div>

      <div className="space-y-1">
        {DOC_TYPES.map((doc) => {
          const collected = isCollected(doc);
          return (
            <div
              key={doc}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                collected ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
              }`}
              onClick={() => toggleMutation.mutate(doc)}
            >
              {collected ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
              <span className={`text-sm flex-1 ${collected ? "text-green-300" : "text-red-300"}`}>{doc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminCSBGChecklist;
