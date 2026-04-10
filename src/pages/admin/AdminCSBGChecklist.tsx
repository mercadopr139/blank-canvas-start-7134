import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ExternalLink, Link2 } from "lucide-react";

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
  const [editingLink, setEditingLink] = useState<string | null>(null);
  const [linkValue, setLinkValue] = useState("");

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

  const upsertLinkMutation = useMutation({
    mutationFn: async ({ docType, link }: { docType: string; link: string }) => {
      const trimmed = link.trim();
      const hasLink = trimmed.length > 0;
      const existing = items.find((i: any) => i.document_type === docType);
      if (existing) {
        const { error } = await supabase.from("csbg_monthly_checklists")
          .update({ document_link: trimmed || null, is_collected: hasLink })
          .eq("id", existing.id);
        if (error) throw error;
      } else if (hasLink) {
        const { error } = await supabase.from("csbg_monthly_checklists")
          .insert({ month, year, document_type: docType, document_link: trimmed, is_collected: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["csbg-checklist", month, year] });
      setEditingLink(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getItem = (docType: string) => items.find((i: any) => i.document_type === docType);
  const isCollected = (docType: string) => getItem(docType)?.is_collected ?? false;
  const getLink = (docType: string) => (getItem(docType) as any)?.document_link ?? "";
  const collectedCount = DOC_TYPES.filter(d => isCollected(d)).length;
  const pct = Math.round((collectedCount / DOC_TYPES.length) * 100);

  const saveLink = (docType: string) => {
    upsertLinkMutation.mutate({ docType, link: linkValue });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-full">
      <div className="border-b border-white/10 pb-3">
        <h2 className="text-lg font-semibold">Monthly Document Checklist</h2>
        <p className="text-xs text-white/50">Paste a Google Drive link for each document — items turn green automatically</p>
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

      <div className="space-y-2">
        {DOC_TYPES.map((doc) => {
          const collected = isCollected(doc);
          const link = getLink(doc);
          const isEditing = editingLink === doc;

          return (
            <div
              key={doc}
              className={`rounded-lg border transition-colors ${
                collected ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {collected
                  ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                }
                <span className={`text-sm flex-1 ${collected ? "text-green-300" : "text-red-300"}`}>{doc}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {link && !isEditing && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open
                    </a>
                  )}
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setEditingLink(null);
                      } else {
                        setEditingLink(doc);
                        setLinkValue(link);
                      }
                    }}
                    className="text-white/40 hover:text-white/70 transition-colors"
                    title={link ? "Edit link" : "Add link"}
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {isEditing && (
                <div className="px-4 pb-3 flex gap-2">
                  <Input
                    autoFocus
                    value={linkValue}
                    onChange={(e) => setLinkValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveLink(doc); if (e.key === "Escape") setEditingLink(null); }}
                    placeholder="Paste Google Drive link here…"
                    className="bg-white/5 border-white/10 text-white text-xs h-8 flex-1"
                  />
                  <button
                    onClick={() => saveLink(doc)}
                    className="text-xs px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminCSBGChecklist;
