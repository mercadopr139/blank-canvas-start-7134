import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const ENGAGEMENT_TYPES = ["Call", "Email", "Text", "Meeting", "Event", "Report Sent", "Video Update Sent"] as const;
const OUTCOME_OPTIONS = ["Positive", "Neutral", "No Response"] as const;

interface EngagementRecord {
  id: string;
  date: string;
  engagement_type: string;
  outcome: string | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  logged_by: string | null;
  summary: string | null;
}

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  engagement_type: "Call" as string,
  outcome: "" as string,
  follow_up_needed: false,
  follow_up_date: "",
  logged_by: "",
  summary: "",
};

interface Props {
  supporterId: string;
  supporterName: string;
}

const SupporterEngagementSection = ({ supporterId }: Props) => {
  const [records, setRecords] = useState<EngagementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("engagements")
      .select("id, date, engagement_type, outcome, follow_up_needed, follow_up_date, logged_by, summary")
      .eq("supporter_id", supporterId)
      .order("date", { ascending: false });
    setRecords((data ?? []) as EngagementRecord[]);
    setLoading(false);
  }, [supporterId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openNew = () => { setEditId(null); setForm(emptyForm); setFormOpen(true); };

  const openEdit = (r: EngagementRecord) => {
    setEditId(r.id);
    setForm({
      date: r.date,
      engagement_type: r.engagement_type,
      outcome: r.outcome || "",
      follow_up_needed: r.follow_up_needed,
      follow_up_date: r.follow_up_date || "",
      logged_by: r.logged_by || "",
      summary: r.summary || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.date || !form.engagement_type) return;
    setSaving(true);
    const payload = {
      supporter_id: supporterId,
      date: form.date,
      engagement_type: form.engagement_type as "Call" | "Email" | "Text" | "Meeting" | "Event" | "Report Sent" | "Video Update Sent",
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
    setFormOpen(false);
    await fetchRecords();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("engagements").delete().eq("id", deleteId);
    setDeleteId(null);
    await fetchRecords();
  };

  const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${m}/${day}/${y}`; };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-white/70 text-sm font-medium">Engagement History</Label>
        <Button size="sm" className="bg-green-500 hover:bg-green-400 text-black gap-1 h-7 text-xs" onClick={openNew}>
          <Plus className="w-3 h-3" /> Log Engagement
        </Button>
      </div>

      {/* Inline form */}
      {formOpen && (
        <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-3">
          <p className="text-xs font-medium text-green-400">
            {editId ? "Edit Engagement" : "New Engagement"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Type *</Label>
              <Select value={form.engagement_type} onValueChange={(v) => setForm({ ...form, engagement_type: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {ENGAGEMENT_TYPES.map((t) => <SelectItem key={t} value={t} className="text-white text-xs focus:bg-white/10 focus:text-white">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Outcome</Label>
              <Select value={form.outcome} onValueChange={(v) => setForm({ ...form, outcome: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {OUTCOME_OPTIONS.map((o) => <SelectItem key={o} value={o} className="text-white text-xs focus:bg-white/10 focus:text-white">{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Logged By</Label>
              <Input value={form.logged_by} onChange={(e) => setForm({ ...form, logged_by: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-8 text-xs" placeholder="Name…" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-white/50 text-xs">Summary</Label>
            <Textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })}
              className="bg-white/5 border-white/10 text-white text-xs min-h-[60px]" placeholder="Notes…" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.follow_up_needed} onChange={(e) => setForm({ ...form, follow_up_needed: e.target.checked })} className="accent-green-500 w-3.5 h-3.5" />
              <span className="text-xs text-white/60">Follow-Up Needed</span>
            </label>
            {form.follow_up_needed && (
              <div className="flex items-center gap-1.5">
                <Label className="text-white/50 text-xs">Date:</Label>
                <Input type="date" value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
                  className="bg-white/5 border-white/10 text-white h-7 text-xs w-36" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)} className="text-white/50 hover:bg-white/10 h-7 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.date || !form.engagement_type || saving}
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
        <p className="text-xs text-white/40 py-2">No engagement records for this supporter.</p>
      ) : (
        <div className="rounded-md border border-white/10 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-3 py-2 text-left font-medium text-white/60">Date</th>
                <th className="px-3 py-2 text-left font-medium text-white/60">Type</th>
                <th className="px-3 py-2 text-left font-medium text-white/60">Outcome</th>
                <th className="px-3 py-2 text-center font-medium text-white/60">F/U</th>
                <th className="px-3 py-2 text-left font-medium text-white/60">F/U Date</th>
                <th className="px-3 py-2 w-16 text-right font-medium text-white/60"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-3 py-1.5 text-white/70">{fmtDate(r.date)}</td>
                  <td className="px-3 py-1.5 text-white/70">{r.engagement_type}</td>
                  <td className="px-3 py-1.5 text-white/60">{r.outcome || "—"}</td>
                  <td className="px-3 py-1.5 text-center">
                    {r.follow_up_needed
                      ? <Check className="w-3.5 h-3.5 text-green-400 mx-auto" />
                      : <X className="w-3.5 h-3.5 text-white/20 mx-auto" />}
                  </td>
                  <td className="px-3 py-1.5 text-white/60">{r.follow_up_date ? fmtDate(r.follow_up_date) : "—"}</td>
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
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="rounded-md border border-red-600/30 bg-red-950/30 p-3 flex items-center justify-between">
          <span className="text-xs text-white/70">Delete this engagement record?</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDeleteId(null)} className="text-white/50 hover:bg-white/10 h-6 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white h-6 text-xs">Delete</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupporterEngagementSection;
