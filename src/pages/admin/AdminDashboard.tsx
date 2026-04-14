import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import nlaLogoWhite from "@/assets/nla-logo-white.png";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions, PermissionKey } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Hammer, BadgeDollarSign, Lightbulb, ArrowLeft, Lock, Plus, Pencil, GripVertical } from "lucide-react";
import { icons } from "lucide-react";
import UpcomingEventsWidget from "@/components/admin/UpcomingEventsWidget";
import InviteAdminModal from "@/components/admin/InviteAdminModal";
import DashboardTileModal, { type DashboardTile } from "@/components/admin/DashboardTileModal";
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

/* ─── Helpers ─── */
const getIconComponent = (name: string) => {
  const pascal = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return (icons as any)[pascal] || null;
};

/* Map href → permission key */
const HREF_PERM_MAP: Record<string, PermissionKey> = {
  "/transport": "driver_checkin",
  "/admin/pd-task-manager": "pd_signals",
  "/admin/pc-task-manager": "pc_signals",
  "/admin/staff": "settings",
  "/admin/operations": "operations",
  "/admin/sales-marketing": "sales_marketing",
  "/admin/finance": "finance",
};

/* Default tiles to seed for new users */
const DEFAULT_TILES = [
  { title: "Upcoming Events", subtitle: "Calendar reminders", icon_name: "calendar-days", accent_color: "#f59e0b", href: "__upcoming_events__", sort_order: 0, is_default: true },
  { title: "Driver Check-In", subtitle: "Transportation PIN login", icon_name: "bus", accent_color: "#60a5fa", href: "/transport", sort_order: 1, is_default: true },
  { title: "PD Task Manager", subtitle: "Executive Focus & Daily Signals", icon_name: "signal", accent_color: "#a1a1aa", href: "/admin/pd-task-manager", sort_order: 2, is_default: true },
  { title: "PC Task Manager", subtitle: "Executive Focus & Daily Signals", icon_name: "signal", accent_color: "#a1a1aa", href: "/admin/pc-task-manager", sort_order: 3, is_default: true },
  { title: "Settings", subtitle: "Staff Management", icon_name: "settings", accent_color: "#a1a1aa", href: "/admin/staff", sort_order: 4, is_default: true },
];

/* ─── Pillar card config (unchanged) ─── */
const pillars = [
  {
    title: "Operations",
    subtitle: "Boxing & Youth Development",
    icon: Hammer,
    href: "/admin/operations",
    permKey: "operations" as const,
    accent: "#bf0f3e",
    glow: "rgba(191,15,62,0.35)",
    gradient: "linear-gradient(145deg, rgba(191,15,62,0.12) 0%, rgba(191,15,62,0.03) 100%)",
  },
  {
    title: "Sales & Marketing",
    subtitle: "Outreach & Retention",
    icon: BadgeDollarSign,
    href: "/admin/sales-marketing",
    permKey: "sales_marketing" as const,
    accent: "#22c55e",
    glow: "rgba(34,197,94,0.30)",
    gradient: "linear-gradient(145deg, rgba(34,197,94,0.10) 0%, rgba(34,197,94,0.02) 100%)",
  },
  {
    title: "Finance",
    subtitle: "Financial Systems & Personnel",
    icon: Lightbulb,
    href: "/admin/finance",
    permKey: "finance" as const,
    accent: "#38bdf8",
    glow: "rgba(56,189,248,0.30)",
    gradient: "linear-gradient(145deg, rgba(56,189,248,0.10) 0%, rgba(56,189,248,0.02) 100%)",
  },
];

/* ─── Sortable Tile ─── */
const SortableTile = ({
  tile,
  allowed,
  onNavigate,
  onEdit,
}: {
  tile: DashboardTile;
  allowed: boolean;
  onNavigate: () => void;
  onEdit: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tile.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const isUpcomingEvents = tile.href === "__upcoming_events__";

  // For Upcoming Events, render the widget inside the sortable wrapper
  if (isUpcomingEvents) {
    return (
      <div ref={setNodeRef} style={style} className="relative group sm:col-span-1">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 z-10 p-1 rounded text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        {/* Edit button */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="absolute top-2 right-2 z-10 p-1 rounded text-white/20 hover:text-white/60 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Edit"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <UpcomingEventsWidget
          title={tile.title}
          subtitle={tile.subtitle}
          accentColor={tile.accent_color}
          iconName={tile.icon_name}
        />
      </div>
    );
  }

  const IconComp = getIconComponent(tile.icon_name);

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-10 p-1 rounded text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      {/* Edit button */}
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="absolute top-2 right-2 z-10 p-1 rounded text-white/20 hover:text-white/60 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Edit"
      >
        <Pencil className="w-3 h-3" />
      </button>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => allowed && onNavigate()}
            disabled={!allowed}
            className={`w-full group relative text-left rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
              allowed
                ? "hover:bg-white/[0.04] hover:border-white/[0.12] cursor-pointer"
                : "opacity-30 cursor-not-allowed"
            }`}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{
                background: `${tile.accent_color}12`,
                color: tile.accent_color,
              }}
            >
              {IconComp && <IconComp className="w-4.5 h-4.5" strokeWidth={1.8} />}
              {!allowed && (
                <Lock className="w-3 h-3 absolute top-4 right-4 text-zinc-600" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-0.5">{tile.title}</h3>
            <p className="text-[11px] text-zinc-600">{tile.subtitle}</p>
          </button>
        </TooltipTrigger>
        {!allowed && (
          <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs">
            Admin access required
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  );
};

/* ─── Main Dashboard ─── */
const AdminDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission, loading: permLoading } = useStaffPermissions();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTile, setEditingTile] = useState<DashboardTile | null>(null);
  const [seeded, setSeeded] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /* Fetch tiles */
  const { data: tiles = [], isLoading: tilesLoading } = useQuery({
    queryKey: ["dashboard-tiles", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from("dashboard_tiles") as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as DashboardTile[];
    },
    enabled: !!user,
  });

  /* Seed default tiles on first load */
  useEffect(() => {
    if (!user || tilesLoading || seeded) return;
    if (tiles.length > 0) {
      setSeeded(true);
      return;
    }
    const seedDefaults = async () => {
      const rows = DEFAULT_TILES.map((t) => ({ ...t, user_id: user.id }));
      const { error } = await (supabase.from("dashboard_tiles") as any).insert(rows);
      if (error) {
        console.error("Failed to seed default tiles:", error);
      } else {
        queryClient.invalidateQueries({ queryKey: ["dashboard-tiles", user.id] });
      }
      setSeeded(true);
    };
    seedDefaults();
  }, [user, tilesLoading, tiles.length, seeded, queryClient]);

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = tiles.findIndex((t) => t.id === active.id);
    const newIdx = tiles.findIndex((t) => t.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    const reordered = [...tiles];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);

    // Optimistic update
    queryClient.setQueryData(["dashboard-tiles", user?.id], reordered);

    // Persist
    const updates = reordered.map((t, i) =>
      (supabase.from("dashboard_tiles") as any).update({ sort_order: i }).eq("id", t.id)
    );
    await Promise.all(updates);
  };

  const isTileAllowed = (tile: DashboardTile) => {
    if (tile.href === "__upcoming_events__") return true;
    const permKey = HREF_PERM_MAP[tile.href];
    if (!permKey) return true;
    return permLoading || hasPermission(permKey);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      {/* ── Header ── */}
      <header className="border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Back to site" className="text-zinc-400 hover:text-white hover:bg-white/5">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Command Center</h1>
              <p className="text-xs text-zinc-500 font-medium">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InviteAdminModal />
            <Button variant="outline" onClick={handleLogout} className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-9">
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-6xl mx-auto px-6 py-10 sm:py-14">
        {/* Logo */}
        <div className="flex justify-center mb-14 sm:mb-20">
          <img
            src={nlaLogoWhite}
            alt="No Limits Academy"
            className="h-36 sm:h-52 w-auto drop-shadow-[0_0_60px_rgba(191,15,62,0.15)]"
          />
        </div>

        {/* ── Hero pillar cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-16 sm:mb-20">
          {pillars.map((p) => {
            const allowed = permLoading || hasPermission(p.permKey);
            return (
              <Tooltip key={p.title}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => allowed && navigate(p.href)}
                    disabled={!allowed}
                    className="group relative text-left rounded-2xl transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                    style={{ cursor: allowed ? "pointer" : "not-allowed" }}
                  >
                    <div
                      className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
                      style={{ background: p.glow }}
                    />
                    <div
                      className={`relative rounded-2xl border-2 p-8 sm:p-10 min-h-[280px] sm:min-h-[320px] flex flex-col justify-between transition-all duration-300 ${
                        allowed
                          ? "group-hover:-translate-y-1 group-hover:shadow-2xl"
                          : "opacity-40"
                      }`}
                      style={{
                        borderColor: allowed ? p.accent : "rgba(255,255,255,0.08)",
                        background: allowed ? p.gradient : "rgba(255,255,255,0.02)",
                      }}
                    >
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center mb-6"
                        style={{
                          background: `${p.accent}18`,
                          color: p.accent,
                        }}
                      >
                        <p.icon className="w-8 h-8" strokeWidth={1.8} />
                        {!allowed && (
                          <Lock className="w-4 h-4 absolute top-6 right-6 text-zinc-500" />
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-end">
                        <h2 className="text-2xl sm:text-[1.65rem] font-extrabold tracking-tight text-white mb-1.5">
                          {p.title}
                        </h2>
                        <p className="text-sm text-zinc-500 font-medium mb-6">
                          {p.subtitle}
                        </p>
                        <div
                          className={`inline-flex items-center gap-2 text-sm font-semibold tracking-wide transition-colors duration-200 ${
                            allowed ? "group-hover:brightness-125" : ""
                          }`}
                          style={{ color: allowed ? p.accent : "rgba(255,255,255,0.2)" }}
                        >
                          {allowed ? (
                            <>
                              <span>Open</span>
                              <span className="text-lg leading-none transition-transform duration-200 group-hover:translate-x-1">→</span>
                            </>
                          ) : (
                            <span>🔒 Locked</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </TooltipTrigger>
                {!allowed && (
                  <TooltipContent className="bg-zinc-900 border-zinc-800 text-zinc-300 text-xs">
                    Admin access required
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-white/[0.04] mb-10" />

        {/* ── Secondary tier (database-driven, drag-and-drop) ── */}
        {!tilesLoading && tiles.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tiles.map((t) => t.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
                {tiles.map((tile) => (
                  <SortableTile
                    key={tile.id}
                    tile={tile}
                    allowed={isTileAllowed(tile)}
                    onNavigate={() => navigate(tile.href)}
                    onEdit={() => { setEditingTile(tile); setModalOpen(true); }}
                  />
                ))}

                {/* Add tile button */}
                <button
                  onClick={() => { setEditingTile(null); setModalOpen(true); }}
                  className="rounded-xl border-2 border-dashed border-white/[0.08] bg-transparent p-5 flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 hover:border-white/[0.15] transition-colors min-h-[100px]"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-xs font-medium">Add Tile</span>
                </button>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      {/* Edit / Add modal */}
      {user && (
        <DashboardTileModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingTile(null); }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["dashboard-tiles", user.id] })}
          editingTile={editingTile}
          userId={user.id}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
