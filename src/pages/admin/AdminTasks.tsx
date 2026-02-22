import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const TASK_TYPES = ["Call", "Proposal", "Thank You", "Renewal", "Report Deadline", "Follow-Up"] as const;
const TASK_STATUSES = ["Open", "Completed"] as const;

interface SupporterOption { id: string; name: string; }

interface TaskRow {
  id: string;
  supporter_id: string;
  supporter_name: string | null;
  due_date: string | null;
  task_type: string;
  assigned_to: string | null;
  status: string;
  created_by: string | null;
  notes: string | null;
}

const emptyForm = {
  supporter_id: "",
  due_date: "",
  task_type: "Call" as string,
  assigned_to: "",
  status: "Open" as string,
  created_by: "",
  notes: "",
};

const AdminTasks = () => {
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [supporters, setSupporters] = useState<SupporterOption[]>([]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, supporter_id, due_date, task_type, assigned_to, status, created_by, notes")
      .order("due_date", { ascending: true });

    const taskRows = (data ?? []) as any[];
    const sIds = [...new Set(taskRows.map(r => r.supporter_id).filter(Boolean))];
    let sMap: Record<string, string> = {};
    if (sIds.length > 0) {
      const { data: sData } = await supabase.from("supporters").select("id, name").in("id", sIds);
      (sData ?? []).forEach((s: any) => { sMap[s.id] = s.name; });
    }

    setRows(taskRows.map(r => ({
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditId(null); setForm(emptyForm); setModalOpen(true); };

  const openEdit = (r: TaskRow) => {
    setEditId(r.id);
    setForm({
      supporter_id: r.supporter_id || "",
      due_date: r.due_date || "",
      task_type: r.task_type,
      assigned_to: r.assigned_to || "",
      status: r.status,
      created_by: r.created_by || "",
      notes: r.notes || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.supporter_id || !form.task_type) return;
    setSaving(true);
    const payload = {
      supporter_id: form.supporter_id,
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
    setModalOpen(false);
    await fetchRows();
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await supabase.from("tasks").delete().eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    await fetchRows();
  };

  const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${m}/${day}/${y}`; };

  return (
    <div className="bg-black text-white flex flex-col" style={{ height: 'calc(100vh - 73px)' }}>
      <div className="border-b border-white/10 px-4 py-3 flex-shrink-0">
        <h2 className="text-base font-semibold text-green-400">Tasks</h2>
        <p className="text-xs text-white/50">Manage supporter-related tasks and follow-ups</p>
      </div>

      <div className="flex flex-col flex-1 min-h-0 px-4 py-4">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <p className="text-sm text-white/50">{rows.length} record{rows.length !== 1 ? "s" : ""}</p>
          <Button size="sm" className="bg-green-500 hover:bg-green-400 text-black gap-1.5" onClick={openNew}>
            <Plus className="w-4 h-4" /> New Task
          </Button>
        </div>

        <div className="flex-1 min-h-0 rounded-lg border border-white/10 overflow-auto">
          <table className="w-full caption-bottom text-sm min-w-[850px]">
            <thead className="sticky top-0 z-10 bg-black shadow-[0_1px_0_rgba(255,255,255,0.12)] [&_tr]:border-b">
              <tr className="border-b border-white/10">
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Due Date</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Supporter</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Task Type</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Assigned To</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Status</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-white/70">Created By</th>
                <th className="h-12 px-4 w-20 text-right align-middle font-medium text-white/70">Actions</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {loading ? (
                <tr className="border-b border-white/10">
                  <td colSpan={7} className="p-4 text-center py-12 text-white/50 align-middle">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className="border-b border-white/10">
                  <td colSpan={7} className="p-4 text-center py-12 text-white/50 align-middle">No tasks yet.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/10 transition-colors hover:bg-white/5">
                    <td className="p-4 align-middle text-white/70 text-sm">{r.due_date ? fmtDate(r.due_date) : "—"}</td>
                    <td className="p-4 align-middle text-white font-medium text-sm">{r.supporter_name || "—"}</td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.task_type}</td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.assigned_to || "—"}</td>
                    <td className="p-4 align-middle text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === "Completed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-white/70 text-sm">{r.created_by || "—"}</td>
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

      {/* Create / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-md flex flex-col max-h-[85vh] p-0 gap-0" onPointerDownOutside={(e) => e.preventDefault()}>
          <div className="px-6 pt-6 pb-2 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-green-400">{editId ? "Edit Task" : "New Task"}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-white/70">Supporter <span className="text-red-400">*</span></Label>
              <Select value={form.supporter_id} onValueChange={(v) => setForm({ ...form, supporter_id: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="— select supporter —" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white max-h-60">
                  {supporters.map((s) => <SelectItem key={s.id} value={s.id} className="text-white focus:bg-white/10 focus:text-white">{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Task Type <span className="text-red-400">*</span></Label>
              <Select value={form.task_type} onValueChange={(v) => setForm({ ...form, task_type: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {TASK_TYPES.map((t) => <SelectItem key={t} value={t} className="text-white focus:bg-white/10 focus:text-white">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Assigned To</Label>
              <Input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Staff name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {TASK_STATUSES.map((s) => <SelectItem key={s} value={s} className="text-white focus:bg-white/10 focus:text-white">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Created By</Label>
              <Input value={form.created_by} onChange={(e) => setForm({ ...form, created_by: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="bg-white/5 border-white/10 text-white min-h-[80px]" placeholder="Additional details…" />
            </div>
          </div>
          <div className="border-t border-white/10 px-6 py-4 flex justify-end gap-2 shrink-0">
            <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button className="bg-green-500 hover:bg-green-400 text-black" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editId ? "Save Changes" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">This action cannot be undone. The task will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-500 text-white" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTasks;
