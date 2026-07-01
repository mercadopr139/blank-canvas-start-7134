import { useState, useCallback } from "react";
import {
  DndContext, rectIntersection, PointerSensor, useSensor, useSensors,
  DragEndEvent, DragStartEvent, DragOverlay, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import nlaLogo from "@/assets/nla-logo-white.png";
import usaBoxingLogo from "@/assets/usa-boxing-logo.png";
import fcusaLogo from "@/assets/FightingChanceUSA.png";
import quikhitLogo from "@/assets/quikhit-logo.png";
import nlaMascot from "@/assets/nla-mascot.png";
import personalFamily from "@/assets/personal-family.png";
import DailyVerse from "@/components/admin/DailyVerse";
import FocusAreaNotes from "@/components/admin/FocusAreaNotes";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { todayInET, todayDisplayInET } from "@/lib/easternTime";
import { ArrowLeft, Plus, CheckCircle2, Circle, LogOut, Archive, ArrowRight, Trash2, MoreVertical, Target, Zap, GripVertical, Radar } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const PILLARS = ["Operations", "Sales & Marketing", "Finance", "Vision", "Personal"] as const;

const formatCreatedDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

type Signal = {
  id: string;
  title: string | null;
  pillar: string | null;
  priority_layer: string | null;
  signal_kind: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  date_assigned: string | null;
  signal_type: string;
  source: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
  source_message_id?: string | null;
  source_conversation_id?: string | null;
};

type BucketId = "core" | "bonus" | "ondeck";

const PILLAR_COLORS: Record<string, string> = {
  Operations: "bg-[#bf0f3e]/20 text-[#bf0f3e] border-[#bf0f3e]/40",
  "Sales & Marketing": "bg-green-500/20 text-green-400 border-green-500/40",
  Finance: "bg-sky-300/20 text-sky-300 border-sky-300/40",
  Vision: "bg-amber-400/20 text-amber-400 border-amber-400/40",
  Personal: "bg-purple-400/20 text-purple-400 border-purple-400/40",
};

const FOCUS_AREA_LABELS: Record<string, string> = {
  nla: "NLA",
  "usa-boxing": "USA Boxing",
  quikhit: "QUIKHIT",
  fcusa: "FCUSA",
  personal: "Personal",
};

const FOCUS_AREA_COLORS: Record<string, { hex: string; hexMuted: string; ring: string; bgFrom: string }> = {
  nla:         { hex: "#ef4444", hexMuted: "#f87171", ring: "#ef4444", bgFrom: "rgba(239,68,68,0.12)" },
  "usa-boxing":{ hex: "#3b82f6", hexMuted: "#60a5fa", ring: "#3b82f6", bgFrom: "rgba(59,130,246,0.12)" },
  quikhit:     { hex: "#e4e4e7", hexMuted: "#a1a1aa", ring: "#e4e4e7", bgFrom: "rgba(228,228,231,0.10)" },
  fcusa:       { hex: "#71717a", hexMuted: "#a1a1aa", ring: "#71717a", bgFrom: "rgba(113,113,122,0.10)" },
  personal:    { hex: "#a78bfa", hexMuted: "#c4b5fd", ring: "#a78bfa", bgFrom: "rgba(167,139,250,0.12)" },
};

const buildColorFromHex = (hex: string) => ({
  hex,
  hexMuted: hex,
  ring: hex,
  bgFrom: `${hex}1f`,
});

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

/* ─── Droppable Container ─── */
const DroppableColumn = ({ id, children, isOver }: { id: string; children: React.ReactNode; isOver?: boolean }) => {
  const { setNodeRef, isOver: hovering } = useDroppable({ id });
  const active = isOver ?? hovering;
  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-200 rounded-xl ${active ? "ring-2 ring-white/20 bg-white/[0.03]" : ""}`}
    >
      {children}
    </div>
  );
};

/* ─── Sortable Row (shared for all columns) ─── */
const SortableSignalRow = ({
  signal,
  bucket,
  onEdit,
  onToggleStatus,
  extraActions,
  accentColor,
}: {
  signal: Signal;
  bucket: BucketId;
  onEdit: () => void;
  onToggleStatus: () => void;
  extraActions?: React.ReactNode;
  accentColor?: string;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: signal.id,
    data: { bucket },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const isComplete = signal.status === "Complete";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
        isDragging ? "ring-1 ring-white/20 bg-white/[0.06]" : ""
      } ${
        isComplete
          ? "bg-white/[0.01] border border-white/[0.03] opacity-40 hover:opacity-60"
          : bucket === "ondeck"
            ? "hover:bg-white/[0.04]"
            : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07]"
      }`}
      onClick={onEdit}
    >
      {/* Drag handle */}
      <button
        className="shrink-0 p-0.5 text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Status toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleStatus(); }}
        className="shrink-0"
        aria-label="Toggle status"
      >
        {isComplete ? (
          <CheckCircle2 className="w-4 h-4 text-green-400" />
        ) : (
          <Circle className={`w-4 h-4 ${bucket === "core" ? "opacity-50 hover:opacity-80" : "text-white/25 hover:text-white/50"} transition-colors`} style={bucket === "core" && accentColor ? { color: accentColor } : undefined} />
        )}
      </button>

      {/* Title */}
      <span className={`text-sm flex-1 ${isComplete ? "line-through text-white/30" : "text-white"}`}>
        {signal.title || "(Untitled)"}
      </span>

      <span className="text-[10px] text-white/15 shrink-0 tabular-nums">{formatCreatedDate(signal.created_at)}</span>

      {signal.pillar && (
        <Badge variant="outline" className={`text-[9px] shrink-0 ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>
          {signal.pillar}
        </Badge>
      )}

      {extraActions}
    </div>
  );
};

const AdminSignals = ({ managerType = "PD" }: { managerType?: string }) => {
  const navigate = useNavigate();
  const { focusArea = "nla" } = useParams<{ focusArea: string }>();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const backPath = `/admin/task-manager/${managerType}`;
  // Legacy routes only exist for PD and PC; new managers (HC, etc.) use
  // the polymorphic /admin/task-manager/:managerType/signals/:focusArea path.
  const signalsBasePath =
    managerType === "PD"
      ? "/admin/signals"
      : managerType === "PC"
      ? "/admin/pc-signals"
      : `/admin/task-manager/${managerType}/signals`;
  const [showAdd, setShowAdd] = useState(false);
  const [selectedForArchive, setSelectedForArchive] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    title: "",
    pillar: "" as string,
    priority_layer: "" as string,
    description: "",
    bucket: "core" as BucketId,
  });

  const [editingSignal, setEditingSignal] = useState<Signal | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    pillar: "",
    bucket: "core" as BucketId,
    status: "Pending" as string,
    description: "",
  });

  const [trashConfirmId, setTrashConfirmId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [, setDraggingBucket] = useState<BucketId | null>(null);

  // "Today" is pinned to the academy's local timezone (America/New_York)
  // for the date header. Bucket placement is driven by priority_layer alone;
  // signals don't carry a per-day date stamp.
  const today = todayInET();
  const todayDisplay = todayDisplayInET();

  // Load the task manager record so the greeting uses the actual owner's
  // first name instead of a hardcoded "Josh" / "Chrissy".
  const { data: taskManager } = useQuery({
    queryKey: ["task-manager", managerType],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("task_managers")
        .select("key, owner_name") as any)
        .eq("key", managerType)
        .maybeSingle();
      if (error) throw error;
      return data as { key: string; owner_name: string | null } | null;
    },
  });
  const ownerFirstName = (taskManager?.owner_name || "").trim().split(/\s+/)[0] || "there";

  // Fetch dynamic focus area config from DB — scoped by manager_type
  const { data: focusAreaConfig } = useQuery({
    queryKey: ["focus-area-config", focusArea, managerType],
    queryFn: async () => {
      const { data } = await (supabase
        .from("focus_areas")
        .select("*") as any)
        .eq("key", focusArea)
        .eq("manager_type", managerType)
        .maybeSingle();
      return data as { id: string; title: string; accent_color: string; image_url: string | null } | null;
    },
  });

  const areaLabel = focusAreaConfig?.title ?? FOCUS_AREA_LABELS[focusArea] ?? focusArea;
  const isNla = focusArea === "nla";
  const ac = FOCUS_AREA_COLORS[focusArea] || (focusAreaConfig ? buildColorFromHex(focusAreaConfig.accent_color) : FOCUS_AREA_COLORS.nla);
  const dynamicImageUrl = focusAreaConfig?.image_url ?? null;

  // Apply the manager-scoped source filter. PD uses the legacy convention
  // (NULL or raw area title for backward compat); every other manager
  // (PC, HC, JS, etc.) namespaces sources as "<KEY>:<area>".
  const applySourceFilter = (query: any) => {
    if (managerType === "PD") {
      if (isNla) return query.or("source.is.null,source.eq.NLA");
      return query.eq("source", areaLabel);
    }
    return query.eq("source", `${managerType}:${isNla ? "NLA" : areaLabel}`);
  };

  // Core signals stick around until archived — pending items carry over
  // day after day so unfinished work is always visible. Completed items
  // also stay (with strikethrough) until the user hits "Archive completed."
  // No date filter means this is a single rolling list, not a daily reset.
  const { data: todayCoreSignals = [] } = useQuery({
    queryKey: ["signals", focusArea, "today-core"],
    queryFn: async () => {
      let q = supabase
        .from("signals")
        .select("*")
        .eq("priority_layer", "Core" as any)
        .eq("is_archived", false as any)
        .eq("is_trashed", false as any);
      q = applySourceFilter(q);
      const { data, error } = await q
        .order("today_sort_order" as any, { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Signal[];
    },
  });

  const { data: todayBonusSignals = [] } = useQuery({
    queryKey: ["signals", focusArea, "today-bonus"],
    queryFn: async () => {
      let q = supabase
        .from("signals")
        .select("*")
        .eq("priority_layer", "Bonus" as any)
        .eq("is_archived", false as any)
        .eq("is_trashed", false as any);
      q = applySourceFilter(q);
      const { data, error } = await q
        .order("today_sort_order" as any, { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Signal[];
    },
  });

  // On Radar = signals not yet scheduled into Core or On-Deck. With the
  // date-less model, the bucket is determined by priority_layer alone, so
  // On Radar means priority_layer IS NULL.
  const { data: onDeckSignals = [] } = useQuery({
    queryKey: ["signals", focusArea, "on-deck"],
    queryFn: async () => {
      let q = supabase
        .from("signals")
        .select("*")
        .is("priority_layer", null)
        .eq("status", "Pending" as any)
        .eq("is_archived", false as any)
        .eq("is_trashed", false as any);
      q = applySourceFilter(q);
      const { data, error } = await q
        .order("deck_sort_order" as any, { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Signal[];
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: "Core" | "Bonus" }) => {
      const { error } = await supabase
        .from("signals")
        .update({
          priority_layer: priority,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Signal scheduled");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveToOnDeckMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("signals")
        .update({
          priority_layer: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Moved to On Radar");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const priorityLayer = form.bucket === "core" ? "Core" : form.bucket === "bonus" ? "Bonus" : (form.priority_layer || null);
      const { error } = await supabase.from("signals").insert({
        title: form.title,
        pillar: form.pillar || null,
        priority_layer: priorityLayer,
        signal_kind: null,
        signal_type: "Action",
        status: "Pending",
        is_archived: false,
        description: form.description.trim() || null,
        source:
          managerType === "PD"
            ? (isNla ? null : areaLabel)
            : `${managerType}:${isNla ? "NLA" : areaLabel}`,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setShowAdd(false);
      setForm({ title: "", pillar: "", priority_layer: "", description: "", bucket: "core" });
      toast.success("Signal added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: string }) => {
      const newStatus = current === "Pending" ? "Complete" : "Pending";
      const { error } = await supabase
        .from("signals")
        .update({
          status: newStatus,
          completed_at: newStatus === "Complete" ? new Date().toISOString() : null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["signals"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("signals")
        .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
        .eq("status", "Complete" as any)
        .eq("is_archived", false as any)
        .eq("is_trashed", false as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setShowArchiveConfirm(false);
      setSelectedForArchive(new Set());
      toast.success("Completed signals archived");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archiveSelectedMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("signals")
        .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setSelectedForArchive(new Set());
      toast.success("Selected signals archived");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editSignalMutation = useMutation({
    mutationFn: async () => {
      if (!editingSignal) return;
      const todayStr = todayInET();
      const newStatus = editForm.status;
      const isOnDeck = editForm.bucket === "ondeck";
      const { error } = await supabase
        .from("signals")
        .update({
          title: editForm.title,
          pillar: editForm.pillar || null,
          priority_layer: isOnDeck ? null : (editForm.bucket === "core" ? "Core" : "Bonus"),
          status: newStatus,
          completed_at: newStatus === "Complete" ? (editingSignal.completed_at || new Date().toISOString()) : null,
          description: editForm.description || null,
        } as any)
        .eq("id", editingSignal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setEditingSignal(null);
      toast.success("Signal updated");
    },
    onError: () => toast.error("Action failed. Try again."),
  });

  const trashSignalMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("signals")
        .update({
          is_trashed: true,
          trashed_at: new Date().toISOString(),
          trashed_by: user?.id || null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setEditingSignal(null);
      toast.success("Moved to Trash");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Cross-column DnD ───
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Batch reorder mutation for any bucket
  const reorderMutation = useMutation({
    mutationFn: async ({ items, field }: { items: Signal[]; field: "today_sort_order" | "deck_sort_order" }) => {
      const updates = items.map((s, i) =>
        supabase.from("signals").update({ [field]: (i + 1) * 10 } as any).eq("id", s.id)
      );
      const results = await Promise.all(updates);
      const failed = results.find(r => r.error);
      if (failed?.error) throw failed.error;
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.error("Couldn't save order. Try again.");
    },
  });

  // Cross-column move mutation
  const crossMoveMutation = useMutation({
    mutationFn: async ({
      signalId,
      targetBucket,
      newCoreList,
      newBonusList,
      newOnDeckList,
    }: {
      signalId: string;
      targetBucket: BucketId;
      newCoreList: Signal[];
      newBonusList: Signal[];
      newOnDeckList: Signal[];
    }) => {
      // Update the moved signal's bucket. With the date-less model, the
      // bucket is determined by priority_layer alone.
      const updateData: Record<string, any> = {};
      if (targetBucket === "ondeck") {
        updateData.priority_layer = null;
      } else {
        updateData.priority_layer = targetBucket === "core" ? "Core" : "Bonus";
      }
      const { error } = await supabase.from("signals").update(updateData as any).eq("id", signalId);
      if (error) throw error;

      // Reindex all affected lists
      const allUpdates: Array<PromiseLike<any>> = [];
      newCoreList.forEach((s, i) => {
        allUpdates.push(supabase.from("signals").update({ today_sort_order: (i + 1) * 10 } as any).eq("id", s.id));
      });
      newBonusList.forEach((s, i) => {
        allUpdates.push(supabase.from("signals").update({ today_sort_order: (i + 1) * 10 } as any).eq("id", s.id));
      });
      newOnDeckList.forEach((s, i) => {
        allUpdates.push(supabase.from("signals").update({ deck_sort_order: (i + 1) * 10 } as any).eq("id", s.id));
      });
      const results = await Promise.all(allUpdates);
      const failed = results.find((r: any) => r.error);
      if (failed?.error) throw (failed as any).error;
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.error("Couldn't save order. Try again.");
    },
  });

  const getBucketForSignal = useCallback((signalId: string): BucketId | null => {
    if (todayCoreSignals.find(s => s.id === signalId)) return "core";
    if (todayBonusSignals.find(s => s.id === signalId)) return "bonus";
    if (onDeckSignals.find(s => s.id === signalId)) return "ondeck";
    return null;
  }, [todayCoreSignals, todayBonusSignals, onDeckSignals]);

  const getListForBucket = useCallback((bucket: BucketId): Signal[] => {
    if (bucket === "core") return todayCoreSignals;
    if (bucket === "bonus") return todayBonusSignals;
    return onDeckSignals;
  }, [todayCoreSignals, todayBonusSignals, onDeckSignals]);

  const getQueryKeyForBucket = (bucket: BucketId) => {
    if (bucket === "core") return ["signals", focusArea, "today-core"];
    if (bucket === "bonus") return ["signals", focusArea, "today-bonus"];
    return ["signals", focusArea, "on-deck"];
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setDraggingId(id);
    setDraggingBucket(getBucketForSignal(id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingId(null);
    setDraggingBucket(null);
    if (!over) return;

    const activeId = active.id as string;
    const sourceBucket = getBucketForSignal(activeId);
    if (!sourceBucket) return;

    // Determine target bucket: if over a droppable container, use that; otherwise check if over another sortable item
    let targetBucket: BucketId;
    const overId = over.id as string;
    if (overId === "core" || overId === "bonus" || overId === "ondeck") {
      targetBucket = overId as BucketId;
    } else {
      // Over a sortable item - find which bucket it's in
      const overBucket = getBucketForSignal(overId);
      targetBucket = overBucket || sourceBucket;
    }


    if (sourceBucket === targetBucket) {
      // Same-column reorder
      const list = [...getListForBucket(sourceBucket)];
      const oldIndex = list.findIndex(s => s.id === activeId);
      const overIndex = list.findIndex(s => s.id === overId);
      if (oldIndex === -1 || overIndex === -1 || oldIndex === overIndex) return;
      const reordered = arrayMove(list, oldIndex, overIndex);
      queryClient.setQueryData(getQueryKeyForBucket(sourceBucket), reordered);
      const field = sourceBucket === "ondeck" ? "deck_sort_order" : "today_sort_order";
      reorderMutation.mutate({ items: reordered, field });
      toast.success("Order updated");
    } else {
      // Cross-column move
      const signal = getListForBucket(sourceBucket).find(s => s.id === activeId);
      if (!signal) return;

      const newSourceList = getListForBucket(sourceBucket).filter(s => s.id !== activeId);
      const targetList = [...getListForBucket(targetBucket)];

      // Insert at position if dropped on an item, otherwise append
      const overIndex = targetList.findIndex(s => s.id === overId);
      if (overIndex >= 0) {
        targetList.splice(overIndex, 0, signal);
      } else {
        targetList.push(signal);
      }

      // Optimistic updates
      queryClient.setQueryData(getQueryKeyForBucket(sourceBucket), newSourceList);
      queryClient.setQueryData(getQueryKeyForBucket(targetBucket), targetList);

      const newCoreList = targetBucket === "core" ? targetList : sourceBucket === "core" ? newSourceList : todayCoreSignals;
      const newBonusList = targetBucket === "bonus" ? targetList : sourceBucket === "bonus" ? newSourceList : todayBonusSignals;
      const newOnDeckList = targetBucket === "ondeck" ? targetList : sourceBucket === "ondeck" ? newSourceList : onDeckSignals;

      crossMoveMutation.mutate({
        signalId: activeId,
        targetBucket,
        newCoreList,
        newBonusList,
        newOnDeckList,
      });

      const label = targetBucket === "core" ? "Core" : targetBucket === "bonus" ? "On-Deck" : "On Radar";
      toast.success(`Moved to ${label}`);
    }
  };

  const openEditSignal = (signal: Signal, bucket: BucketId) => {
    setEditingSignal(signal);
    setEditForm({
      title: signal.title || "",
      pillar: signal.pillar || "",
      bucket,
      status: signal.status,
      description: signal.description || "",
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedForArchive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  // Core 3 progress only
  const totalCore3 = todayCoreSignals.length;
  const doneCore3 = todayCoreSignals.filter((s) => s.status === "Complete").length;
  const remainingCore3 = totalCore3 - doneCore3;
  const progressPct = totalCore3 > 0 ? Math.round((doneCore3 / totalCore3) * 100) : 0;
  const dayWon = totalCore3 > 0 && doneCore3 === totalCore3;

  // Progress ring SVG params
  const ringR = 38;
  const ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (progressPct / 100) * ringC;

  // Find the dragged signal for overlay
  const draggedSignal = draggingId
    ? (todayCoreSignals.find(s => s.id === draggingId)
      || todayBonusSignals.find(s => s.id === draggingId)
      || onDeckSignals.find(s => s.id === draggingId))
    : null;

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden max-w-full">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${ac.bgFrom}, black, rgba(245,158,11,0.04))` }} />
        <div className="relative mx-auto px-3 sm:px-4 py-5 flex items-center justify-between max-w-6xl w-full">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(backPath)} aria-label="Back" className="text-white/40 hover:text-white hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            {isNla && (
              <img
                src={nlaLogo}
                alt="NLA"
                className="h-10 w-auto opacity-[0.92] hover:opacity-100 hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.15)] transition-all duration-300 hidden sm:block"
              />
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-0.5">
                {todayDisplay} · <span style={{ color: ac.hex }}>{areaLabel}</span>
              </p>
              <h1 className="text-lg font-semibold text-white">{getGreeting()}, {ownerFirstName}</h1>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-white/30 hover:text-white/60 hover:bg-white/5 text-xs">
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto px-3 sm:px-4 py-6 max-w-6xl w-full">

        {/* ═══ Top section — focus area logo LEFT, daily verse RIGHT.
              Small NLA wordmark removed; the focus area's own branding is
              the identity element here. ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center mb-10 pt-2">
          <div className="flex items-center justify-center md:justify-end">
            {focusArea === "nla" && !dynamicImageUrl && (
              <img src={nlaMascot} alt="NLA Mascot" className="h-40 w-auto shrink-0" />
            )}
            {focusArea === "usa-boxing" && !dynamicImageUrl && (
              <img src={usaBoxingLogo} alt="USA Boxing" className="h-40 w-auto shrink-0" />
            )}
            {focusArea === "fcusa" && !dynamicImageUrl && (
              <img src={fcusaLogo} alt="Fighting Chance USA" className="h-40 w-auto shrink-0" />
            )}
            {focusArea === "quikhit" && !dynamicImageUrl && (
              <img src={quikhitLogo} alt="QUIKHIT" className="h-40 w-auto shrink-0" />
            )}
            {focusArea === "personal" && !dynamicImageUrl && managerType === "PD" && (
              <img src={personalFamily} alt="Family" className="h-40 w-auto rounded-lg shrink-0" />
            )}
            {dynamicImageUrl && (
              <img src={dynamicImageUrl} alt={areaLabel} className="h-40 w-auto rounded-lg shrink-0" />
            )}
          </div>
          <div className="flex items-center justify-center md:justify-start">
            <DailyVerse />
          </div>
        </div>

        {/* ═══ Action Bar (Core % progress) — acts as the divider between
              the top section and the kanban below. ═══ */}
        {dayWon && (
          <div className="text-center py-6 mb-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 border border-amber-400/20">
            <p className="text-3xl font-bold text-amber-400 tracking-wide" style={{ textShadow: "0 0 30px rgba(251,191,36,0.3)" }}>
              🏆 Day Won.
            </p>
            <p className="text-xs text-amber-400/50 mt-1">All signals complete</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-10 py-4 px-3 sm:px-5 rounded-xl bg-white/[0.02] border border-white/[0.06] max-w-full">
          {/* Progress Ring */}
          <div className="relative shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle cx="48" cy="48" r={ringR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
              <circle
                cx="48" cy="48" r={ringR}
                fill="none"
                stroke={dayWon ? "#fbbf24" : progressPct > 0 ? ac.ring : "rgba(255,255,255,0.1)"}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={ringC}
                strokeDashoffset={ringOffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-white">{progressPct}%</span>
              <span className="text-[8px] uppercase tracking-wider text-white/25 mt-0.5">Core</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">{remainingCore3}</span>
                <span className="text-xs text-amber-400/60">remaining</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                <span className="text-sm font-semibold text-green-400">{doneCore3}</span>
                <span className="text-xs text-green-400/60">done</span>
              </div>
            </div>
          </div>

          {/* Add Signal */}
          <Button
            onClick={() => setShowAdd(true)}
            className="shrink-0 bg-white text-black hover:bg-white/90 font-semibold shadow-lg shadow-white/5 px-5 py-2.5 text-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Signal
          </Button>
        </div>

        {/* ─── Unified DnD Context for Core 3 / On-Deck / On Radar ─── */}
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { setDraggingId(null); setDraggingBucket(null); }}
        >
          {/* 3-column kanban — Core | On-Deck | On Radar. All three live in
              the same parent DndContext so cross-column drags keep working. */}
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Core — today's must-dos */}
              <DroppableColumn id="core">
                <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: `${ac.hex}4D`, background: `linear-gradient(to bottom, ${ac.bgFrom}, transparent)` }}>
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <Target className="w-4 h-4" style={{ color: ac.hex }} />
                    <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: ac.hex }}>Core</h3>
                  </div>
                  <SortableContext items={[...todayCoreSignals].sort((a, b) => (b.status === "Complete" ? 1 : 0) - (a.status === "Complete" ? 1 : 0)).map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="px-3 pb-3 space-y-1 min-h-[80px]">
                      {todayCoreSignals.length === 0 ? (
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <Circle className="w-4 h-4 text-white/10 shrink-0" />
                          <span className="text-white/15 text-sm italic">Empty slot</span>
                        </div>
                      ) : (
                        [...todayCoreSignals].sort((a, b) => (b.status === "Complete" ? 1 : 0) - (a.status === "Complete" ? 1 : 0)).map((signal) => (
                          <SortableSignalRow
                            key={signal.id}
                            signal={signal}
                            bucket="core"
                            onEdit={() => openEditSignal(signal, "core")}
                            onToggleStatus={() => toggleStatus.mutate({ id: signal.id, current: signal.status })}
                            accentColor={ac.hex}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </div>
              </DroppableColumn>

              {/* On-Deck — today's nice-to-haves (priority_layer="Bonus") */}
              <DroppableColumn id="bonus">
                <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent overflow-hidden">
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-white/30" />
                    <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider">On-Deck</h3>
                  </div>
                  <SortableContext items={[...todayBonusSignals].sort((a, b) => (b.status === "Complete" ? 1 : 0) - (a.status === "Complete" ? 1 : 0)).map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="px-3 pb-3 space-y-1 min-h-[80px]">
                      {todayBonusSignals.length === 0 ? (
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <Circle className="w-4 h-4 text-white/10 shrink-0" />
                          <span className="text-white/15 text-sm italic">Empty slot</span>
                        </div>
                      ) : (
                        [...todayBonusSignals].sort((a, b) => (b.status === "Complete" ? 1 : 0) - (a.status === "Complete" ? 1 : 0)).map((signal) => (
                          <SortableSignalRow
                            key={signal.id}
                            signal={signal}
                            bucket="bonus"
                            onEdit={() => openEditSignal(signal, "bonus")}
                            onToggleStatus={() => toggleStatus.mutate({ id: signal.id, current: signal.status })}
                            accentColor={ac.hex}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </div>
              </DroppableColumn>

              {/* On Radar — backlog/idea queue. Droppable id is "ondeck"
                  for historic reasons (priority_layer=null is the bucket
                  key). The visible label is "On Radar". */}
              <DroppableColumn id="ondeck">
                <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent overflow-hidden">
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <Radar className="w-4 h-4 text-white/30" />
                    <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider">On Radar</h3>
                    {onDeckSignals.length > 0 && <span className="text-xs text-white/15">({onDeckSignals.length})</span>}
                  </div>
                  <SortableContext items={onDeckSignals.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="px-3 pb-3 space-y-1 min-h-[80px]">
                      {onDeckSignals.length === 0 ? (
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <Circle className="w-4 h-4 text-white/10 shrink-0" />
                          <span className="text-white/15 text-sm italic">Empty slot</span>
                        </div>
                      ) : (
                        onDeckSignals.map((signal) => (
                          <SortableSignalRow
                            key={signal.id}
                            signal={signal}
                            bucket="ondeck"
                            onEdit={() => openEditSignal(signal, "ondeck")}
                            onToggleStatus={() => toggleStatus.mutate({ id: signal.id, current: signal.status })}
                            accentColor={ac.hex}
                            extraActions={
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] px-2 shrink-0"
                                  style={{ color: `${ac.hexMuted}99` }}
                                  onClick={(e) => { e.stopPropagation(); scheduleMutation.mutate({ id: signal.id, priority: "Core" }); }}
                                  disabled={scheduleMutation.isPending}
                                >
                                  Core <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] text-white/30 hover:text-white/60 hover:bg-white/5 px-2 shrink-0"
                                  onClick={(e) => { e.stopPropagation(); scheduleMutation.mutate({ id: signal.id, priority: "Bonus" }); }}
                                  disabled={scheduleMutation.isPending}
                                >
                                  On-Deck <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                                <button
                                  className="shrink-0 p-1 rounded hover:bg-red-500/10 text-white/15 hover:text-red-400 transition-colors"
                                  aria-label="Move to Trash"
                                  onClick={(e) => { e.stopPropagation(); setTrashConfirmId(signal.id); }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            }
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </div>
              </DroppableColumn>
            </div>
          </div>

          {/* Archive toolbar */}
          <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
            {selectedForArchive.size > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => archiveSelectedMutation.mutate(Array.from(selectedForArchive))}
                className="border-amber-400/30 text-amber-400 hover:text-amber-300 bg-transparent hover:bg-amber-400/10 text-xs h-8"
              >
                <Archive className="w-3.5 h-3.5 mr-1.5" />
                Archive selected ({selectedForArchive.size})
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchiveConfirm(true)}
              className="text-white/30 hover:text-white/60 text-xs h-8"
            >
              <Archive className="w-3.5 h-3.5 mr-1.5" />
              Archive completed
            </Button>
            <span className="w-px h-4 bg-white/10" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`${signalsBasePath}/${focusArea}/archive`)}
              className="text-white/25 hover:text-white/50 text-xs h-8"
            >
              View Archive →
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`${signalsBasePath}/${focusArea}/trash`)}
              className="text-white/25 hover:text-white/50 text-xs h-8"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Trash
            </Button>
          </div>

          {/* Notes — durable, detailed context for this focus area, kept
              separate from the signals kanban above. */}
          <FocusAreaNotes
            managerType={managerType}
            focusArea={focusArea}
            accentHex={ac.hex}
            currentUserId={user?.id || ""}
          />

          {/* Global Drag Overlay */}
          <DragOverlay>
            {draggedSignal ? (
              <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/95 border border-white/20 rounded-lg shadow-xl shadow-black/40">
                <GripVertical className="w-4 h-4 text-white/30 shrink-0" />
                <span className="text-sm text-white/60 flex-1">{draggedSignal.title || "(Untitled)"}</span>
                {draggedSignal.pillar && (
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${PILLAR_COLORS[draggedSignal.pillar] || "border-white/20 text-white/60"}`}>
                    {draggedSignal.pillar}
                  </Badge>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Archive Confirm */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent className="bg-zinc-900 border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive all completed signals?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              Pending items will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white/60 hover:bg-white/5 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
              className="bg-amber-400 text-black hover:bg-amber-500"
            >
              {archiveMutation.isPending ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Signal Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Add Signal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/60">Bucket *</Label>
              <Select value={form.bucket} onValueChange={(v: BucketId) => setForm({ ...form, bucket: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue placeholder="Select bucket" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 z-[200]">
                  <SelectItem value="core" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Core</SelectItem>
                  <SelectItem value="bonus" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">On-Deck</SelectItem>
                  <SelectItem value="ondeck" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">On Radar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/60">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-white/5 border-white/10 text-white mt-1"
                placeholder="What's the signal?"
              />
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
            <div>
              <Label className="text-white/60">Notes</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-white/5 border-white/10 text-white mt-1 resize-none"
                rows={3}
                placeholder="Optional notes…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)} className="text-white/40 hover:text-white/60">Cancel</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!form.title.trim() || addMutation.isPending}
              className="bg-white text-black hover:bg-white/90"
            >
              {addMutation.isPending ? "Adding..." : "Add Signal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Signal Dialog */}
      <Dialog open={!!editingSignal} onOpenChange={(open) => { if (!open) setEditingSignal(null); }}>
        <DialogContent className="bg-zinc-900 border-white/10 text-white" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1">
              Editing {editForm.bucket === "core" ? "Core" : editForm.bucket === "bonus" ? "On-Deck" : "On Radar"} Signal
            </p>
            <DialogTitle>Edit Signal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-white/60">Title *</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white/60">Pillar</Label>
              <Select value={editForm.pillar} onValueChange={(v) => setEditForm({ ...editForm, pillar: v })}>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60">Bucket</Label>
                <Select value={editForm.bucket} onValueChange={(v: BucketId) => setEditForm({ ...editForm, bucket: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 z-[200]">
                    <SelectItem value="core" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Core</SelectItem>
                    <SelectItem value="bonus" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">On-Deck</SelectItem>
                    <SelectItem value="ondeck" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">On Radar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/60">Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 z-[200]">
                    <SelectItem value="Pending" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Pending</SelectItem>
                    <SelectItem value="Complete" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-white/60">Notes</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="bg-white/5 border-white/10 text-white mt-1"
                placeholder="Optional notes..."
                rows={3}
              />
            </div>

            {/* Back-reference: this signal came from a message-board message.
                The deep-link opens that conversation and the thread auto-
                scrolls to the originating message via the #message-{id} hash. */}
            {editingSignal?.source_conversation_id && editingSignal?.source_message_id && (
              <a
                href={`/admin/message-board?conv=${editingSignal.source_conversation_id}#message-${editingSignal.source_message_id}`}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                ↗ View original message
              </a>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => editingSignal && trashSignalMutation.mutate(editingSignal.id)}
              disabled={trashSignalMutation.isPending}
              className="text-red-400/70 hover:text-red-400 hover:bg-red-500/10 mr-auto"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Move to Trash
            </Button>
            <Button variant="ghost" onClick={() => setEditingSignal(null)} className="text-white/40 hover:text-white/60">Cancel</Button>
            <Button
              onClick={() => editSignalMutation.mutate()}
              disabled={!editForm.title.trim() || editSignalMutation.isPending}
              className="bg-white text-black hover:bg-white/90"
            >
              {editSignalMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* On Radar Trash Confirm */}
      <AlertDialog open={!!trashConfirmId} onOpenChange={(open) => { if (!open) setTrashConfirmId(null); }}>
        <AlertDialogContent className="bg-zinc-900 border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Move this task to Trash?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              You can restore it later from Trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white/60 hover:bg-white/5 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (trashConfirmId) trashSignalMutation.mutate(trashConfirmId); setTrashConfirmId(null); }}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSignals;
