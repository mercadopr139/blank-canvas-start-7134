// Coach access on a wall board.
//
// The TV is never signed in: every board works without a login, and the
// admin is out of a kid's reach. When a coach needs to change something on
// the wall -- Edit tonight, the holiday switch, the Bible topic -- they tap
// the button, sign in right there, make the change, and the board signs
// itself out again: when they press Done editing, or after fifteen minutes
// with nobody touching the screen. A session started this way is marked as a
// "board session", so a coach's own phone, signed in through the admin, is
// never signed out from under them.
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Lock, X } from "lucide-react";
import { markBoardSession } from "@/hooks/useBoardSession";

/** The sign-in box a coach sees after tapping a coach-only button on the wall. */
const CoachUnlock = ({ open, onClose, onUnlocked, what = "edit the board" }: { open: boolean; onClose: () => void; onUnlocked?: () => void; what?: string }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setPassword(""); setError(null); } }, [open]);
  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) { setError("That didn't work. Check the email and password."); return; }
    markBoardSession(true);
    onUnlocked?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-neutral-950 border border-white/15 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><Lock className="w-4 h-4 text-amber-300" /></div>
            <div>
              <p className="font-bold text-white leading-tight">Coaches only</p>
              <p className="text-xs text-white/45">Sign in to {what}. The board signs out by itself when you're done.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Coach email" autoFocus
            className="h-11 bg-neutral-900 border-neutral-700 text-white" />
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
            className="h-11 bg-neutral-900 border-neutral-700 text-white" />
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <Button type="submit" disabled={busy || !email.trim() || !password} className="w-full h-11 font-bold text-white" style={{ backgroundColor: "#bf0f3e" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />} Unlock
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CoachUnlock;
