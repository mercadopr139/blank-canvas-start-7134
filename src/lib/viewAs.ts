// "View as": lets the access manager see the back end the way one staff
// person sees it, before handing them a login. Menus, tiles and the door on
// every page follow that person's boxes; the data on screen is still read
// with the access manager's own login.
//
// The choice lives in this browser tab only (sessionStorage), and it is
// honoured only when the signed-in person is the access manager; for anyone
// else it is ignored, so it cannot be used to widen access.
import { useSyncExternalStore } from "react";

export interface ViewAs {
  user_id: string;
  name: string;
  email: string;
}

const KEY = "nla_view_as";

const read = (): ViewAs | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v.user_id === "string" ? (v as ViewAs) : null;
  } catch {
    return null;
  }
};

let current: ViewAs | null = read();
const listeners = new Set<() => void>();

export const getViewAs = () => current;

export const setViewAs = (next: ViewAs | null) => {
  current = next;
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
    else sessionStorage.removeItem(KEY);
  } catch {
    // A browser that blocks storage still previews for this page load.
  }
  listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};

export const useViewAs = () => useSyncExternalStore(subscribe, getViewAs);
