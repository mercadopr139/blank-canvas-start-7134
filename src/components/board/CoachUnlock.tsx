// Coach access on a wall board.
//
// The TV is never signed in: every board works without a login, and the
// admin is out of a kid's reach. When a coach needs to change something on
// the wall -- Edit tonight, the holiday switch, the Bible topic -- they tap
// the button and type the four-digit coach code. The board signs in as the
// "Gym Board" account (a person in Staff Management) and signs itself out
// again when they press Done editing, or after fifteen minutes with nobody
// touching the screen. See src/hooks/useBoardSession.ts.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, X, Delete } from "lucide-react";
import { markBoardSession } from "@/hooks/useBoardSession";

const CODE_LENGTH = 4;

/** The code box a coach sees after tapping a coach-only button on the wall. */
const CoachUnlock = ({ open, onClose, onUnlocked, what = "edit the board" }: { open: boolean; onClose: () => void; onUnlocked?: () => void; what?: string }) => {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useEffect(() => { if (open) { setCode(""); setError(null); setBusy(false); submitting.current = false; } }, [open]);

  const submit = async (pin: string) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("board-unlock", { body: { pin } });
      if (error || !data?.access_token) throw new Error(data?.error ?? "That code isn't right.");
      const { error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (sessionError) throw sessionError;
      markBoardSession(true);
      onUnlocked?.();
      onClose();
    } catch (e) {
      setError((e as Error).message || "That code isn't right.");
      setCode("");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  };

  const press = (d: string) => {
    if (busy) return;
    const next = (code + d).slice(0, CODE_LENGTH);
    setCode(next);
    setError(null);
    if (next.length === CODE_LENGTH) submit(next);
  };
  const back = () => { if (!busy) setCode((c) => c.slice(0, -1)); };

  // A keyboard works too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === "Backspace") { e.preventDefault(); back(); }
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, code, busy]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl bg-neutral-950 border border-white/15 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><Lock className="w-4 h-4 text-amber-300" /></div>
            <div>
              <p className="font-bold text-white leading-tight">Coaches only</p>
              <p className="text-xs text-white/45">Enter the code to {what}.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* The four slots. */}
          <div className="flex justify-center gap-3" aria-label="Code">
            {Array.from({ length: CODE_LENGTH }).map((_, i) => (
              <div key={i} className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-black ${i < code.length ? "border-white/60 bg-white/10 text-white" : "border-white/20 text-white/20"}`}>
                {i < code.length ? "•" : ""}
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-rose-300 text-center">{error}</p>}
          {busy && <p className="text-sm text-white/50 text-center flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Unlocking…</p>}
          {/* A keypad, for the wall. */}
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button key={d} type="button" onClick={() => press(d)} disabled={busy}
                className="h-14 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-2xl font-bold text-white transition-all">
                {d}
              </button>
            ))}
            <div />
            <button type="button" onClick={() => press("0")} disabled={busy}
              className="h-14 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] active:scale-95 text-2xl font-bold text-white transition-all">0</button>
            <button type="button" onClick={back} disabled={busy} aria-label="Delete"
              className="h-14 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] active:scale-95 text-white/60 flex items-center justify-center transition-all">
              <Delete className="w-6 h-6" />
            </button>
          </div>
          <Button type="button" variant="ghost" onClick={onClose} className="w-full text-white/50 hover:text-white">Cancel</Button>
        </div>
      </div>
    </div>
  );
};

export default CoachUnlock;
