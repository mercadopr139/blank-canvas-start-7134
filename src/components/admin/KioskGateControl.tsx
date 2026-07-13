import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, ShieldOff, Clock } from "lucide-react";
import { toast } from "sonner";
import { getCurrentAttendanceYear, nextProgramYear, shortProgramYear } from "@/lib/programYear";

type Settings = { enforce_current_year_from: string | null };

// The upcoming program year's Sept 1 — the natural moment to switch on.
const upcoming = nextProgramYear(getCurrentAttendanceYear());
const defaultStart = `${parseInt(upcoming.slice(0, 4), 10)}-09-01`;
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function KioskGateControl() {
  const qc = useQueryClient();
  const [customDate, setCustomDate] = useState(defaultStart);
  const [pending, setPending] = useState<{ date: string | null } | null>(null);

  const { data } = useQuery({
    queryKey: ["kiosk-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kiosk_settings" as never).select("enforce_current_year_from").limit(1).maybeSingle();
      if (error) throw error;
      return (data as unknown as Settings) || { enforce_current_year_from: null };
    },
  });

  const save = useMutation({
    mutationFn: async (date: string | null) => {
      const { error } = await supabase
        .from("kiosk_settings" as never)
        .update({ enforce_current_year_from: date, updated_at: new Date().toISOString() } as never)
        .eq("id", true as never);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kiosk-settings"] }); toast.success("Kiosk gate updated"); setPending(null); },
    onError: (e: any) => toast.error("Couldn't update: " + (e?.message || "unknown error")),
  });

  const val = data?.enforce_current_year_from ?? null;
  const active = !!val && val <= todayStr();
  const scheduled = !!val && val > todayStr();

  const status = active
    ? { icon: ShieldCheck, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30", label: "ON — active now", sub: `Only ${shortProgramYear(getCurrentAttendanceYear())} youth can check in.` }
    : scheduled
    ? { icon: Clock, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/30", label: `Scheduled for ${val}`, sub: `Turns on automatically that day. Until then, check-in is unchanged.` }
    : { icon: ShieldOff, color: "text-white/50", bg: "bg-white/5 border-white/10", label: "OFF", sub: "Every registered youth can check in (current behavior)." };

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";

  return (
    <div className={`rounded-xl border p-4 ${status.bg}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <status.icon className={`w-5 h-5 mt-0.5 ${status.color}`} />
          <div>
            <p className="text-sm font-semibold text-white">Kiosk Check-In Gate <span className={`ml-1 ${status.color}`}>· {status.label}</span></p>
            <p className="text-white/50 text-xs mt-0.5">{status.sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!active && !scheduled && (
            <>
              <Input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className="h-8 w-40 bg-white/5 border-white/15 text-white text-xs" />
              <Button size="sm" onClick={() => setPending({ date: customDate })} className="bg-[#CC0000] hover:bg-[#CC0000]/80 text-white h-8">
                Schedule gate
              </Button>
            </>
          )}
          {(active || scheduled) && (
            <Button size="sm" variant="outline" onClick={() => setPending({ date: null })} className="border-white/20 text-white hover:bg-white/10 h-8">
              Turn off
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.date === null ? "Turn the kiosk gate OFF?" : "Schedule the kiosk gate?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.date === null ? (
                <>Every registered youth will be able to check in again, regardless of program year. You can re-schedule it anytime.</>
              ) : pending && pending.date <= todayStr() ? (
                <><strong>This takes effect immediately.</strong> Only youth registered for {shortProgramYear(getCurrentAttendanceYear())} will be able to check in at all three kiosks. Anyone who hasn't re-registered will not be found.</>
              ) : (
                <>On <strong>{fmtDate(pending?.date ?? null)}</strong>, the three kiosks will automatically start requiring current-year registration. Nothing changes before that date.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => save.mutate(pending?.date ?? null)}
              className={pending?.date === null ? "" : "bg-[#CC0000] hover:bg-[#CC0000]/80 text-white"}
            >
              {pending?.date === null ? "Turn off" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
