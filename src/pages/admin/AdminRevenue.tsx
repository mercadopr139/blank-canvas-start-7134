import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import SupporterAutocomplete from "@/components/admin/SupporterAutocomplete";
import SendReceiptFlow from "@/components/admin/SendReceiptFlow";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Constants ────────────────────────────────────────────────────────────────

const REVENUE_TYPES = ["Donation", "Sponsorship", "Fee for Service", "Re-Grant"] as const;
const PAYMENT_METHODS = ["Cash", "Check", "Zelle", "Stripe", "ACH", "In-Kind"] as const;

interface RevenueRow {
  id: string;
  supporter_id: string | null;
  supporter_name: string | null;
  date: string;
  amount: number;
  revenue_type: string;
  payment_method: string | null;
  invoice_sent: boolean;
  reporting_required: boolean;
  thank_you_sent: boolean;
  thank_you_date: string | null;
  logged_by: string | null;
  notes: string | null;
}

const emptyForm = {
  supporter_id: "" as string,
  supporter_email: "",
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  revenue_type: "Donation",
  payment_method: "",
  invoice_sent: false,
  reporting_required: false,
  thank_you_sent: false,
  thank_you_date: "",
  logged_by: "",
  notes: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

const AdminRevenue = () => {
  const { toast } = useToast();

  // ── Receipt flow state ──────────────────────────────────────────────────
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptSupporterId, setReceiptSupporterId] = useState("");
  const [receiptSupporterName, setReceiptSupporterName] = useState("");

  // ── Data state ──────────────────────────────────────────────────────────
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("revenue")
      .select("id, supporter_id, date, amount, revenue_type, payment_method, invoice_sent, reporting_required, thank_you_sent, thank_you_date, logged_by, notes")
      .order("date", { ascending: false });

    // Fetch supporter names for linked records
    const revenueRows = (data ?? []) as any[];
    const supporterIds = [...new Set(revenueRows.map(r => r.supporter_id).filter(Boolean))];
    let supporterMap: Record<string, string> = {};
    if (supporterIds.length > 0) {
      const { data: sData } = await supabase.from("supporters").select("id, name").in("id", supporterIds);
      (sData ?? []).forEach((s: any) => { supporterMap[s.id] = s.name; });
    }

    setRows(revenueRows.map(r => ({
      ...r,
      supporter_name: r.supporter_id ? (supporterMap[r.supporter_id] || "Unknown") : null,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Modal state ─────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [supporterSearch, setSupporterSearch] = useState("");

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setSupporterSearch("");
    setModalOpen(true);
  };

  const openEdit = (r: RevenueRow) => {
    setEditId(r.id);
    setSupporterSearch(r.supporter_name || "");
    setForm({
      supporter_id: r.supporter_id || "",
      supporter_email: "",
      date: r.date,
      amount: String(r.amount),
      revenue_type: r.revenue_type,
      payment_method: r.payment_method || "",
      invoice_sent: r.invoice_sent,
      reporting_required: r.reporting_required,
      thank_you_sent: r.thank_you_sent,
      thank_you_date: r.thank_you_date || "",
      logged_by: r.logged_by || "",
      notes: r.notes || "",
    });
    setModalOpen(true);
  };

  /** Find or create a supporter by name, optionally with email */
  const findOrCreateSupporter = async (name: string, email?: string): Promise<string | null> => {
    const { data: existing } = await supabase
      .from("supporters")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (existing) {
      if (email) await supabase.from("supporters").update({ email }).eq("id", existing.id);
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from("supporters")
      .insert({ name, email: email || null })
      .select("id")
      .single();
    if (error) return null;
    return created.id;
  };

  const isQualifyingForReceipt = (type: string) =>
    type === "Donation" || type === "Sponsorship";

  const handleSave = async () => {
    if (!form.date || !form.amount) return;
    setSaving(true);

    // If supporter not yet linked but we have a name typed, find/create
    let supporterId = form.supporter_id || null;
    if (!supporterId && supporterSearch.trim()) {
      supporterId = await findOrCreateSupporter(supporterSearch.trim(), form.supporter_email.trim() || undefined);
      if (supporterId) {
        setForm(f => ({ ...f, supporter_id: supporterId! }));
      }
    } else if (supporterId && form.supporter_email.trim()) {
      // Update email on existing supporter
      await supabase.from("supporters").update({ email: form.supporter_email.trim() }).eq("id", supporterId);
    }

    const payload = {
      supporter_id: supporterId,
      date: form.date,
      amount: parseFloat(form.amount.replace(/,/g, "")) || 0,
      revenue_type: form.revenue_type,
      payment_method: form.payment_method || null,
      invoice_sent: form.invoice_sent,
      reporting_required: form.reporting_required,
      thank_you_sent: form.thank_you_sent,
      thank_you_date: form.thank_you_date || null,
      logged_by: form.logged_by || null,
      notes: form.notes || null,
    };

    if (editId) {
      await supabase.from("revenue").update(payload).eq("id", editId);
    } else {
      await supabase.from("revenue").insert(payload);
    }

    // Also sync to donations table (for Master Revenue Tracker)
    const donorName = supporterSearch.trim() || "N/A";
    const donationsPayload: Record<string, any> = {
      donor_name: donorName,
      source_name: donorName,
      amount: payload.amount,
      date_received: form.date,
      deposit_date: form.date,
      revenue_type: form.revenue_type === "Sponsorship" ? "Fundraising" : form.revenue_type as any,
      method: (payload.payment_method || "Other") as any,
      receipt_status: "Not Needed" as any,
      reference_id: null,
      notes: payload.notes,
      supporter_id: supporterId,
    };
    if (form.revenue_type === "Sponsorship") {
      donationsPayload.revenue_description = "Sponsor";
    }

    if (!editId) {
      await supabase.from("donations").insert(donationsPayload as any);
    }

    toast({ title: editId ? "Revenue updated." : "Revenue saved." });
    setSaving(false);
    setModalOpen(false);
    await fetchRows();

    // Trigger receipt flow for qualifying new entries
    if (!editId && isQualifyingForReceipt(form.revenue_type) && supporterId) {
      setReceiptSupporterId(supporterId);
      setReceiptSupporterName(donorName);
      setReceiptOpen(true);
    }
  };

  // ── Delete state ────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from("revenue").delete().eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    await fetchRows();
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const fmtCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };

  const BoolIcon = ({ value }: { value: boolean }) =>
    value
      ? <Check className="w-4 h-4 text-green-400 mx-auto" />
      : <X className="w-4 h-4 text-white/20 mx-auto" />;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="bg-black text-white flex flex-col" style={{ height: 'calc(100vh - 73px)' }}>
      {/* Page header */}
      <div className="border-b border-white/10 px-4 py-3 flex-shrink-0">
        <h2 className="text-base font-semibold text-green-400">Revenue</h2>
        <p className="text-xs text-white/50">Track all incoming revenue records</p>
      </div>

      <div className="flex flex-col flex-1 min-h-0 px-4 py-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <p className="text-sm text-white/50">{rows.length} record{rows.length !== 1 ? "s" : ""}</p>
          <Button
            size="sm"
            className="bg-green-500 hover:bg-green-400 text-black gap-1.5"
            onClick={openNew}
          >
            <Plus className="w-4 h-4" />
            New Revenue Entry
          </Button>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 rounded-lg border border-white/10 overflow-auto">
          <table className="w-full caption-bottom text-sm min-w-[1100px]">
            <thead className="sticky top-0 z-10 bg-black shadow-[0_1px_0_rgba(255,255,255,0.12)] [&_tr]:border-b">
              <tr className="border-b border-white/10">
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Date</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Supporter</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-white/70">Amount</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Revenue Type</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Payment Method</th>
                <th className="h-12 px-4 text-center align-middle font-medium text-white/70">Thank You</th>
                <th className="h-12 px-4 text-center align-middle font-medium text-white/70">Invoice</th>
                <th className="h-12 px-4 text-center align-middle font-medium text-white/70">Reporting</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Logged By</th>
                <th className="h-12 px-4 w-20 text-right align-middle font-medium text-white/70">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr className="border-b border-white/10">
                  <td colSpan={10} className="p-4 text-center py-12 text-white/50 align-middle">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className="border-b border-white/10">
                  <td colSpan={10} className="p-4 text-center py-12 text-white/50 align-middle">No revenue records yet.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/10 transition-colors hover:bg-white/5">
                    <td className="p-4 align-middle text-white/70 text-sm">{fmtDate(r.date)}</td>
                    <td className="p-4 align-middle text-white font-medium text-sm">{r.supporter_name || "—"}</td>
                    <td className="p-4 align-middle text-right text-green-400 font-medium text-sm">{fmtCurrency(r.amount)}</td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.revenue_type}</td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.payment_method || "—"}</td>
                    <td className="p-4 align-middle text-center"><BoolIcon value={r.thank_you_sent} /></td>
                    <td className="p-4 align-middle text-center"><BoolIcon value={r.invoice_sent} /></td>
                    <td className="p-4 align-middle text-center"><BoolIcon value={r.reporting_required} /></td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.logged_by || "—"}</td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 rounded text-white/40 hover:text-green-400 hover:bg-white/5 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(r.id)}
                          className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit Modal ───────────────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent
          className="bg-zinc-900 border-white/10 text-white sm:max-w-md flex flex-col max-h-[85vh] p-0 gap-0"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="px-6 pt-6 pb-2 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-green-400">
                {editId ? "Edit Revenue Entry" : "New Revenue Entry"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-4 pt-2">
             {/* Supporter */}
            <div className="space-y-1.5">
              <SupporterAutocomplete
                label="Supporter"
                value={supporterSearch}
                onChange={(val) => {
                  setSupporterSearch(val);
                  if (!val) setForm({ ...form, supporter_id: "", supporter_email: "" });
                }}
                onSelect={(s) => {
                  setForm({ ...form, supporter_id: s.id, supporter_email: s.email || "" });
                  setSupporterSearch(s.name);
                }}
                placeholder="Type to search supporters…"
              />
            </div>

            {/* Supporter Email */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Supporter Email</Label>
              <Input
                type="email"
                value={form.supporter_email}
                onChange={(e) => setForm({ ...form, supporter_email: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="Email for receipt delivery…"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Date <span className="text-red-400">*</span></Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Amount <span className="text-red-400">*</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => {
                    // Allow digits, dots, and commas while typing
                    const raw = e.target.value.replace(/[^0-9.,]/g, "");
                    setForm({ ...form, amount: raw });
                  }}
                  onBlur={() => {
                    // Format on blur
                    const num = parseFloat(form.amount.replace(/,/g, ""));
                    if (!isNaN(num)) {
                      setForm((f) => ({ ...f, amount: num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
                    }
                  }}
                  onFocus={() => {
                    // Strip formatting on focus for easy editing
                    const num = parseFloat(form.amount.replace(/,/g, ""));
                    if (!isNaN(num)) {
                      setForm((f) => ({ ...f, amount: String(num) }));
                    }
                  }}
                  className="bg-white/5 border-white/10 text-white pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Revenue Type */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Revenue Type <span className="text-red-400">*</span></Label>
              <Select value={form.revenue_type} onValueChange={(v) => setForm({ ...form, revenue_type: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {REVENUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-white focus:bg-white/10 focus:text-white">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Payment Method</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="— not set —" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="text-white focus:bg-white/10 focus:text-white">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Checkboxes */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.invoice_sent}
                  onChange={(e) => setForm({ ...form, invoice_sent: e.target.checked })}
                  className="accent-green-500 w-4 h-4"
                />
                <span className="text-sm text-white/70">Invoice Sent</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.reporting_required}
                  onChange={(e) => setForm({ ...form, reporting_required: e.target.checked })}
                  className="accent-green-500 w-4 h-4"
                />
                <span className="text-sm text-white/70">Reporting Required</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.thank_you_sent}
                  onChange={(e) => setForm({ ...form, thank_you_sent: e.target.checked })}
                  className="accent-green-500 w-4 h-4"
                />
                <span className="text-sm text-white/70">Thank You Sent</span>
              </label>
            </div>

            {/* Thank You Date */}
            {form.thank_you_sent && (
              <div className="space-y-1.5">
                <Label className="text-white/70">Thank You Date</Label>
                <Input
                  type="date"
                  value={form.thank_you_date}
                  onChange={(e) => setForm({ ...form, thank_you_date: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            )}

            {/* Logged By */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Logged By</Label>
              <Input
                value={form.logged_by}
                onChange={(e) => setForm({ ...form, logged_by: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="Person's name…"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Notes</Label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-md bg-white/5 border border-white/10 text-white text-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-white/10 shrink-0 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.date || !form.amount || saving}
              className="bg-green-500 hover:bg-green-400 text-black"
            >
              {saving ? "Saving…" : editId ? "Save Changes" : "Create Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete revenue record?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This will permanently remove the record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-black hover:bg-white/10 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500 text-white"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Receipt Flow ───────────────────────────────────────────────── */}
      <SendReceiptFlow
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        supporterId={receiptSupporterId}
        supporterName={receiptSupporterName}
        onComplete={() => {
          setReceiptOpen(false);
          fetchRows();
        }}
      />
    </div>
  );
};

export default AdminRevenue;
