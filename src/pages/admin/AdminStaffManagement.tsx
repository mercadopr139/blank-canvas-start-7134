import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { taskManagerPermKey, ADMIN_LEVEL_KEY, isExplicitOnlyKey } from "@/lib/permissions";
import { Switch } from "@/components/ui/switch";
import { canOpen } from "@/lib/access";
import { ACCESS_CARD, COMMAND_CENTER_LINES, allCardLines, type AccessLine, type AccessPillar, type AccessSection } from "@/config/accessCard";

// Which cards are folded down to their header, remembered in this browser so
// the page opens the way it was left.
const HIDDEN_CARDS_KEY = "nla_staff_cards_hidden";
const readHiddenCards = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(HIDDEN_CARDS_KEY) || "{}") || {}; } catch { return {}; }
};
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Shield, UserCog, Pencil, ShieldCheck, Trash2, AlertTriangle, ChevronDown, Eye } from "lucide-react";
import { setViewAs } from "@/lib/viewAs";
import { SHARED_PASSWORD_TOOLS } from "@/config/appRegistry";

import { isSuperAdminEmail, isAccessManagerEmail } from "@/lib/superAdmins";

// ─────────────────────────────────────────────────────────────────────────
// Types

interface StaffMember {
  id: string;
  user_id: string;
  full_name: string;
  // Optional short label shown when two staffers share a first name
  // (e.g., "Josh" / "Sanchez"). Falls back to full_name when null.
  display_name: string | null;
  email: string;
  job_title: string;
  status: string;
  /** Set when the person was removed. The row stays so their name still shows on what they wrote. */
  removed_at?: string | null;
}

/** One login, as the manage-access function reports it. */
interface AccessAccount {
  user_id: string;
  email: string;
  roles: string[];
  has_card: boolean;
  removed: boolean;
  on_allowlist: boolean;
  last_sign_in_at: string | null;
  created_at: string;
  blocked: boolean;
}
interface AccessList { accounts: AccessAccount[]; allowlist_without_login: string[] }

/** Who is about to be removed. A login has a user_id; an allowlist-only email does not. */
type RemoveTarget = { name: string; email: string; user_id: string | null };

const fmtSignIn = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })
    : null;

type StaffPerms = Record<string, boolean>;

type TaskManagerRow = {
  key: string;
  display_name: string;
  sort_order: number;
};

// ─────────────────────────────────────────────────────────────────────────
// Component

export default function AdminStaffManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canManageAccess, isSuperAdmin, loading: permLoading } = useStaffPermissions();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffPerms, setStaffPerms] = useState<Record<string, StaffPerms>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({ full_name: "", display_name: "", email: "", job_title: "" });
  const [saving, setSaving] = useState(false);
  // Set when the Add window is giving a card to a login that already exists.
  const [linkingEmail, setLinkingEmail] = useState<string | null>(null);
  // Which pillars are folded open on which card ("userId:pillar").
  const [openPillars, setOpenPillars] = useState<Record<string, boolean>>({});
  // Cards folded down to name, level and a one-line summary.
  const [hiddenCards, setHiddenCards] = useState<Record<string, boolean>>(readHiddenCards);
  const saveHidden = (next: Record<string, boolean>) => {
    setHiddenCards(next);
    try { localStorage.setItem(HIDDEN_CARDS_KEY, JSON.stringify(next)); } catch { /* still folds for this visit */ }
  };
  const allHidden = staff.length > 0 && staff.every((m) => hiddenCards[m.user_id]);
  const setAllHidden = (hide: boolean) => saveHidden(Object.fromEntries(staff.map((m) => [m.user_id, hide])));
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [removing, setRemoving] = useState(false);
  const queryClient = useQueryClient();

  // Every login that exists, from the server. Staff cards only cover people
  // added through this page; this also shows accounts that never got a card,
  // and when each person last signed in.
  const access = useQuery({
    queryKey: ["access-accounts"],
    enabled: canManageAccess,
    queryFn: async (): Promise<AccessList> => {
      const { data, error } = await supabase.functions.invoke("manage-access", { body: { action: "list" } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data as AccessList;
    },
  });
  const accountById = useMemo(() => {
    const m = new Map<string, AccessAccount>();
    (access.data?.accounts ?? []).forEach((a) => m.set(a.user_id, a));
    return m;
  }, [access.data]);
  // Logins that can still get in but have no staff card to manage them from.
  const uncarded = useMemo(
    () => (access.data?.accounts ?? []).filter((a) => !a.has_card && !a.blocked && (a.roles.length > 0 || a.on_allowlist)),
    [access.data],
  );
  const waitingEmails = access.data?.allowlist_without_login ?? [];

  // Task managers come from the DB so the checkbox set updates automatically
  // whenever a new task manager (HC, JS, etc.) is added.
  const { data: taskManagers = [] } = useQuery({
    queryKey: ["task-managers-for-staff-mgmt"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("task_managers")
        .select("key, display_name, sort_order") as any)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as TaskManagerRow[];
    },
  });

  useEffect(() => {
    if (!permLoading && !canManageAccess) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [permLoading, canManageAccess, navigate]);

  const fetchStaff = async () => {
    const { data: profiles } = await supabase
      .from("staff_profiles")
      .select("*")
      .order("full_name");
    if (profiles) {
      const current = (profiles as unknown as StaffMember[]).filter((p) => !p.removed_at);
      setStaff(current);
      const userIds = current.map((p) => p.user_id);
      if (userIds.length > 0) {
        const { data: perms } = await supabase
          .from("staff_permissions")
          .select("user_id, permission_key, granted")
          .in("user_id", userIds);
        const mapped: Record<string, StaffPerms> = {};
        profiles.forEach((p: any) => {
          mapped[p.user_id] = {};
        });
        perms?.forEach((row: any) => {
          if (mapped[row.user_id]) mapped[row.user_id][row.permission_key] = row.granted;
        });
        setStaffPerms(mapped);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAdd = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.job_title.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await supabase.functions.invoke("invite-staff-member", {
        body: {
          email: form.email.toLowerCase().trim(),
          full_name: form.full_name.trim(),
          job_title: form.job_title.trim(),
        },
      });

      if (res.error) {
        toast({ title: "Failed to send invite", variant: "destructive" });
        setSaving(false);
        return;
      }

      if (res.data?.already_exists) {
        toast({ title: "This email already has an account. You can manage their permissions directly." });
        setAddOpen(false);
        setForm({ full_name: "", display_name: "", email: "", job_title: "" });
        fetchStaff();
        setSaving(false);
        return;
      }

      if (res.data?.error) {
        toast({ title: res.data.error, variant: "destructive" });
        setSaving(false);
        return;
      }

      toast({ title: linkingEmail ? "Staff card added" : (res.data?.message || "Staff member added successfully") });
      setAddOpen(false);
      setForm({ full_name: "", display_name: "", email: "", job_title: "" });
      fetchStaff();
      queryClient.invalidateQueries({ queryKey: ["access-accounts"] });
    } catch {
      toast({ title: "An error occurred", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    const { error } = await supabase
      .from("staff_profiles")
      .update({
        full_name: form.full_name.trim(),
        display_name: form.display_name.trim() || null,
        job_title: form.job_title.trim(),
      })
      .eq("id", editTarget.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Staff member updated" });
    setEditTarget(null);
    fetchStaff();
  };

  const toggleStatus = async (member: StaffMember) => {
    const newStatus = member.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("staff_profiles").update({ status: newStatus }).eq("id", member.id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: `${member.full_name} ${newStatus === "active" ? "activated" : "deactivated"}`,
      description: newStatus === "active"
        ? "They can sign in to the back end again, with the same boxes as before."
        : "They are locked out of the back end until you activate them. Nothing is deleted.",
    });
    fetchStaff();
  };

  // Take a person out for good: role, checkboxes, allowlist, login. What they
  // wrote stays, with their name on it.
  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const { data, error } = await supabase.functions.invoke("manage-access", {
      body: removeTarget.user_id
        ? { action: "remove", user_id: removeTarget.user_id }
        : { action: "remove", email: removeTarget.email },
    });
    setRemoving(false);
    if (error || data?.error) {
      toast({ title: "Couldn't remove", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: `${removeTarget.name} removed`, description: "Their login is blocked and all access is gone." });
    setRemoveTarget(null);
    fetchStaff();
    queryClient.invalidateQueries({ queryKey: ["access-accounts"] });
  };

  const setPermission = async (userId: string, key: string, value: boolean) => {
    if (key === "settings" && !isSuperAdmin) {
      toast({
        title: "Only the super admin can grant Settings permission",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("staff_permissions")
      .upsert(
        { user_id: userId, permission_key: key, granted: value },
        { onConflict: "user_id,permission_key" }
      );
    if (error) {
      // Nothing was saved, so the box stays as it was.
      toast({ title: "Couldn't save that change", description: error.message, variant: "destructive" });
      return;
    }
    setStaffPerms((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [key]: value },
    }));
  };

  // The Admin switch. Turning it on also writes the Website Photos row,
  // because the database checks that one by its own key.
  const setAdminLevel = async (userId: string, next: boolean) => {
    await setPermission(userId, ADMIN_LEVEL_KEY, next);
    if (next) await setPermission(userId, "manage_website_photos", true);
  };

  // Several boxes in one save, for a section's "all" box.
  const setMany = async (userId: string, keys: string[], value: boolean) => {
    if (keys.length === 0) return;
    const { error } = await supabase
      .from("staff_permissions")
      .upsert(
        keys.map((k) => ({ user_id: userId, permission_key: k, granted: value })),
        { onConflict: "user_id,permission_key" }
      );
    if (error) {
      toast({ title: "Couldn't save that change", description: error.message, variant: "destructive" });
      return;
    }
    setStaffPerms((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], ...Object.fromEntries(keys.map((k) => [k, value])) },
    }));
  };

  // What a line shows for a person: its own setting once it has one;
  // until then, whatever the old one-box-per-section setting granted.
  // Asked of the same rule the sidebars and the door use, so the card can
  // never show something different from what the person actually gets.
  const lineOn = (userId: string, line: AccessLine) =>
    canOpen(line.key, { isSuperAdmin: false, permissions: staffPerms[userId] ?? {} });

  // `full` = the person is a Super Admin or an Admin: every line is on and
  // locked, apart from the explicit-only ones (Task Managers, the reviewer).
  const Line = ({ userId, line, full, indent = false }: {
    userId: string;
    line: AccessLine & { defaultOn?: boolean };
    full: boolean;
    indent?: boolean;
  }) => {
    const locked = full && !isExplicitOnlyKey(line.key);
    const checked = locked ? true : lineOn(userId, line);
    return (
      <label className={`flex items-center gap-2 text-sm ${indent ? "ml-6" : ""} ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => !locked && setPermission(userId, line.key, !!v)}
          disabled={locked}
        />
        <span className={checked ? "text-white" : "text-white/45"}>{line.label}</span>
      </label>
    );
  };

  // A sidebar heading with its lines. The heading's box is a shortcut for
  // "all of these"; it is not a permission of its own.
  const Section = ({ userId, section, full }: { userId: string; section: AccessSection; full: boolean }) => {
    if (!section.title) {
      return <>{section.lines.map((l) => <Line key={l.key} userId={userId} line={l} full={full} />)}</>;
    }
    const pickable = section.lines.filter((l) => !isExplicitOnlyKey(l.key));
    const onCount = full ? pickable.length : pickable.filter((l) => lineOn(userId, l)).length;
    const all = pickable.length > 0 && onCount === pickable.length;
    return (
      <div className="space-y-1.5">
        <label className={`flex items-center gap-2 text-sm font-semibold ${full ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
          <Checkbox
            checked={all ? true : onCount > 0 ? "indeterminate" : false}
            onCheckedChange={() => !full && setMany(userId, pickable.map((l) => l.key), !all)}
            disabled={full}
          />
          {section.title}
          <span className="text-[11px] font-normal text-white/35">{onCount} of {pickable.length}</span>
        </label>
        {section.lines.map((l) => <Line key={l.key} userId={userId} line={l} full={full} indent />)}
      </div>
    );
  };

  // One pillar (Operations / Sales & Marketing / Finance): folds away, and
  // says how many of its lines are open.
  const PillarBlock = ({ userId, pillar, full }: { userId: string; pillar: AccessPillar; full: boolean }) => {
    const lines = pillar.sections.flatMap((sec) => sec.lines).filter((l) => !isExplicitOnlyKey(l.key));
    const onCount = full ? lines.length : lines.filter((l) => lineOn(userId, l)).length;
    const id = `${userId}:${pillar.id}`;
    const open = openPillars[id] ?? !full;
    return (
      <div className="rounded-lg border border-white/10">
        <button
          type="button"
          onClick={() => setOpenPillars((p) => ({ ...p, [id]: !open }))}
          className="w-full flex items-center gap-2 px-3 py-2 text-left"
        >
          <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${open ? "" : "-rotate-90"}`} />
          <span className="text-sm font-bold">{pillar.title}</span>
          <span className={`ml-auto text-[11px] tabular-nums ${onCount === 0 ? "text-white/30" : "text-white/60"}`}>
            {onCount} of {lines.length} open
          </span>
        </button>
        {open && (
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-white/10">
            {pillar.sections.map((sec) => (
              <Section key={sec.title ?? sec.lines[0]?.key} userId={userId} section={sec} full={full} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Memo: the dynamic task manager checkbox descriptors.
  const taskManagerChecks = useMemo(
    () =>
      taskManagers.map((tm) => ({
        permKey: taskManagerPermKey(tm.key),
        label: tm.display_name,
      })),
    [taskManagers]
  );

  if (permLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <UserCog className="w-5 h-5" /> Staff Management
              </h1>
              <p className="text-sm text-white/50">Manage team access and permissions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {staff.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setAllHidden(!allHidden)}
                className="border-white/20 text-white bg-transparent hover:bg-white/10"
              >
                <ChevronDown className={`w-4 h-4 mr-2 transition-transform ${allHidden ? "" : "rotate-180"}`} />
                {allHidden ? "Show all" : "Hide all"}
              </Button>
            )}
            <Button
              onClick={() => {
                setForm({ full_name: "", display_name: "", email: "", job_title: "" });
                setLinkingEmail(null);
                setAddOpen(true);
              }}
              className="bg-[#bf0f3e] hover:bg-[#a00d35]"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Staff
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {staff.length === 0 ? (
          <p className="text-center text-white/40 mt-12">
            No staff members yet. Click "Add Staff" to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {staff.map((member) => {
              const isMemberSuperAdmin = isSuperAdminEmail(member.email);
              const isMemberAdmin = !isMemberSuperAdmin && (staffPerms[member.user_id]?.[ADMIN_LEVEL_KEY] ?? false);
              const cardHidden = hiddenCards[member.user_id] ?? false;
              const openLines = allCardLines().filter((l) => !isExplicitOnlyKey(l.key) && lineOn(member.user_id, l)).length;
              const totalLines = allCardLines().filter((l) => !isExplicitOnlyKey(l.key)).length;
              const myTaskManagers = taskManagerChecks.filter((tm) => staffPerms[member.user_id]?.[tm.permKey]).map((tm) => tm.label);
              const summary = isMemberSuperAdmin
                ? "Everything, including every Task Manager"
                : `${isMemberAdmin ? "Every app open" : `${openLines} of ${totalLines} lines open`}${myTaskManagers.length ? ` · ${myTaskManagers.join(", ")}` : ""}`;
              return (
              <Card
                key={member.id}
                className={`bg-white/5 border-white/10 text-white ${
                  member.status === "inactive" ? "opacity-50" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg text-white">{member.full_name}</CardTitle>
                        {member.display_name && member.display_name.trim() && (
                          <span
                            className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/15 text-white/70 font-medium"
                            title="Short label shown in lists / avatars when first names collide"
                          >
                            "{member.display_name}"
                          </span>
                        )}
                        {isMemberSuperAdmin && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 font-semibold">
                            <ShieldCheck className="w-3 h-3" />
                            Super Admin
                          </span>
                        )}
                        {isMemberAdmin && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-400/15 border border-sky-400/40 text-sky-300 font-semibold">
                            <ShieldCheck className="w-3 h-3" />
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/50">{member.job_title}</p>
                      <p className="text-xs text-white/30 mt-1">{member.email}</p>
                      {access.data && (
                        <p className="text-[11px] text-white/30 mt-0.5">
                          {fmtSignIn(accountById.get(member.user_id)?.last_sign_in_at ?? null)
                            ? `Last signed in ${fmtSignIn(accountById.get(member.user_id)?.last_sign_in_at ?? null)}`
                            : "Never signed in"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          member.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {member.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditTarget(member);
                          setForm({
                            full_name: member.full_name,
                            display_name: member.display_name ?? "",
                            email: member.email,
                            job_title: member.job_title,
                          });
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-white/60 hover:text-white"
                        onClick={() => saveHidden({ ...hiddenCards, [member.user_id]: !cardHidden })}
                        title={cardHidden ? "Show this person's access" : "Hide this person's access"}
                      >
                        {cardHidden ? "Show" : "Hide"}
                        <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform ${cardHidden ? "" : "rotate-180"}`} />
                      </Button>
                    </div>
                  </div>
                  {cardHidden && (
                    <p className="text-xs text-white/45 mt-2">{summary}</p>
                  )}
                </CardHeader>
                {!cardHidden && (
                <CardContent>
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-xs text-white/40 mb-3 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Permissions
                    </p>

                    {isMemberSuperAdmin && (
                      <p className="text-[11px] text-amber-300/70 bg-amber-400/[0.04] border border-amber-400/20 rounded-md px-2.5 py-1.5 mb-3">
                        Super admin has full access to everything regardless of these checkboxes.
                      </p>
                    )}

                    {!isMemberSuperAdmin && (
                      <label className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 mb-4 cursor-pointer ${isMemberAdmin ? "border-sky-400/40 bg-sky-400/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
                        <Switch
                          checked={isMemberAdmin}
                          onCheckedChange={(v) => setAdminLevel(member.user_id, !!v)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-sm font-semibold">Admin</span>
                          <span className="block text-[11px] text-white/45 leading-snug">
                            {isMemberAdmin
                              ? "Every app is open, including new ones as they are built. Task Managers and the reviewer box stay your choice below."
                              : "Off: this person opens only the boxes checked below. Turn on to open every app in one click."}
                          </span>
                        </span>
                      </label>
                    )}

                    <div className="space-y-4">
                      {/* Command Center: the tiles outside the three pillars. */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Command Center</p>
                        {COMMAND_CENTER_LINES.map((l) => (
                          <Line key={l.key} userId={member.user_id} line={l} full={isMemberSuperAdmin || isMemberAdmin} />
                        ))}
                      </div>

                      {/* Task Managers: personal, so they stay a per-person
                          choice even for an Admin. Only a Super Admin has all. */}
                      {taskManagerChecks.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Task Managers</p>
                          {taskManagerChecks.map((tm) => (
                            <label
                              key={tm.permKey}
                              className={`flex items-center gap-2 text-sm ${isMemberSuperAdmin ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <Checkbox
                                checked={isMemberSuperAdmin ? true : (staffPerms[member.user_id]?.[tm.permKey] ?? false)}
                                onCheckedChange={(v) => !isMemberSuperAdmin && setPermission(member.user_id, tm.permKey, !!v)}
                                disabled={isMemberSuperAdmin}
                              />
                              <span>{tm.label}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* The three pillars, line for line as their sidebars show them. */}
                      {ACCESS_CARD.map((pillar) => (
                        <PillarBlock
                          key={pillar.id}
                          userId={member.user_id}
                          pillar={pillar}
                          full={isMemberSuperAdmin || isMemberAdmin}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {!isAccessManagerEmail(member.email) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-amber-400/40 text-amber-300 bg-transparent hover:bg-amber-400/10 hover:text-amber-200 mr-auto"
                        onClick={() => {
                          setViewAs({ user_id: member.user_id, name: member.full_name, email: member.email });
                          navigate("/admin/dashboard");
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> View as
                      </Button>
                    )}
                    {!isAccessManagerEmail(member.email) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs border-red-500/40 text-red-300 bg-transparent hover:bg-red-500/10 hover:text-red-200"
                        onClick={() => setRemoveTarget({ name: member.full_name, email: member.email, user_id: member.user_id })}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-white/20 text-white bg-transparent hover:bg-white/10"
                      onClick={() => toggleStatus(member)}
                    >
                      {member.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </CardContent>
                )}
              </Card>
              );
            })}
          </div>
        )}
        {/* Logins that never got a staff card. They were made with the old
            Invite Admin button, so they could not be seen or managed here. */}
        {access.isError && (
          <p className="mt-8 text-sm text-rose-300">Couldn't load the list of logins: {(access.error as Error)?.message}</p>
        )}
        {(uncarded.length > 0 || waitingEmails.length > 0) && (
          <section className="mt-10">
            <h2 className="text-sm font-bold flex items-center gap-2 text-amber-300">
              <AlertTriangle className="w-4 h-4" /> Logins without a staff card
            </h2>
            <p className="text-xs text-white/40 mt-1 mb-3">
              These can get into the back end but were never added as staff, so they have no card above. Add a staff card to manage one like everyone else.
            </p>
            <div className="rounded-xl border border-amber-400/20 divide-y divide-white/10">
              {uncarded.map((a) => (
                <div key={a.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{a.email}</p>
                    <p className="text-[11px] text-white/40">
                      {a.roles.includes("admin") ? "Full admin access" : a.roles.length ? a.roles.join(", ") : "On the sign-up allowlist"}
                      {" · "}
                      {fmtSignIn(a.last_sign_in_at) ? `last signed in ${fmtSignIn(a.last_sign_in_at)}` : "never signed in"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="text-xs bg-[#bf0f3e] hover:bg-[#a00d35]"
                    onClick={() => {
                      setForm({ full_name: "", display_name: "", email: a.email, job_title: "" });
                      setLinkingEmail(a.email);
                      setAddOpen(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add staff card
                  </Button>
                  {!isAccessManagerEmail(a.email) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-red-500/40 text-red-300 bg-transparent hover:bg-red-500/10 hover:text-red-200"
                      onClick={() => setRemoveTarget({ name: a.email, email: a.email, user_id: a.user_id })}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove
                    </Button>
                  )}
                </div>
              ))}
              {waitingEmails.map((email) => (
                <div key={email} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{email}</p>
                    <p className="text-[11px] text-white/40">No login yet · would become a full admin the moment they sign up</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-red-500/40 text-red-300 bg-transparent hover:bg-red-500/10 hover:text-red-200"
                    onClick={() => setRemoveTarget({ name: email, email, user_id: null })}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
        {/* The rest of the blueprint: tools that run on a shared password or
            a PIN rather than a personal login, so no box here controls them. */}
        <section className="mt-10">
          <h2 className="text-sm font-bold text-white/70">Kiosks, wall boards and shared-password tools</h2>
          <p className="text-xs text-white/40 mt-1 mb-3">
            These do not use a personal login, so the boxes above do not control them. They are listed so this page shows everything that exists.
          </p>
          <div className="rounded-xl border border-white/10 grid sm:grid-cols-2 lg:grid-cols-3">
            {SHARED_PASSWORD_TOOLS.map((t) => (
              <div key={t.route} className="px-4 py-2.5 border-b border-white/5">
                <p className="text-sm text-white/80">{t.label}</p>
                <p className="text-[11px] text-white/35">{t.how}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Remove — says exactly what happens before it happens. */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && !removing && setRemoveTarget(null)}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.name}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-white/70">
            <p className="text-white/40 text-xs">{removeTarget?.email}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Their login is blocked. They cannot sign in again.</li>
              <li>All access is taken away at once: admin role, every checkbox, the sign-up allowlist.</li>
              <li>They leave this page and the staff pickers.</li>
              <li>Nothing they wrote is deleted. Their name stays on past messages, notes and sessions.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing} className="border-white/20 text-white bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleRemove} disabled={removing} className="bg-red-600 hover:bg-red-700">
              {removing ? "Removing…" : "Remove for good"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{linkingEmail ? "Add staff card" : "Add Staff Member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {linkingEmail && (
              <p className="text-xs text-white/50">
                This login already exists. Nothing is emailed and the password stays the same; this only gives it a card on this page.
              </p>
            )}
            <div>
              <label className="text-sm text-white/60">Full Name</label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-white/60">
                Display Name <span className="text-white/30">(optional)</span>
              </label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Short label when first names collide (e.g., Sanchez)"
                className="bg-white/10 border-white/20 text-white"
              />
              <p className="text-[10px] text-white/40 mt-1">
                Shown in lists when set. Avatar initials still use the full name.
              </p>
            </div>
            <div>
              <label className="text-sm text-white/60">NLA Email</label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@nolimitsboxingacademy.org"
                disabled={!!linkingEmail}
                className={linkingEmail ? "bg-white/5 border-white/10 text-white/40" : "bg-white/10 border-white/20 text-white"}
              />
            </div>
            <div>
              <label className="text-sm text-white/60">Job Title</label>
              <Input
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              className="border-white/20 text-white bg-transparent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={saving}
              className="bg-[#bf0f3e] hover:bg-[#a00d35]"
            >
              {linkingEmail ? (saving ? "Adding…" : "Add staff card") : (saving ? "Inviting…" : "Add & Send Invite")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/60">Full Name</label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-white/60">
                Display Name <span className="text-white/30">(optional)</span>
              </label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="Short label when first names collide (e.g., Sanchez)"
                className="bg-white/10 border-white/20 text-white"
              />
              <p className="text-[10px] text-white/40 mt-1">
                Shown in lists when set. Avatar initials still use the full name.
              </p>
            </div>
            <div>
              <label className="text-sm text-white/60">Email</label>
              <Input
                value={form.email}
                disabled
                className="bg-white/5 border-white/10 text-white/40"
              />
            </div>
            <div>
              <label className="text-sm text-white/60">Job Title</label>
              <Input
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              className="border-white/20 text-white bg-transparent"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={saving}
              className="bg-[#bf0f3e] hover:bg-[#a00d35]"
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
