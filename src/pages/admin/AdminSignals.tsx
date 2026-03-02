import { useState, useCallback } from "react";
import {
  DndContext, rectIntersection, PointerSensor, useSensor, useSensors,
  DragEndEvent, DragStartEvent, DragOverlay, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import nlaLogo from "@/assets/nla-logo-white.png";
import DailyVerse from "@/components/admin/DailyVerse";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, Plus, CheckCircle2, Circle, LogOut, Archive, ArrowRight, Trash2, MoreVertical, Flame, Target, Zap, GripVertical } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import VisionCloud from "@/components/admin/VisionCloud";

const PILLARS = ["Operations", "Sales & Marketing", "Finance", "Vision", "Personal"] as const;

const formatCreatedDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const SIGNAL_KINDS = ["Outcome", "Action"] as const;

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
};

type BucketId = "core" | "bonus" | "ondeck";

const PILLAR_COLORS: Record<string, string> = {
  Operations: "bg-[#bf0f3e]/20 text-[#bf0f3e] border-[#bf0f3e]/40",
  "Sales & Marketing": "bg-green-500/20 text-green-400 border-green-500/40",
  Finance: "bg-sky-300/20 text-sky-300 border-sky-300/40",
  Vision: "bg-amber-400/20 text-amber-400 border-amber-400/40",
  Personal: "bg-purple-400/20 text-purple-400 border-purple-400/40",
};

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
}: {
  signal: Signal;
  bucket: BucketId;
  onEdit: () => void;
  onToggleStatus: () => void;
  extraActions?: React.ReactNode;
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
          <Circle className={`w-4 h-4 ${bucket === "core" ? "text-rose-500/50 hover:text-rose-400" : "text-white/25 hover:text-white/50"} transition-colors`} />
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

const AdminSignals = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedForArchive, setSelectedForArchive] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    title: "",
    pillar: "" as string,
    priority_layer: "" as string,
    signal_kind: "" as string,
    bucket: "core" as BucketId,
  });

  const [editingSignal, setEditingSignal] = useState<Signal | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    pillar: "",
    signal_kind: "",
    bucket: "core" as BucketId,
    status: "Pending" as string,
    description: "",
  });

  const [trashConfirmId, setTrashConfirmId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [, setDraggingBucket] = useState<BucketId | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const todayDisplay = format(new Date(), "EEEE, MMMM d");

  const { data: todayCoreSignals = [] } = useQuery({
    queryKey: ["signals", "today-core"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("date_assigned", today)
        .eq("priority_layer", "Core" as any)
        .eq("is_archived", false as any)
        .eq("is_trashed", false as any)
        .order("today_sort_order" as any, { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Signal[];
    },
  });

  const { data: todayBonusSignals = [] } = useQuery({
    queryKey: ["signals", "today-bonus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("date_assigned", today)
        .eq("priority_layer", "Bonus" as any)
        .eq("is_archived", false as any)
        .eq("is_trashed", false as any)
        .order("today_sort_order" as any, { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Signal[];
    },
  });

  const { data: carryoverSignals = [] } = useQuery({
    queryKey: ["signals", "carryover"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .not("date_assigned", "is", null)
        .lt("date_assigned", today)
        .eq("status", "Pending" as any)
        .eq("is_archived", false as any)
        .eq("is_trashed", false as any)
        .order("date_assigned", { ascending: true });
      if (error) throw error;
      return data as Signal[];
    },
  });

  const { data: onDeckSignals = [] } = useQuery({
    queryKey: ["signals", "on-deck"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .is("date_assigned", null)
        .eq("status", "Pending" as any)
        .eq("is_archived", false as any)
        .eq("is_trashed", false as any)
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
          date_assigned: format(new Date(), "yyyy-MM-dd"),
          priority_layer: priority,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Signal scheduled for today");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveToOnDeckMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("signals")
        .update({
          date_assigned: null,
          priority_layer: null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Moved to On Deck");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const dateAssigned = form.bucket === "ondeck" ? null : todayStr;
      const priorityLayer = form.bucket === "core" ? "Core" : form.bucket === "bonus" ? "Bonus" : (form.priority_layer || null);
      const { error } = await supabase.from("signals").insert({
        title: form.title,
        pillar: form.pillar || null,
        priority_layer: priorityLayer,
        signal_kind: form.signal_kind || null,
        signal_type: form.signal_kind || "Action",
        status: "Pending",
        is_archived: false,
        date_assigned: dateAssigned,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setShowAdd(false);
      setForm({ title: "", pillar: "", priority_layer: "", signal_kind: "", bucket: "core" });
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
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const newStatus = editForm.status;
      const isOnDeck = editForm.bucket === "ondeck";
      const { error } = await supabase
        .from("signals")
        .update({
          title: editForm.title,
          pillar: editForm.pillar || null,
          signal_kind: editForm.signal_kind || null,
          signal_type: editForm.signal_kind || editingSignal.signal_type,
          priority_layer: isOnDeck ? null : (editForm.bucket === "core" ? "Core" : "Bonus"),
          status: newStatus,
          completed_at: newStatus === "Complete" ? (editingSignal.completed_at || new Date().toISOString()) : null,
          description: editForm.description || null,
          date_assigned: isOnDeck ? null : todayStr,
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
      const todayStr = format(new Date(), "yyyy-MM-dd");
      // Update the moved signal's bucket
      const updateData: Record<string, any> = {};
      if (targetBucket === "ondeck") {
        updateData.date_assigned = null;
        updateData.priority_layer = null;
      } else {
        updateData.date_assigned = todayStr;
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
    if (bucket === "core") return ["signals", "today-core"];
    if (bucket === "bonus") return ["signals", "today-bonus"];
    return ["signals", "on-deck"];
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

    // Guardrail: Core 3 max limit
    if (targetBucket === "core" && sourceBucket !== "core") {
      if (todayCoreSignals.length >= 3) {
        toast.error("Core 3 limit reached (3 max)");
        return;
      }
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

      const label = targetBucket === "core" ? "Core 3" : targetBucket === "bonus" ? "Bonus" : "On Deck";
      toast.success(`Moved to ${label}`);
    }
  };

  const openEditSignal = (signal: Signal, bucket: BucketId) => {
    setEditingSignal(signal);
    setEditForm({
      title: signal.title || "",
      pillar: signal.pillar || "",
      signal_kind: signal.signal_kind || "",
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
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-white/[0.06]">
        <div className="absolute inset-0 bg-gradient-to-r from-rose-950/20 via-black to-amber-950/10" />
        <div className="relative container mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")} aria-label="Back" className="text-white/40 hover:text-white hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img
              src={nlaLogo}
              alt="NLA"
              className="h-10 w-auto opacity-[0.92] hover:opacity-100 hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.15)] transition-all duration-300 hidden sm:block"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/30 mb-0.5">{todayDisplay}</p>
              <h1 className="text-lg font-semibold text-white">{getGreeting()}, Josh</h1>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-white/30 hover:text-white/60 hover:bg-white/5 text-xs">
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Log out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">

        {/* Day Won Banner */}
        {dayWon && (
          <div className="text-center py-6 mb-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 border border-amber-400/20">
            <p className="text-3xl font-bold text-amber-400 tracking-wide" style={{ textShadow: "0 0 30px rgba(251,191,36,0.3)" }}>
              🏆 Day Won.
            </p>
            <p className="text-xs text-amber-400/50 mt-1">All signals complete</p>
          </div>
        )}

        {/* Progress Ring + Stats Row */}
        <div className="flex items-center gap-6 mb-8">
          <div className="relative shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
              <circle cx="48" cy="48" r={ringR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
              <circle
                cx="48" cy="48" r={ringR}
                fill="none"
                stroke={dayWon ? "#fbbf24" : progressPct > 0 ? "#4ade80" : "rgba(255,255,255,0.1)"}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={ringC}
                strokeDashoffset={ringOffset}
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold text-white">{progressPct}%</span>
              <span className="text-[8px] uppercase tracking-wider text-white/25 mt-0.5">Core 3</span>
            </div>
          </div>
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
            {carryoverSignals.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 w-fit">
                <Flame className="w-3.5 h-3.5 text-red-400" />
                <span className="text-sm font-semibold text-red-400">{carryoverSignals.length}</span>
                <span className="text-xs text-red-400/60">carryover</span>
              </div>
            )}
          </div>
          <Button
            onClick={() => setShowAdd(true)}
            className="shrink-0 bg-white text-black hover:bg-white/90 font-semibold shadow-lg shadow-white/5"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Signal
          </Button>
        </div>

        {/* Carryover */}
        {carryoverSignals.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400">Carryover</h2>
              <span className="text-xs text-red-400/40">({carryoverSignals.length})</span>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-gradient-to-b from-red-950/20 to-transparent overflow-hidden">
              <div className="divide-y divide-white/[0.04]">
                {carryoverSignals.map((signal) => (
                  <div key={signal.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <button
                      onClick={() => toggleStatus.mutate({ id: signal.id, current: signal.status })}
                      className="shrink-0"
                      aria-label="Toggle status"
                    >
                      {signal.status === "Complete" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-red-400/40 hover:text-red-400 transition-colors" />
                      )}
                    </button>
                    <span className={`text-sm flex-1 ${signal.status === "Complete" ? "line-through text-white/30" : "text-white/80"}`}>
                      {signal.title || "(Untitled)"}
                    </span>
                    <span className="text-[10px] text-white/15 shrink-0 tabular-nums">{signal.date_assigned}</span>
                    {signal.pillar && (
                      <Badge variant="outline" className={`text-[10px] ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>
                        {signal.pillar}
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="shrink-0 p-1 rounded hover:bg-white/10 text-white/20 hover:text-white/50 transition-colors" aria-label="Move signal">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-zinc-900 border-white/10 text-white">
                        <DropdownMenuItem onClick={() => scheduleMutation.mutate({ id: signal.id, priority: "Core" })} className="text-rose-400 focus:text-rose-400 focus:bg-white/5">
                          Move to Core 3
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => scheduleMutation.mutate({ id: signal.id, priority: "Bonus" })} className="text-white/60 focus:text-white focus:bg-white/5">
                          Move to Bonus
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => moveToOnDeckMutation.mutate(signal.id)} className="text-white/40 focus:text-white/60 focus:bg-white/5">
                          Move to On Deck
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Unified DnD Context for Core 3 / Bonus / On Deck ─── */}
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { setDraggingId(null); setDraggingBucket(null); }}
        >
          {/* Today's Signals */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 mb-4">Today's Signals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Core 3 */}
              <DroppableColumn id="core">
                <div className="rounded-xl border-2 border-rose-500/30 bg-gradient-to-b from-rose-950/30 to-black/0 overflow-hidden">
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-rose-500" />
                    <h3 className="text-sm font-bold text-rose-500 uppercase tracking-wider">Core 3</h3>
                  </div>
                  <SortableContext items={todayCoreSignals.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="px-3 pb-3 space-y-1 min-h-[80px]">
                      {todayCoreSignals.length === 0 ? (
                        <>
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                              <Circle className="w-4 h-4 text-white/10 shrink-0" />
                              <span className="text-white/15 text-sm italic">Empty slot</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        todayCoreSignals.map((signal) => (
                          <SortableSignalRow
                            key={signal.id}
                            signal={signal}
                            bucket="core"
                            onEdit={() => openEditSignal(signal, "core")}
                            onToggleStatus={() => toggleStatus.mutate({ id: signal.id, current: signal.status })}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </div>
              </DroppableColumn>

              {/* Bonus */}
              <DroppableColumn id="bonus">
                <div className="rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent overflow-hidden">
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-white/30" />
                    <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider">Bonus</h3>
                  </div>
                  <SortableContext items={todayBonusSignals.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="px-3 pb-3 space-y-1 min-h-[80px]">
                      {todayBonusSignals.length === 0 ? (
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <Circle className="w-4 h-4 text-white/10 shrink-0" />
                          <span className="text-white/15 text-sm italic">Empty slot</span>
                        </div>
                      ) : (
                        todayBonusSignals.map((signal) => (
                          <SortableSignalRow
                            key={signal.id}
                            signal={signal}
                            bucket="bonus"
                            onEdit={() => openEditSignal(signal, "bonus")}
                            onToggleStatus={() => toggleStatus.mutate({ id: signal.id, current: signal.status })}
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
              onClick={() => navigate("/admin/signals/archive")}
              className="text-white/25 hover:text-white/50 text-xs h-8"
            >
              View Archive →
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/signals/trash")}
              className="text-white/25 hover:text-white/50 text-xs h-8"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Trash
            </Button>
          </div>

          {/* Vision Cloud */}
          <div className="mb-8">
            <VisionCloud />
          </div>

          {/* Divider — Verse + Logo */}
          <div className="flex flex-col items-center justify-center my-10 gap-5">
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <DailyVerse />
            <a href="/admin/dashboard" className="cursor-pointer opacity-60 hover:opacity-90 transition-opacity">
              <img src={nlaLogo} alt="NLA" className="h-20" />
            </a>
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          {/* On Deck */}
          {onDeckSignals.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/25">On Deck</h2>
                <span className="text-xs text-white/15">({onDeckSignals.length})</span>
              </div>
              <DroppableColumn id="ondeck">
                <SortableContext items={onDeckSignals.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <div className="divide-y divide-white/[0.04]">
                      {onDeckSignals.map((signal) => (
                        <SortableSignalRow
                          key={signal.id}
                          signal={signal}
                          bucket="ondeck"
                          onEdit={() => openEditSignal(signal, "ondeck")}
                          onToggleStatus={() => toggleStatus.mutate({ id: signal.id, current: signal.status })}
                          extraActions={
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10 px-2 shrink-0"
                                onClick={(e) => { e.stopPropagation(); scheduleMutation.mutate({ id: signal.id, priority: "Core" }); }}
                                disabled={scheduleMutation.isPending}
                              >
                                Core 3 <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] text-white/30 hover:text-white/60 hover:bg-white/5 px-2 shrink-0"
                                onClick={(e) => { e.stopPropagation(); scheduleMutation.mutate({ id: signal.id, priority: "Bonus" }); }}
                                disabled={scheduleMutation.isPending}
                              >
                                Bonus <ArrowRight className="w-3 h-3 ml-1" />
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
                      ))}
                    </div>
                  </div>
                </SortableContext>
              </DroppableColumn>
            </div>
          )}

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
                  <SelectItem value="ondeck" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">On Deck</SelectItem>
                  <SelectItem value="core" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Core 3 (Today)</SelectItem>
                  <SelectItem value="bonus" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Bonus (Today)</SelectItem>
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
              <Label className="text-white/60">Signal Kind</Label>
              <Select value={form.signal_kind} onValueChange={(v) => setForm({ ...form, signal_kind: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue placeholder="Outcome or Action" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 z-[200]">
                  {SIGNAL_KINDS.map((k) => (
                    <SelectItem key={k} value={k} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              Editing {editForm.bucket === "core" ? "Core" : editForm.bucket === "bonus" ? "Bonus" : "On Deck"} Signal
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
            <div className="grid grid-cols-2 gap-3">
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
              <div>
                <Label className="text-white/60">Type</Label>
                <Select value={editForm.signal_kind} onValueChange={(v) => setEditForm({ ...editForm, signal_kind: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue placeholder="Outcome / Action" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 z-[200]">
                    {SIGNAL_KINDS.map((k) => (
                      <SelectItem key={k} value={k} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60">Bucket</Label>
                <Select value={editForm.bucket} onValueChange={(v: BucketId) => setEditForm({ ...editForm, bucket: v })}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10 z-[200]">
                    <SelectItem value="ondeck" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">On Deck</SelectItem>
                    <SelectItem value="core" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Core</SelectItem>
                    <SelectItem value="bonus" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Bonus</SelectItem>
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

      {/* On Deck Trash Confirm */}
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
