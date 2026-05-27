import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";
import { taskManagerPermKey, type PillarSub } from "@/lib/permissions";
import {
  OPERATIONS_TILES,
  SALES_MARKETING_TILES,
  FINANCE_TILES,
  pillarSubsFromTiles,
} from "@/config/pillarTiles";

// Sub-permission groups for Operations / Sales / Finance — derived directly
// from the same tile configs the pillar pages render. Adding a tile with a
// permKey there automatically gives it a checkbox here. No registry to keep
// in sync.
const OPERATIONS_SUBS: PillarSub[] = pillarSubsFromTiles(OPERATIONS_TILES);
const SALES_MARKETING_SUBS: PillarSub[] = pillarSubsFromTiles(SALES_MARKETING_TILES);
const FINANCE_SUBS: PillarSub[] = pillarSubsFromTiles(FINANCE_TILES);
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
import { ArrowLeft, Plus, Shield, UserCog, Pencil, ShieldCheck } from "lucide-react";

const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";

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
}

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
  const { canAccessSettings, isSuperAdmin, loading: permLoading } = useStaffPermissions();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffPerms, setStaffPerms] = useState<Record<string, StaffPerms>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({ full_name: "", display_name: "", email: "", job_title: "" });
  const [saving, setSaving] = useState(false);

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
    if (!permLoading && !canAccessSettings()) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [permLoading, canAccessSettings, navigate]);

  const fetchStaff = async () => {
    const { data: profiles } = await supabase
      .from("staff_profiles")
      .select("*")
      .order("full_name");
    if (profiles) {
      setStaff(profiles as StaffMember[]);
      const userIds = profiles.map((p: any) => p.user_id);
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

      toast({ title: res.data?.message || "Staff member added successfully" });
      setAddOpen(false);
      setForm({ full_name: "", display_name: "", email: "", job_title: "" });
      fetchStaff();
    } catch {
      toast({ title: "An error occurred", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    await supabase
      .from("staff_profiles")
      .update({
        full_name: form.full_name.trim(),
        display_name: form.display_name.trim() || null,
        job_title: form.job_title.trim(),
      })
      .eq("id", editTarget.id);
    toast({ title: "Staff member updated" });
    setEditTarget(null);
    fetchStaff();
    setSaving(false);
  };

  const toggleStatus = async (member: StaffMember) => {
    const newStatus = member.status === "active" ? "inactive" : "active";
    await supabase.from("staff_profiles").update({ status: newStatus }).eq("id", member.id);
    toast({ title: `Staff member ${newStatus === "active" ? "activated" : "deactivated"}` });
    fetchStaff();
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
    if (!error) {
      setStaffPerms((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], [key]: value },
      }));
    }
  };

  // Toggle a parent pillar checkbox. When the parent is being unchecked,
  // also revoke every sub-permission for that pillar so there's no
  // orphaned "I'm checked but my parent isn't" state. Re-checking the
  // parent leaves sub-permissions where they are (admin re-grants what
  // they want).
  const togglePillar = async (
    userId: string,
    parentKey: string,
    subs: PillarSub[],
    next: boolean
  ) => {
    await setPermission(userId, parentKey, next);
    if (!next) {
      await Promise.all(
        subs.map((s) => {
          if (staffPerms[userId]?.[s.key]) {
            return setPermission(userId, s.key, false);
          }
          return Promise.resolve();
        })
      );
    }
  };

  // Building blocks — render a single checkbox row. When `superAdminMode`
  // is on (the card belongs to the super-admin), every box renders checked
  // and disabled so the UI matches reality (super-admin bypasses all gates
  // at runtime regardless of staff_permissions rows).
  const Check = ({
    userId,
    permKey,
    label,
    indent = false,
    disabled = false,
    superAdminMode = false,
  }: {
    userId: string;
    permKey: string;
    label: string;
    indent?: boolean;
    disabled?: boolean;
    superAdminMode?: boolean;
  }) => {
    const checked = superAdminMode ? true : (staffPerms[userId]?.[permKey] ?? false);
    const isDisabled = disabled || superAdminMode;
    return (
      <label
        className={`flex items-center gap-2 text-sm ${
          indent ? "ml-6" : ""
        } ${isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => !superAdminMode && setPermission(userId, permKey, !!v)}
          disabled={isDisabled}
        />
        <span className={indent ? "text-white/70 text-[13px]" : ""}>{label}</span>
      </label>
    );
  };

  // Pillar block — parent checkbox + indented sub-checkboxes. Sub-checkboxes
  // appear when the parent is granted, OR when this is the super-admin's
  // card (where everything renders as on).
  const Pillar = ({
    userId,
    parentKey,
    parentLabel,
    subs,
    superAdminMode = false,
  }: {
    userId: string;
    parentKey: string;
    parentLabel: string;
    subs: PillarSub[];
    superAdminMode?: boolean;
  }) => {
    const parentOn = superAdminMode ? true : (staffPerms[userId]?.[parentKey] ?? false);
    return (
      <div className="space-y-1.5">
        <label className={`flex items-center gap-2 text-sm font-medium ${superAdminMode ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
          <Checkbox
            checked={parentOn}
            onCheckedChange={(v) => !superAdminMode && togglePillar(userId, parentKey, subs, !!v)}
            disabled={superAdminMode}
          />
          {parentLabel}
        </label>
        {parentOn && (
          <div className="space-y-1.5">
            {subs.map((s) => (
              <Check
                key={s.key}
                userId={userId}
                permKey={s.key}
                label={s.label}
                indent
                superAdminMode={superAdminMode}
              />
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
          <Button
            onClick={() => {
              setForm({ full_name: "", display_name: "", email: "", job_title: "" });
              setAddOpen(true);
            }}
            className="bg-[#bf0f3e] hover:bg-[#a00d35]"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Staff
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {staff.length === 0 ? (
          <p className="text-center text-white/40 mt-12">
            No staff members yet. Click "Add Staff" to get started.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {staff.map((member) => {
              const isMemberSuperAdmin =
                member.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
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
                      </div>
                      <p className="text-sm text-white/50">{member.job_title}</p>
                      <p className="text-xs text-white/30 mt-1">{member.email}</p>
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
                    </div>
                  </div>
                </CardHeader>
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

                    <div className="space-y-4">
                      {/* Task managers — one row per task_managers entry */}
                      {taskManagerChecks.length > 0 && (
                        <div className="space-y-1.5">
                          {taskManagerChecks.map((tm) => (
                            <Check
                              key={tm.permKey}
                              userId={member.user_id}
                              permKey={tm.permKey}
                              label={tm.label}
                              superAdminMode={isMemberSuperAdmin}
                            />
                          ))}
                        </div>
                      )}

                      {/* Pillars with grouped sub-permissions */}
                      <Pillar
                        userId={member.user_id}
                        parentKey="operations"
                        parentLabel="Operations"
                        subs={OPERATIONS_SUBS}
                        superAdminMode={isMemberSuperAdmin}
                      />
                      <Pillar
                        userId={member.user_id}
                        parentKey="sales_marketing"
                        parentLabel="Sales & Marketing"
                        subs={SALES_MARKETING_SUBS}
                        superAdminMode={isMemberSuperAdmin}
                      />
                      <Pillar
                        userId={member.user_id}
                        parentKey="finance"
                        parentLabel="Finance"
                        subs={FINANCE_SUBS}
                        superAdminMode={isMemberSuperAdmin}
                      />

                      {/* Settings — super-admin gated for granting */}
                      <Check
                        userId={member.user_id}
                        permKey="settings"
                        label="Settings"
                        disabled={!isSuperAdmin}
                        superAdminMode={isMemberSuperAdmin}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
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
              </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-[#1a1a2e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
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
              <label className="text-sm text-white/60">NLA Email</label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@nolimitsboxingacademy.org"
                className="bg-white/10 border-white/20 text-white"
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
              {saving ? "Inviting…" : "Add & Send Invite"}
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
