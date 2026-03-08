import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  GripVertical, Plus, Trash2, Eye, Save, Pencil,
  Type, AlignLeft, Hash, CalendarDays, ChevronDown, CheckSquare, Phone, Mail,
  MapPin, Upload, Heading, FileText, ToggleLeft, List
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import FormPreview from "@/components/admin/FormPreview";

const FIELD_TYPES = [
  { value: "short_text", label: "Short Text", icon: Type },
  { value: "long_text", label: "Long Text", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: CalendarDays },
  { value: "dropdown", label: "Dropdown / Select", icon: ChevronDown },
  { value: "multi_select", label: "Multi-Select", icon: List },
  { value: "yes_no", label: "Yes / No", icon: ToggleLeft },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "phone", label: "Phone Number", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "address", label: "Address", icon: MapPin },
  { value: "file_upload", label: "File Upload", icon: Upload },
  { value: "section_header", label: "Section Header", icon: Heading },
  { value: "paragraph", label: "Paragraph / Instructions", icon: FileText },
] as const;

type FormField = {
  id: string;
  field_key: string;
  field_type: string;
  label: string;
  help_text: string | null;
  placeholder: string | null;
  required: boolean;
  options: any;
  sort_order: number;
  is_active: boolean;
  is_core: boolean;
  db_column: string | null;
  default_value: string | null;
  section: string | null;
};

const fieldTypeIcon = (type: string) => {
  const ft = FIELD_TYPES.find(f => f.value === type);
  return ft ? ft.icon : Type;
};

/* ─── Sortable Field Row ─── */
const SortableFieldRow = ({
  field, onEdit, onToggleActive, onDelete
}: {
  field: FormField;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const Icon = fieldTypeIcon(field.field_type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
        field.is_active
          ? "bg-white/5 border-white/10 hover:border-white/20"
          : "bg-white/[0.02] border-white/5 opacity-50"
      }`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60">
        <GripVertical className="w-4 h-4" />
      </button>

      <Icon className="w-4 h-4 text-white/40 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{field.label}</span>
          {field.is_core && <Badge className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/30 px-1.5 py-0">Core</Badge>}
          {field.required && <Badge className="text-[10px] bg-red-500/15 text-red-400 border-red-500/30 px-1.5 py-0">Required</Badge>}
          {!field.is_active && <Badge className="text-[10px] bg-white/10 text-white/40 border-white/10 px-1.5 py-0">Hidden</Badge>}
        </div>
        <span className="text-xs text-white/30">{FIELD_TYPES.find(f => f.value === field.field_type)?.label || field.field_type} · {field.field_key}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Switch
          checked={field.is_active}
          onCheckedChange={onToggleActive}
          className="scale-75"
        />
        <Button size="icon" variant="ghost" onClick={onEdit} className="h-8 w-8 text-white/50 hover:text-white">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        {!field.is_core && (
          <Button size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-red-400/50 hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

/* ─── Field Editor Dialog ─── */
const FieldEditorDialog = ({
  field, open, onClose, onSave
}: {
  field: FormField | null;
  open: boolean;
  onClose: () => void;
  onSave: (updated: FormField) => void;
}) => {
  const [draft, setDraft] = useState<FormField | null>(null);

  useEffect(() => {
    if (field) setDraft({ ...field });
  }, [field]);

  if (!draft) return null;

  const hasOptions = ["dropdown", "multi_select"].includes(draft.field_type);
  const optionsList: string[] = hasOptions && draft.options ? (typeof draft.options === "string" ? JSON.parse(draft.options) : draft.options) : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Field</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4">
            <div>
              <Label>Field Label</Label>
              <Input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} className="mt-1" />
            </div>

            <div>
              <Label>Field Key</Label>
              <Input
                value={draft.field_key}
                onChange={e => setDraft({ ...draft, field_key: e.target.value.replace(/[^a-z0-9_]/g, "") })}
                className="mt-1 font-mono text-sm"
                disabled={draft.is_core}
              />
              {draft.is_core && <p className="text-xs text-muted-foreground mt-1">Core field keys cannot be changed.</p>}
            </div>

            <div>
              <Label>Field Type</Label>
              <Select
                value={draft.field_type}
                onValueChange={v => setDraft({ ...draft, field_type: v })}
                disabled={draft.is_core}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(ft => (
                    <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {draft.is_core && <p className="text-xs text-muted-foreground mt-1">Core field types cannot be changed.</p>}
            </div>

            <div>
              <Label>Help Text / Instructions</Label>
              <Textarea value={draft.help_text || ""} onChange={e => setDraft({ ...draft, help_text: e.target.value || null })} className="mt-1" rows={3} />
            </div>

            <div>
              <Label>Placeholder Text</Label>
              <Input value={draft.placeholder || ""} onChange={e => setDraft({ ...draft, placeholder: e.target.value || null })} className="mt-1" />
            </div>

            <div>
              <Label>Section</Label>
              <Input value={draft.section || ""} onChange={e => setDraft({ ...draft, section: e.target.value || null })} className="mt-1" />
            </div>

            <div>
              <Label>Default Value</Label>
              <Input value={draft.default_value || ""} onChange={e => setDraft({ ...draft, default_value: e.target.value || null })} className="mt-1" />
            </div>

            <div className="flex items-center justify-between">
              <Label>Required</Label>
              <Switch checked={draft.required} onCheckedChange={v => setDraft({ ...draft, required: v })} />
            </div>

            {hasOptions && (
              <div>
                <Label>Dropdown Options</Label>
                <p className="text-xs text-muted-foreground mb-2">One option per line</p>
                <Textarea
                  value={optionsList.join("\n")}
                  onChange={e => {
                    const opts = e.target.value.split("\n").filter(Boolean);
                    setDraft({ ...draft, options: opts });
                  }}
                  className="mt-1 font-mono text-sm"
                  rows={6}
                />
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Main Form Builder ─── */
const AdminFormBuilder = () => {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [addFieldOpen, setAddFieldOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: dbFields, isLoading } = useQuery({
    queryKey: ["form-fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registration_form_fields")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as FormField[];
    },
  });

  useEffect(() => {
    if (dbFields) {
      setFields(dbFields);
      setHasChanges(false);
    }
  }, [dbFields]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = fields.findIndex(f => f.id === active.id);
    const newIdx = fields.findIndex(f => f.id === over.id);
    const reordered = arrayMove(fields, oldIdx, newIdx).map((f, i) => ({ ...f, sort_order: (i + 1) * 10 }));
    setFields(reordered);
    setHasChanges(true);
  };

  const handleFieldUpdate = (updated: FormField) => {
    setFields(prev => prev.map(f => f.id === updated.id ? updated : f));
    setEditingField(null);
    setHasChanges(true);
  };

  const handleToggleActive = (id: string) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, is_active: !f.is_active } : f));
    setHasChanges(true);
  };

  const handleDeleteField = (id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    setHasChanges(true);
  };

  const handleAddField = (type: string) => {
    const maxSort = Math.max(...fields.map(f => f.sort_order), 0);
    const newField: FormField = {
      id: crypto.randomUUID(),
      field_key: `custom_${Date.now()}`,
      field_type: type,
      label: `New ${FIELD_TYPES.find(f => f.value === type)?.label || "Field"}`,
      help_text: null,
      placeholder: null,
      required: false,
      options: ["dropdown", "multi_select"].includes(type) ? ["Option 1", "Option 2"] : null,
      sort_order: maxSort + 10,
      is_active: true,
      is_core: false,
      db_column: null,
      default_value: null,
      section: null,
    };
    setFields(prev => [...prev, newField]);
    setEditingField(newField);
    setHasChanges(true);
    setAddFieldOpen(false);
  };

  const handlePublish = async () => {
    setIsSaving(true);
    try {
      // Get existing field IDs from DB
      const { data: existing } = await supabase.from("registration_form_fields").select("id");
      const existingIds = new Set((existing || []).map(e => e.id));
      const currentIds = new Set(fields.map(f => f.id));

      // Delete removed fields
      const toDelete = [...existingIds].filter(id => !currentIds.has(id));
      if (toDelete.length > 0) {
        await supabase.from("registration_form_fields").delete().in("id", toDelete);
      }

      // Upsert all current fields
      for (const field of fields) {
        const { id, ...rest } = field;
        const payload = {
          ...rest,
          options: rest.options ? (typeof rest.options === "string" ? rest.options : JSON.stringify(rest.options)) : null,
          updated_at: new Date().toISOString(),
        };

        if (existingIds.has(id)) {
          await supabase.from("registration_form_fields").update(payload).eq("id", id);
        } else {
          await supabase.from("registration_form_fields").insert({ id, ...payload });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["form-fields"] });
      setHasChanges(false);
      toast.success("Form published successfully! The live registration form is now updated.");
    } catch (err: any) {
      toast.error("Failed to publish: " + (err.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="bg-black text-white">
      {/* Header bar */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between sticky top-0 bg-black z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Registration Form Builder</h2>
          {hasChanges && (
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">Unsaved Changes</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPreview(true)} className="gap-1.5 border-white/20 text-white hover:bg-white/10">
            <Eye className="w-3.5 h-3.5" /> Preview
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={!hasChanges || isSaving}
            className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="w-3.5 h-3.5" /> {isSaving ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        <p className="text-sm text-white/50">
          Drag to reorder fields. Edit labels, help text, and options. Add custom fields. Click <strong>Publish</strong> to push changes to the live registration form.
          Waivers and signatures are managed separately.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {fields.map(field => (
                <SortableFieldRow
                  key={field.id}
                  field={field}
                  onEdit={() => setEditingField(field)}
                  onToggleActive={() => handleToggleActive(field.id)}
                  onDelete={() => handleDeleteField(field.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add Field */}
        <Button
          variant="outline"
          onClick={() => setAddFieldOpen(true)}
          className="w-full border-dashed border-white/20 text-white/50 hover:text-white hover:bg-white/5 gap-2"
        >
          <Plus className="w-4 h-4" /> Add New Field
        </Button>
      </div>

      {/* Add Field Type Picker */}
      <Dialog open={addFieldOpen} onOpenChange={setAddFieldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Field Type</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_TYPES.map(ft => {
              const Icon = ft.icon;
              return (
                <Button
                  key={ft.value}
                  variant="outline"
                  className="justify-start gap-2 h-auto py-3"
                  onClick={() => handleAddField(ft.value)}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-sm">{ft.label}</span>
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Field Editor */}
      <FieldEditorDialog
        field={editingField}
        open={!!editingField}
        onClose={() => setEditingField(null)}
        onSave={handleFieldUpdate}
      />

      {/* Preview */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Form Preview</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <FormPreview fields={fields.filter(f => f.is_active)} />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFormBuilder;
