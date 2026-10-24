// Two helpers on every folder (Josh, 2026-10-24): the fit check — go or
// no-go before the hours go in, judged from the funder's own documents — and
// budget help — lines inside the funder's allowable categories, each with
// how its amount is built, ready to paste into their budget form.
import { useState } from "react";
import { toast } from "sonner";
import { Compass, Calculator, Loader2, Sparkles, Copy, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { runFitCheck, draftBudget, type DraftFolder, type FunderBrief, type LibraryEntry, type FitCheck, type BudgetDraft } from "@/lib/grantCoach/writer";
import type { Fact } from "@/lib/grantCoach/liveFacts";
import type { PromptAsk } from "@/components/admin/AskDialog";

const outline = "bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white";
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }) : "");
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const VERDICT: Record<FitCheck["verdict"], { label: string; cls: string }> = {
  go: { label: "Go", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/40" },
  maybe: { label: "Maybe", cls: "bg-amber-400/10 text-amber-200 border-amber-400/40" },
  no_go: { label: "No-go", cls: "bg-red-500/10 text-red-300 border-red-400/40" },
};

const List = ({ title, items, tone = "text-white/75" }: { title: string; items: string[]; tone?: string }) =>
  items.length ? (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">{title}</p>
      <ul className={`list-disc pl-4 mt-1 space-y-0.5 text-[13px] ${tone}`}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  ) : null;

export function FitCheckCard({ folderId, draftFolder, funderBrief, library, getFacts, saved, savedAt, onChanged }: {
  folderId: string; draftFolder: () => DraftFolder; funderBrief: FunderBrief | null; library: LibraryEntry[];
  getFacts: () => Promise<Fact[]>; saved: FitCheck | null; savedAt: string | null; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const fit = await runFitCheck({ folder: draftFolder(), funderBrief, library, facts: await getFacts() });
      const { error } = await supabase.from("grant_folders" as never).update({ fit_check: fit, fit_checked_at: new Date().toISOString() } as never).eq("id", folderId);
      if (error) throw new Error(error.message);
      setOpen(true);
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const v = saved ? VERDICT[saved.verdict] : null;
  return (
    <GcCard
      icon={<Compass className="w-4 h-4" />}
      title="Fit check"
      blurb={saved ? <>{saved.score}/100 · checked {fmt(savedAt)}</> : funderBrief ? "Go or no-go, from the funder's documents" : "Read the funder's documents in first for a real answer"}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      right={
        <>
          {v && <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${v.cls}`}>{v.label}</span>}
          <Button size="sm" variant="outline" className={outline} disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" style={{ color: GC_BLUE }} />} {saved ? "Check again" : "Run the fit check"}
          </Button>
        </>
      }
    >
      {saved ? (
        <div className="p-4 space-y-3">
          <p className="text-sm text-white/85">{saved.summary}</p>
          <List title="Why NLA scores" items={saved.strengths} />
          <List title="What could sink it" items={saved.risks} tone="text-amber-200/90" />
          <List title="Must have or prepare" items={saved.must_haves} />
          <List title="Ask the funder" items={saved.questions} />
        </div>
      ) : (
        <p className="p-4 text-[12px] text-white/45">Run it before the work starts: eligibility first, then fit with what they fund, NLA's strength against their rubric, and the effort against the amount.</p>
      )}
    </GcCard>
  );
}

export function BudgetCard({ folderId, draftFolder, funderBrief, library, getFacts, saved, savedAt, prompt, onChanged }: {
  folderId: string; draftFolder: () => DraftFolder; funderBrief: FunderBrief | null; library: LibraryEntry[];
  getFacts: () => Promise<Fact[]>; saved: BudgetDraft | null; savedAt: string | null;
  prompt: (a: PromptAsk) => Promise<Record<string, string> | null>; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const requested = draftFolder().amount_requested;
  const run = async () => {
    const got = await prompt({
      title: saved ? "Redraft the budget" : "Draft the budget",
      body: `Grant Coach builds it inside ${funderBrief?.budget_categories?.length ? "the funder's allowable categories" : "standard categories (no funder budget rules read yet)"}${requested ? `, up to the ${money(Number(requested))} requested` : ""}. Every amount comes from a figure in the Grant Vault; where there isn't one, it says so.`,
      fields: [{ key: "i", label: "Anything to steer it? (optional)", placeholder: "e.g. put most of it on transportation and the Meal Train" }],
      confirmLabel: saved ? "Redraft" : "Draft it",
    });
    if (!got) return;
    setBusy(true);
    try {
      const budget = await draftBudget({ folder: draftFolder(), funderBrief, library, facts: await getFacts(), instruction: got.i?.trim() || undefined });
      const { error } = await supabase.from("grant_folders" as never).update({ budget, budget_at: new Date().toISOString() } as never).eq("id", folderId);
      if (error) throw new Error(error.message);
      setOpen(true);
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const copy = () => {
    if (!saved) return;
    // Tab-separated: pastes straight into Excel or the funder's budget sheet.
    const rows = [["Category", "Item", "Amount", "Justification"], ...saved.lines.map((l) => [l.category, l.item, String(l.amount), l.justification]), ["", "Total", String(saved.total), ""]];
    void navigator.clipboard.writeText(rows.map((r) => r.join("\t")).join("\n")).then(() => toast.success("Copied. Paste it into Excel or the budget form."), () => toast.error("Couldn't copy."));
  };
  const over = saved && requested != null && saved.total > Number(requested);
  return (
    <GcCard
      icon={<Calculator className="w-4 h-4" />}
      title="Budget help"
      blurb={saved ? <>{money(saved.total)} · {saved.lines.length} lines · drafted {fmt(savedAt)}</> : "Lines inside the funder's categories, each justified"}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      right={
        <>
          {saved && <Button size="sm" variant="outline" className={outline} onClick={copy}><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy</Button>}
          <Button size="sm" variant="outline" className={outline} disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" style={{ color: GC_BLUE }} />} {saved ? "Redraft" : "Draft the budget"}
          </Button>
        </>
      }
    >
      {saved ? (
        <div className="p-4 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white/45">
                  <th className="py-1.5 pr-3 font-bold">Category</th><th className="py-1.5 pr-3 font-bold">Item</th><th className="py-1.5 pr-3 font-bold text-right">Amount</th><th className="py-1.5 font-bold">How it's built</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {saved.lines.map((l, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-2 pr-3 text-white/70">{l.category}</td>
                    <td className="py-2 pr-3 text-white/90">{l.item}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold">{money(l.amount)}</td>
                    <td className={`py-2 text-[12px] ${/\[NEED/i.test(l.justification) ? "text-amber-200" : "text-white/60"}`}>{l.justification}</td>
                  </tr>
                ))}
                <tr><td /><td className="py-2 pr-3 font-bold">Total</td><td className={`py-2 pr-3 text-right tabular-nums font-black ${over ? "text-red-300" : ""}`}>{money(saved.total)}</td><td className="py-2 text-[12px] text-white/45">{requested != null ? `of ${money(Number(requested))} requested` : ""}</td></tr>
              </tbody>
            </table>
          </div>
          {over && <p className="text-[12px] text-red-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Over the amount requested. Redraft or trim a line.</p>}
          <List title="Figures you need to supply" items={saved.needs} tone="text-amber-200/90" />
          <List title="Assumptions" items={saved.notes} />
        </div>
      ) : (
        <p className="p-4 text-[12px] text-white/45">Grant Coach drafts the lines from the funder's allowable categories and your Grant Vault's finances. Copy pastes it into Excel or their budget sheet.</p>
      )}
    </GcCard>
  );
}
