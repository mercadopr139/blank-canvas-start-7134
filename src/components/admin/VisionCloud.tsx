import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, ArchiveX, Cloud, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PILLARS = ["Operations", "Sales & Marketing", "Finance", "Vision", "Personal"] as const;

const PILLAR_CHIP_COLORS: Record<string, string> = {
  Operations: "bg-[#bf0f3e]/15 text-[#bf0f3e] border-[#bf0f3e]/30",
  "Sales & Marketing": "bg-green-500/15 text-green-400 border-green-500/30",
  Finance: "bg-sky-300/15 text-sky-300 border-sky-300/30",
  Vision: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  Personal: "bg-purple-400/15 text-purple-400 border-purple-400/30",
};

type VisionItem = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  pillar: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/* ── Sortable Row ── */
function SortableRow({
  item,
  onEdit,
  onArchive,
}: {
  item: VisionItem;
  onEdit: (item: VisionItem) => void;
  onArchive: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 px-4 py-3 rounded-xl border bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.07] transition-colors ${isDragging ? "ring-1 ring-white/20" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 rounded text-white/20 hover:text-white/50 transition-colors touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Title */}
      <span className="flex-1 text-sm text-white/80 font-medium truncate">{item.title}</span>

      {/* Pillar badge */}
      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${PILLAR_CHIP_COLORS[item.pillar] || "border-white/20 text-white/60"}`}>
        {item.pillar}
      </Badge>

      {/* Actions */}
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        <button onClick={() => onEdit(item)} className="p-1 rounded-full hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors" aria-label="Edit">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={() => onArchive(item.id)} className="p-1 rounded-full hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors" aria-label="Archive">
          <ArchiveX className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ── Overlay preview while dragging ── */
function DragOverlayRow({ item }: { item: VisionItem }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-white/[0.09] border-white/20 shadow-lg shadow-black/30">
      <GripVertical className="w-4 h-4 text-white/40" />
      <span className="flex-1 text-sm text-white/90 font-medium truncate">{item.title}</span>
      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 shrink-0 ${PILLAR_CHIP_COLORS[item.pillar] || "border-white/20 text-white/60"}`}>
        {item.pillar}
      </Badge>
    </div>
  );
}

/* ── Main Component ── */
export default function VisionCloud({ focusArea = "nla" }: { focusArea?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<VisionItem | null>(null);
  const [form, setForm] = useState({ title: "", description: "", pillar: "Vision" });
  const [activeId, setActiveId] = useState<string | null>(null);

  const FOCUS_AREA_LABELS: Record<string, string> = {
    nla: "NLA", "usa-boxing": "USA Boxing", quikhit: "QUIKHIT", fcusa: "FCUSA", personal: "Personal",
  };
  const areaLabel = FOCUS_AREA_LABELS[focusArea] || focusArea;
  const isNla = focusArea === "nla";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const { data: items = [] } = useQuery({
    queryKey: ["vision-cloud-items", focusArea],
    queryFn: async () => {
      let q = supabase
        .from("vision_cloud_items" as any)
        .select("*")
        .eq("active", true);
      if (isNla) {
        q = q.or("source.is.null,source.eq.NLA");
      } else {
        q = q.eq("source", areaLabel);
      }
      const { data, error } = await q
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]) as VisionItem[];
    },
    enabled: !!user,
  });

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (editingItem) {
        const { error } = await supabase
          .from("vision_cloud_items" as any)
          .update({ title: form.title, description: form.description || null, pillar: form.pillar } as any)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        // New items get sort_order after current max
        const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : 0;
        const { error } = await supabase
          .from("vision_cloud_items" as any)
          .insert({ title: form.title, description: form.description || null, pillar: form.pillar, user_id: user!.id, active: true, sort_order: maxOrder + 10, source: areaLabel } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vision-cloud-items", focusArea] });
      closeModal();
      toast.success(editingItem ? "Updated" : "Added to Vision Cloud");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("vision_cloud_items" as any)
        .update({ active: false } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vision-cloud-items", focusArea] });
      toast.success("Archived");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async (reordered: VisionItem[]) => {
      const updates = reordered.map((item, idx) => ({
        id: item.id,
        sort_order: (idx + 1) * 10,
      }));
      // Batch update each item's sort_order
      for (const u of updates) {
        const { error } = await supabase
          .from("vision_cloud_items" as any)
          .update({ sort_order: u.sort_order } as any)
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vision-cloud-items", focusArea] });
      toast.success("Order updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    // Optimistic update
    queryClient.setQueryData(["vision-cloud-items", focusArea], reordered);
    reorderMutation.mutate(reordered);
  };

  const openAdd = () => {
    setEditingItem(null);
    setForm({ title: "", description: "", pillar: "Vision" });
    setShowModal(true);
  };

  const openEdit = (item: VisionItem) => {
    setEditingItem(item);
    setForm({ title: item.title, description: item.description || "", pillar: item.pillar });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setForm({ title: "", description: "", pillar: "Vision" });
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <>
      <div className="relative rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-white/[0.01] backdrop-blur-sm p-6 md:p-8 overflow-hidden">
        <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/[0.06] pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-amber-400/[0.03] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-400/[0.03] rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Cloud className="w-4 h-4 text-white/30" />
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-white/50">Big Picture Focus</h2>
            </div>
            <p className="text-xs text-white/20 italic">Drag items to prioritize.</p>
          </div>
          <div className="flex items-center gap-3">
            {items.length > 0 && (
              <span className="text-[10px] text-white/20 tabular-nums">
                {items.length} Strategic Focus Area{items.length !== 1 ? "s" : ""} Active
              </span>
            )}
            <Button
              onClick={openAdd}
              size="sm"
              className="bg-white/[0.08] hover:bg-white/[0.14] text-white/60 hover:text-white border border-white/[0.1] text-xs h-7 px-3 rounded-full"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Vertical List */}
        <div className="relative space-y-2 min-h-[60px]">
          {items.length === 0 ? (
            <div className="w-full text-center py-8">
              <Cloud className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-xs text-white/15 italic">No strategic focus areas yet</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {items.map((item) => (
                  <SortableRow key={item.id} item={item} onEdit={openEdit} onArchive={(id) => archiveMutation.mutate(id)} />
                ))}
              </SortableContext>
              <DragOverlay>{activeItem ? <DragOverlayRow item={activeItem} /> : null}</DragOverlay>
            </DndContext>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Focus Area" : "Add Big Picture Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/60">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1" placeholder="e.g. Launch summer program" />
            </div>
            <div>
              <Label className="text-white/60">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-white/5 border-white/10 text-white mt-1" placeholder="Optional details..." rows={3} />
            </div>
            <div>
              <Label className="text-white/60">Pillar</Label>
              <Select value={form.pillar} onValueChange={(v) => setForm({ ...form, pillar: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue placeholder="Select pillar" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 z-[200]">
                  {PILLARS.map((p) => (
                    <SelectItem key={p} value={p} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeModal} className="text-white/40 hover:text-white/60">Cancel</Button>
            <Button onClick={() => upsertMutation.mutate()} disabled={!form.title.trim() || upsertMutation.isPending} className="bg-white text-black hover:bg-white/90">
              {upsertMutation.isPending ? "Saving..." : editingItem ? "Save Changes" : "Add to Cloud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
