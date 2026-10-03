// The one switch for "is this on the Gym Board?" — the same words on every
// step of the week: the practice plan, the verse, the Battle Team week and
// the NBT week. Not live: a red "Put on Gym Board". Live: a green "Live on
// Gym Board ✓" that, tapped, asks before taking the plan off the wall. The
// quiet state is a red outline on black so it never competes with the solid
// red "Build this week"; the green is the moment that pops.
// Underneath, each step still stores what it always did (published, locked);
// only the words on screen are shared. (Josh, 2026-10-03.)
import { Loader2, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const NLA_RED = "#bf0f3e";

export const LiveSwitch = ({
  live, onChange, pending = false, what, size = "sm",
}: {
  live: boolean;
  /** Asked to go live (true) or come off the board (false). */
  onChange: (next: boolean) => void;
  pending?: boolean;
  /** Named in the confirm: "the practice plan", "the verse", "the Battle Team week". */
  what: string;
  size?: "sm" | "default";
}) => {
  if (!live) {
    return (
      <Button
        size={size}
        variant="outline"
        onClick={() => onChange(true)}
        disabled={pending}
        className="bg-black font-semibold hover:bg-white/5"
        style={{ borderColor: NLA_RED, color: NLA_RED }}
      >
        {pending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
        Put on Gym Board
      </Button>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {/* The green pill is the status AND the control: tap it to take the
            plan off the wall. One thing on screen, not a badge plus a button. */}
        <button
          type="button"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/15 border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-60"
          title="Live on the Gym Board — tap to take it off"
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Live on Gym Board
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-neutral-900 border-neutral-800 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Take {what} off the Gym Board?</AlertDialogTitle>
          <AlertDialogDescription className="text-neutral-400">
            The kids stop seeing it on the wall until you put it back. Nothing is deleted — you can edit and put it back on.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-transparent border-neutral-700 text-neutral-300 hover:text-white hover:bg-white/5">
            Keep it live
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => onChange(false)} className="text-white" style={{ backgroundColor: NLA_RED }}>
            Take it off
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
