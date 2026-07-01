import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import nlaLogoWhite from "@/assets/nla-logo-white.png";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions, PermissionKey } from "@/hooks/useStaffPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Hammer, BadgeDollarSign, Lightbulb, ArrowLeft, Lock, Plus, Pencil, GripVertical, KeyRound, LayoutGrid, ChevronRight, MessageSquare, Trash2 } from "lucide-react";
import { icons } from "lucide-react";
import UpcomingEventsWidget from "@/components/admin/UpcomingEventsWidget";
import InviteAdminModal from "@/components/admin/InviteAdminModal";
import DashboardTileModal, { type DashboardTile } from "@/components/admin/DashboardTileModal";
import AddWorkbenchModal from "@/components/admin/AddWorkbenchModal";
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

/* Map href → permission key. Task manager tiles use the dynamic
   task_manager_<KEY> convention so any new task manager (HC, JS, etc.)
   added via the AddWorkbenchModal automatically gets a permission gate
   without code changes. */
const HREF_PERM_MAP: Record<string, PermissionKey> = {
  "/admin/staff": "settings",
  "/admin/operations": "operations",
  "/admin/sales-marketing": "sales_marketing",
  "/admin/finance": "finance",
};

/** Resolve the permission key for a tile href. Static entries above plus
 *  dynamic task manager hrefs of the shape /admin/task-manager/<KEY>. */
const resolvePermKey = (href: string): PermissionKey | undefined => {
  if (HREF_PERM_MAP[href]) return HREF_PERM_MAP[href];
  // /admin/task-manager/PD → task_manager_PD
  const tm = href.match(/^\/admin\/task-manager\/([^/]+)$/);
  if (tm) return `task_manager_${tm[1]}`;
  // Legacy paths for PD/PC kept for safety; redirect components also catch these.
  if (href === "/admin/pd-task-manager") return "task_manager_PD";
  if (href === "/admin/pc-task-manager") return "task_manager_PC";
  return undefined;
};

/* Reserved workbench keys that can never be deleted from the UI (they
   mirror the server-side guard in delete_workbench). */
const RESERVED_WORKBENCH_KEYS = ["PD", "PC"];

/* If a tile is a deletable workbench tile, return its key; otherwise null.
   Workbench tiles have the shape /admin/task-manager/<KEY>. PD/PC are
   reserved and never deletable. */
const deletableWorkbenchKey = (href: string): string | null => {
  const m = href.match(/^\/admin\/task-manager\/([^/]+)$/);
  if (!m) return null;
  const key = m[1].toUpperCase();
  return RESERVED_WORKBENCH_KEYS.includes(key) ? null : key;
};

/* Tiles that were removed — delete from DB if found. Listing a tile's href
   here makes the dashboard auto-clean it from every admin's tile row on
   their next visit. */
const DEPRECATED_TILE_HREFS = ["/admin/shared-task-board", "/admin/pd-task-manager", "/admin/pc-task-manager", "/admin/task-manager", "/transport"];

/* Default tiles to seed for new users. PD/PC tiles are no longer hardcoded
   here — they (and any newly-added task managers like HC) come from the
   `task_managers` table and are merged in below in `defaultTiles`. */
const STATIC_DEFAULT_TILES = [
  { title: "Upcoming Events", subtitle: "Calendar reminders", icon_name: "calendar-days", accent_color: "#f59e0b", href: "__upcoming_events__", sort_order: 0, is_default: true },
  { title: "Message Board", subtitle: "Team communication & tasks", icon_name: "message-square", accent_color: "#bf0f3e", href: "/admin/message-board", sort_order: 100, is_default: true },
  { title: "Weekly Agenda", subtitle: "Staff meeting review", icon_name: "list-todo", accent_color: "#bf0f3e", href: "/admin/agenda", sort_order: 101, is_default: true },
  { title: "Settings", subtitle: "Staff Management", icon_name: "settings", accent_color: "#a1a1aa", href: "/admin/staff", sort_order: 102, is_default: true },
];

type TaskManagerRow = {
  id: string;
  key: string;
  display_name: string;
  subtitle: string | null;
  accent_color: string | null;
  icon_name: string | null;
  sort_order: number;
};

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
  onDelete,
}: {
  tile: DashboardTile;
  allowed: boolean;
  onNavigate: () => void;
  onEdit: () => void;
  // Only provided for deletable workbench tiles (super admin). When set,
  // a trash button appears beside the edit pencil.
  onDelete?: () => void;
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
      {/* Delete button — only rendered for deletable workbench tiles
          (super admin). Sits just left of the edit pencil. */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-8 z-10 p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete workbench"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

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
  const { hasPermission, loading: permLoading, isSuperAdmin } = useStaffPermissions();
  const { toast } = useToast();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Too short", description: "New password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    // Verify old password first
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user!.email!, password: oldPassword });
    if (signInError) {
      toast({ title: "Wrong password", description: "Your current password is incorrect.", variant: "destructive" });
      setChangingPassword(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Password updated!", description: "Your new password is now active." });
    setShowChangePassword(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTile, setEditingTile] = useState<DashboardTile | null>(null);
  const [addTaskManagerOpen, setAddTaskManagerOpen] = useState(false);
  const [seeded, setSeeded] = useState(false);
  // The dashboard is a fixed home of 4 tiles: the 3 business pillars plus
  // one gray "Other Admin" tile. Clicking "Other Admin" swaps to a second
  // screen showing only the secondary tiles (workbenches, message board,
  // settings, etc.) with a Back button. The dashboard is always the
  // landing view, so this is plain in-memory state (not persisted).
  const [showOther, setShowOther] = useState(false);

  // Workbench deletion (super admin only). deleteTarget holds the tile
  // being removed; impact is fetched from get_workbench_impact so the
  // confirm dialog can show exactly what will be destroyed before the
  // irreversible delete_workbench RPC runs.
  const [deleteTarget, setDeleteTarget] = useState<{ key: string; title: string } | null>(null);
  const [impact, setImpact] = useState<{ focus_areas: number; signals: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openDeleteWorkbench = async (tile: DashboardTile) => {
    const key = deletableWorkbenchKey(tile.href);
    if (!key) return;
    setDeleteTarget({ key, title: tile.title });
    setImpact(null);
    const { data, error } = await supabase.rpc("get_workbench_impact", { p_key: key });
    if (error) {
      toast({ title: "Couldn't load workbench details", description: error.message, variant: "destructive" });
      return;
    }
    const row = (data as { focus_areas: number; signals: number }[] | null)?.[0];
    setImpact({ focus_areas: row?.focus_areas ?? 0, signals: row?.signals ?? 0 });
  };

  const confirmDeleteWorkbench = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.rpc("delete_workbench", { p_key: deleteTarget.key });
    setDeleting(false);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Workbench deleted", description: `${deleteTarget.title} and its data were removed.` });
    setDeleteTarget(null);
    setImpact(null);
    queryClient.invalidateQueries({ queryKey: ["task-managers"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-tiles", user?.id] });
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /* Fetch user's dashboard tiles */
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

  /* Fetch task managers — drives both the auto-seeded tiles below and the
     "Add Task Manager" button. */
  const { data: taskManagers = [], isLoading: tmLoading } = useQuery({
    queryKey: ["task-managers"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("task_managers") as any)
        .select("id, key, display_name, subtitle, accent_color, icon_name, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as TaskManagerRow[];
    },
  });

  /* Unread message count for the signed-in admin. Same RPC the message
     board uses (mb_unread_counts returns one row per conversation); we
     sum it to a single number that drives the alert tile under the
     pillars. Polls on an interval + on window focus so a message that
     lands while the dashboard is open eventually surfaces here. */
  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["dashboard-unread-messages", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mb_unread_counts", { uid: user!.id });
      if (error) throw error;
      return ((data as { unread_count: number }[]) || []).reduce(
        (sum, r) => sum + Number(r.unread_count),
        0,
      );
    },
    enabled: !!user,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  /* Realtime: any new message anywhere refreshes the unread count so the
     alert tile lights up the instant a message is sent — not just on the
     60s poll above (which stays as a safety net if the socket drops).
     Own channel name so it doesn't collide with the board's "mb-realtime".
     The RPC re-runs on invalidate and only counts conversations this user
     is a member of, so messages in threads you're not in are ignored. */
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dashboard-mb-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mb_messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-unread-messages", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  /* The full default-tile set = static defaults + one tile per task manager.
     This drives both the new-user seed and the missing-tile backfill below. */
  const defaultTiles = useMemo(() => {
    const tmTiles = taskManagers.map((tm) => ({
      title: tm.display_name,
      subtitle: tm.subtitle || "Focus Areas & Daily Signals",
      icon_name: tm.icon_name || "signal",
      accent_color: tm.accent_color || "#a1a1aa",
      href: `/admin/task-manager/${tm.key}`,
      sort_order: tm.sort_order + 1, // Leave 0 for Upcoming Events
      is_default: true,
    }));
    return [...STATIC_DEFAULT_TILES, ...tmTiles];
  }, [taskManagers]);

  /* Seed default tiles on first load; also add any missing tiles for existing
     users — this is what makes a newly-added task manager auto-appear on
     every admin's dashboard the next time they visit. */
  useEffect(() => {
    if (!user || tilesLoading || tmLoading || seeded) return;

    const seedDefaults = async () => {
      // Remove any deprecated tiles first
      const deprecatedIds = tiles
        .filter((t) => DEPRECATED_TILE_HREFS.includes(t.href))
        .map((t) => t.id);
      if (deprecatedIds.length > 0) {
        await (supabase.from("dashboard_tiles") as any)
          .delete()
          .in("id", deprecatedIds);
      }

      if (tiles.length === 0 || tiles.every((t) => DEPRECATED_TILE_HREFS.includes(t.href))) {
        const rows = defaultTiles.map((t) => ({ ...t, user_id: user.id }));
        const { error } = await (supabase.from("dashboard_tiles") as any).insert(rows);
        if (error) console.error("Failed to seed default tiles:", error);
      } else {
        const existingHrefs = new Set(
          tiles.filter((t) => !DEPRECATED_TILE_HREFS.includes(t.href)).map((t) => t.href)
        );
        const missing = defaultTiles.filter((t) => !existingHrefs.has(t.href));
        if (missing.length > 0) {
          const rows = missing.map((t) => ({ ...t, user_id: user.id }));
          const { error } = await (supabase.from("dashboard_tiles") as any).insert(rows);
          if (error) console.error("Failed to add missing tiles:", error);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard-tiles", user.id] });
      setSeeded(true);
    };

    seedDefaults();
  }, [user, tilesLoading, tmLoading, tiles.length, defaultTiles, seeded, queryClient]);

  /* When a new task manager is created, immediately drop a tile onto the
     current user's dashboard (the seed effect above only runs once per
     mount, and other admins will get the tile next time they visit). */
  const handleTaskManagerCreated = async () => {
    queryClient.invalidateQueries({ queryKey: ["task-managers"] });
    setSeeded(false); // Re-trigger the seed effect so the new tile gets inserted
  };

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
    const permKey = resolvePermKey(tile.href);
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
            <Button variant="outline" onClick={() => setShowChangePassword(true)} className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-9">
              <KeyRound className="w-3.5 h-3.5 mr-1.5" />
              Change Password
            </Button>
            <Button variant="outline" onClick={handleLogout} className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-9">
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Log out
            </Button>
          </div>

          <Dialog open={showChangePassword} onOpenChange={(open) => { setShowChangePassword(open); if (!open) { setOldPassword(""); setNewPassword(""); setConfirmPassword(""); } }}>
            <DialogContent className="bg-neutral-900 border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Change Password</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleChangePassword} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-white/70">Current Password</Label>
                  <Input type="password" placeholder="Your current password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required autoComplete="current-password" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">New Password</Label>
                  <Input type="password" placeholder="Min 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoComplete="new-password" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/70">Confirm Password</Label>
                  <Input type="password" placeholder="Re-enter password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
                </div>
                <Button type="submit" className="w-full" disabled={changingPassword}>
                  {changingPassword ? "Saving…" : "Update Password"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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

        {!showOther ? (
        <>
        {/* ── Hero pillar cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-10 sm:mb-12">
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

        {/* ── Secondary row under the pillars ── an unread-messages alert
            (only rendered when you actually have unread messages) beside
            the "Other Admin" entry tile. */}
        <div className="flex flex-wrap justify-center items-stretch gap-3">
          {/* Unread-messages alert — hidden entirely at zero so it reads
              as a true notification, not permanent chrome. NLA red with a
              pulsing dot to pull the eye. Clicks straight to the board,
              where unread conversations already float to the top. */}
          {unreadMessages > 0 && (
            <button
              type="button"
              onClick={() => navigate("/admin/message-board")}
              className="group flex items-center gap-3 rounded-xl border border-[#bf0f3e]/40 bg-[#bf0f3e]/[0.08] px-5 py-3.5 text-left transition-all duration-200 hover:bg-[#bf0f3e]/[0.14] hover:border-[#bf0f3e]/60 shadow-[0_0_24px_rgba(191,15,62,0.22)]"
            >
              <div className="relative w-9 h-9 rounded-lg flex items-center justify-center bg-[#bf0f3e]/20 text-[#bf0f3e]">
                <MessageSquare className="w-4.5 h-4.5" strokeWidth={1.8} />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#bf0f3e] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#bf0f3e]" />
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {unreadMessages > 99 ? "99+" : unreadMessages} unread {unreadMessages === 1 ? "message" : "messages"}
                </h3>
                <p className="text-[11px] text-[#bf0f3e]/80">Tap to read on the message board</p>
              </div>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowOther(true)}
            className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3.5 text-left transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.12]"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.04] text-zinc-500 group-hover:text-zinc-300 transition-colors">
              <LayoutGrid className="w-4.5 h-4.5" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-300">Other Admin</h3>
              <p className="text-[11px] text-zinc-600">Workbenches, message board, settings &amp; more</p>
            </div>
            <ChevronRight className="w-4 h-4 ml-2 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </button>
        </div>
        </>
        ) : (
        <>
        {/* ── Other Admin screen ── only the secondary tiles, no pillars.
            Back button returns to the fixed 3-pillar dashboard. */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Other Admin</h2>
            <p className="text-sm text-zinc-500 font-medium">Workbenches, message board, settings &amp; more</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowOther(false)}
            className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-xs h-9"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Dashboard
          </Button>
        </div>

        {!tilesLoading && tiles.length > 0 && (
          <div className="max-w-5xl mx-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tiles.map((t) => t.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {tiles.map((tile) => (
                    <SortableTile
                      key={tile.id}
                      tile={tile}
                      allowed={isTileAllowed(tile)}
                      onNavigate={() => navigate(tile.href)}
                      onEdit={() => { setEditingTile(tile); setModalOpen(true); }}
                      onDelete={
                        isSuperAdmin && deletableWorkbenchKey(tile.href)
                          ? () => openDeleteWorkbench(tile)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* "Add Workbench" — outside DndContext so DnD sensors don't
                swallow the click. Replaces the previous generic "Add Tile"
                button since adding a workbench is the only common reason
                anyone needs to create a new tile. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
              <button
                type="button"
                onClick={() => setAddTaskManagerOpen(true)}
                className="rounded-xl border-2 border-dashed border-white/[0.08] bg-transparent p-5 flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 hover:border-white/[0.15] transition-colors min-h-[100px]"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs font-medium">Add Workbench</span>
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </main>

      {/* Edit-only modal: opens when the user clicks the pencil on an
          existing tile. New tiles all flow through AddWorkbenchModal,
          which creates the tile with its destination already locked in. */}
      {user && (
        <DashboardTileModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingTile(null); }}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["dashboard-tiles", user.id] })}
          editingTile={editingTile}
        />
      )}

      <AddWorkbenchModal
        open={addTaskManagerOpen}
        onClose={() => setAddTaskManagerOpen(false)}
        onCreated={handleTaskManagerCreated}
      />

      {/* Delete-workbench confirmation. Shows the exact impact (focus areas
          + signals) fetched before opening, so the destructive action is
          never a surprise. Runs the guarded delete_workbench RPC. */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) { setDeleteTarget(null); setImpact(null); } }}>
        <DialogContent className="bg-neutral-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              Delete {deleteTarget?.title}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-zinc-400">
              This permanently removes the workbench for everyone. It cannot be undone.
            </p>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm">
              {impact === null ? (
                <p className="text-zinc-500">Checking what's attached…</p>
              ) : (
                <>
                  <p className="text-zinc-300 font-medium mb-2">Will be permanently deleted:</p>
                  <ul className="space-y-1 text-zinc-400">
                    <li>• <span className="text-white font-semibold">{impact.focus_areas}</span> focus area{impact.focus_areas === 1 ? "" : "s"}</li>
                    <li>• <span className="text-white font-semibold">{impact.signals}</span> signal{impact.signals === 1 ? "" : "s"}</li>
                    <li>• the dashboard tile and its access permission</li>
                  </ul>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => { setDeleteTarget(null); setImpact(null); }}
                disabled={deleting}
                className="border-white/10 text-zinc-300 bg-transparent hover:bg-white/5 hover:text-white text-sm h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteWorkbench}
                disabled={deleting || impact === null}
                className="bg-red-600 hover:bg-red-500 text-white text-sm h-9"
              >
                {deleting ? "Deleting…" : "Delete workbench"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
