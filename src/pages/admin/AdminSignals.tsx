import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, CheckCircle2, Circle, Trash2, LogOut } from "lucide-react";

const PILLARS = ["Operations", "Sales & Marketing", "Finance", "Vision", "Personal"] as const;
const PRIORITY_LAYERS = ["Core", "Bonus"] as const;
const SIGNAL_KINDS = ["Outcome", "Action"] as const;
const STATUSES = ["Pending", "Complete"] as const;

type Signal = {
  id: string;
  title: string | null;
  pillar: string | null;
  priority_layer: string | null;
  signal_kind: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  signal_type: string;
  source: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
};

const PILLAR_COLORS: Record<string, string> = {
  Operations: "bg-[#bf0f3e]/20 text-[#bf0f3e] border-[#bf0f3e]/40",
  "Sales & Marketing": "bg-green-500/20 text-green-400 border-green-500/40",
  Finance: "bg-sky-300/20 text-sky-300 border-sky-300/40",
  Vision: "bg-amber-400/20 text-amber-400 border-amber-400/40",
  Personal: "bg-purple-400/20 text-purple-400 border-purple-400/40",
};

const AdminSignals = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [filterPillar, setFilterPillar] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Form state
  const [form, setForm] = useState({
    title: "",
    pillar: "" as string,
    priority_layer: "" as string,
    signal_kind: "" as string,
  });

  const today = new Date().toISOString().slice(0, 10);

  const { data: todayCoreSignals = [] } = useQuery({
    queryKey: ["signals", "today-core"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("*")
        .eq("date_assigned", today)
        .eq("priority_layer", "Core" as any)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Signal[];
    },
  });

  const { data: signals = [], isLoading } = useQuery({
    queryKey: ["signals", filterPillar, filterStatus],
    queryFn: async () => {
      let q = supabase.from("signals").select("*").order("created_at", { ascending: false });
      if (filterPillar !== "all") q = q.eq("pillar", filterPillar as any);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      const { data, error } = await q;
      if (error) throw error;
      return data as Signal[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("signals").insert({
        title: form.title,
        pillar: form.pillar || null,
        priority_layer: form.priority_layer || null,
        signal_kind: form.signal_kind || null,
        signal_type: form.signal_kind || "Action",
        status: "Pending",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      setShowAdd(false);
      setForm({ title: "", pillar: "", priority_layer: "", signal_kind: "" });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("signals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] });
      toast.success("Signal deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login", { replace: true });
  };

  const pendingCount = signals.filter((s) => s.status === "Pending").length;
  const completeCount = signals.filter((s) => s.status === "Complete").length;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")} aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">Program Director – Signals</h1>
              <p className="text-sm text-white/50">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-white/20 text-white bg-black hover:bg-black hover:text-white">
            <LogOut className="w-4 h-4 mr-2" />
            Log out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Today's Signals */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Today's Signals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Core 3 */}
            <Card className="bg-white/5 border-2 border-amber-400/40 text-white">
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-amber-400 mb-3">Core 3</h3>
                <div className="space-y-2">
                  {todayCoreSignals.length === 0 ? (
                    <>
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5">
                          <Circle className="w-5 h-5 text-white/20 shrink-0" />
                          <span className="text-white/30 text-sm italic">No signals yet</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    todayCoreSignals.map((signal) => (
                      <div key={signal.id} className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5">
                        <button
                          onClick={() => toggleStatus.mutate({ id: signal.id, current: signal.status })}
                          className="shrink-0"
                          aria-label="Toggle status"
                        >
                          {signal.status === "Complete" ? (
                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-white/30 hover:text-white/60" />
                          )}
                        </button>
                        <span className={`text-sm ${signal.status === "Complete" ? "line-through text-white/40" : "text-white"}`}>
                          {signal.title || "(Untitled)"}
                        </span>
                        {signal.pillar && (
                          <Badge variant="outline" className={`text-[10px] ml-auto ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>
                            {signal.pillar}
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bonus */}
            <Card className="bg-white/5 border border-white/10 text-white">
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-white/60 mb-3">Bonus</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5">
                    <Circle className="w-5 h-5 text-white/20 shrink-0" />
                    <span className="text-white/30 text-sm italic">No signals yet</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-6">
          <Card className="bg-white/5 border-white/10 text-white flex-1">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-amber-400">{pendingCount}</p>
              <p className="text-sm text-white/50">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white flex-1">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{completeCount}</p>
              <p className="text-sm text-white/50">Complete</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters + Add */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={filterPillar} onValueChange={setFilterPillar}>
            <SelectTrigger className="w-[180px] bg-white/5 border-white/20 text-white">
              <SelectValue placeholder="All Pillars" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/20 z-[200]">
              <SelectItem value="all" className="text-black">All Pillars</SelectItem>
              {PILLARS.map((p) => (
                <SelectItem key={p} value={p} className="text-black">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] bg-white/5 border-white/20 text-white">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-white/20 z-[200]">
              <SelectItem value="all" className="text-black">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-black">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={() => setShowAdd(true)} className="ml-auto bg-white text-black hover:bg-white/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Signal
          </Button>
        </div>

        {/* Signal List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        ) : signals.length === 0 ? (
          <div className="text-center py-16 text-white/40">
            <p className="text-lg">No signals yet. Add your first one!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {signals.map((signal) => (
              <div
                key={signal.id}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                  signal.status === "Complete"
                    ? "bg-white/[0.02] border-white/5 opacity-60"
                    : "bg-white/5 border-white/10"
                }`}
              >
                {/* Toggle status */}
                <button
                  onClick={() => toggleStatus.mutate({ id: signal.id, current: signal.status })}
                  className="shrink-0"
                  aria-label="Toggle status"
                >
                  {signal.status === "Complete" ? (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  ) : (
                    <Circle className="w-6 h-6 text-white/30 hover:text-white/60" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${signal.status === "Complete" ? "line-through text-white/50" : "text-white"}`}>
                    {signal.title || "(Untitled)"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {signal.pillar && (
                      <Badge variant="outline" className={`text-xs ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>
                        {signal.pillar}
                      </Badge>
                    )}
                    {signal.priority_layer && (
                      <Badge variant="outline" className={`text-xs ${signal.priority_layer === "Core" ? "border-amber-400/40 text-amber-400" : "border-white/20 text-white/40"}`}>
                        {signal.priority_layer}
                      </Badge>
                    )}
                    {signal.signal_kind && (
                      <Badge variant="outline" className="text-xs border-white/20 text-white/40">
                        {signal.signal_kind}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => deleteMutation.mutate(signal.id)}
                  className="shrink-0 text-white/20 hover:text-red-400 transition-colors"
                  aria-label="Delete signal"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Signal Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-zinc-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Add Signal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="bg-white/5 border-white/20 text-white"
                placeholder="What's the signal?"
              />
            </div>
            <div>
              <Label>Pillar</Label>
              <Select value={form.pillar} onValueChange={(v) => setForm({ ...form, pillar: v })}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Select pillar" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/20 z-[200]">
                  {PILLARS.map((p) => (
                    <SelectItem key={p} value={p} className="text-black">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority Layer</Label>
              <Select value={form.priority_layer} onValueChange={(v) => setForm({ ...form, priority_layer: v })}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Core or Bonus" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/20 z-[200]">
                  {PRIORITY_LAYERS.map((p) => (
                    <SelectItem key={p} value={p} className="text-black">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Signal Kind</Label>
              <Select value={form.signal_kind} onValueChange={(v) => setForm({ ...form, signal_kind: v })}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Outcome or Action" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/20 z-[200]">
                  {SIGNAL_KINDS.map((k) => (
                    <SelectItem key={k} value={k} className="text-black">{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)} className="text-white/60">Cancel</Button>
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
    </div>
  );
};

export default AdminSignals;
