// The funder brief, at the top of Grant/RFP Info Here (Josh, 2026-10-22):
// every document the funder sent, read once into what the writer, the
// strategy session and the reviewer all work from. Josh sees exactly what
// Grant Coach took from them, corrects it, and re-reads when files change.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, BookOpenCheck, RefreshCw, ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { GRANT_DOCUMENTS_BUCKET } from "@/lib/grantCoach/orgDocuments";
import { readFunderBrief, type DraftFolder, type FunderBrief as Brief } from "@/lib/grantCoach/writer";
import { officeText, readsAsText } from "@/lib/grantCoach/readOffice";

export interface BriefDoc { id: string; side: "funder" | "ours"; title: string; storage_path: string | null; file_name: string | null; link_url: string | null }

/** The funder's documents the brief is read from: not the application screenshots, which are questions. */
export const briefDocs = (docs: BriefDoc[]) =>
  docs.filter((d) => d.side === "funder" && d.storage_path && !/^(Application|Portal screen):/i.test(d.title));

/** Read the funder's files into the brief and save it on the folder. */
export async function readAndSaveBrief(folderId: string, folder: DraftFolder, docs: BriefDoc[], corrections?: string | null) {
  const sources = briefDocs(docs);
  if (!sources.length) throw new Error("Upload the funder's documents first (the RFP, guidelines, slides, templates).");
  const payload: { title: string; path?: string; text?: string }[] = [];
  for (const d of sources) {
    const name = d.file_name ?? d.storage_path!;
    if (readsAsText(name)) {
      const { data, error } = await supabase.storage.from(GRANT_DOCUMENTS_BUCKET).download(d.storage_path!);
      if (error || !data) throw new Error(`Couldn't open ${d.title}: ${error?.message ?? "no file"}`);
      payload.push({ title: d.title, text: await officeText(name, data) });
    } else {
      payload.push({ title: d.title, path: d.storage_path! });
    }
  }
  const brief = await readFunderBrief(folder, payload);
  const { error } = await supabase.from("grant_folders" as never).update({
    funder_brief: { ...brief, corrections: corrections ?? null }, funder_brief_at: new Date().toISOString(), funder_brief_docs: sources.map((d) => d.id),
  } as never).eq("id", folderId);
  if (error) throw new Error(error.message);
  return brief;
}

export default function FunderBrief({ folderId, folder, docs, brief, briefAt, briefDocIds }: {
  folderId: string; folder: DraftFolder; docs: BriefDoc[]; brief: Brief | null; briefAt: string | null; briefDocIds: string[];
}) {
  const qc = useQueryClient();
  const [reading, setReading] = useState(false);
  const [more, setMore] = useState(false);
  // Hide or show the whole brief; remembered on this computer (a convenience, so it fails quietly).
  const hideKey = `grant-brief-hidden:${folderId}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(hideKey) === "1"; } catch { return false; } });
  const toggle = () => setHidden((h) => { try { localStorage.setItem(hideKey, h ? "0" : "1"); } catch { /* private window */ } return !h; });
  const sources = briefDocs(docs);
  const ids = sources.map((d) => d.id).sort().join(",");
  const stale = !!brief && ids !== [...briefDocIds].sort().join(",");

  const read = async () => {
    setReading(true);
    try {
      await readAndSaveBrief(folderId, folder, docs, brief?.corrections ?? null);
      qc.invalidateQueries({ queryKey: ["grant-folder", folderId] });
      toast.success("Read. Every answer, the strategy session and the reviewer now work from what the funder sent.");
    } catch (e) {
      toast.error(`Grant Coach: ${(e as Error).message}`);
    } finally {
      setReading(false);
    }
  };
  const saveCorrections = async (v: string) => {
    if (!brief || (brief.corrections ?? "") === v.trim()) return;
    const { error } = await supabase.from("grant_folders" as never).update({ funder_brief: { ...brief, corrections: v.trim() || null } } as never).eq("id", folderId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["grant-folder", folderId] });
    toast.success("Correction saved. Grant Coach treats it as the last word.");
  };

  const Section = ({ title, xs }: { title: string; xs?: string[] }) => xs?.length ? (
    <div><p className="text-[10px] font-bold uppercase tracking-wide text-white/45">{title}</p><ul className="mt-0.5 space-y-0.5">{xs.map((x) => <li key={x} className="text-[12px] text-white/75">• {x}</li>)}</ul></div>
  ) : null;

  return (
    <div className="rounded-xl border p-3 space-y-2.5" style={{ borderColor: `${GC_BLUE}55`, background: "#0f243366" }}>
      <button type="button" onClick={toggle} aria-expanded={!hidden} className="w-full flex items-start gap-2 text-left">
        {hidden ? <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-white/50" /> : <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-white/50" />}
        <BookOpenCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GC_BLUE }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">What the funder told us</p>
          <p className="text-[11px] text-white/45">
            {brief
              ? `Read from ${brief.sources?.length ?? sources.length} document${(brief.sources?.length ?? sources.length) === 1 ? "" : "s"}${briefAt ? ` · ${new Date(briefAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}` : ""} · every answer is written to this`
              : sources.length ? `${sources.length} document${sources.length === 1 ? "" : "s"} not read yet` : "Upload the RFP, guidelines, rubric and slides, and Grant Coach reads them"}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-white/45 underline underline-offset-2">{hidden ? "Show" : "Hide"}</span>
      </button>
      {!hidden && <>

      {reading && <p className="text-[12px] text-white/60 inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" style={{ color: GC_BLUE }} /> Reading every page the funder sent…</p>}

      {!reading && (!brief || stale) && sources.length > 0 && (
        <div className="space-y-1.5">
          {stale && <p className="text-[12px] text-amber-300">The documents changed since this was read.</p>}
          <Button size="sm" onClick={() => void read()} className="text-white" style={{ backgroundColor: "#bf0f3e" }}>
            <BookOpenCheck className="w-4 h-4 mr-1.5" /> {brief ? "Read them again" : `Read the ${sources.length} document${sources.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      {brief && !reading && (
        <>
          <p className="text-[13px] text-white/85">{brief.summary}</p>
          {brief.rubric?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: GC_BLUE }}>How they score it</p>
              <ul className="mt-0.5 space-y-1">
                {brief.rubric.map((r) => (
                  <li key={r.criterion} className="text-[12px]">
                    <span className="font-semibold text-white">{r.criterion}</span>{r.points != null && <span className="text-white/50"> · {r.points} pts</span>}
                    <span className="block text-white/60">{r.what_scores}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {brief.open_questions?.length > 0 && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.05] p-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300 inline-flex items-center gap-1"><HelpCircle className="w-3 h-3" /> Ask the funder</p>
              <ul className="mt-0.5 space-y-0.5">{brief.open_questions.map((q) => <li key={q} className="text-[12px] text-amber-100/90">• {q}</li>)}</ul>
            </div>
          )}
          <button type="button" onClick={() => setMore((m) => !m)} className="text-[12px] text-white/55 hover:text-white inline-flex items-center gap-1">
            {more ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Everything else Grant Coach took from them
          </button>
          {more && (
            <div className="space-y-2">
              <Section title="Their priorities" xs={brief.priorities} />
              <Section title="Their own words" xs={brief.their_words} />
              <Section title="What they fund" xs={brief.funds} />
              <Section title="What they won't fund" xs={brief.does_not_fund} />
              <Section title="Eligibility" xs={brief.eligibility} />
              <Section title="Data and reporting" xs={brief.data_and_reporting} />
              <Section title="Budget rules" xs={brief.budget_rules} />
              <Section title="Their budget categories" xs={brief.budget_categories} />
              <Section title="Dates" xs={brief.dates} />
              <Section title="What gets marked down" xs={brief.marked_down} />
              <Section title="Key lines, verbatim" xs={brief.key_quotes} />
            </div>
          )}
          <label className="block">
            <span className="text-[11px] text-white/50">Something wrong or missing? Correct it here. Grant Coach treats your correction as the last word.</span>
            <Textarea key={brief.corrections ?? ""} defaultValue={brief.corrections ?? ""} onBlur={(e) => void saveCorrections(e.target.value)} rows={2} placeholder="e.g. Darrell said in the session that retention counts more than enrollment this year." className="mt-1 bg-neutral-950 border-white/15 text-white text-[12px]" />
          </label>
          {!stale && (
            <button type="button" onClick={() => void read()} className="text-[11px] text-white/40 hover:text-white inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Read them again</button>
          )}
        </>
      )}
      </>}
      {hidden && stale && <p className="text-[12px] text-amber-300">The documents changed since this was read. Show it to read them again.</p>}
    </div>
  );
}
