// The Program Narrative (Josh, 2026-10-28: "I don't think my
// current grant coach is built for this"). It was half-built: the writer's
// narrative mode drafts the funder's seven items in order inside the word
// limit, and narrativeDocx.ts turns them into the Word file the portal's
// upload slot wants. This is the missing piece between the two.
//
// The seven items live as ordinary questions in the folder (section
// "8 · Program Narrative"), so each one has its own conversation, Approve
// and the reviewer like every other answer. These tools sit in that screen's
// own header (Josh: "why is Program Narrative written twice!" — one card, not
// two): Draft all seven in one pass so they read as one document (no page limit — Josh, 2026-10-29),
// the running word count, and the .docx once all seven are written.
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Copy, FileText, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import {
  draftWithGrantCoach, narrativeItems, narrativeWordCount, NARRATIVE_SECTION, WORDS_PER_PAGE,
  type DraftFolder, type LibraryEntry, type FunderBrief, type CaseBrief,
} from "@/lib/grantCoach/writer";
import { downloadNarrativeDocx, headingFromLabel } from "@/lib/grantCoach/narrativeDocx";
import { downloadNarrativePdf, narrativeText } from "@/lib/grantCoach/narrativePdf";
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

/** The screen card's second line: how many written, and the running length (information, not a limit). */
export function NarrativeBlurb({ items }: { items: AppItem[] }) {
  const rows = narrativeItems(items);
  const total = narrativeWordCount(rows);
  const written = rows.filter((r) => r.answer?.trim()).length;
  const done = rows.filter((r) => r.status === "done").length;
  const pages = Math.max(1, Math.ceil(total / WORDS_PER_PAGE));
  return (
    <>
      {written} of {rows.length} written · {done} approved · {total.toLocaleString()} words · about {pages} page{pages === 1 ? "" : "s"} · no page limit
      <span className="block mt-0.5">One uploaded file on the portal. Draft all seven together, approve each below, then download the PDF (or Word file) and upload it on screen 8 — or Copy all and paste.</span>
    </>
  );
}

export default function NarrativeTools({ folder, items, library, getFacts, funderBrief, caseBrief, prompt, onChanged }: {
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
  const written = rows.filter((r) => r.answer?.trim()).length;
  // Approved sections are never rewritten (Josh, 2026-10-28: "this could be bad if I hit it
  // accidentally"). The draft touches only the open ones; with all seven approved, no button.
  const open = rows.filter((r) => r.status !== "done");
  const [busy, setBusy] = useState<null | "draft" | "docx" | "pdf">(null);
  const [copied, setCopied] = useState(false);
  if (rows.length !== 7) return null;

  /** All seven in one pass, so they read as one document. Approved sections are kept word for word; open ones are drafted (or improved, if a draft is there). */
  const draftAll = async () => {
    const kept = rows.length - open.length;
    const got = await prompt({
      title: kept ? `Draft the ${open.length} open section${open.length === 1 ? "" : "s"}` : "Draft the Program Narrative",
      body: `Grant Coach writes the narrative in the funder's order, from the Snapshot, the Vault and the answers already approved in this application. There is no page limit: each section is as long as it takes to prove its point.${kept ? ` Your ${kept} approved section${kept === 1 ? " is" : "s are"} kept word for word; only the ${open.length} not yet approved ${open.length === 1 ? "is" : "are"} written.` : " Each section lands as a draft you approve one by one."}`,
      fields: [{ key: "instruction", label: "Anything to steer it? (optional)", placeholder: "e.g. lead with the Battle Team; keep the Launch Pad short" }],
      confirmLabel: kept ? `Draft the ${open.length} open` : written ? "Redraft all seven" : "Draft all seven",
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
      for (const r of open) {
        const n = Number(r.label[0]);
        const s = sections.find((x) => Number(x.n) === n);
        if (!s?.text?.trim()) continue;
        const { error } = await supabase.from("grant_checklist_items" as never)
          .update({ answer: s.text.trim(), status: "in_progress", answer_source: "coach", pasted_at: null, updated_at: now } as never)
          .eq("id", r.id);
        if (error) throw new Error(error.message);
      }
      onChanged();
      toast.success(kept ? `Drafted the ${open.length} open section${open.length === 1 ? "" : "s"}; your ${kept} approved stayed as written.` : `Drafted: ${out.words?.toLocaleString() ?? "?"} words across seven sections. Read each one and approve it.`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  /** The seven sections as the file-builders want them, in the funder's order. */
  const sections = () => rows.map((r) => ({ n: Number(r.label[0]), heading: headingFromLabel(r.label), text: (r.answer ?? "").trim() }));
  const meta = () => ({ org: "No Limits Academy", grant: folder.name, program: folder.program_name });
  const fileBase = () => `NLA_Program_Narrative_${folder.name.replace(/[^\w.-]+/g, "_").slice(0, 40)}`;

  /** PDF, Word, or the plain text to paste straight into a portal box (Josh, 2026-10-28). */
  const downloadPdf = () => {
    setBusy("pdf");
    try { downloadNarrativePdf(sections(), meta(), `${fileBase()}.pdf`); toast.success("PDF saved. Upload it in the portal's Program Narrative slot."); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const downloadDocx = async () => {
    setBusy("docx");
    try { await downloadNarrativeDocx(sections(), meta(), `${fileBase()}.docx`); toast.success("Word file saved."); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };
  const copyAll = () => void navigator.clipboard.writeText(narrativeText(sections())).then(
    () => { setCopied(true); window.setTimeout(() => setCopied(false), 1800); toast.success("All seven sections copied, headings included. Paste into the portal."); },
    () => toast.error("Couldn't copy. Select the text and copy it by hand."),
  );

  return (
    <>
      {open.length > 0 && (
        <Button size="sm" variant="outline" className={outline} disabled={busy != null} onClick={() => void draftAll()} title="Approved sections are never touched">
          {busy === "draft" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" style={{ color: GC_BLUE }} />} {open.length === 7 ? (written ? "Redraft all seven" : "Draft all seven") : `Draft the ${open.length} open`}
        </Button>
      )}
      <Button size="sm" variant="outline" className={outline} disabled={busy != null || written < 7} onClick={copyAll} title={written < 7 ? "Write all seven first" : "Copy all seven sections as text, to paste into the portal"}>
        {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />} Copy all
      </Button>
      <Button size="sm" className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy != null || written < 7} onClick={downloadPdf} title={written < 7 ? "Write all seven first" : "Build the PDF for the portal's upload slot"}>
        {busy === "pdf" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />} Download PDF
      </Button>
      <Button size="sm" variant="outline" className={outline} disabled={busy != null || written < 7} onClick={() => void downloadDocx()} title={written < 7 ? "Write all seven first" : "The same narrative as a Word file"}>
        {busy === "docx" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1.5" />} Word
      </Button>
    </>
  );
}
