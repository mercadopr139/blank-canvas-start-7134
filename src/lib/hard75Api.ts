// Two ways into the same 75 days.
//
// Josh opens it signed in as an admin and talks to the tables directly. Rob
// opens a private link with no account at all, and everything he does goes
// through the hard75-access edge function, which checks his token server-side.
//
// The calendar, the day sheet, the journal and the photos shouldn't have to know
// which of those is happening — so they take one of these instead of reaching
// for supabase themselves.
import { supabase } from "@/integrations/supabase/client";
import { Workout } from "@/lib/hard75";

export interface Hard75Api {
  patchDay(dayId: string, patch: Record<string, unknown>): Promise<void>;
  regenerate(body: Record<string, unknown>): Promise<Workout | null>;
  /** Returns the storage path the photo landed on. */
  uploadPhoto(dayId: string, dayNumber: number, file: File): Promise<string>;
  removePhoto(path: string): Promise<void>;
  signedUrls(paths: string[]): Promise<Record<string, string>>;
  refresh(): void;
}

const photoPath = (runId: string, dayNumber: number, file: File) => {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  // The run id is the first path segment — both the storage policy and the
  // edge function read it to decide whether this photo is yours.
  return `${runId}/${String(dayNumber).padStart(2, "0")}.${ext}`;
};

/* ───── Signed in as an admin ───── */

export const adminApi = (runId: string, refresh: () => void): Hard75Api => ({
  refresh,

  async patchDay(dayId, patch) {
    const { error } = await supabase
      .from("hard75_days" as never)
      .update(patch as never)
      .eq("id", dayId);
    if (error) throw error;
    refresh();
  },

  async regenerate(body) {
    const { data, error } = await supabase.functions.invoke("hard75-workout", { body });
    if (error) throw error;
    if (!data?.workout) throw new Error(data?.error ?? "Nothing came back.");
    return data.workout as Workout;
  },

  async uploadPhoto(_dayId, dayNumber, file) {
    const path = photoPath(runId, dayNumber, file);
    const { error } = await supabase.storage
      .from("hard75-photos")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw error;
    return path;
  },

  async removePhoto(path) {
    await supabase.storage.from("hard75-photos").remove([path]);
  },

  async signedUrls(paths) {
    if (paths.length === 0) return {};
    const { data, error } = await supabase.storage
      .from("hard75-photos")
      .createSignedUrls(paths, 3600);
    if (error) throw error;
    const m: Record<string, string> = {};
    (data ?? []).forEach((r) => { if (r.path && r.signedUrl) m[r.path] = r.signedUrl; });
    return m;
  },
});

/* ───── Holding a private link ───── */

export const tokenApi = (
  token: string,
  pin: string,
  runId: string,
  refresh: () => void
): Hard75Api => {
  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("hard75-access", {
      body: { token, pin, action, ...extra },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  return {
    refresh,

    async patchDay(dayId, patch) {
      await call("update_day", { dayId, patch });
      refresh();
    },

    async regenerate(body) {
      const { data, error } = await supabase.functions.invoke("hard75-workout", { body });
      if (error) throw error;
      if (!data?.workout) throw new Error(data?.error ?? "Nothing came back.");
      return data.workout as Workout;
    },

    async uploadPhoto(dayId, dayNumber, file) {
      const path = photoPath(runId, dayNumber, file);
      // A one-shot signed URL, so the photo goes straight to storage and never
      // passes through the function.
      const res = await call("photo_upload_url", { dayId, path });
      const { error } = await supabase.storage
        .from("hard75-photos")
        .uploadToSignedUrl(path, res.token, file, { contentType: file.type });
      if (error) throw error;
      return path;
    },

    async removePhoto(path) {
      await call("photo_delete", { path });
    },

    async signedUrls(paths) {
      if (paths.length === 0) return {};
      const res = await call("photo_urls", { paths });
      return (res?.urls ?? {}) as Record<string, string>;
    },
  };
};
