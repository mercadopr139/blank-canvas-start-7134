import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const TASK_TYPES = ["Call", "Proposal", "Thank You", "Renewal", "Report Deadline", "Follow-Up"] as const;
const TASK_STATUSES = ["Open", "Completed"] as const;

interface TaskRecord {
  id: string;
  due_date: string | null;
  task_type: string;
  assigned_to: string | null;
  status: string;
  created_by: string | null;
  notes: string | null;
}

const emptyForm = {
  due_date: "",
  task_type: "Call" as string,
  assigned_to: "",
  status: "Open" as string,
  created_by: "",
  notes: "",
};

interface Props {
  supporterId: string;
  supporterName: string;
}

const SupporterTasksSection = ({ supporterId }: Props) => {
  const [records, setRecords] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, due_date, task_type, assigned_to, status, created_by, notes")
      .eq("supporter_id", supporterId)
      .order("due_date", { ascending: true });
    setRecords((data ?? []) as TaskRecord[]);
    setLoading(false);
  }, [supporterId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const openNew = () => { setEditId(null); setForm(emptyForm); setFormOpen(true); };

  const openEdit = (r: TaskRecord) => {
    setEditId(r.id);
    setForm({
      due_date: r.due_date || "",
      task_type: r.task_type,
      assigned_to: r.assigned_to || "",
      status: r.status,
      created_by: r.created_by || "",
      notes: r.notes || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.task_type) return;
    setSaving(true);
    const payload = {
      supporter_id: supporterId,
      due_date: form.due_date || null,
      task_type: form.task_type as "Call" | "Proposal" | "Thank You" | "Renewal" | "Report Deadline" | "Follow-Up",
      assigned_to: form.assigned_to || null,
      status: form.status as "Open" | "Completed",
      created_by: form.created_by || null,
      notes: form.notes || null,
    };
    if (editId) {
      await supabase.from("tasks").update(payload).eq("id", editId);
    } else {
      await supabase.from("tasks").insert(payload);
    }
    setSaving(false);
    setFormOpen(false);
    await fetchRecords();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("tasks").delete().eq("id", deleteId);
    setDeleteId(null);
    await fetchRecords();
  };

  const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${m}/${day}/${y}`; };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-white/70 text-sm font-medium">Tasks</Label>
        <Button size="sm" className="bg-green-500 hover:bg-green-400 text-black gap-1 h-7 text-xs" onClick={openNew}>
          <Plus className="w-3 h-3" /> Add Task
        </Button>
      </div>

      {/* Inline form */}
      {formOpen && (
        <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-3">
          <p className="text-xs font-medium text-green-400">
            {editId ? "Edit Task" : "New Task"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Task Type *</Label>
              <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {TASK_TYPES.map((t) => <SelectItem key={t} value={t} className="text-white text-xs focus:bg-white/10 focus:text-white">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Assigned To</Label>
              <Input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-8 text-xs" placeholder="Staff name…" />
            </div>
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {TASK_STATUSES.map((s) => <SelectItem key={s} value={s} className="text-white text-xs focus:bg-white/10 focus:text-white">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-white/50 text-xs">Created By</Label>
              <Input value={form.created_by} onChange={(e) => setForm({ ...form, created_by: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-8 text-xs" placeholder="Name…" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-white/50 text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-white/5 border-white/10 text-white text-xs min-h-[60px]" placeholder="Additional details…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)} className="text-white/50 hover:bg-white/10 h-7 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.task_type || saving}
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
        <p className="text-xs text-white/40 py-2">No tasks for this supporter.</p>
      ) : (
        <div className="rounded-md border border-white/10 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-3 py-2 text-left font-medium text-white/60">Due Date</th>
                <th className="px-3 py-2 text-left font-medium text-white/60">Task Type</th>
                <th className="px-3 py-2 text-left font-medium text-white/60">Assigned To</th>
                <th className="px-3 py-2 text-left font-medium text-white/60">Status</th>
                <th className="px-3 py-2 w-16 text-right font-medium text-white/60"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-3 py-1.5 text-white/70">{r.due_date ? fmtDate(r.due_date) : "—"}</td>
                  <td className="px-3 py-1.5 text-white/70">{r.task_type}</td>
                  <td className="px-3 py-1.5 text-white/60">{r.assigned_to || "—"}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${r.status === "Completed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                      {r.status}
                    </span>
                  </td>
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
          <span className="text-xs text-white/70">Delete this task?</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDeleteId(null)} className="text-white/50 hover:bg-white/10 h-6 text-xs">Cancel</Button>
            <Button size="sm" onClick={handleDelete} className="bg-red-600 hover:bg-red-500 text-white h-6 text-xs">Delete</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupporterTasksSection;
