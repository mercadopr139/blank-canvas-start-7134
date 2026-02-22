import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SupporterAutocomplete from "@/components/admin/SupporterAutocomplete";

import SendReceiptFlow from "@/components/admin/SendReceiptFlow";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
  reference_id: "",
  logged_by: "",
  notes: "",
};

const SUPPORTER_CATEGORIES = ["Individual", "Organization"] as const;
const SUPPORTER_STATUSES = ["Active", "Lapsed", "Prospect", "New"] as const;
const PRIMARY_STREAMS = ["Donation", "Sponsorship", "Fee for Service", "Re-Grant"] as const;

const emptySupporterDetails = {
  name: "",
  supporter_category: "",
  primary_revenue_stream: "",
  status: "",
  relationship_owner: "",
  email: "",
  phone: "",
  address: "",
  story: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

const AdminRevenue = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

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
      .select("id, supporter_id, date, amount, revenue_type, payment_method, reference_id, logged_by, notes")
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

  // Auto-open modal from sidebar "Add Revenue" button
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setSearchParams({}, { replace: true });
      // Small delay to ensure state is ready
      setTimeout(() => {
        setEditId(null);
        setForm(emptyForm);
        setSupporterSearch("");
        setSupporterDetails(emptySupporterDetails);
        setSupporterDetailsOpen(false);
        setIsNewSupporter(false);
        setModalOpen(true);
      }, 100);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Modal state ─────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
   const [supporterSearch, setSupporterSearch] = useState("");
   const [supporterDetails, setSupporterDetails] = useState(emptySupporterDetails);
   const [supporterDetailsOpen, setSupporterDetailsOpen] = useState(false);
   const [isNewSupporter, setIsNewSupporter] = useState(false);

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setSupporterSearch("");
    setSupporterDetails(emptySupporterDetails);
    setSupporterDetailsOpen(false);
    setIsNewSupporter(false);
    setModalOpen(true);
  };

  const openEdit = (r: RevenueRow) => {
    setEditId(r.id);
    setSupporterSearch(r.supporter_name || "");
    setSupporterDetailsOpen(false);
    setIsNewSupporter(false);
    setForm({
      supporter_id: r.supporter_id || "",
      supporter_email: "",
      date: r.date,
      amount: String(r.amount),
      revenue_type: r.revenue_type,
      payment_method: r.payment_method || "",
      reference_id: (r as any).reference_id || "",
      logged_by: r.logged_by || "",
      notes: r.notes || "",
    });
    // Load supporter details if linked
    if (r.supporter_id) {
      supabase.from("supporters")
        .select("name, email, phone, address, supporter_category, primary_revenue_stream, status, relationship_owner, story")
        .eq("id", r.supporter_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSupporterDetails({
              name: data.name || "",
              supporter_category: data.supporter_category || "",
              primary_revenue_stream: data.primary_revenue_stream || "",
              status: data.status || "",
              relationship_owner: data.relationship_owner || "",
              email: data.email || "",
              phone: data.phone || "",
              address: data.address || "",
              story: data.story || "",
            });
            setForm(f => ({ ...f, supporter_email: data.email || "" }));
          }
        });
    } else {
      setSupporterDetails(emptySupporterDetails);
    }
    setModalOpen(true);
  };

  /** Find or create a supporter by name, with full details */
  const findOrCreateSupporter = async (name: string, details: typeof emptySupporterDetails): Promise<string | null> => {
    const insertData: Record<string, any> = {
      name,
      email: details.email || null,
      phone: details.phone || null,
      address: details.address || null,
      supporter_category: details.supporter_category || null,
      primary_revenue_stream: details.primary_revenue_stream || null,
      status: details.status || null,
      relationship_owner: details.relationship_owner || null,
      story: details.story || null,
    };

    const { data: existing } = await supabase
      .from("supporters")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (existing) {
      await supabase.from("supporters").update(insertData as any).eq("id", existing.id);
      return existing.id;
    }

    const { data: created, error } = await supabase
      .from("supporters")
      .insert(insertData as any)
      .select("id")
      .single();
    if (error) return null;
    return created.id;
  };

  /** Save supporter details back to the supporters table */
  const saveSupporterDetails = async (supporterId: string) => {
    const updateData: Record<string, any> = {
      name: supporterDetails.name || supporterSearch.trim(),
      email: supporterDetails.email || null,
      phone: supporterDetails.phone || null,
      address: supporterDetails.address || null,
      supporter_category: supporterDetails.supporter_category || null,
      primary_revenue_stream: supporterDetails.primary_revenue_stream || null,
      status: supporterDetails.status || null,
      relationship_owner: supporterDetails.relationship_owner || null,
      story: supporterDetails.story || null,
    };
    await supabase.from("supporters").update(updateData as any).eq("id", supporterId);
  };

  const isQualifyingForReceipt = (type: string) =>
    type === "Donation" || type === "Sponsorship";

  const handleSave = async () => {
    if (!form.date || !form.amount) return;
    setSaving(true);

    // If supporter not yet linked but we have a name typed, find/create
    let supporterId = form.supporter_id || null;
    if (!supporterId && (supporterSearch.trim() || isNewSupporter)) {
      const name = supporterDetails.name || supporterSearch.trim();
      supporterId = await findOrCreateSupporter(name, supporterDetails);
      if (supporterId) {
        setForm(f => ({ ...f, supporter_id: supporterId! }));
      }
    } else if (supporterId) {
      // Save any edits to supporter details
      await saveSupporterDetails(supporterId);
    }

    const payload = {
      supporter_id: supporterId,
      date: form.date,
      amount: parseFloat(form.amount.replace(/,/g, "")) || 0,
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
      reference_id: form.reference_id || null,
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

    // Find the revenue row to get supporter info before deleting
    const rowToDelete = rows.find((r) => r.id === deleteId);
    const supporterId = rowToDelete?.supporter_id;
    const rowDate = rowToDelete?.date;
    const rowAmount = rowToDelete?.amount;

    // Delete from revenue table
    await supabase.from("revenue").delete().eq("id", deleteId);

    // Also delete matching record from donations table (synced on create)
    if (supporterId && rowDate && rowAmount != null) {
      const { data: matchingDonations } = await supabase
        .from("donations")
        .select("id")
        .eq("supporter_id", supporterId)
        .eq("deposit_date", rowDate)
        .eq("amount", rowAmount)
        .limit(1);

      if (matchingDonations && matchingDonations.length > 0) {
        await supabase.from("donations").delete().eq("id", matchingDonations[0].id);
      }
    }

    // If supporter has no remaining qualifying donations, clean up
    if (supporterId) {
      const { data: remaining } = await supabase
        .from("donations")
        .select("id")
        .eq("supporter_id", supporterId);

      const { data: remainingRevenue } = await supabase
        .from("revenue")
        .select("id")
        .eq("supporter_id", supporterId);

      if ((!remaining || remaining.length === 0) && (!remainingRevenue || remainingRevenue.length === 0)) {
        await supabase.from("supporters").delete().eq("id", supporterId);
      }
    }

    setDeleting(false);
    setDeleteId(null);
    toast({ title: "Revenue record deleted from all tables." });
    await fetchRows();
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const fmtCurrency = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };


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
            <thead className="sticky top-0 z-10 bg-green-600 shadow-[0_1px_0_rgba(255,255,255,0.12)] [&_tr]:border-b">
              <tr className="border-b border-white/10">
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Date</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Supporter</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-white bg-green-600">Amount</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Revenue Type</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Payment Method</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Ref / Check #</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Logged By</th>
                <th className="h-12 px-4 w-20 text-right align-middle font-medium text-white bg-green-600">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr className="border-b border-white/10">
                  <td colSpan={8} className="p-4 text-center py-12 text-white/50 align-middle">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className="border-b border-white/10">
                  <td colSpan={8} className="p-4 text-center py-12 text-white/50 align-middle">No revenue records yet.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/10 transition-colors hover:bg-white/5">
                    <td className="p-4 align-middle text-white/70 text-sm">{fmtDate(r.date)}</td>
                    <td className="p-4 align-middle text-white font-medium text-sm">{r.supporter_name || "—"}</td>
                    <td className="p-4 align-middle text-right text-green-400 font-medium text-sm">{fmtCurrency(r.amount)}</td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.revenue_type}</td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.payment_method || "—"}</td>
                    <td className="p-4 align-middle text-white/60 text-sm">{(r as any).reference_id || "—"}</td>
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
          <div className="px-6 pt-6 pb-2 shrink-0 flex items-center justify-between">
            <DialogHeader className="flex-1">
              <DialogTitle className="text-green-400">
                {editId ? "Edit Revenue Entry" : "New Revenue Entry"}
              </DialogTitle>
            </DialogHeader>
            {form.supporter_id && !isNewSupporter && (
              <button
                type="button"
                onClick={() => setSupporterDetailsOpen(!supporterDetailsOpen)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors mr-8 ${
                  supporterDetailsOpen
                    ? "border-green-500/50 text-green-400 bg-green-500/10"
                    : "border-white/15 text-white/40 hover:text-white/70 hover:border-white/30"
                }`}
              >
                {supporterDetailsOpen ? "Close Supporter Info" : "Edit Supporter Info"}
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-4 pt-2">
             {/* Supporter */}
            <div className="space-y-1.5">
              <SupporterAutocomplete
                label="Supporter"
                value={supporterSearch}
                onChange={(val) => {
                  setSupporterSearch(val);
                  if (!val) {
                    setForm({ ...form, supporter_id: "", supporter_email: "" });
                    setSupporterDetails(emptySupporterDetails);
                    setSupporterDetailsOpen(false);
                    setIsNewSupporter(false);
                  }
                }}
                onSelect={(s) => {
                  setForm({ ...form, supporter_id: s.id, supporter_email: s.email || "" });
                  setSupporterSearch(s.name);
                  setSupporterDetails({
                    name: s.name,
                    supporter_category: s.supporter_category || "",
                    primary_revenue_stream: s.primary_revenue_stream || "",
                    status: s.status || "",
                    relationship_owner: s.relationship_owner || "",
                    email: s.email || "",
                    phone: s.phone || "",
                    address: s.address || "",
                    story: s.story || "",
                  });
                  setIsNewSupporter(false);
                }}
                onCreateNew={() => {
                  setSupporterSearch("");
                  setForm({ ...form, supporter_id: "" });
                  setSupporterDetails({ ...emptySupporterDetails });
                  setSupporterDetailsOpen(true);
                  setIsNewSupporter(true);
                }}
                placeholder="Type to search supporters…"
              />
            </div>

            {/* Collapsible Supporter Details */}
            {(form.supporter_id || isNewSupporter) && supporterDetailsOpen && (
              <div className="border border-white/10 rounded-lg overflow-hidden">
                {isNewSupporter && (
                  <div className="px-3 py-2 text-xs font-medium text-green-400 border-b border-white/10 bg-green-500/5">
                    New Supporter Details
                  </div>
                )}
                <div className="px-3 pb-3 space-y-3 pt-3">
                    {/* Supporter Name */}
                    <div className="space-y-1">
                      <Label className="text-white/50 text-xs">Supporter Name {isNewSupporter && <span className="text-red-400">*</span>}</Label>
                      <Input
                        value={supporterDetails.name}
                        onChange={(e) => {
                          setSupporterDetails({ ...supporterDetails, name: e.target.value });
                          if (isNewSupporter) setSupporterSearch(e.target.value);
                        }}
                        className="bg-white/5 border-white/10 text-white h-8 text-sm"
                        placeholder="Full name…"
                      />
                    </div>
                    {/* Two-column grid for compact fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-white/50 text-xs">Category</Label>
                        <Select value={supporterDetails.supporter_category} onValueChange={(v) => setSupporterDetails({ ...supporterDetails, supporter_category: v })}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-sm">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-white/10 text-white">
                            {SUPPORTER_CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c} className="text-white focus:bg-white/10 focus:text-white">{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/50 text-xs">Revenue Stream</Label>
                        <Select value={supporterDetails.primary_revenue_stream} onValueChange={(v) => setSupporterDetails({ ...supporterDetails, primary_revenue_stream: v })}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-sm">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-white/10 text-white">
                            {PRIMARY_STREAMS.map((s) => (
                              <SelectItem key={s} value={s} className="text-white focus:bg-white/10 focus:text-white">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/50 text-xs">Status</Label>
                        <Select value={supporterDetails.status} onValueChange={(v) => setSupporterDetails({ ...supporterDetails, status: v })}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-sm">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-white/10 text-white">
                            {SUPPORTER_STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="text-white focus:bg-white/10 focus:text-white">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/50 text-xs">Relationship Owner</Label>
                        <Input
                          value={supporterDetails.relationship_owner}
                          onChange={(e) => setSupporterDetails({ ...supporterDetails, relationship_owner: e.target.value })}
                          className="bg-white/5 border-white/10 text-white h-8 text-sm"
                          placeholder="Owner name…"
                        />
                      </div>
                    </div>
                    {/* Contact fields */}
                    <div className="space-y-1">
                      <Label className="text-white/50 text-xs">Primary Contact Email</Label>
                      <Input
                        type="email"
                        value={supporterDetails.email}
                        onChange={(e) => {
                          setSupporterDetails({ ...supporterDetails, email: e.target.value });
                          setForm(f => ({ ...f, supporter_email: e.target.value }));
                        }}
                        className="bg-white/5 border-white/10 text-white h-8 text-sm"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-white/50 text-xs">Phone</Label>
                        <Input
                          type="tel"
                          value={supporterDetails.phone}
                          onChange={(e) => setSupporterDetails({ ...supporterDetails, phone: e.target.value })}
                          className="bg-white/5 border-white/10 text-white h-8 text-sm"
                          placeholder="(555) 555-5555"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/50 text-xs">Address</Label>
                        <Input
                          value={supporterDetails.address}
                          onChange={(e) => setSupporterDetails({ ...supporterDetails, address: e.target.value })}
                          className="bg-white/5 border-white/10 text-white h-8 text-sm"
                          placeholder="Street address…"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-white/50 text-xs">Internal Strategic Notes</Label>
                      <textarea
                        rows={2}
                        value={supporterDetails.story}
                        onChange={(e) => setSupporterDetails({ ...supporterDetails, story: e.target.value })}
                        className="w-full rounded-md bg-white/5 border border-white/10 text-white text-xs px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-green-500"
                        placeholder="Internal notes…"
                      />
                    </div>
                </div>
              </div>
            )}

            {/* Supporter Email (shown when no details panel, for quick entry) */}
            {!supporterDetailsOpen && !isNewSupporter && (
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
            )}

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

            {/* Reference ID / Check # */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Reference ID / Check #</Label>
              <Input
                value={form.reference_id}
                onChange={(e) => setForm({ ...form, reference_id: e.target.value })}
                className="bg-white/5 border-white/10 text-white"
                placeholder="Check #, confirmation code, etc."
              />
            </div>


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
