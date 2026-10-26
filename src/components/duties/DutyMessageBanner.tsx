// The scrolling message under Special Projects on Daily Duties (Josh, 2026-10-26):
// "Don't forget to RESTOCK toilet paper". Bright amber, bold black, moving —
// it has to pop on the wall so the kids read it mid-clean-up. A coach changes
// it any time: Change → type → Save, on a phone or at the board (the TV asks
// for the coach code first). Clear takes it off; empty means no banner.
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Megaphone, Pencil, Plus, Check, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import CoachUnlock from "@/components/board/CoachUnlock";

const KEY = ["duty-board-message"];

export default function DutyMessageBanner({ editing, setEditing }: { editing: boolean; setEditing: (on: boolean) => void }) {
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [draft, setDraft] = useState("");

  // Every 15 seconds: a message typed on a phone shows on the wall almost at once.
  const { data: message = "" } = useQuery({
    queryKey: KEY,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from("duty_board_message" as never).select("message").eq("id", 1).maybeSingle();
      if (error) throw error;
      return ((data as { message: string } | null)?.message ?? "").trim();
    },
  });

  useEffect(() => { if (editing) setDraft(message); }, [editing, message]);

  const save = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase
        .from("duty_board_message" as never)
        .update({ message: text.trim(), updated_at: new Date().toISOString(), updated_by: user?.id ?? null } as never)
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: (_d, text) => {
      qc.setQueryData(KEY, text.trim());
      setEditing(false);
      toast.success(text.trim() ? "Message is up on the board." : "Message taken down.");
    },
    onError: () => toast.error("Couldn't save the message. Check the Wi-Fi and try again."),
  });

  // A coach changes it: signed in already (phone, or the board after the code), or the code first.
  const change = () => (isAdmin ? setEditing(true) : setUnlockOpen(true));

  const unlock = <CoachUnlock open={unlockOpen} onClose={() => setUnlockOpen(false)} onUnlocked={() => setEditing(true)} what="change the board message" />;

  if (editing) {
    return (
      <div className="rounded-2xl border-2 border-amber-400 bg-neutral-950 px-4 md:px-5 py-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); if (draft.trim() && !save.isPending) save.mutate(draft); }}
        >
          <Megaphone className="w-6 h-6 text-amber-400 shrink-0" />
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEditing(false); } }}
            placeholder="e.g. Don't forget to RESTOCK toilet paper"
            maxLength={240}
            className="flex-1 min-w-[240px] h-12 text-lg bg-black border-2 border-amber-400/60 text-white placeholder:text-white/30"
          />
          <button type="submit" disabled={!draft.trim() || save.isPending} className="h-12 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black px-5 inline-flex items-center gap-1.5 disabled:opacity-40">
            {save.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Put it up
          </button>
          {message && (
            <button type="button" disabled={save.isPending} onClick={() => save.mutate("")} className="h-12 rounded-xl border border-white/20 text-white/80 hover:bg-white/10 px-4 font-semibold">
              Take it down
            </button>
          )}
          <button type="button" onClick={() => setEditing(false)} className="h-12 w-12 rounded-xl text-white/50 hover:text-white hover:bg-white/10 inline-flex items-center justify-center" aria-label="Cancel">
            <X className="w-5 h-5" />
          </button>
        </form>
      </div>
    );
  }

  if (!message) {
    // No message: a quiet line a coach can tap. The kids barely notice it.
    return (
      <div className="px-1 py-1 flex justify-end">
        <button type="button" onClick={change} className="text-[13px] text-white/35 hover:text-amber-300 inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add a message for the crew
        </button>
        {unlock}
      </div>
    );
  }

  // The banner. Two copies of the message side by side slide left forever; the
  // second takes the first one's place, so it never jumps.
  const seconds = Math.max(14, Math.round(message.length * 0.32));
  const run = (
    <span className="inline-flex items-center gap-6 pr-16 shrink-0">
      <Megaphone className="w-9 h-9 md:w-11 md:h-11 shrink-0" strokeWidth={2.5} />
      <span>{message}</span>
    </span>
  );
  return (
    <div className="relative rounded-2xl bg-amber-400 text-black overflow-hidden shadow-[0_0_30px_rgba(251,191,36,0.25)]" role="status" aria-label={`Message: ${message}`}>
      <style>{`
        @keyframes nla-duty-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
      <div className="py-3 md:py-4 whitespace-nowrap">
        <div className="inline-flex text-3xl md:text-5xl font-black uppercase tracking-tight" style={{ animation: `nla-duty-marquee ${seconds}s linear infinite` }}>
          {run}{run}{run}{run}
        </div>
      </div>
      {/* Change it, any time — even halfway through clean-up. */}
      <button
        type="button"
        onClick={change}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl bg-black/85 hover:bg-black text-amber-300 font-bold text-sm px-3 py-2 inline-flex items-center gap-1.5 shadow-lg"
      >
        <Pencil className="w-4 h-4" /> Change
      </button>
      {unlock}
    </div>
  );
}
