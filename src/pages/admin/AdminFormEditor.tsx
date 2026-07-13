import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Pencil, Save, Link2, ExternalLink,
  Download, Eye, Inbox, Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { QRCodeCanvas } from "qrcode.react";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { downloadFormResponsePdf } from "@/lib/generateFormResponsePdf";
import {
  FIELD_TYPES, fieldTypeIcon, fieldTypeLabel, isInputField, makeField, parseOptions, slugify, ageFromDob,
  type FormFieldDef, type FormRecord,
} from "@/lib/formKit";

/* ── sortable field row ── */
const FieldRow = ({ field, onEdit, onDelete }: { field: FormFieldDef; onEdit: () => void; onDelete: () => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const Icon = fieldTypeIcon(field.field_type);
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onEdit}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/[0.08] cursor-pointer transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <Icon className="w-4 h-4 text-white/40 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{field.label}</span>
          {field.required && <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] px-1.5 py-0">Required</Badge>}
        </div>
        <span className="text-xs text-white/30">{fieldTypeLabel(field.field_type)}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="h-8 gap-1.5 px-2 text-white/60 hover:text-white hover:bg-white/10"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-8 gap-1.5 px-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
};

/* ── field editor dialog (with proper add/remove options) ── */
const FieldEditor = ({ field, allFields, onClose, onSave }: { field: FormFieldDef | null; allFields: FormFieldDef[]; onClose: () => void; onSave: (f: FormFieldDef) => void }) => {
  const [draft, setDraft] = useState<FormFieldDef | null>(null);
  useEffect(() => { setDraft(field ? { ...field, options: field.options ? [...parseOptions(field.options)] : null } : null); }, [field]);
  if (!draft) return null;
  const hasOptions = draft.field_type === "dropdown" || draft.field_type === "multi_select" || draft.field_type === "radio";
  const opts = parseOptions(draft.options);
  const setOpts = (arr: string[]) => setDraft({ ...draft, options: arr });
  const layout = draft.field_type === "paragraph" || draft.field_type === "section_header";
  const myIdx = allFields.findIndex((f) => f.id === draft.id);
  const priorFields = allFields.filter((f, i) => i < myIdx && isInputField(f.field_type));

  return (
    <Dialog open={!!field} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader><DialogTitle>Edit Field</DialogTitle></DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto px-1 pr-3">
          <div className="space-y-4">
            <div>
              <Label>{layout ? "Text" : "Question / Label"}</Label>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Field Type</Label>
              <Select value={draft.field_type} onValueChange={(v) => setDraft({ ...draft, field_type: v, options: (v === "dropdown" || v === "multi_select" || v === "radio") ? (opts.length ? opts : ["Option 1", "Option 2"]) : null })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{FIELD_TYPES.map((ft) => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isInputField(draft.field_type) && (
              <>
                <div>
                  <Label>Help Text (optional)</Label>
                  <Textarea value={draft.help_text || ""} onChange={(e) => setDraft({ ...draft, help_text: e.target.value || null })} className="mt-1" rows={2} />
                </div>
                <div>
                  <Label>Placeholder (optional)</Label>
                  <Input value={draft.placeholder || ""} onChange={(e) => setDraft({ ...draft, placeholder: e.target.value || null })} className="mt-1" />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Required</Label>
                  <Switch checked={draft.required} onCheckedChange={(v) => setDraft({ ...draft, required: v })} />
                </div>
              </>
            )}
            {hasOptions && (
              <div>
                <Label>Options</Label>
                <div className="space-y-2 mt-1.5">
                  {opts.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={opt} onChange={(e) => { const a = [...opts]; a[i] = e.target.value; setOpts(a); }} placeholder={`Option ${i + 1}`} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setOpts(opts.filter((_, idx) => idx !== i))} className="shrink-0 text-red-400/60 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpts([...opts, ""])} className="gap-1.5"><Plus className="w-4 h-4" /> Add option</Button>
                </div>
              </div>
            )}

            {priorFields.length > 0 && (
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <Label>Only show this field based on an answer</Label>
                  <Switch checked={!!draft.condition} onCheckedChange={(on) => setDraft({ ...draft, condition: on ? { field: priorFields[0].field_key, op: "eq", value: "" } : null })} />
                </div>
                {draft.condition && (() => {
                  const cond = draft.condition!;
                  const src = priorFields.find((f) => f.field_key === cond.field) || priorFields[0];
                  const srcOpts = src.field_type === "yes_no" ? ["Yes", "No"] : parseOptions(src.options);
                  return (
                    <div className="space-y-2 mt-3">
                      <p className="text-xs text-muted-foreground">Show this field only when…</p>
                      <Select value={cond.field} onValueChange={(v) => setDraft({ ...draft, condition: { ...cond, field: v, value: "" } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{priorFields.map((pf) => <SelectItem key={pf.id} value={pf.field_key}>{pf.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={cond.op} onValueChange={(v) => setDraft({ ...draft, condition: { ...cond, op: v as "eq" | "neq" | "contains" | "answered" } })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eq">is</SelectItem>
                          <SelectItem value="neq">is not</SelectItem>
                          <SelectItem value="contains">includes</SelectItem>
                          <SelectItem value="answered">is answered</SelectItem>
                        </SelectContent>
                      </Select>
                      {cond.op !== "answered" && (srcOpts.length > 0 ? (
                        <Select value={cond.value || ""} onValueChange={(v) => setDraft({ ...draft, condition: { ...cond, value: v } })}>
                          <SelectTrigger><SelectValue placeholder="Select a value" /></SelectTrigger>
                          <SelectContent>{srcOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input value={cond.value || ""} onChange={(e) => setDraft({ ...draft, condition: { ...cond, value: e.target.value } })} placeholder="Enter a value" />
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ ...draft, options: hasOptions ? opts.filter((o) => o.trim()) : null })}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ── small color control ── */
const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div>
    <Label className="text-white/70">{label}</Label>
    <div className="flex gap-2 mt-1 items-center">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-10 h-9 rounded border border-white/15 bg-transparent cursor-pointer" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="w-32 bg-white/5 border-white/15 text-white font-mono text-sm" />
    </div>
  </div>
);

const csvEscape = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const AdminFormEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [fields, setFields] = useState<FormFieldDef[]>([]);
  const [confirmationTitle, setConfirmationTitle] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [accentColor, setAccentColor] = useState("#bf0f3e");
  const [headerColor, setHeaderColor] = useState("#000000");
  const [showLogo, setShowLogo] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [slugEdited, setSlugEdited] = useState(false);
  const [tab, setTab] = useState("build");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<FormFieldDef | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [viewResp, setViewResp] = useState<{ id: string; data: Record<string, unknown>; submitted_at: string } | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown> | null>(null);
  const [savingResp, setSavingResp] = useState(false);
  const [deleteRespId, setDeleteRespId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: form, isLoading } = useQuery({
    queryKey: ["admin-form", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("forms" as never).select("*").eq("id", id as string).single();
      if (error) throw error;
      return data as unknown as FormRecord;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!form) return;
    const s = form.settings || {};
    setTitle(form.title || "");
    setDescription(form.description || "");
    setSlug(form.slug || "");
    setFields([...(form.fields || [])].sort((a, b) => a.sort_order - b.sort_order));
    setConfirmationTitle(s.confirmationTitle || "");
    setConfirmationMessage(s.confirmationMessage || "");
    setAccentColor(s.accentColor || "#bf0f3e");
    setHeaderColor(s.headerColor || "#000000");
    setShowLogo(s.showLogo !== false);
    setTheme(s.theme === "dark" ? "dark" : "light");
    setStatus(form.status || "draft");
    // The slug "follows" the title until the user hand-edits it — but never
    // auto-changes a slug that's already meaningful or already published
    // (which would break links already handed out).
    setSlugEdited(!(form.status !== "published" && /^form-[a-z0-9]{4,8}$/.test(form.slug || "")));
    setDirty(false);
  }, [form]);

  const { data: responses } = useQuery({
    queryKey: ["form-responses", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_responses" as never).select("*").eq("form_id", id as string).order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as { id: string; data: Record<string, unknown>; submitted_at: string }[]) || [];
    },
    enabled: !!id,
  });

  const touch = () => setDirty(true);

  // Warn before closing/refreshing the tab with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const publicUrl = `${window.location.origin}/f/${slug}`;
  const inputFields = useMemo(() => fields.filter((f) => isInputField(f.field_type)), [fields]);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setFields(arrayMove(fields, fields.findIndex((f) => f.id === active.id), fields.findIndex((f) => f.id === over.id)));
    touch();
  };

  const addField = (type: string) => { const nf = makeField(type, (fields.length + 1) * 10); setFields((p) => [...p, nf]); setAddOpen(false); setEditingField(nf); touch(); };
  const saveField = (u: FormFieldDef) => { setFields((p) => p.map((f) => (f.id === u.id ? u : f))); setEditingField(null); touch(); };
  const deleteField = (fid: string) => { setFields((p) => p.filter((f) => f.id !== fid)); touch(); };

  const save = async (nextStatus?: "draft" | "published") => {
    if (!id) return;
    if (nextStatus === "published") {
      if (!title.trim()) { toast.error("Add a form title before publishing."); return; }
      if (!fields.some((f) => isInputField(f.field_type))) { toast.error("Add at least one question before publishing."); return; }
    }
    setSaving(true);
    try {
      const normalized = fields.map((f, i) => ({
        ...f, sort_order: (i + 1) * 10,
        options: f.field_type === "dropdown" ? parseOptions(f.options).filter((o) => o.trim()) : null,
      }));
      const payload = {
        title: title.trim() || "Untitled Form",
        description: description.trim() || null,
        slug: slug.trim(),
        fields: normalized,
        settings: {
          confirmationTitle: confirmationTitle.trim() || null,
          confirmationMessage: confirmationMessage.trim() || null,
          accentColor, headerColor, showLogo, theme,
        },
        status: nextStatus || status,
      };
      const { error } = await supabase.from("forms" as never).update(payload as never).eq("id", id);
      if (error) throw error;
      if (nextStatus) setStatus(nextStatus);
      if (nextStatus === "published") setTab("share");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["admin-forms"] });
      qc.invalidateQueries({ queryKey: ["admin-form", id] });
      toast.success(nextStatus === "published" ? "Published — your form is live!" : nextStatus === "draft" ? "Unpublished" : "Saved");
    } catch (e) {
      const msg = (e as Error).message || "";
      toast.error(msg.includes("duplicate") || msg.includes("unique") ? "That link (slug) is already taken — try another." : "Save failed: " + msg);
    } finally { setSaving(false); }
  };

  const deleteResponse = async () => {
    if (!deleteRespId) return;
    const { error } = await supabase.from("form_responses" as never).delete().eq("id", deleteRespId);
    if (error) { toast.error("Delete failed"); return; }
    setDeleteRespId(null);
    qc.invalidateQueries({ queryKey: ["form-responses", id] });
    toast.success("Response deleted");
  };

  const saveResponseEdit = async () => {
    if (!viewResp || !editData) return;
    setSavingResp(true);
    try {
      const newData = { ...editData, _editedAt: new Date().toISOString() };
      const { data, error } = await supabase.from("form_responses" as never).update({ data: newData } as never).eq("id", viewResp.id).select();
      if (error) throw error;
      if (!data || (data as unknown[]).length === 0) throw new Error("Editing isn’t enabled yet — run the one-time database snippet, then try again.");
      qc.invalidateQueries({ queryKey: ["form-responses", id] });
      setViewResp({ ...viewResp, data: newData });
      setEditData(null);
      toast.success("Response updated");
    } catch (e) {
      toast.error((e as Error).message || "Update failed");
    } finally {
      setSavingResp(false);
    }
  };

  const downloadResponsePdf = (r: { data: Record<string, unknown>; submitted_at: string }) => {
    downloadFormResponsePdf({ formTitle: title, fields: inputFields, data: r.data, submittedAt: r.submitted_at });
  };

  const exportCsv = () => {
    if (!responses || responses.length === 0) { toast.error("No responses yet"); return; }
    const cols = inputFields.filter((f) => f.field_type !== "signature");
    const headers = ["Submitted", ...cols.map((c) => c.label)];
    const rows = responses.map((r) => [new Date(r.submitted_at).toLocaleString(), ...cols.map((c) => { const v = r.data?.[c.field_key]; return Array.isArray(v) ? v.join("; ") : v === true ? "Yes" : v === false ? "No" : (v ?? ""); })]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${slug || "form"}-responses.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" /></div>;

  return (
    <div className="text-white">
      {/* header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Button size="icon" variant="ghost" onClick={() => { if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return; navigate("/admin/operations/forms"); }} className="text-white/70 hover:text-white hover:bg-white/10"><ArrowLeft className="w-5 h-5" /></Button>
        <Input value={title} onChange={(e) => { const v = e.target.value; setTitle(v); if (!slugEdited && status === "draft") setSlug(slugify(v)); touch(); }} className="max-w-sm bg-white/5 border-white/15 text-white text-lg font-semibold" placeholder="Form title" />
        {status === "published" ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30">Published</Badge> : <Badge className="bg-white/10 text-white/50 border-white/15">Draft</Badge>}
        {dirty && <span className="text-amber-400 text-xs">Unsaved changes</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={() => save()} disabled={saving || !dirty} className="border-white/20 text-white hover:bg-white/10 gap-1.5"><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}</Button>
          {status === "published"
            ? <Button variant="outline" onClick={() => save("draft")} disabled={saving} className="border-white/20 text-white hover:bg-white/10">Unpublish</Button>
            : <Button onClick={() => save("published")} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">Publish</Button>}
        </div>
      </div>

      {/* two-pane: controls | live preview */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] gap-6 items-start">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-white/5 border border-white/10">
              <TabsTrigger value="build" className="text-white/60 data-[state=active]:bg-white data-[state=active]:text-black">Build</TabsTrigger>
              <TabsTrigger value="design" className="text-white/60 data-[state=active]:bg-white data-[state=active]:text-black">Design</TabsTrigger>
              <TabsTrigger value="share" className="text-white/60 data-[state=active]:bg-white data-[state=active]:text-black">Share</TabsTrigger>
              <TabsTrigger value="responses" className="text-white/60 data-[state=active]:bg-white data-[state=active]:text-black">Responses{responses && responses.length > 0 ? ` (${responses.length})` : ""}</TabsTrigger>
            </TabsList>

            {/* BUILD */}
            <TabsContent value="build" className="mt-4 space-y-4">
              <div>
                <Label className="text-white/70">Description (optional, shown under the title)</Label>
                <Textarea value={description} onChange={(e) => { setDescription(e.target.value); touch(); }} className="mt-1 bg-white/5 border-white/15 text-white" rows={2} />
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">{fields.map((f) => <FieldRow key={f.id} field={f} onEdit={() => setEditingField(f)} onDelete={() => deleteField(f.id)} />)}</div>
                </SortableContext>
              </DndContext>
              <Button variant="outline" onClick={() => setAddOpen(true)} className="w-full border-dashed border-white/20 bg-white/5 text-white hover:text-white hover:bg-white/10 gap-2"><Plus className="w-4 h-4" /> Add Field</Button>
              <div className="border-t border-white/10 pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">After they submit</h3>
                <div><Label className="text-white/70">Confirmation heading</Label><Input value={confirmationTitle} onChange={(e) => { setConfirmationTitle(e.target.value); touch(); }} placeholder="Thank you!" className="mt-1 bg-white/5 border-white/15 text-white" /></div>
                <div><Label className="text-white/70">Confirmation message</Label><Textarea value={confirmationMessage} onChange={(e) => { setConfirmationMessage(e.target.value); touch(); }} placeholder="Your response has been recorded." className="mt-1 bg-white/5 border-white/15 text-white" rows={2} /></div>
              </div>
            </TabsContent>

            {/* DESIGN */}
            <TabsContent value="design" className="mt-4 space-y-5">
              <ColorField label="Accent color (buttons & highlights)" value={accentColor} onChange={(v) => { setAccentColor(v); touch(); }} />
              <ColorField label="Header banner color" value={headerColor} onChange={(v) => { setHeaderColor(v); touch(); }} />
              <div>
                <Label className="text-white/70">Page theme</Label>
                <div className="flex gap-2 mt-1">
                  {(["light", "dark"] as const).map((t) => (
                    <Button key={t} type="button" variant={theme === t ? "default" : "outline"} onClick={() => { setTheme(t); touch(); }}
                      className={theme === t ? "bg-[#bf0f3e] hover:bg-[#a50d35] text-white capitalize" : "border-white/20 text-white hover:bg-white/10 capitalize"}>{t}</Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between max-w-xs">
                <Label className="text-white/70">Show NLA logo</Label>
                <Switch checked={showLogo} onCheckedChange={(v) => { setShowLogo(v); touch(); }} />
              </div>
              <p className="text-xs text-white/40">Changes appear instantly in the live preview →</p>
            </TabsContent>

            {/* SHARE */}
            <TabsContent value="share" className="mt-4 space-y-5">
              {status !== "published" && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm px-4 py-3">This form is a <strong>draft</strong>. Click <strong>Publish</strong> (top right) to make the link and QR code go live.</div>}
              <div>
                <Label className="text-white/70">Public link</Label>
                <div className="flex gap-2 mt-1">
                  <Input readOnly value={publicUrl} className="bg-white/5 border-white/15 text-white font-mono text-sm" />
                  <Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copied"); }} className="border-white/20 text-white hover:bg-white/10 gap-1.5 shrink-0"><Link2 className="w-4 h-4" /> Copy</Button>
                  <Button variant="outline" onClick={() => window.open(publicUrl, "_blank")} className="border-white/20 text-white hover:bg-white/10 shrink-0"><ExternalLink className="w-4 h-4" /></Button>
                </div>
              </div>
              <div>
                <Label className="text-white/70">Custom link ending (slug)</Label>
                <Input value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugEdited(true); touch(); }} className="mt-1 bg-white/5 border-white/15 text-white font-mono text-sm" />
                <p className="text-xs text-white/40 mt-1">Changing this changes the public link. Save after editing.</p>
              </div>
              <div>
                <Label className="text-white/70">QR code</Label>
                <div className="mt-2 inline-block bg-white p-4 rounded-xl"><QRCodeCanvas value={publicUrl} size={180} includeMargin /></div>
                <p className="text-xs text-white/40 mt-2">Right-click the code to save the image, then print or post it for parents to scan.</p>
              </div>
            </TabsContent>

            {/* RESPONSES */}
            <TabsContent value="responses" className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/60 text-sm">{responses?.length || 0} response{(responses?.length || 0) === 1 ? "" : "s"}</p>
                <Button variant="outline" size="sm" onClick={exportCsv} className="border-white/20 text-white hover:bg-white/10 gap-1.5"><Download className="w-4 h-4" /> Export CSV</Button>
              </div>
              {!responses || responses.length === 0 ? (
                <div className="border border-dashed border-white/15 rounded-xl py-14 text-center"><Inbox className="w-9 h-9 mx-auto text-white/20 mb-2" /><p className="text-white/50">No responses yet.</p></div>
              ) : (
                <div className="space-y-2">
                  {responses.map((r) => {
                    const firstAnswers = inputFields.filter((f) => f.field_type !== "signature" && f.field_type !== "image").slice(0, 2).map((f) => r.data?.[f.field_key]).filter((x) => x !== undefined && x !== null && x !== "");
                    return (
                      <div key={r.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{firstAnswers.length ? firstAnswers.map(String).join(" · ") : "Response"}</div>
                          <div className="text-xs text-white/35">{new Date(r.submitted_at).toLocaleString()}</div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => downloadResponsePdf(r)} title="Download PDF" className="h-8 w-8 text-white/50 hover:text-white"><Download className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setViewResp(r)} className="h-8 w-8 text-white/50 hover:text-white"><Eye className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteRespId(r.id)} className="h-8 w-8 text-red-400/50 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* LIVE PREVIEW */}
        <div className="lg:sticky lg:top-4">
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-2">Live preview</p>
          <div className="rounded-xl overflow-hidden border border-white/10 max-h-[80vh] overflow-y-auto">
            <FormRenderer
              preview
              title={title}
              description={description}
              fields={fields}
              branding={{ accentColor, headerColor, showLogo, theme }}
              confirmation={{ title: confirmationTitle, message: confirmationMessage }}
            />
          </div>
        </div>
      </div>

      {/* add field picker */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add a field</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map((ft) => { const Icon = ft.icon; return (
              <Button key={ft.value} variant="outline" className="justify-start items-center gap-2 h-auto min-h-[46px] py-2.5 whitespace-normal text-left" onClick={() => addField(ft.value)}><Icon className="w-4 h-4 shrink-0" /> <span className="text-sm leading-tight">{ft.label}</span></Button>
            ); })}
          </div>
        </DialogContent>
      </Dialog>

      <FieldEditor field={editingField} allFields={fields} onClose={() => setEditingField(null)} onSave={saveField} />

      {/* view / edit response */}
      <Dialog open={!!viewResp} onOpenChange={(o) => { if (!o) { setViewResp(null); setEditData(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader><DialogTitle>{editData ? "Edit Response" : "Response"}</DialogTitle></DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto px-1 pr-3">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Submitted {viewResp && new Date(viewResp.submitted_at).toLocaleString()}
                {viewResp?.data?._editedAt ? ` · edited ${new Date(String(viewResp.data._editedAt)).toLocaleString()}` : ""}
              </p>
              {viewResp && inputFields.map((f) => {
                const v = editData ? editData[f.field_key] : viewResp.data?.[f.field_key];
                const setV = (nv: unknown) => setEditData((p) => ({ ...(p || {}), [f.field_key]: nv }));
                const isMedia = f.field_type === "signature" || f.field_type === "image";
                return (
                  <div key={f.id} className="border-b pb-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</div>
                    {isMedia ? (
                      v ? <img src={String(v)} alt={f.field_type} className="mt-1 border rounded bg-white max-h-40 object-contain" /> : <span className="text-sm text-muted-foreground">—</span>
                    ) : editData ? (
                      f.field_type === "long_text" ? (
                        <Textarea value={String(v ?? "")} onChange={(e) => setV(e.target.value)} className="mt-1" rows={3} />
                      ) : (f.field_type === "dropdown" || f.field_type === "radio") ? (
                        <Select value={String(v ?? "")} onValueChange={setV}><SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent>{parseOptions(f.options).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                      ) : f.field_type === "yes_no" ? (
                        <Select value={String(v ?? "")} onValueChange={setV}><SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger><SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent></Select>
                      ) : f.field_type === "checkbox" ? (
                        <div className="mt-1"><Switch checked={v === true} onCheckedChange={(c) => setV(c === true)} /></div>
                      ) : f.field_type === "multi_select" ? (
                        <div className="mt-1 space-y-1.5">
                          {parseOptions(f.options).map((o) => { const sel = Array.isArray(v) ? (v as string[]) : []; return (
                            <label key={o} className="flex items-center gap-2"><Checkbox checked={sel.includes(o)} onCheckedChange={() => setV(sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o])} /><span className="text-sm">{o}</span></label>
                          ); })}
                        </div>
                      ) : f.field_type === "rating" ? (
                        <div className="mt-1 flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button type="button" key={n} onClick={() => setV(n)}><Star className="w-6 h-6" style={{ fill: (typeof v === "number" && n <= v) ? "#f59e0b" : "transparent", color: "#f59e0b" }} /></button>
                          ))}
                        </div>
                      ) : (
                        <Input type={f.field_type === "number" ? "number" : (f.field_type === "date" || f.field_type === "dob") ? "date" : f.field_type === "time" ? "time" : f.field_type === "email" ? "email" : f.field_type === "phone" ? "tel" : "text"} value={String(v ?? "")} onChange={(e) => setV(e.target.value)} className="mt-1" />
                      )
                    ) : (
                      <div className="text-sm mt-0.5">{Array.isArray(v) ? (v.length ? v.join(", ") : "—") : f.field_type === "rating" ? (v ? `${v} / 5` : "—") : f.field_type === "dob" ? (v ? `${v}${ageFromDob(String(v)) !== null ? ` (age ${ageFromDob(String(v))})` : ""}` : "—") : v === true ? "Yes" : v === false ? "No" : (v ? String(v) : "—")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            {editData ? (
              <>
                <Button variant="outline" onClick={() => setEditData(null)}>Cancel</Button>
                <Button onClick={saveResponseEdit} disabled={savingResp}>{savingResp ? "Saving…" : "Save changes"}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => viewResp && downloadResponsePdf(viewResp)} className="gap-1.5"><Download className="w-4 h-4" /> Download PDF</Button>
                <Button variant="outline" onClick={() => setEditData({ ...(viewResp?.data || {}) })} className="gap-1.5"><Pencil className="w-4 h-4" /> Edit response</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRespId} onOpenChange={(o) => !o && setDeleteRespId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this response?</AlertDialogTitle><AlertDialogDescription>This permanently removes the submission. This can’t be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-500 hover:bg-red-600 text-white" onClick={deleteResponse}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminFormEditor;
