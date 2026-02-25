import { useState } from "react";
import nlaLogo from "@/assets/nla-logo-white.png";
import DailyVerse from "@/components/admin/DailyVerse";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Plus, CheckCircle2, Circle, LogOut, Archive, ArrowRight, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  const [selectedForArchive, setSelectedForArchive] = useState<Set<string>>(new Set());
  // Form state
  const [form, setForm] = useState({
    title: "",
    pillar: "" as string,
    priority_layer: "" as string,
    signal_kind: "" as string,
    bucket: "core" as "ondeck" | "core" | "bonus",
  });

  const today = format(new Date(), "yyyy-MM-dd");

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
        .order("created_at", { ascending: false });
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

  const allToday = [...todayCoreSignals, ...todayBonusSignals];
  const pendingCount = allToday.filter((s) => s.status === "Pending").length;
  const completeCount = allToday.filter((s) => s.status === "Complete").length;

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
        {/* Day Won Banner */}
        {todayCoreSignals.length + todayBonusSignals.length > 0 &&
          todayCoreSignals.every(s => s.status === "Complete") &&
          todayBonusSignals.every(s => s.status === "Complete") && (
          <p className="text-center text-2xl font-bold text-amber-400 mb-6 tracking-wide" style={{ textShadow: "0 0 20px rgba(251,191,36,0.4)" }}>
            Day Won.
          </p>
        )}
        {/* Scoreboard */}
        <p className="text-sm text-white/50 mb-4">
          Remaining today: <span className="text-amber-400 font-semibold">{todayCoreSignals.filter(s => s.status === "Pending").length + todayBonusSignals.filter(s => s.status === "Pending").length}</span>
        </p>

        {/* Carryover */}
        {carryoverSignals.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-red-400 mb-3">Carryover</h2>
            <Card className="bg-white/5 border border-red-400/30 text-white">
              <CardContent className="p-5">
                <div className="space-y-2">
                  {carryoverSignals.map((signal) => (
                    <div key={signal.id} className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5">
                      <button
                        onClick={() => toggleStatus.mutate({ id: signal.id, current: signal.status })}
                        className="shrink-0"
                        aria-label="Toggle status"
                      >
                        {signal.status === "Complete" ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-red-400/60 hover:text-red-400" />
                        )}
                      </button>
                      <span className={`text-sm ${signal.status === "Complete" ? "line-through text-white/40" : "text-white"}`}>{signal.title || "(Untitled)"}</span>
                      <span className="text-[10px] text-white/20 shrink-0">{formatCreatedDate(signal.created_at)}</span>
                      <span className="text-[10px] text-white/30 ml-auto">{signal.date_assigned}</span>
                      {signal.pillar && (
                        <Badge variant="outline" className={`text-[10px] ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>
                          {signal.pillar}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Today's Signals */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Today's Signals</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Core 3 */}
            <Card className="bg-white/5 border-2 border-rose-500/40 text-white">
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-rose-500 mb-3">Core 3</h3>
                <div className="space-y-2">
                  {todayCoreSignals.filter(s => s.status === "Pending").length === 0 && todayCoreSignals.filter(s => s.status === "Complete").length === 0 ? (
                    <>
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5">
                          <Circle className="w-5 h-5 text-white/20 shrink-0" />
                          <span className="text-white/30 text-sm italic">No signals yet</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {todayCoreSignals.filter(s => s.status === "Pending").map((signal) => (
                        <div key={signal.id} className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5">
                          <button onClick={() => toggleStatus.mutate({ id: signal.id, current: signal.status })} className="shrink-0" aria-label="Toggle status">
                            <Circle className="w-5 h-5 text-white/30 hover:text-white/60" />
                          </button>
                          <span className="text-sm text-white">{signal.title || "(Untitled)"}</span>
                          <span className="text-[10px] text-white/20 shrink-0">{formatCreatedDate(signal.created_at)}</span>
                          {signal.pillar && (
                            <Badge variant="outline" className={`text-[10px] ml-auto ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>{signal.pillar}</Badge>
                          )}
                        </div>
                      ))}
                      {todayCoreSignals.filter(s => s.status === "Complete").length > 0 && (
                        <>
                          <p className="text-[10px] uppercase tracking-wider text-white/30 mt-3 mb-1">Completed (ready to archive)</p>
                          {todayCoreSignals.filter(s => s.status === "Complete").map((signal) => (
                            <div key={signal.id} className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5 opacity-50">
                              <Checkbox
                                checked={selectedForArchive.has(signal.id)}
                                onCheckedChange={() => toggleSelected(signal.id)}
                                className="shrink-0 border-white/30 data-[state=checked]:bg-rose-500 data-[state=checked]:border-rose-500"
                              />
                              <button onClick={() => toggleStatus.mutate({ id: signal.id, current: signal.status })} className="shrink-0" aria-label="Toggle status">
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                              </button>
                              <span className="text-sm line-through text-white/40">{signal.title || "(Untitled)"}</span>
                              {signal.pillar && (
                                <Badge variant="outline" className={`text-[10px] ml-auto ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>{signal.pillar}</Badge>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bonus */}
            <Card className="bg-white/5 border border-white/10 text-white">
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-white/60 mb-3">Bonus</h3>
                <div className="space-y-2">
                  {todayBonusSignals.length === 0 ? (
                    <div className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5">
                      <Circle className="w-5 h-5 text-white/20 shrink-0" />
                      <span className="text-white/30 text-sm italic">No signals yet</span>
                    </div>
                  ) : (
                    <>
                      {todayBonusSignals.filter(s => s.status === "Pending").map((signal) => (
                        <div key={signal.id} className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5">
                          <button onClick={() => toggleStatus.mutate({ id: signal.id, current: signal.status })} className="shrink-0" aria-label="Toggle status">
                            <Circle className="w-5 h-5 text-white/30 hover:text-white/60" />
                          </button>
                          <span className="text-sm text-white">{signal.title || "(Untitled)"}</span>
                          <span className="text-[10px] text-white/20 shrink-0">{formatCreatedDate(signal.created_at)}</span>
                          {signal.pillar && (
                            <Badge variant="outline" className={`text-[10px] ml-auto ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>{signal.pillar}</Badge>
                          )}
                        </div>
                      ))}
                      {todayBonusSignals.filter(s => s.status === "Complete").length > 0 && (
                        <>
                          <p className="text-[10px] uppercase tracking-wider text-white/30 mt-3 mb-1">Completed (ready to archive)</p>
                          {todayBonusSignals.filter(s => s.status === "Complete").map((signal) => (
                            <div key={signal.id} className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5 opacity-50">
                              <Checkbox
                                checked={selectedForArchive.has(signal.id)}
                                onCheckedChange={() => toggleSelected(signal.id)}
                                className="shrink-0 border-white/30 data-[state=checked]:bg-rose-500 data-[state=checked]:border-rose-500"
                              />
                              <button onClick={() => toggleStatus.mutate({ id: signal.id, current: signal.status })} className="shrink-0" aria-label="Toggle status">
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                              </button>
                              <span className="text-sm line-through text-white/40">{signal.title || "(Untitled)"}</span>
                              {signal.pillar && (
                                <Badge variant="outline" className={`text-[10px] ml-auto ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>{signal.pillar}</Badge>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Archive actions */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          {selectedForArchive.size > 0 && (
            <Button
              variant="outline"
              onClick={() => archiveSelectedMutation.mutate(Array.from(selectedForArchive))}
              className="border-amber-400/40 text-amber-400 hover:text-amber-300 bg-transparent hover:bg-amber-400/10"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive selected ({selectedForArchive.size})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowArchiveConfirm(true)}
            className="border-white/20 text-white/60 hover:text-white bg-transparent hover:bg-white/5"
          >
            <Archive className="w-4 h-4 mr-2" />
            Archive completed
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/signals/archive")}
            className="text-white/40 hover:text-white/70"
          >
            View Archive →
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/signals/trash")}
            className="text-white/40 hover:text-white/70"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Trash
          </Button>
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

        {/* Add Signal Button */}
        <div className="flex justify-end mb-6">
          <Button onClick={() => setShowAdd(true)} className="bg-white text-black hover:bg-white/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Signal
          </Button>
        </div>

        {/* Visual divider with NLA logo */}
        <div className="flex flex-col items-center justify-center my-10 gap-4">
          <DailyVerse />
          <a href="/admin/dashboard" className="cursor-pointer">
            <img src={nlaLogo} alt="NLA" className="h-24" />
          </a>
        </div>

        {/* On Deck */}
        {onDeckSignals.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white/40 mb-3">On Deck <span className="text-sm font-normal text-white/30">({onDeckSignals.length})</span></h2>
            <Card className="bg-white/5 border border-white/10 text-white">
              <CardContent className="p-5">
                <div className="space-y-2">
                  {onDeckSignals.map((signal) => (
                    <div key={signal.id} className="flex items-center gap-3 p-3 rounded-md bg-white/[0.03] border border-white/5">
                      <span className="text-sm text-white/60 flex-1">{signal.title || "(Untitled)"}</span>
                      <span className="text-[10px] text-white/20 shrink-0">{formatCreatedDate(signal.created_at)}</span>
                      {signal.pillar && (
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${PILLAR_COLORS[signal.pillar] || "border-white/20 text-white/60"}`}>
                          {signal.pillar}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-transparent border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 shrink-0"
                        onClick={() => scheduleMutation.mutate({ id: signal.id, priority: "Core" })}
                        disabled={scheduleMutation.isPending}
                      >
                        Core 3 <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs bg-transparent border-white/20 text-white/50 hover:bg-white/5 hover:text-white/70 shrink-0"
                        onClick={() => scheduleMutation.mutate({ id: signal.id, priority: "Bonus" })}
                        disabled={scheduleMutation.isPending}
                      >
                        Bonus <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent className="bg-zinc-900 border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive all completed, unarchived signals?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              This will archive all signals with status "Complete" that haven't been archived yet. Pending items will not be affected.
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
        <DialogContent className="bg-zinc-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Add Signal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bucket *</Label>
              <Select value={form.bucket} onValueChange={(v: "ondeck" | "core" | "bonus") => setForm({ ...form, bucket: v })}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Select bucket" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/20 z-[200]">
                  <SelectItem value="ondeck" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">On Deck</SelectItem>
                  <SelectItem value="core" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Core 3 (Today)</SelectItem>
                  <SelectItem value="bonus" className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">Bonus (Today)</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                    <SelectItem key={p} value={p} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">{p}</SelectItem>
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
                    <SelectItem key={k} value={k} className="text-white hover:bg-white/10 focus:bg-white/10 focus:text-white">{k}</SelectItem>
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
