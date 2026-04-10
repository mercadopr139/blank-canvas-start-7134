import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Incident {
  id: string;
  description: string;
  recorded_at: string;
  status: string;
  incident_type: string;
  driver_name: string | null;
  youth_first: string | null;
  youth_last: string | null;
  run_id: string | null;
}

const statusColors: Record<string, string> = {
  new: "bg-red-500/20 text-red-400 border-red-500/30",
  reviewed: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function TransportIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchIncidents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("incidents")
      .select("id, description, recorded_at, status, incident_type, run_id, driver_id, youth_id, drivers(name), youth_profiles(first_name, last_name)")
      .order("recorded_at", { ascending: false });

    if (error) {
      console.error(error);
      toast({ title: "Failed to load incidents", variant: "destructive" });
    } else {
      setIncidents(
        (data || []).map((r: any) => ({
          id: r.id,
          description: r.description,
          recorded_at: r.recorded_at,
          status: r.status || "new",
          incident_type: r.incident_type || "General",
          driver_name: r.drivers?.name || null,
          youth_first: r.youth_profiles?.first_name || null,
          youth_last: r.youth_profiles?.last_name || null,
          run_id: r.run_id,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from("incidents")
      .update({ status: newStatus } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
    } else {
      toast({ title: `Status updated to ${newStatus}` });
      setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)));
      if (selected?.id === id) setSelected((s) => (s ? { ...s, status: newStatus } : null));
    }
    setUpdating(false);
  };

  const newCount = incidents.filter((i) => i.status === "new").length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
          <h1 className="text-white text-xl font-bold">Incident Reports</h1>
          {newCount > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs">
              {newCount} New
            </Badge>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
        </div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No incidents reported</p>
          <p className="text-sm mt-1">Incidents submitted by drivers will appear here.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => setSelected(inc)}
                className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 active:bg-white/10 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white/50 text-xs">
                    {format(new Date(inc.recorded_at), "MMM d, yyyy · h:mm a")}
                  </span>
                  <Badge className={`text-[10px] border ${statusColors[inc.status]}`}>
                    {inc.status.charAt(0).toUpperCase() + inc.status.slice(1)}
                  </Badge>
                </div>
                <p className="text-white font-medium text-sm truncate">{inc.description}</p>
                <div className="flex items-center gap-3 text-xs text-white/40">
                  {inc.driver_name && <span>Driver: {inc.driver_name}</span>}
                  {inc.youth_first && <span>Youth: {inc.youth_first} {inc.youth_last}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/50 text-left">
                  <th className="py-3 px-3 font-medium">Date</th>
                  <th className="py-3 px-3 font-medium">Driver</th>
                  <th className="py-3 px-3 font-medium">Youth</th>
                  <th className="py-3 px-3 font-medium">Type</th>
                  <th className="py-3 px-3 font-medium">Description</th>
                  <th className="py-3 px-3 font-medium">Status</th>
                  <th className="py-3 px-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-3 text-white/70 whitespace-nowrap">
                      {format(new Date(inc.recorded_at), "MMM d, yyyy")}
                    </td>
                    <td className="py-3 px-3 text-white">{inc.driver_name || "—"}</td>
                    <td className="py-3 px-3 text-white">
                      {inc.youth_first ? `${inc.youth_first} ${inc.youth_last}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-white/70">{inc.incident_type}</td>
                    <td className="py-3 px-3 text-white/60 max-w-xs truncate">{inc.description}</td>
                    <td className="py-3 px-3">
                      <Badge className={`text-[10px] border ${statusColors[inc.status]}`}>
                        {inc.status.charAt(0).toUpperCase() + inc.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(inc)}
                        className="text-white/50 hover:text-white gap-1.5"
                      >
                        <Eye className="w-4 h-4" /> View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="bg-[#111827] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
              Incident Details
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-white/40 text-xs mb-1">Date</p>
                  <p className="text-white">{format(new Date(selected.recorded_at), "MMM d, yyyy · h:mm a")}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs mb-1">Type</p>
                  <p className="text-white">{selected.incident_type}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs mb-1">Driver</p>
                  <p className="text-white">{selected.driver_name || "—"}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs mb-1">Youth</p>
                  <p className="text-white">
                    {selected.youth_first ? `${selected.youth_first} ${selected.youth_last}` : "—"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-white/40 text-xs mb-1">Description</p>
                <p className="text-white text-sm bg-white/5 border border-white/10 rounded-lg p-3">
                  {selected.description}
                </p>
              </div>
              <div>
                <p className="text-white/40 text-xs mb-2">Update Status</p>
                <Select
                  value={selected.status}
                  onValueChange={(v) => updateStatus(selected.id, v)}
                  disabled={updating}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function useIncidentCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const { count: c } = await supabase
        .from("incidents")
        .select("*", { count: "exact", head: true })
        .eq("status", "new" as any);
      setCount(c || 0);
    };
    fetch();
  }, []);

  return count;
}
