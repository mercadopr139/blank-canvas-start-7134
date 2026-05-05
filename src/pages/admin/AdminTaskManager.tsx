import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, LogOut, Plus, Pencil, GripVertical, Lock,
  Circle, CheckCircle2, ArrowRight, Trophy,
} from "lucide-react";
import { icons } from "lucide-react";
import { toast } from "sonner";
import { todayInET } from "@/lib/easternTime";
import confetti from "canvas-confetti";
import nlaLogo from "@/assets/nla-logo-white.png";
import FocusAreaModal from "@/components/admin/FocusAreaModal";
import DailyVerse from "@/components/admin/DailyVerse";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const getSignalsPath = (managerType: string, key: string) => {
  if (managerType === "PD") return `/admin/signals/${key}`;
  if (managerType === "PC") return `/admin/pc-signals/${key}`;
  return `/admin/task-manager/${managerType}/signals/${key}`;
};

// Source resolution. PD uses the legacy convention (null for NLA, raw
// area title for everything else) for backward compatibility. Every other
// manager (PC, HC, JS, etc.) uses the prefixed form "<KEY>:<area>".
const signalSourceFor = (
  managerType: string,
  area: { key: string; title: string }
): string | null => {
  const isNla = area.key === "nla";
  if (managerType === "PD") return isNla ? null : area.title;
  return `${managerType}:${isNla ? "NLA" : area.title}`;
};

// Inverse: maps a signal's stored `source` back to a focus-area key so
// the home page can group signals by tile. Manager types other than PD
// recognize their own prefix; PD recognizes null/raw values.
const sourceToFocusAreaKey = (
  source: string | null,
  managerType: string,
  focusAreas: FocusArea[]
): string | null => {
  if (managerType === "PD") {
    if (source === null || source === "NLA") return "nla";
    if (source.includes(":")) return null; // belongs to another manager
    return focusAreas.find((a) => a.title === source)?.key ?? null;
  }
  const prefix = `${managerType}:`;
  if (!source?.startsWith(prefix)) return null;
  const stripped = source.slice(prefix.length);
  if (stripped === "NLA") return "nla";
  return focusAreas.find((a) => a.title === stripped)?.key ?? null;
};

type FocusArea = {
  id: string;
  key: string;
  title: string;
  subtitle: string | null;
  icon_name: string;
  accent_color: string;
  sort_order: number;
  is_default: boolean;
  image_url: string | null;
  manager_type: string;
};

type CoreSignal = {
  id: string;
  title: string | null;
  status: string;
  source: string | null;
  today_sort_order: number | null;
  description: string | null;
  pillar: string | null;
};

const getGradient = (hex: string) =>
  `linear-gradient(145deg, ${hex}1f 0%, ${hex}08 100%)`;

const getIconComponent = (name: string) => {
  const pascal = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return (icons as any)[pascal] || null;
};

/* ───────── Sortable signal row inside a tile ───────── */
const TileSignalRow = ({
  signal,
  accentColor,
  onToggle,
  onOpenDetails,
}: {
  signal: CoreSignal;
  accentColor: string;
  onToggle: () => void;
  onOpenDetails: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: signal.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const isComplete = signal.status === "Complete";
  const hasNotes = !!signal.description?.trim();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 px-1 py-1 rounded-md hover:bg-white/[0.04] group/row"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing pt-1 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0"
        title="Drag to reorder"
      >
        <GripVertical className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={onToggle}
        className="pt-0.5 shrink-0"
        title={isComplete ? "Mark incomplete" : "Mark complete"}
      >
        {isComplete ? (
          <CheckCircle2 className="w-4 h-4" style={{ color: accentColor }} />
        ) : (
          <Circle className="w-4 h-4 text-white/30 hover:text-white/60 transition-colors" />
        )}
      </button>
      {/* Title is its own button so clicking it opens the details modal —
          separate from the toggle circle so the two actions don't conflict. */}
      <button
        type="button"
        onClick={onOpenDetails}
        className={`text-sm leading-snug flex-1 min-w-0 break-words text-left hover:text-white transition-colors ${
          isComplete ? "line-through text-white/30" : "text-white/85"
        }`}
        title="View signal details"
      >
        {signal.title || "Untitled"}
        {hasNotes && (
          <span className="ml-1 text-[10px] text-white/30 align-middle" aria-label="has notes">
            ·
          </span>
        )}
      </button>
    </div>
  );
};

/* ───────── Signal details modal — opened by clicking a tile's signal title.
    Read-only view of pillar + notes, with a hint to drill into the kanban
    for full edit. ───────── */
const SignalDetailsModal = ({
  signal,
  accentColor,
  open,
  onClose,
}: {
  signal: CoreSignal | null;
  accentColor: string;
  open: boolean;
  onClose: () => void;
}) => {
  if (!signal) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md">
        <DialogHeader>
          <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1">
            Today's Core
          </p>
          <DialogTitle className="text-white text-base leading-snug">
            {signal.title || "Untitled"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-2 text-xs text-white/50">
            {signal.pillar && (
              <span
                className="px-2 py-0.5 rounded-full border text-[10px] font-semibold"
                style={{ borderColor: `${accentColor}55`, color: accentColor }}
              >
                {signal.pillar}
              </span>
            )}
            <span
              className={`text-[10px] font-medium ${
                signal.status === "Complete" ? "text-green-400" : "text-white/40"
              }`}
            >
              {signal.status}
            </span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-1.5">
              Notes
            </p>
            {signal.description?.trim() ? (
              <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                {signal.description}
              </p>
            ) : (
              <p className="text-sm text-white/30 italic">No notes for this signal.</p>
            )}
          </div>
          <p className="text-[10px] text-white/30 pt-2 border-t border-white/5">
            To edit this signal, click <span className="text-white/50">Open →</span> on the focus area tile.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ───────── Vertical-rectangle focus-area tile ───────── */
const FocusAreaTile = ({
  area,
  managerType,
  signals,
  onEdit,
  onAdd,
  onToggle,
  onReorder,
  onOpenSignalDetails,
}: {
  area: FocusArea;
  managerType: string;
  signals: CoreSignal[];
  onEdit: () => void;
  onAdd: (title: string) => Promise<void>;
  onToggle: (signal: CoreSignal) => void;
  onReorder: (newOrder: CoreSignal[]) => void;
  onOpenSignalDetails: (signal: CoreSignal) => void;
}) => {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: area.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const IconComp = getIconComponent(area.icon_name);

  const [adding, setAdding] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);

  // Each tile owns its own DnD context so reordering signals within one tile
  // doesn't bubble up to the page-level focus-area reorder.
  const tileSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftTitle.trim();
    if (!trimmed) return;
    setSavingAdd(true);
    try {
      await onAdd(trimmed);
      setDraftTitle("");
      setAdding(false);
    } finally {
      setSavingAdd(false);
    }
  };

  const handleSignalReorder = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = signals.findIndex((s) => s.id === active.id);
    const newIndex = signals.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(signals, oldIndex, newIndex));
  };

  const completedCount = signals.filter((s) => s.status === "Complete").length;
  const allDone = signals.length > 0 && completedCount === signals.length;

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="absolute top-3 left-3 z-20 p-1 rounded text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder focus area"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="absolute top-3 right-3 z-20 p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Edit focus area"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      <div
        className="relative rounded-2xl border-2 p-5 min-h-[300px] flex flex-col transition-transform duration-300 group-hover:-translate-y-0.5"
        style={{ borderColor: area.accent_color, background: getGradient(area.accent_color) }}
      >
        {/* Header: icon + title + add button */}
        <div className="flex items-start gap-3 mb-3 pl-6 pr-6">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${area.accent_color}18`, color: area.accent_color }}
          >
            {IconComp && <IconComp className="w-5 h-5" strokeWidth={1.8} />}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h2 className="text-base font-extrabold tracking-tight text-white truncate">
              {area.title}
            </h2>
            {area.subtitle && (
              <p className="text-[11px] text-zinc-500 font-medium truncate">{area.subtitle}</p>
            )}
          </div>
        </div>

        {/* Signal list */}
        <div className="flex-1 min-h-[60px]">
          {signals.length === 0 ? (
            <p className="text-[11px] text-white/25 italic text-center pt-6">
              No signals for today
            </p>
          ) : (
            <DndContext
              sensors={tileSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSignalReorder}
            >
              <SortableContext
                items={signals.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0.5">
                  {signals.map((s) => (
                    <TileSignalRow
                      key={s.id}
                      signal={s}
                      accentColor={area.accent_color}
                      onToggle={() => onToggle(s)}
                      onOpenDetails={() => onOpenSignalDetails(s)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Add Signal trigger — sits at the bottom of the tile per design. */}
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-2 inline-flex items-center justify-center gap-1.5 w-full text-[11px] font-semibold px-2 py-1.5 rounded-md border border-white/10 hover:border-white/25 hover:bg-white/[0.04] text-white/50 hover:text-white/80 transition-colors"
            title="Add today's signal"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Today's Signal
          </button>
        ) : (
          <form onSubmit={handleSubmitAdd} className="mt-2 space-y-1.5">
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraftTitle("");
                }
              }}
              placeholder="Today's signal…"
              className="w-full bg-white/5 border border-white/10 focus:border-white/30 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none"
              disabled={savingAdd}
            />
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                disabled={!draftTitle.trim() || savingAdd}
                className="text-[11px] font-semibold px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {savingAdd ? "Saving…" : "Add"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setDraftTitle("");
                }}
                className="text-[11px] text-white/40 hover:text-white/70 px-1.5 py-1"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Footer: tile progress + Open → */}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5">
          {signals.length > 0 ? (
            <span
              className={`text-[10px] font-semibold ${allDone ? "text-green-400" : "text-white/35"}`}
            >
              {completedCount}/{signals.length}
              {allDone && " ✓"}
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => navigate(getSignalsPath(managerType, area.key))}
            className="inline-flex items-center gap-1 text-xs font-semibold transition-all hover:translate-x-0.5"
            style={{ color: area.accent_color }}
          >
            <span>Open</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────── Page component ───────── */
const AdminTaskManager = () => {
  const { managerType = "PD" } = useParams<{ managerType: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<FocusArea | null>(null);
  // Read-only details modal opened by clicking a signal title in any tile.
  const [detailsSignal, setDetailsSignal] = useState<CoreSignal | null>(null);
  const [detailsAccent, setDetailsAccent] = useState<string>("#a1a1aa");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const todayStr = todayInET();

  // Load the task manager record so we know its owner (for lock logic and
  // future per-manager metadata). PD and PC are always present (seeded);
  // any new managers (HC, etc.) live in the same table.
  const { data: taskManager } = useQuery({
    queryKey: ["task-manager", managerType],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("task_managers")
        .select("key, owner_email, owner_name, accent_color, display_name") as any)
        .eq("key", managerType)
        .maybeSingle();
      if (error) throw error;
      return data as { key: string; owner_email: string | null; owner_name: string | null; accent_color: string | null; display_name: string } | null;
    },
  });

  const ownerEmail = taskManager?.owner_email?.toLowerCase() || null;
  const isOwner = !!ownerEmail && user?.email?.toLowerCase() === ownerEmail;

  const { data: focusAreas = [], isLoading } = useQuery({
    queryKey: ["focus-areas", managerType],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("focus_areas")
        .select("*") as any)
        .eq("manager_type", managerType)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as FocusArea[];
    },
  });

  // Single fetch for ALL Core signals across this manager type's focus
  // areas — pending and completed. The Core list is a rolling backlog,
  // not a daily reset: items stick until archived. The "Day Won" pill at
  // the top fires only when every item in the list is Complete.
  // Source-prefix filter is applied client-side because the PostgREST
  // "not.like" syntax with reserved chars in the value is fragile.
  const { data: todaysCoreSignals = [] } = useQuery({
    queryKey: ["task-manager-home-core", managerType],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("signals")
        .select("id, title, status, source, today_sort_order, description, pillar") as any)
        .eq("priority_layer", "Core")
        .eq("is_archived", false)
        .eq("is_trashed", false)
        .order("today_sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      // Manager-scope filter: PD owns null + raw-title sources (legacy);
      // every other manager owns "<KEY>:..." sources.
      return ((data || []) as CoreSignal[]).filter((s) => {
        if (managerType === "PD") return !s.source || !s.source.includes(":");
        return s.source?.startsWith(`${managerType}:`) ?? false;
      });
    },
    enabled: focusAreas.length > 0,
  });

  // Group signals by focus-area key (preserves the per-tile sort order).
  const signalsByArea = useMemo(() => {
    const map = new Map<string, CoreSignal[]>();
    for (const area of focusAreas) map.set(area.key, []);
    for (const s of todaysCoreSignals) {
      const key = sourceToFocusAreaKey(s.source, managerType, focusAreas);
      if (key && map.has(key)) map.get(key)!.push(s);
    }
    return map;
  }, [focusAreas, todaysCoreSignals, managerType]);

  // Unified daily progress across all focus areas (Personal counts).
  const totalCore = todaysCoreSignals.length;
  const completedCore = todaysCoreSignals.filter((s) => s.status === "Complete").length;
  const donePct = totalCore > 0 ? Math.round((completedCore / totalCore) * 100) : 0;
  const dayWon = totalCore > 0 && completedCore === totalCore;

  // Confetti fires once on the false → true transition into Day Won. If the
  // user undoes a completion and re-completes, it fires again, which is what
  // we want — every win deserves the celebration.
  const dayWonRef = useRef(false);
  useEffect(() => {
    if (dayWon && !dayWonRef.current) {
      dayWonRef.current = true;
      const colors = ["#22c55e", "#16a34a", "#86efac", "#bbf7d0", "#facc15"];
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.3 }, colors });
      setTimeout(
        () => confetti({ particleCount: 60, spread: 100, origin: { y: 0.4 }, colors }),
        250
      );
    } else if (!dayWon && dayWonRef.current) {
      dayWonRef.current = false;
    }
  }, [dayWon]);

  // Lock rule: NLA is shared across every task manager; everything else
  // is editable only by the owner of this task manager. (If the manager
  // record doesn't have an owner set yet, nothing is locked.)
  const isLocked = (area: FocusArea) => {
    if (area.key === "nla") return false;
    if (!ownerEmail) return false;
    return !isOwner;
  };

  // Same rule for adding focus areas — only the owner can add to their
  // own manager (or anyone if no owner is set).
  const canAdd = !ownerEmail || isOwner;

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["focus-areas", managerType] });
    setEditingArea(null);
  };

  // Mutations — payload shape matches AdminSignals.tsx so the home tile and
  // the kanban share an identical write path. The home tile only writes Core
  // signals; everything else is drill-in only.
  const addSignalMutation = useMutation({
    mutationFn: async ({ title, area }: { title: string; area: FocusArea }) => {
      const source = signalSourceFor(managerType, area);
      const { error } = await supabase.from("signals").insert({
        title,
        pillar: null,
        priority_layer: "Core",
        signal_kind: null,
        signal_type: "Action",
        status: "Pending",
        is_archived: false,
        date_assigned: todayStr,
        source,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-manager-home-core"] });
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Signal added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatusMutation = useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-manager-home-core"] });
      queryClient.invalidateQueries({ queryKey: ["signals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reorderSignalsMutation = useMutation({
    mutationFn: async (newOrder: CoreSignal[]) => {
      const updates = newOrder.map((s, i) =>
        supabase
          .from("signals")
          .update({ today_sort_order: (i + 1) * 10 } as any)
          .eq("id", s.id)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-manager-home-core"] });
      queryClient.invalidateQueries({ queryKey: ["signals"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["task-manager-home-core"] });
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.error("Couldn't save order");
    },
  });

  const handleFocusAreaDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = focusAreas.findIndex((a) => a.id === active.id);
    const newIndex = focusAreas.findIndex((a) => a.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...focusAreas];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    try {
      await Promise.all(
        reordered.map((area, idx) =>
          supabase.from("focus_areas").update({ sort_order: idx }).eq("id", area.id)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["focus-areas", managerType] });
    } catch {
      toast.error("Failed to reorder");
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin/dashboard")}
              aria-label="Back"
              className="text-zinc-400 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                {managerType} Task Manager
              </h1>
              <p className="text-xs text-zinc-500 font-medium">Today's daily workbench</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-9"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Log out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
        <div className="flex justify-center mb-6">
          <img
            src={nlaLogo}
            alt="No Limits Academy"
            className="h-24 sm:h-32 w-auto drop-shadow-[0_0_60px_rgba(191,15,62,0.15)]"
          />
        </div>

        {/* Unified daily progress pill — hidden when there's nothing to track. */}
        {totalCore > 0 && (
          <div className="flex justify-center mb-10">
            <div
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                dayWon
                  ? "bg-green-500/15 border-green-500/40 text-green-300"
                  : "bg-white/5 border-white/10 text-white/60"
              }`}
            >
              {dayWon ? (
                <>
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Day Won! · {completedCore}/{totalCore}</span>
                </>
              ) : (
                <span>
                  {completedCore}/{totalCore} · {donePct}%
                </span>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center text-zinc-500 py-20">Loading…</div>
        ) : focusAreas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400 mb-4">
              No focus areas yet. Create your first one to get started.
            </p>
            {canAdd && (
              <Button
                onClick={() => {
                  setEditingArea(null);
                  setModalOpen(true);
                }}
                className="bg-white text-black hover:bg-white/90 gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Focus Area
              </Button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleFocusAreaDragEnd}
          >
            <SortableContext items={focusAreas.map((a) => a.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
                {focusAreas.map((area) => {
                  if (isLocked(area)) {
                    const IconComp = getIconComponent(area.icon_name);
                    return (
                      <Tooltip key={area.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="relative rounded-2xl border-2 p-5 min-h-[300px] flex flex-col justify-between opacity-30 cursor-not-allowed"
                            style={{
                              borderColor: `${area.accent_color}40`,
                              background: getGradient(area.accent_color),
                            }}
                          >
                            <Lock className="absolute top-3 right-3 w-4 h-4 text-white/30" />
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center"
                              style={{
                                background: `${area.accent_color}18`,
                                color: area.accent_color,
                              }}
                            >
                              {IconComp && <IconComp className="w-5 h-5" strokeWidth={1.8} />}
                            </div>
                            <div>
                              <h2 className="text-base font-extrabold tracking-tight text-white mb-1">
                                {area.title}
                              </h2>
                              <p className="text-[11px] text-zinc-500 font-medium mb-3">
                                {area.subtitle || ""}
                              </p>
                              <span className="text-xs font-semibold text-white/20">
                                🔒 Locked
                              </span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs">
                          {managerType} access only
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return (
                    <FocusAreaTile
                      key={area.id}
                      area={area}
                      managerType={managerType}
                      signals={signalsByArea.get(area.key) || []}
                      onEdit={() => {
                        setEditingArea(area);
                        setModalOpen(true);
                      }}
                      onAdd={(title) => addSignalMutation.mutateAsync({ title, area })}
                      onToggle={(s) =>
                        toggleStatusMutation.mutate({ id: s.id, current: s.status })
                      }
                      onReorder={(newOrder) => reorderSignalsMutation.mutate(newOrder)}
                      onOpenSignalDetails={(s) => {
                        setDetailsSignal(s);
                        setDetailsAccent(area.accent_color);
                      }}
                    />
                  );
                })}

                {canAdd && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingArea(null);
                      setModalOpen(true);
                    }}
                    className="group/add rounded-2xl border border-dashed border-white/[0.07] hover:border-white/20 min-h-[300px] flex flex-col items-center justify-center gap-2 transition-all duration-300 hover:bg-white/[0.02] cursor-pointer"
                    title="Add a focus area"
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/[0.03] flex items-center justify-center group-hover/add:bg-white/10 transition-colors">
                      <Plus className="w-4 h-4 text-white/20 group-hover/add:text-white/50" />
                    </div>
                    <span className="text-[11px] font-semibold text-white/20 group-hover/add:text-white/50 transition-colors">
                      Add Focus Area
                    </span>
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {/* Daily verse — sits at the bottom of the workbench so the page Josh
            spends most of his day on is also where he sees scripture. */}
        {!isLoading && focusAreas.length > 0 && (
          <div className="mt-16 pt-8 border-t border-white/5">
            <DailyVerse />
          </div>
        )}
      </main>

      {modalOpen && (
        <FocusAreaModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingArea(null);
          }}
          onSaved={handleSaved}
          editingArea={editingArea}
          managerType={managerType}
        />
      )}

      <SignalDetailsModal
        signal={detailsSignal}
        accentColor={detailsAccent}
        open={!!detailsSignal}
        onClose={() => setDetailsSignal(null)}
      />
    </div>
  );
};

export default AdminTaskManager;
