// The three-page Program Narrative (Josh, 2026-10-28: "I don't think my
// current grant coach is built for this"). It was half-built: the writer's
// narrative mode drafts the funder's seven items in order inside the word
// limit, and narrativeDocx.ts turns them into the Word file the portal's
// upload slot wants. This card is the missing screen between the two.
//
// The seven items live as ordinary questions in the folder (section
// "8 · Program Narrative"), so each one has its own conversation, Approve
// and the reviewer like every other answer. This card drafts all seven in
// one pass (so the total stays inside three pages), keeps the running word
// count, and builds the .docx when all seven are written.
import { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Sparkles, Download, AlertTriangle, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import {
  draftWithGrantCoach, narrativeItems, narrativeWordCount, wordCount, NARRATIVE_SECTION, NARRATIVE_WORD_LIMIT,
  type DraftFolder, type LibraryEntry, type FunderBrief, type CaseBrief,
} from "@/lib/grantCoach/writer";
import { downloadNarrativeDocx, headingFromLabel } from "@/lib/grantCoach/narrativeDocx";
import type { AppItem } from "@/components/admin/grantCoach/GrantApplication";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import type { PromptAsk } from "@/components/admin/AskDialog";

const outline = "bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white";

/** The funder's seven items, in their order (O.C.E.A.N. 2027, screen 8). */
export const NARRATIVE_LABELS = [
  "1. Statement of need, with recent local information or experience",
  "2. Program design, major activities, and service schedule",
  "3. Outreach, referral, enrollment, and participant retention",
  "4. Staff roles, qualifications, supervision, and use of volunteers or subcontractors",
  "5. Coordination with other organizations and avoidance of duplicated services",
  "6. Experience delivering comparable services and evidence of past effectiveness",
  "7. Sustainability or transition plan if CSBG funding ends",
];

const STATUS: Record<AppItem["status"], { label: string; cls: string }> = {
  todo: { label: "Not written", cls: "text-white/40" },
  in_progress: { label: "Drafted", cls: "text-amber-300" },
  done: { label: "Approved", cls: "text-emerald-300" },
  na: { label: "N/A", cls: "text-white/40" },
};

export default function NarrativeCard({ folderId, folder, items, library, getFacts, funderBrief, caseBrief, prompt, onChanged }: {
  folderId: string;
  folder: DraftFolder;
  items: AppItem[];
  library: LibraryEntry[];
  getFacts: () => Promise<Fact[]>;
  funderBrief: FunderBrief | null;
  caseBrief: CaseBrief | null;
  prompt: (a: PromptAsk) => Promise<Record<string, string> | null>;
  onChanged: () => void;
}) {
  const rows = narrativeItems(items);
  const total = narrativeWordCount(rows);
  const written = rows.filter((r) => r.answer?.trim()).length;
  const over = total > NARRATIVE_WORD_LIMIT;
  const [busy, setBusy] = useState<null | "draft" | "docx" | "add">(null);
  const [open, setOpen] = useState(true);

  /** For a folder read from a portal without them: the seven rows, after everything else. */
  const addItems = async () => {
    setBusy("add");
    try {
      const top = items.reduce((n, i) => Math.max(n, i.sort_order), 0);
      const fresh = NARRATIVE_LABELS.map((label, i) => ({
        folder_id: folderId, section: NARRATIVE_SECTION, label, kind: "narrative", required: true, status: "todo", owner: "Josh", sort_order: top + i + 1,
        detail: `One of the seven sections of the three-page narrative uploaded on screen 8. All seven together: at most ${NARRATIVE_WORD_LIMIT.toLocaleString()} words.`,
      }));
      const { error } = await supabase.from("grant_checklist_items" as never).insert(fresh as never);
      if (error) throw new Error(error.message);
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  /** All seven in one pass, so the total lands inside three pages. Existing drafts are improved, not thrown away. */
  const draftAll = async () => {
    const got = await prompt({
      title: "Draft the Program Narrative",
      body: `Grant Coach writes all seven sections together, in the funder's order, from the Snapshot, the Vault and the answers already approved in this application — at most ${NARRATIVE_WORD_LIMIT.toLocaleString()} words in all. Each section lands as a draft you approve one by one below.`,
      fields: [{ key: "instruction", label: "Anything to steer it? (optional)", placeholder: "e.g. lead with the Battle Team; keep the Launch Pad short" }],
      confirmLabel: written ? "Redraft all seven" : "Draft all seven",
    });
    if (!got) return;
    setBusy("draft");
    try {
      const facts = await getFacts();
      const answered = items.filter((i) => i.answer?.trim() && i.section !== NARRATIVE_SECTION).map((i) => ({ section: i.section, label: i.label, answer: i.answer!.trim() }));
      const out = await draftWithGrantCoach({
        mode: "narrative", folder, library, facts, answered, funderBrief, caseBrief,
        instruction: got.instruction?.trim() || undefined,
        narrativeItems: rows.map((r) => ({ id: r.id, section: r.section, label: r.label, detail: r.detail, kind: r.kind, answer: r.answer, limit_kind: r.limit_kind, limit_value: r.limit_value })),
      });
      const sections = out.sections ?? [];
      if (sections.length !== 7) throw new Error("The draft did not come back with seven sections. Try again.");
      const now = new Date().toISOString();
      for (const r of rows) {
        const n = Number(r.label[0]);
        const s = sections.find((x) => Number(x.n) === n);
        if (!s?.text?.trim()) continue;
        const { error } = await supabase.from("grant_checklist_items" as never)
          .update({ answer: s.text.trim(), status: "in_progress", answer_source: "coach", pasted_at: null, updated_at: now } as never)
          .eq("id", r.id);
        if (error) throw new Error(error.message);
      }
      onChanged();
      toast.success(`Drafted: ${out.words?.toLocaleString() ?? "?"} words across seven sections. Read each one below and approve it.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  /** The Word file for the portal's upload slot: seven numbered sections, the funder's headings. */
  const download = async () => {
    setBusy("docx");
    try {
      const sections = rows.map((r) => ({ n: Number(r.label[0]), heading: headingFromLabel(r.label), text: (r.answer ?? "").trim() }));
      const safe = folder.name.replace(/[^\w.-]+/g, "_").slice(0, 40);
      await downloadNarrativeDocx(sections, { org: "No Limits Academy", grant: folder.name, program: folder.program_name }, `NLA_Program_Narrative_${safe}.docx`);
      toast.success("Word file saved. Upload it in the portal's Program Narrative slot.");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  return (
    <GcCard
      icon={<FileText className="w-4 h-4" />}
      title="Program Narrative · three pages"
      open={open}
      onToggle={() => setOpen((o) => !o)}
      blurb={
        rows.length !== 7
          ? "The funder wants one uploaded narrative in seven numbered items. Add the seven here; each becomes a question below."
          : <>{written} of 7 written · <span className={over ? "text-red-300 font-bold" : total > NARRATIVE_WORD_LIMIT * 0.92 ? "text-amber-300" : ""}>{total.toLocaleString()} / {NARRATIVE_WORD_LIMIT.toLocaleString()} words</span> · about {Math.max(1, Math.ceil(total / 450))} page{total > 450 ? "s" : ""}</>
      }
      right={
        rows.length === 7 ? (
          <>
            <Button size="sm" variant="outline" className={outline} disabled={busy != null} onClick={() => void draftAll()}>
              {busy === "draft" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" style={{ color: GC_BLUE }} />} {written ? "Redraft all seven" : "Draft all seven"}
            </Button>
            <Button size="sm" className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy != null || written < 7} onClick={() => void download()} title={written < 7 ? "Write all seven first" : "Build the Word file for the portal"}>
              {busy === "docx" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />} Download Word file
            </Button>
          </>
        ) : (
          <Button size="sm" className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy != null} onClick={() => void addItems()}>
            {busy === "add" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />} Add the seven items
          </Button>
        )
      }
    >
      {rows.length === 7 && (
        <div className="p-4 space-y-3">
          {over && (
            <p className="flex items-start gap-2 text-[12px] text-red-300"><AlertTriangle className="w-4 h-4 shrink-0" /> Over three pages. Trim {(total - NARRATIVE_WORD_LIMIT).toLocaleString()} words before building the file — or press Redraft all seven and ask for it shorter.</p>
          )}
          <ol className="divide-y divide-white/[0.06]">
            {rows.map((r) => {
              const st = STATUS[r.status];
              const w = wordCount(r.answer);
              return (
                <li key={r.id} className="py-2 flex items-center gap-3 text-[13px]">
                  <span className="w-5 text-right font-black text-white/40 tabular-nums">{r.label[0]}</span>
                  <span className="flex-1 min-w-0 text-white/85 truncate">{headingFromLabel(r.label)}</span>
                  <span className="shrink-0 tabular-nums text-white/45">{w ? `${w} words` : "—"}</span>
                  <span className={`shrink-0 w-24 text-right text-[11px] font-bold uppercase tracking-wide ${st.cls}`}>{r.status === "done" && <Check className="inline w-3 h-3 mr-1" />}{st.label}</span>
                </li>
              );
            })}
          </ol>
          <p className="text-[12px] text-white/45">
            Each section is a question in the application below, under <span className="text-white/70">8 · Program Narrative</span>: read it, talk to Grant Coach about it, approve it. When all seven are written, the Word file is built from them, 11-point type, one-inch margins, the funder's headings — then upload it on the portal's Program Narrative screen.
          </p>
        </div>
      )}
    </GcCard>
  );
}
