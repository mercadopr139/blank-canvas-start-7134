// Board-side session rules for the wall boards.
//
// A session a coach starts on the wall (through CoachUnlock) is marked as a
// board session. The board signs it out when the coach presses Done editing,
// and after fifteen quiet minutes. A coach's own phone, signed in through the
// admin, is never a board session and is never signed out from under them.
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";

const BOARD_SESSION_KEY = "nla_board_session";
const IDLE_MS = 15 * 60 * 1000;

export const isBoardSession = (): boolean => {
  try { return localStorage.getItem(BOARD_SESSION_KEY) === "1"; } catch { return false; }
};

export const markBoardSession = (on: boolean) => {
  try {
    if (on) localStorage.setItem(BOARD_SESSION_KEY, "1");
    else localStorage.removeItem(BOARD_SESSION_KEY);
  } catch {
    // Storage blocked: the idle timer still runs for this page.
  }
};

export const useBoardSession = () => {
  const { isAdmin, signOut } = useAuth();
  const timer = useRef<number | null>(null);

  const lock = async () => { markBoardSession(false); await signOut(); };

  useEffect(() => {
    if (!isAdmin || !isBoardSession()) return;
    const arm = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { markBoardSession(false); signOut(); }, IDLE_MS);
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      events.forEach((e) => window.removeEventListener(e, arm));
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [isAdmin, signOut]);

  return { isAdmin, lock, isBoardSession: isBoardSession() };
};
