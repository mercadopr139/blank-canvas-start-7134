import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Plus, Pencil, GripVertical, Lock } from "lucide-react";
import { icons } from "lucide-react";
import { toast } from "sonner";
import nlaLogo from "@/assets/nla-logo-white.png";
import FocusAreaModal from "@/components/admin/FocusAreaModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const JOSH_EMAIL = "joshmercado@nolimitsboxingacademy.org";
const CHRISSY_EMAIL = "chrissycasiello@nolimitsboxingacademy.org";

/* Where each manager type navigates when a focus area card is opened */
const SIGNALS_BASE: Record<string, string> = {
  PD: "/admin/signals",
  PC: "/admin/pc-signals",
};

/* Tab display labels */
const TAB_LABELS: Record<string, string> = {
  PD: "PD",
  PC: "PC",
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

const getGlow = (hex: string) => `${hex}59`;
const getGradient = (hex: string) =>
  `linear-gradient(145deg, ${hex}1f 0%, ${hex}08 100%)`;

const getIconComponent = (name: string) => {
  const pascal = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return (icons as any)[pascal] || null;
};

/* ── Sortable Card ── */
const SortableCard = ({
  area,
  onOpen,
  onEdit,
}: {
  area: FocusArea;
  onOpen: () => void;
  onEdit: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: area.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const IconComp = getIconComponent(area.icon_name);

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        {...attributes}
        {...listeners}
        className="absolute top-3 left-3 z-10 p-1 rounded text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Edit"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={onOpen}
        className="w-full text-left rounded-2xl transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 cursor-pointer"
      >
        <div
          className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
          style={{ background: getGlow(area.accent_color) }}
        />
        <div
          className="relative rounded-2xl border-2 p-7 min-h-[200px] flex flex-col justify-between transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl"
          style={{ borderColor: area.accent_color, background: getGradient(area.accent_color) }}
        >
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
            style={{ background: `${area.accent_color}18`, color: area.accent_color }}
          >
            {IconComp && <IconComp className="w-7 h-7" strokeWidth={1.8} />}
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-white mb-1">{area.title}</h2>
            <p className="text-xs text-zinc-500 font-medium mb-4">{area.subtitle || ""}</p>
            <div
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide group-hover:brightness-125"
              style={{ color: area.accent_color }}
            >
              <span>Open</span>
              <span className="text-lg leading-none transition-transform duration-200 group-hover:translate-x-1">→</span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};

/* ── Main Page ── */
const AdminTaskManager = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("PD");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<FocusArea | null>(null);

  const isJosh = user?.email?.toLowerCase() === JOSH_EMAIL;
  const isChrissy = user?.email?.toLowerCase() === CHRISSY_EMAIL;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: allAreas = [], isLoading } = useQuery({
    queryKey: ["focus-areas-all"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("focus_areas")
        .select("*") as any)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as FocusArea[];
    },
  });

  /* Derive tabs dynamically from what's in the DB */
  const tabs = Array.from(new Set(allAreas.map((a) => a.manager_type))).sort();
  /* Default to first available tab if activeTab is no longer present */
  const currentTab = tabs.includes(activeTab) ? activeTab : (tabs[0] ?? "PD");
  const focusAreas = allAreas.filter((a) => a.manager_type === currentTab);

  const isLocked = (area: FocusArea) => {
    if (currentTab === "PD") return isChrissy && area.key !== "nla";
    if (currentTab === "PC") return isJosh && area.key !== "nla";
    return false;
  };

  const canEdit = (area: FocusArea) => !isLocked(area);
  const canAdd = currentTab === "PD" ? !isChrissy : currentTab === "PC" ? !isJosh : true;

  const getNavPath = (area: FocusArea) => {
    const base = SIGNALS_BASE[currentTab] ?? "/admin/signals";
    const viewMode = (currentTab === "PC" && isJosh) || (currentTab === "PD" && isChrissy);
    return `${base}/${area.key}${viewMode ? "?mode=view" : ""}`;
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["focus-areas-all"] });
    setEditingArea(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
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
      queryClient.invalidateQueries({ queryKey: ["focus-areas-all"] });
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
              <h1 className="text-lg font-bold tracking-tight text-white">Task Manager</h1>
              <p className="text-xs text-zinc-500 font-medium">Select a Focus Area</p>
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
        <div className="flex justify-center mb-10">
          <img
            src={nlaLogo}
            alt="No Limits Academy"
            className="h-24 sm:h-32 w-auto drop-shadow-[0_0_60px_rgba(191,15,62,0.15)]"
          />
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div className="flex gap-2 mb-8 border-b border-white/[0.06] pb-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
                  currentTab === tab
                    ? "text-white border-[#bf0f3e]"
                    : "text-zinc-500 border-transparent hover:text-zinc-300"
                }`}
              >
                {TAB_LABELS[tab] ?? tab}
              </button>
            ))}
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
                onClick={() => { setEditingArea(null); setModalOpen(true); }}
                className="bg-white text-black hover:bg-white/90 gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Focus Area
              </Button>
            )}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={focusAreas.map((a) => a.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
                {focusAreas.map((area) => {
                  if (isLocked(area)) {
                    const IconComp = getIconComponent(area.icon_name);
                    return (
                      <Tooltip key={area.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="relative rounded-2xl border-2 p-7 min-h-[200px] flex flex-col justify-between opacity-30 cursor-not-allowed"
                            style={{ borderColor: `${area.accent_color}40`, background: getGradient(area.accent_color) }}
                          >
                            <Lock className="absolute top-3 right-3 w-4 h-4 text-white/30" />
                            <div
                              className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                              style={{ background: `${area.accent_color}18`, color: area.accent_color }}
                            >
                              {IconComp && <IconComp className="w-7 h-7" strokeWidth={1.8} />}
                            </div>
                            <div>
                              <h2 className="text-xl font-extrabold tracking-tight text-white mb-1">{area.title}</h2>
                              <p className="text-xs text-zinc-500 font-medium mb-4">{area.subtitle || ""}</p>
                              <span className="text-sm font-semibold text-white/20">🔒 Locked</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs">
                          {currentTab} access only
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return (
                    <SortableCard
                      key={area.id}
                      area={area}
                      onOpen={() => navigate(getNavPath(area))}
                      onEdit={() => canEdit(area) ? (setEditingArea(area), setModalOpen(true)) : undefined}
                    />
                  );
                })}

                {canAdd && (
                  <div>
                    <button
                      type="button"
                      onClick={() => { setEditingArea(null); setModalOpen(true); }}
                      className="group w-full rounded-2xl border-2 border-dashed border-white/10 hover:border-white/25 min-h-[200px] flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:bg-white/[0.02] cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                        <Plus className="w-7 h-7 text-white/30 group-hover:text-white/60" />
                      </div>
                      <span className="text-sm font-semibold text-white/30 group-hover:text-white/60 transition-colors">
                        Add Focus Area
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      {modalOpen && (
        <FocusAreaModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingArea(null); }}
          onSaved={handleSaved}
          editingArea={editingArea}
          managerType={currentTab}
        />
      )}
    </div>
  );
};

export default AdminTaskManager;
