import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const REVENUE_TYPES = ["Donation", "Sponsorship", "Fee for Service", "Re-Grant"] as const;
const PAYMENT_METHODS = ["Cash", "Check", "Zelle", "Stripe", "ACH", "In-Kind"] as const;

interface RevenueRecord {
  id: string;
  date: string;
  amount: number;
  revenue_type: string;
  payment_method: string | null;
  reference_id: string | null;
  logged_by: string | null;
  notes: string | null;
}

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  revenue_type: "Donation",
  payment_method: "",
  reference_id: "",
  logged_by: "",
  notes: "",
};

interface Props {
  supporterId: string;
  supporterName: string;
}

const SupporterRevenueSection = ({ supporterId, supporterName }: Props) => {
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("revenue")
      .select("id, date, amount, revenue_type, payment_method, reference_id, logged_by, notes")
      .eq("supporter_id", supporterId)
      .order("date", { ascending: false });
    setRecords((data ?? []) as RevenueRecord[]);
    setLoading(false);
  }, [supporterId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (r: RevenueRecord) => {
    setEditId(r.id);
    setForm({
      date: r.date,
      amount: String(r.amount),
      revenue_type: r.revenue_type,
      payment_method: r.payment_method || "",
      reference_id: r.reference_id || "",
      logged_by: r.logged_by || "",
      notes: r.notes || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.date || !form.amount) return;
    setSaving(true);
    const payload = {
      supporter_id: supporterId,
      date: form.date,
      amount: parseFloat(form.amount) || 0,
      revenue_type: form.revenue_type,
      payment_method: form.payment_method || null,
      reference_id: form.reference_id || null,
      logged_by: form.logged_by || null,
      notes: form.notes || null,
    };
    if (editId) {
      await supabase.from("revenue").update(payload).eq("id", editId);
    } else {
      await supabase.from("revenue").insert(payload);
    }
    setSaving(false);
    setFormOpen(false);
    await fetchRecords();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("revenue").delete().eq("id", deleteId);
    setDeleteId(null);
    await fetchRecords();
  };

  const fmtCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };

  const total = records.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-white/70 text-sm font-medium">Revenue History</Label>
        <Button
          size="sm"
          className="bg-green-500 hover:bg-green-400 text-black gap-1 h-7 text-xs"
          onClick={openNew}
        >
          <Plus className="w-3 h-3" />
          Add Revenue
        </Button>
      </div>

      {/* Inline form */}
      {formOpen && (
        <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-3">
          <p className="text-xs font-medium text-green-400">
            {editId ? "Edit Revenue Entry" : "New Revenue Entry"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Amount *</Label>
              <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-8 text-xs" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Revenue Type</Label>
              <Select value={form.revenue_type} onValueChange={(v) => setForm({ ...form, revenue_type: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {REVENUE_TYPES.map((t) => <SelectItem key={t} value={t} className="text-white text-xs focus:bg-white/10 focus:text-white">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Payment Method</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m} className="text-white text-xs focus:bg-white/10 focus:text-white">{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Reference ID */}
            <div className="flex-1 space-y-1">
              <Label className="text-white/50 text-xs">Ref / Check #</Label>
              <Input value={form.reference_id} onChange={(e) => setForm({ ...form, reference_id: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-8 text-xs" placeholder="Check #, code…" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-white/50 text-xs">Logged By</Label>
            <Input value={form.logged_by} onChange={(e) => setForm({ ...form, logged_by: e.target.value })}
              className="bg-white/5 border-white/10 text-white h-8 text-xs" placeholder="Name…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)} className="text-white/50 hover:bg-white/10 h-7 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.date || !form.amount || saving}
              className="bg-green-500 hover:bg-green-400 text-black h-7 text-xs">
              {saving ? "Saving…" : editId ? "Update" : "Add"}
            </Button>
          </div>
        </div>
      )}

      {/* Records list */}
      {loading ? (
        <p className="text-xs text-white/40 py-2">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-xs text-white/40 py-2">No revenue records for this supporter.</p>
      ) : (
        <>
          <div className="rounded-md border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-3 py-2 text-left font-medium text-white/60">Date</th>
                  <th className="px-3 py-2 text-right font-medium text-white/60">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-white/60">Type</th>
                  <th className="px-3 py-2 text-left font-medium text-white/60">Ref #</th>
                  <th className="px-3 py-2 w-16 text-right font-medium text-white/60"></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-3 py-1.5 text-white/70">{fmtDate(r.date)}</td>
                    <td className="px-3 py-1.5 text-right text-green-400 font-medium">{fmtCurrency(r.amount)}</td>
                    <td className="px-3 py-1.5 text-white/60">{r.revenue_type}</td>
                    <td className="px-3 py-1.5 text-white/50">{r.reference_id || "—"}</td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex justify-end gap-0.5">
                        <button onClick={() => openEdit(r)} className="p-1 rounded text-white/30 hover:text-green-400 hover:bg-white/5" title="Edit">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => setDeleteId(r.id)} className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-white/5" title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-white/50 text-right">
            Total: <span className="text-green-400 font-medium">{fmtCurrency(total)}</span> ({records.length} record{records.length !== 1 ? "s" : ""})
          </p>
        </>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="rounded-md border border-red-600/30 bg-red-950/30 p-3 flex items-center justify-between">
          <span className="text-xs text-white/70">Delete this revenue record?</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDeleteId(null)} className="text-white/50 hover:bg-white/10 h-6 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white h-6 text-xs">Delete</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupporterRevenueSection;
