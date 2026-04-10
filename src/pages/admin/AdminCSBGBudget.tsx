import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const LINE_ITEMS = [
  { name: "Youth Boxing Equipment & Safety Gear", budget: 2961 },
  { name: "Coaching Training Equipment", budget: 315 },
  { name: "Strength & Conditioning Equipment", budget: 3024 },
  { name: "Operations & Program Director", budget: 12751.20 },
  { name: "Program Coordinator", budget: 8820 },
  { name: "Boxing Coaches Stipends", budget: 4536 },
  { name: "Facility Lease", budget: 13708.80 },
  { name: "Heating & Gas Utilities", budget: 1564 },
  { name: "Electric Utility Services", budget: 2320 },
];

const TOTAL_GRANT = 50000;

const AdminCSBGBudget = () => {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [editCell, setEditCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [noteCell, setNoteCell] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");

  const { data: actuals = [] } = useQuery({
    queryKey: ["csbg-budget", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("csbg_budget_actuals")
        .select("*")
        .eq("year", year);
      if (error) throw error;
      return data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ line_item_name, month, actual_amount, notes }: { line_item_name: string; month: number; actual_amount?: number; notes?: string }) => {
      const existing = actuals.find((a: any) => a.line_item_name === line_item_name && a.month === month);
      const budget = LINE_ITEMS.find(l => l.name === line_item_name)?.budget || 0;
      if (existing) {
        const updates: any = {};
        if (actual_amount !== undefined) updates.actual_amount = actual_amount;
        if (notes !== undefined) updates.notes = notes;
        const { error } = await supabase.from("csbg_budget_actuals").update(updates).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("csbg_budget_actuals").insert({
          line_item_name, month, year, budgeted_amount: budget,
          actual_amount: actual_amount ?? 0,
          notes: notes ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["csbg-budget", year] }),
    onError: (e: any) => toast.error(e.message),
  });

  const getActual = (name: string, m: number) => {
    const row = actuals.find((a: any) => a.line_item_name === name && a.month === m);
    return row ? Number(row.actual_amount) : 0;
  };
  const getNote = (name: string, m: number) => {
    const row = actuals.find((a: any) => a.line_item_name === name && a.month === m);
    return row?.notes || "";
  };

  const totalSpent = useMemo(() => actuals.reduce((s: number, a: any) => s + Number(a.actual_amount), 0), [actuals]);
  const remaining = TOTAL_GRANT - totalSpent;

  const saveEdit = (name: string, m: number) => {
    const val = parseFloat(editValue);
    if (!isNaN(val)) upsertMutation.mutate({ line_item_name: name, month: m, actual_amount: val });
    setEditCell(null);
  };
  const saveNote = (name: string, m: number) => {
    upsertMutation.mutate({ line_item_name: name, month: m, notes: noteValue });
    setNoteCell(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-lg font-semibold">Budget vs. Actual Tracker</h2>
          <p className="text-xs text-white/50">CSBG Grant · Total: $50,000</p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{[currentYear - 1, currentYear, currentYear + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="flex gap-4 flex-wrap text-sm">
        <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2">
          <p className="text-white/50 text-xs">Total Spent</p>
          <p className="text-white font-semibold">${totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`border rounded-lg px-4 py-2 ${remaining >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
          <p className="text-white/50 text-xs">Remaining</p>
          <p className={`font-semibold ${remaining >= 0 ? "text-green-400" : "text-red-400"}`}>${remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-xs min-w-[800px]">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-2 text-white/50 font-medium sticky left-0 bg-black z-10">Line Item</th>
              <th className="text-right py-2 px-2 text-white/50 font-medium">Budget</th>
              {MONTHS.map((m, i) => <th key={i} className="text-right py-2 px-1 text-white/50 font-medium">{m}</th>)}
              <th className="text-right py-2 px-2 text-white/50 font-medium">Spent</th>
              <th className="text-right py-2 px-2 text-white/50 font-medium">Bal</th>
            </tr>
          </thead>
          <tbody>
            {LINE_ITEMS.map((item) => {
              const spent = Array.from({ length: 12 }, (_, i) => getActual(item.name, i + 1)).reduce((a, b) => a + b, 0);
              const bal = item.budget - spent;
              return (
                <tr key={item.name} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2 px-2 text-white/80 sticky left-0 bg-black z-10 max-w-[140px] truncate" title={item.name}>{item.name}</td>
                  <td className="text-right py-2 px-2 text-white/60">${item.budget.toLocaleString()}</td>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = i + 1;
                    const key = `${item.name}-${m}`;
                    const val = getActual(item.name, m);
                    const note = getNote(item.name, m);
                    if (editCell === key) {
                      return (
                        <td key={i} className="py-1 px-1">
                          <Input type="number" autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => saveEdit(item.name, m)} onKeyDown={(e) => e.key === "Enter" && saveEdit(item.name, m)} className="h-6 text-xs w-16 bg-white/10 border-sky-300/50 text-white p-1" />
                        </td>
                      );
                    }
                    if (noteCell === key) {
                      return (
                        <td key={i} className="py-1 px-1">
                          <Textarea autoFocus value={noteValue} onChange={(e) => setNoteValue(e.target.value)} onBlur={() => saveNote(item.name, m)} className="h-16 text-xs w-24 bg-white/10 border-sky-300/50 text-white p-1" placeholder="Add note…" />
                        </td>
                      );
                    }
                    return (
                      <td key={i} className="text-right py-2 px-1 cursor-pointer group" onClick={() => { setEditCell(key); setEditValue(String(val || "")); }}>
                        <span className={`${val > 0 ? "text-white" : "text-white/20"}`}>{val > 0 ? `$${val.toLocaleString()}` : "–"}</span>
                        {note && <span className="ml-0.5 text-yellow-400" title={note}>📝</span>}
                      </td>
                    );
                  })}
                  <td className="text-right py-2 px-2 text-white font-medium">${spent.toLocaleString()}</td>
                  <td className={`text-right py-2 px-2 font-medium ${bal >= 0 ? "text-green-400" : "text-red-400"}`}>${bal.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-white/30">Click any month cell to enter actual spend. Emoji 📝 indicates a note is attached.</p>
    </div>
  );
};

export default AdminCSBGBudget;
