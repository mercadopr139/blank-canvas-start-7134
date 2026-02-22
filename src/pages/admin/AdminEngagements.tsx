import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Check, X, Send } from "lucide-react";
import { toast } from "sonner";
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

const ENGAGEMENT_TYPES = ["Call", "Email", "Text", "Meeting", "Event", "Report Sent", "Video Update Sent", "Monthly Postcard"] as const;
const OUTCOME_OPTIONS = ["Positive", "Neutral", "No Response"] as const;

interface SupporterOption { id: string; name: string; }

interface EngagementRow {
  id: string;
  supporter_id: string;
  supporter_name: string | null;
  date: string;
  engagement_type: string;
  outcome: string | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  logged_by: string | null;
  summary: string | null;
}

const emptyForm = {
  supporter_id: "",
  date: new Date().toISOString().slice(0, 10),
  engagement_type: "Call" as string,
  outcome: "" as string,
  follow_up_needed: false,
  follow_up_date: "",
  logged_by: "",
  summary: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

const AdminEngagements = () => {
  const [rows, setRows] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [supporters, setSupporters] = useState<SupporterOption[]>([]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("engagements")
      .select("id, supporter_id, date, engagement_type, outcome, follow_up_needed, follow_up_date, logged_by, summary")
      .order("date", { ascending: false });

    const engRows = (data ?? []) as any[];
    const sIds = [...new Set(engRows.map(r => r.supporter_id).filter(Boolean))];
    let sMap: Record<string, string> = {};
    if (sIds.length > 0) {
      const { data: sData } = await supabase.from("supporters").select("id, name").in("id", sIds);
      (sData ?? []).forEach((s: any) => { sMap[s.id] = s.name; });
    }

    setRows(engRows.map(r => ({
      ...r,
      supporter_name: r.supporter_id ? (sMap[r.supporter_id] || "Unknown") : null,
    })));
    setLoading(false);
  }, []);

  const fetchSupporters = useCallback(async () => {
    const { data } = await supabase.from("supporters").select("id, name").order("name");
    setSupporters((data ?? []) as SupporterOption[]);
  }, []);

  useEffect(() => { fetchRows(); fetchSupporters(); }, [fetchRows, fetchSupporters]);

  // ── Modal state ─────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditId(null); setForm(emptyForm); setModalOpen(true); };

  const openEdit = (r: EngagementRow) => {
    setEditId(r.id);
    setForm({
      supporter_id: r.supporter_id || "",
      date: r.date,
      engagement_type: r.engagement_type,
      outcome: r.outcome || "",
      follow_up_needed: r.follow_up_needed,
      follow_up_date: r.follow_up_date || "",
      logged_by: r.logged_by || "",
      summary: r.summary || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.date || !form.supporter_id || !form.engagement_type) return;
    setSaving(true);
    const payload = {
      supporter_id: form.supporter_id,
      date: form.date,
      engagement_type: form.engagement_type as "Call" | "Email" | "Text" | "Meeting" | "Event" | "Report Sent" | "Video Update Sent" | "Monthly Postcard",
      outcome: (form.outcome || null) as "Positive" | "Neutral" | "No Response" | null,
      follow_up_needed: form.follow_up_needed,
      follow_up_date: form.follow_up_date || null,
      logged_by: form.logged_by || null,
      summary: form.summary || null,
    };

    if (editId) {
      await supabase.from("engagements").update(payload).eq("id", editId);
    } else {
      await supabase.from("engagements").insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    await fetchRows();
  };

  // ── Delete state ────────────────────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from("engagements").delete().eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    await fetchRows();
  };

  // ── Bulk Postcard state ────────────────────────────────────────────────
  const [postcardOpen, setPostcardOpen] = useState(false);
  const [postcardDate, setPostcardDate] = useState(new Date().toISOString().slice(0, 10));
  const [postcardSummary, setPostcardSummary] = useState("");
  const [postcardLoggedBy, setPostcardLoggedBy] = useState("");
  const [postcardSaving, setPostcardSaving] = useState(false);

  const handleBulkPostcard = async () => {
    if (!postcardDate) return;
    setPostcardSaving(true);

    // 1. Get active supporters
    const { data: activeSupporters } = await supabase
      .from("supporters")
      .select("id")
      .eq("status", "Active");

    const activeIds = (activeSupporters ?? []).map((s: any) => s.id);
    if (activeIds.length === 0) {
      toast.error("No active supporters found.");
      setPostcardSaving(false);
      return;
    }

    // 2. Check existing postcards for that date to avoid duplicates
    const { data: existing } = await supabase
      .from("engagements")
      .select("supporter_id")
      .eq("date", postcardDate)
      .eq("engagement_type", "Monthly Postcard")
      .in("supporter_id", activeIds);

    const existingIds = new Set((existing ?? []).map((e: any) => e.supporter_id));
    const toInsert = activeIds
      .filter((id: string) => !existingIds.has(id))
      .map((id: string) => ({
        supporter_id: id,
        date: postcardDate,
        engagement_type: "Monthly Postcard" as const,
        summary: postcardSummary || null,
        logged_by: postcardLoggedBy || null,
        follow_up_needed: false,
      }));

    if (toInsert.length === 0) {
      toast.info("All active supporters already have a postcard entry for this date.");
      setPostcardSaving(false);
      return;
    }

    const { error } = await supabase.from("engagements").insert(toInsert);
    if (error) {
      toast.error("Failed to create postcard records.");
    } else {
      toast.success(`Created ${toInsert.length} postcard record${toInsert.length !== 1 ? "s" : ""}.${existingIds.size > 0 ? ` Skipped ${existingIds.size} duplicate${existingIds.size !== 1 ? "s" : ""}.` : ""}`);
    }

    setPostcardSaving(false);
    setPostcardOpen(false);
    setPostcardSummary("");
    setPostcardLoggedBy("");
    await fetchRows();
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${m}/${day}/${y}`; };
  const BoolIcon = ({ value }: { value: boolean }) =>
    value ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-white/20 mx-auto" />;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="bg-black text-white flex flex-col" style={{ height: 'calc(100vh - 73px)' }}>
      {/* Page header */}
      <div className="border-b border-white/10 px-4 py-3 flex-shrink-0">
        <h2 className="text-base font-semibold text-green-400">Engagements</h2>
        <p className="text-xs text-white/50">Track supporter interactions and follow-ups</p>
      </div>

      <div className="flex flex-col flex-1 min-h-0 px-4 py-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <p className="text-sm text-white/50">{rows.length} record{rows.length !== 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="border-white/10 text-white/70 hover:text-white hover:bg-white/10 gap-1.5" onClick={() => setPostcardOpen(true)}>
              <Send className="w-4 h-4" /> Log Monthly Postcard
            </Button>
            <Button size="sm" className="bg-green-500 hover:bg-green-400 text-black gap-1.5" onClick={openNew}>
              <Plus className="w-4 h-4" /> New Engagement
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 rounded-lg border border-white/10 overflow-auto">
          <table className="w-full caption-bottom text-sm min-w-[900px]">
              <thead className="sticky top-0 z-10 bg-green-600 shadow-[0_1px_0_rgba(255,255,255,0.12)] [&_tr]:border-b">
              <tr className="border-b border-white/10">
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Date</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Supporter</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Type</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Outcome</th>
                <th className="h-12 px-4 text-center align-middle font-medium text-white bg-green-600">Follow-Up</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white bg-green-600">Follow-Up Date</th>
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
                  <td colSpan={8} className="p-4 text-center py-12 text-white/50 align-middle">No engagement records yet.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/10 transition-colors hover:bg-white/5">
                    <td className="p-4 align-middle text-white/70 text-sm">{fmtDate(r.date)}</td>
                    <td className="p-4 align-middle text-white font-medium text-sm">{r.supporter_name || "—"}</td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.engagement_type}</td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.outcome || "—"}</td>
                    <td className="p-4 align-middle text-center"><BoolIcon value={r.follow_up_needed} /></td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.follow_up_date ? fmtDate(r.follow_up_date) : "—"}</td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.logged_by || "—"}</td>
                    <td className="p-4 align-middle text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(r)} className="p-1.5 rounded text-white/40 hover:text-green-400 hover:bg-white/5 transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteId(r.id)} className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors" title="Delete">
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
                {editId ? "Edit Engagement" : "New Engagement"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-4 pt-2">
            {/* Supporter */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Supporter <span className="text-red-400">*</span></Label>
              <Select value={form.supporter_id} onValueChange={(v) => setForm({ ...form, supporter_id: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="— select supporter —" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white max-h-60">
                  {supporters.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-white focus:bg-white/10 focus:text-white">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Date <span className="text-red-400">*</span></Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-white/5 border-white/10 text-white" />
            </div>

            {/* Engagement Type */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Engagement Type <span className="text-red-400">*</span></Label>
              <Select value={form.engagement_type} onValueChange={(v) => setForm({ ...form, engagement_type: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {ENGAGEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-white focus:bg-white/10 focus:text-white">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Logged By */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Logged By</Label>
              <Input value={form.logged_by} onChange={(e) => setForm({ ...form, logged_by: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Name" />
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Summary</Label>
              <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="bg-white/5 border-white/10 text-white min-h-[80px]" placeholder="Notes about this interaction…" />
            </div>

            {/* Outcome */}
            <div className="space-y-1.5">
              <Label className="text-white/70">Outcome</Label>
              <Select value={form.outcome} onValueChange={(v) => setForm({ ...form, outcome: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="— not set —" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {OUTCOME_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o} className="text-white focus:bg-white/10 focus:text-white">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Follow-Up */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.follow_up_needed} onChange={(e) => setForm({ ...form, follow_up_needed: e.target.checked })} className="accent-green-500 w-4 h-4" />
              <span className="text-sm text-white/70">Follow-Up Needed</span>
            </label>

            {form.follow_up_needed && (
              <div className="space-y-1.5">
                <Label className="text-white/70">Follow-Up Date</Label>
                <Input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} className="bg-white/5 border-white/10 text-white" />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 px-6 py-4 flex justify-end gap-2 shrink-0">
            <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="bg-green-500 hover:bg-green-400 text-black" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editId ? "Save Changes" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Engagement</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              This action cannot be undone. The engagement record will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-500 text-white" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk Postcard Modal ───────────────────────────────────────────── */}
      <Dialog open={postcardOpen} onOpenChange={(o) => { if (!o) setPostcardOpen(false); }}>
        <DialogContent
          className="bg-zinc-900 border-white/10 text-white sm:max-w-md p-0 gap-0"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="px-6 pt-6 pb-2">
            <DialogHeader>
              <DialogTitle className="text-green-400">Log Monthly Postcard</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-white/50 mt-1">Creates a "Monthly Postcard" engagement for every Active supporter. Duplicates are automatically skipped.</p>
          </div>
          <div className="px-6 pb-4 space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-white/70">Date <span className="text-red-400">*</span></Label>
              <Input type="date" value={postcardDate} onChange={(e) => setPostcardDate(e.target.value)} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Summary</Label>
              <Textarea value={postcardSummary} onChange={(e) => setPostcardSummary(e.target.value)} className="bg-white/5 border-white/10 text-white min-h-[80px]" placeholder='e.g. "March Program Highlight postcard mailed."' />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Logged By</Label>
              <Input value={postcardLoggedBy} onChange={(e) => setPostcardLoggedBy(e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="Name" />
            </div>
          </div>
          <div className="border-t border-white/10 px-6 py-4 flex justify-end gap-2">
            <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => setPostcardOpen(false)}>Cancel</Button>
            <Button className="bg-green-500 hover:bg-green-400 text-black" onClick={handleBulkPostcard} disabled={postcardSaving || !postcardDate}>
              {postcardSaving ? "Creating…" : "Create for All Active"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminEngagements;
