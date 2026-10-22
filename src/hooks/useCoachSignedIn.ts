// True while a coach is signed in on this screen — on a gym wall, that means
// Edit tonight has been unlocked. Coach-only controls (picture and video fixes)
// show only then, so the kids never see them.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCoachSignedIn() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) setSignedIn(!!data.session && !data.session.user.is_anonymous); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session && !session.user.is_anonymous));
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return signedIn;
}
