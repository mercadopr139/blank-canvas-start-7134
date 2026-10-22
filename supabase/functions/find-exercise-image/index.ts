// find-exercise-image — start-and-finish pictures for a lift or a station move, cached.
//
// Most of the youth have never done the move on tonight's wall, so they see
// the position before they pick up the bar (Josh, 2026-10-22). Every picture
// comes from ONE library, RepDB's free tier (github.com/RepDB/exercise-dataset),
// so they all share one flat drawn style — a mix of photos and drawings
// confused the kids. License: free for use in our apps and site with the
// visible credit "Exercise pictures by RepDB (repdb.co)" (shown in the picture
// panels); no republishing it as a dataset, no feeding its images to
// generative AI. Copied into our own `exercise-images` bucket, remembered per name.
//
// { name }                         → the cached pick, or a fresh match (anyone: the walls are public).
// { name, candidates: true }       → the library's closest entries, for a coach to pick from.
// { name, choose: "<library id>" } → use that entry (a signed-in coach).
// { name, refresh: true }          → throw the current pick out, take the next best (a signed-in coach).
// { name, upload: "<storage path>" } → use NLA's own picture, already uploaded (a signed-in coach).
// { name, none: true }             → this move shows no picture (a signed-in coach).
// { name, video: "auto" | "show" | "hide" } → whether the demo video shows under the picture (a signed-in coach).
// { name, add_finish: "<storage path>" } → a one-picture move gets NLA's own finish picture
//                                   (the wall ball throw: RepDB has only the squat — Josh, 2026-10-22).
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.63.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { thinking, textOf, extractJson } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const REPDB = "https://raw.githubusercontent.com/RepDB/exercise-dataset/main/";
const BUCKET = "exercise-images";

type Entry = { id: string; name: string; equipment: string; images: string[] };
type RepDbRow = { id: string; name_en: string; tags?: string[]; category?: string; images?: { flat?: { start?: string; peak?: string; main?: string } } };
let library: Entry[] | null = null;
const loadLibrary = async () => {
  if (library) return library;
  const r = await fetch(REPDB + "exercises.json");
  if (!r.ok) throw new Error(`The picture library didn't answer (${r.status}).`);
  const raw = await r.json();
  const rows: RepDbRow[] = Array.isArray(raw) ? raw : (raw.exercises ?? []);
  library = rows
    .map((e) => {
      const f = e.images?.flat ?? {};
      // Start, then the peak of the move; a one-picture move keeps its one.
      const images = f.start && f.peak ? [f.start, f.peak] : f.main ? [f.main] : [];
      return { id: e.id, name: e.name_en, equipment: [e.category, ...(e.tags ?? [])].filter(Boolean).join(", "), images };
    })
    .filter((e) => e.images.length && e.name);
  return library;
};

// Coaches write the way coaches talk: DB row, KB swing, RDL.
const EXPAND: [RegExp, string][] = [
  [/\bdb\b/g, "dumbbell"], [/\bkb\b/g, "kettlebell"], [/\bbb\b/g, "barbell"], [/\brdls?\b/g, "romanian deadlift"],
  [/\bsingle[- ]arm\b/g, "single arm"], [/\bone[- ]arm\b/g, "single arm"], [/\bsingle[- ]leg\b/g, "single leg"],
  [/\bpull[- ]?ups?\b/g, "pull up"], [/\bpush[- ]?ups?\b/g, "push up"], [/\bchin[- ]?ups?\b/g, "chin up"], [/\bohp\b/g, "overhead press"],
  [/\bfarmers?'?s?\b/g, "farmer"], [/\bcarry\b/g, "carry walk"], [/\bwall balls?\b/g, "wall ball"],
];
const tokens = (s: string) => {
  let t = s.toLowerCase().replace(/'/g, "");
  for (const [re, to] of EXPAND) t = t.replace(re, to);
  return t.replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 1).map((w) => w.replace(/s$/, ""));
};
/** The library entries sharing the most words with the move's name. */
const shortlist = (name: string, lib: Entry[], skip: Set<string>, n = 30) => {
  const want = new Set(tokens(name));
  return lib
    .filter((e) => !skip.has(e.id))
    .map((e) => { const have = tokens(e.name); const hit = have.filter((w) => want.has(w)).length; return { e, score: hit * 2 - Math.max(0, have.length - hit) * 0.25 }; })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.e);
};

/** One small model call: which shortlisted entry shows this exact movement, or none. */
const pick = async (name: string, list: Entry[]): Promise<Entry | null> => {
  if (!list.length) return null;
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return list[0];
  const anthropic = new Anthropic({ apiKey: key });
  const res = await anthropic.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 1500,
    system: "You match a youth strength coach's exercise name to the picture library entry that shows the SAME movement with the SAME equipment, so a beginner can copy the position. Be strict: a seated press is not a standing press, a barbell row is not a dumbbell row, a one-arm swing is not a swing (a swing with no arm named is two-handed). Prefer the entry whose name is closest to the coach's words. A small variation on the same position (\"rocks\", \"pulses\", \"hold\", \"march\", \"slow\") may use the base movement's picture: a hollow hold rocks shows the hollow hold. A station machine (\"rowing machine\", \"stationary bike\") is the machine. If nothing shows the same movement, say none.",
    messages: [{ role: "user", content: `The coach's exercise: "${name}"\n\nLibrary entries (id — name — tags):\n${list.map((e) => `${e.id} — ${e.name} — ${e.equipment || "?"}`).join("\n")}\n\nReturn ONLY JSON: {"id":"<the best id, or null>"}` }],
    ...thinking("low"),
  } as never);
  const id = String(extractJson(textOf(res as never)).id ?? "");
  return list.find((e) => e.id === id) ?? null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return json({ images: [] });
    const nameNorm = name.toLowerCase().replace(/\s+/g, " ");
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const coachAction = body.candidates || body.choose || body.refresh || body.upload || body.none || body.add_finish || body.video;

    // Changing what a wall shows takes a signed-in person — the coach in Edit tonight.
    if (coachAction) {
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
      const { data: who } = token ? await anon.auth.getUser(token) : { data: { user: null } };
      if (!who?.user || who.user.is_anonymous) return json({ images: [], error: "Sign in to change a picture." }, 401);
    }

    const { data: cached } = await db.from("exercise_images").select("*").eq("name_norm", nameNorm).maybeSingle();
    const rejected = new Set<string>((cached?.rejected as string[] | null) ?? []);
    if (cached && !coachAction) return json({ images: cached.images ?? [], exercise: cached.exercise_name, source: cached.source, video: cached.video ?? "auto" });

    if (["auto", "show", "hide"].includes(body.video)) {
      if (!cached) return json({ images: [], error: "Open the picture once before changing its video." }, 400);
      await db.from("exercise_images").update({ video: body.video }).eq("name_norm", nameNorm);
      return json({ images: cached.images ?? [], exercise: cached.exercise_name, source: cached.source, video: body.video });
    }

    /** Copy a library entry's pictures into our bucket and remember them for this name. */
    const save = async (e: Entry | null, extra: Partial<{ rejected: string[] }> = {}) => {
      const images: string[] = [];
      if (e) {
        for (const [k, p] of e.images.entries()) {
          const r = await fetch(REPDB + p);
          if (!r.ok) continue;
          const path = `repdb/${e.id}/${k === 0 ? "start" : "finish"}.webp`;
          await db.storage.from(BUCKET).upload(path, new Uint8Array(await r.arrayBuffer()), { contentType: "image/webp", upsert: true });
          images.push(db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
        }
      }
      const row = { name_norm: nameNorm, exercise_id: e?.id ?? null, exercise_name: e?.name ?? null, images, source: e ? "library" : "none", rejected: extra.rejected ?? [...rejected], credit: null, fetched_at: new Date().toISOString() };
      await db.from("exercise_images").upsert(row, { onConflict: "name_norm" });
      return json({ images, exercise: row.exercise_name, source: row.source });
    };

    if (body.none) return save(null);

    if (typeof body.add_finish === "string" && body.add_finish.startsWith("uploads/")) {
      // Keep the library's start picture; NLA's photo is the finish.
      const start = (cached?.images as string[] | null)?.[0];
      if (!start) return json({ images: [], error: "This move has no start picture yet." }, 400);
      const finish = db.storage.from(BUCKET).getPublicUrl(body.add_finish).data.publicUrl;
      const images = [start, finish];
      await db.from("exercise_images").update({ images, fetched_at: new Date().toISOString() }).eq("name_norm", nameNorm);
      return json({ images, exercise: cached?.exercise_name ?? null, source: cached?.source ?? "library" });
    }

    if (typeof body.upload === "string" && body.upload.startsWith("uploads/")) {
      const publicUrl = db.storage.from(BUCKET).getPublicUrl(body.upload).data.publicUrl;
      const row = { name_norm: nameNorm, exercise_id: null, exercise_name: "NLA's own picture", images: [publicUrl], source: "upload", rejected: [...rejected], credit: null, fetched_at: new Date().toISOString() };
      await db.from("exercise_images").upsert(row, { onConflict: "name_norm" });
      return json({ images: row.images, exercise: row.exercise_name, source: "upload" });
    }

    const lib = await loadLibrary();

    if (body.candidates) {
      const list = shortlist(name, lib, new Set(), 12);
      return json({ candidates: list.map((e) => ({ id: e.id, name: e.name, thumb: REPDB + e.images[0] })) });
    }

    if (typeof body.choose === "string") {
      const e = lib.find((x) => x.id === body.choose);
      if (!e) return json({ images: [], error: "That picture isn't in the library." }, 400);
      rejected.delete(e.id);
      return save(e);
    }

    if (body.refresh && cached?.exercise_id) rejected.add(cached.exercise_id);
    const chosen = await pick(name, shortlist(name, lib, rejected));
    return save(chosen, { rejected: [...rejected] });
  } catch (err) {
    console.error("find-exercise-image error:", err);
    return json({ images: [], error: (err as Error).message || "Couldn't find a picture." }, 500);
  }
});
