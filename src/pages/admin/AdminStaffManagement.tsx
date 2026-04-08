import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffPermissions, PERMISSION_KEYS, PERMISSION_LABELS, type PermissionKey } from "@/hooks/useStaffPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Shield, UserCog, Pencil } from "lucide-react";

const SUPER_ADMIN_EMAIL = "joshmercado@nolimitsboxingacademy.org";

interface StaffMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  job_title: string;
  status: string;
}

interface StaffPerms {
  [key: string]: boolean;
}

export default function AdminStaffManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canAccessSettings, isSuperAdmin, loading: permLoading } = useStaffPermissions();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffPerms, setStaffPerms] = useState<Record<string, StaffPerms>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", job_title: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!permLoading && !canAccessSettings()) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [permLoading, canAccessSettings]);

  const fetchStaff = async () => {
    const { data: profiles } = await supabase.from("staff_profiles").select("*").order("full_name");
    if (profiles) {
      setStaff(profiles as StaffMember[]);
      // Fetch permissions for all staff
      const userIds = profiles.map((p: any) => p.user_id);
      if (userIds.length > 0) {
        const { data: perms } = await supabase
          .from("staff_permissions")
          .select("user_id, permission_key, granted")
          .in("user_id", userIds);
        const mapped: Record<string, StaffPerms> = {};
        profiles.forEach((p: any) => {
          mapped[p.user_id] = {};
          PERMISSION_KEYS.forEach((k) => (mapped[p.user_id][k] = false));
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
        setForm({ full_name: "", email: "", job_title: "" });
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
      setForm({ full_name: "", email: "", job_title: "" });
      fetchStaff();
    } catch (err) {
      toast({ title: "An error occurred", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    await supabase
      .from("staff_profiles")
      .update({ full_name: form.full_name.trim(), job_title: form.job_title.trim() })
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

  const togglePermission = async (userId: string, key: string, current: boolean) => {
    if (key === "settings" && !isSuperAdmin) {
      toast({ title: "Only the super admin can grant Settings permission", variant: "destructive" });
      return;
    }

    const newVal = !current;
    const { error } = await supabase
      .from("staff_permissions")
      .upsert({ user_id: userId, permission_key: key, granted: newVal }, { onConflict: "user_id,permission_key" });

    if (!error) {
      setStaffPerms((prev) => ({
        ...prev,
        [userId]: { ...prev[userId], [key]: newVal },
      }));
    }
  };

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
          <Button onClick={() => { setForm({ full_name: "", email: "", job_title: "" }); setAddOpen(true); }} className="bg-[#bf0f3e] hover:bg-[#a00d35]">
            <Plus className="w-4 h-4 mr-2" /> Add Staff
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {staff.length === 0 ? (
          <p className="text-center text-white/40 mt-12">No staff members yet. Click "Add Staff" to get started.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {staff.map((member) => (
              <Card key={member.id} className={`bg-white/5 border-white/10 text-white ${member.status === "inactive" ? "opacity-50" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg text-white">{member.full_name}</CardTitle>
                      <p className="text-sm text-white/50">{member.job_title}</p>
                      <p className="text-xs text-white/30 mt-1">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${member.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {member.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditTarget(member);
                          setForm({ full_name: member.full_name, email: member.email, job_title: member.job_title });
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-xs text-white/40 mb-2 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Permissions
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {PERMISSION_KEYS.map((key) => {
                        const isSettingsPerm = key === "settings";
                        const disabled = isSettingsPerm && !isSuperAdmin;
                        return (
                          <label
                            key={key}
                            className={`flex items-center gap-2 text-sm ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            <Checkbox
                              checked={staffPerms[member.user_id]?.[key] ?? false}
                              onCheckedChange={() => togglePermission(member.user_id, key, staffPerms[member.user_id]?.[key] ?? false)}
                              disabled={disabled}
                            />
                            {PERMISSION_LABELS[key]}
                          </label>
                        );
                      })}
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
            ))}
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
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="bg-white/10 border-white/20 text-white" />
            </div>
            <div>
              <label className="text-sm text-white/60">NLA Email</label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@nolimitsboxingacademy.org" className="bg-white/10 border-white/20 text-white" />
            </div>
            <div>
              <label className="text-sm text-white/60">Job Title</label>
              <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} className="bg-white/10 border-white/20 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} className="border-white/20 text-white bg-transparent">Cancel</Button>
            <Button onClick={handleAdd} disabled={saving} className="bg-[#bf0f3e] hover:bg-[#a00d35]">
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
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="bg-white/10 border-white/20 text-white" />
            </div>
            <div>
              <label className="text-sm text-white/60">Email</label>
              <Input value={form.email} disabled className="bg-white/5 border-white/10 text-white/40" />
            </div>
            <div>
              <label className="text-sm text-white/60">Job Title</label>
              <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} className="bg-white/10 border-white/20 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} className="border-white/20 text-white bg-transparent">Cancel</Button>
            <Button onClick={handleEdit} disabled={saving} className="bg-[#bf0f3e] hover:bg-[#a00d35]">
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
