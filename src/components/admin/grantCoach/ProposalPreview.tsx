// The proposal before it prints (Josh, 2026-11-12: "When I hit print proposal,
// I want to see the draft so I can make edits. Then save it."). The whole
// document on a white page, laid out as the PDF will be: letterhead, date,
// addressee, Re:, salutation, every section under the funder's heading, the
// cost table drawn live from the lines, the closing, the signature, the
// enclosures. The addressee, the subject, every section and the closing are
// edited in place. Save writes the sections back to their rows (the folder
// stays the record) and the setup to the folder; Save and download then
// builds the PDF from exactly what is on the page.
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Save, AlertCircle } from "lucide-react";
import { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import { closingText, costCheck, costProse, isContactItem, isCostItem, money, parseCostLines, type ProposalSetup } from "@/lib/grantCoach/proposal";
import type { Letterhead } from "@/lib/grantCoach/proposalPdf";
import { salutation } from "@/lib/grantCoach/proposalPdf";
import nlaLogo from "@/assets/nla-logo.png";

export interface PreviewRow { id: string; label: string; kind: string; answer: string | null; status: string }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folder: { name: string; funder: string; amount_requested: number | null };
  setup: ProposalSetup;
  letterhead: Letterhead;
  /** The folder's rows in order (uploads included: they are listed as enclosures). */
  rows: PreviewRow[];
  enclosures: string[];
  /** YYYY-MM-DD */
  date: string;
  /** Write the edited sections and setup. */
  onSave: (edits: { rows: { id: string; answer: string }[]; setup: ProposalSetup }) => Promise<void>;
  /** Build and download the PDF from exactly what is on the page. */
  onDownload: (state: { answers: Record<string, string>; setup: ProposalSetup }) => Promise<void>;
}

const longDate = (ymd: string) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); };
const heading = (label: string) => label.replace(/^\d+[.)]\s*/, "").trim();

/** A textarea that grows with its text and looks like the page it sits on. */
function Area({ value, onChange, className = "", placeholder, mono = false }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; mono?: boolean }) {
  const rows = Math.max(1, value.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 95)), 0));
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      spellCheck
      className={`w-full resize-none bg-transparent border border-transparent hover:border-sky-300/60 focus:border-sky-400 focus:bg-sky-50 rounded px-1 -mx-1 outline-none leading-relaxed ${mono ? "font-mono text-[12px]" : "text-[13.5px]"} text-neutral-900 ${className}`}
    />
  );
}

export default function ProposalPreview({ open, onOpenChange, folder, setup: saved, letterhead, rows, enclosures, date, onSave, onDownload }: Props) {
  const [setup, setSetup] = useState<ProposalSetup>(saved);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "download" | null>(null);
  // Fresh from the record each time it opens.
  useEffect(() => {
    if (!open) return;
    setSetup({ ...saved, closing: saved.closing ?? "" });
    setAnswers(Object.fromEntries(rows.map((r) => [r.id, r.answer ?? ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sections = useMemo(() => rows.filter((r) => r.status !== "na" && !["upload", "acknowledgment", "signature"].includes(r.kind)), [rows]);
  const dirty = useMemo(() =>
    sections.some((r) => (answers[r.id] ?? "") !== (r.answer ?? "")) ||
    (Object.keys(setup) as (keyof ProposalSetup)[]).some((k) => (setup[k] ?? "") !== (saved[k] ?? "")),
  [answers, sections, setup, saved]);

  const save = async () => {
    setBusy("save");
    try {
      await onSave({ rows: sections.filter((r) => (answers[r.id] ?? "") !== (r.answer ?? "")).map((r) => ({ id: r.id, answer: answers[r.id] ?? "" })), setup });
    } finally { setBusy(null); }
  };
  const download = async () => {
    setBusy("download");
    try {
      if (dirty) await onSave({ rows: sections.filter((r) => (answers[r.id] ?? "") !== (r.answer ?? "")).map((r) => ({ id: r.id, answer: answers[r.id] ?? "" })), setup });
      await onDownload({ answers, setup });
    } finally { setBusy(null); }
  };

  const toBlock = [[setup.to_name, setup.to_title].filter((s) => s.trim()).join(", "), setup.to_org, ...setup.to_address.split("\n")].filter((s) => s.trim()).join("\n");
  const setToBlock = (v: string) => {
    const lines = v.split("\n");
    const [first = "", org = "", ...addr] = lines;
    const [name, ...title] = first.split(",");
    setSetup((s) => ({ ...s, to_name: name.trim(), to_title: title.join(",").trim(), to_org: org.trim(), to_address: addr.join("\n").trim() }));
  };
  const [signerName, ...signerTitle] = setup.signer.split(",").map((s) => s.trim());
  const addr = letterhead.address.split("\n").map((s) => s.trim()).filter(Boolean).join(", ");
  const bits = [letterhead.phone, letterhead.website, letterhead.ein ? `EIN ${letterhead.ein}` : null].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-4xl bg-neutral-900 border-white/10 text-white p-0 gap-0 max-h-[92vh] flex flex-col">
        <DialogHeader className="px-5 py-3 border-b border-white/10 flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle className="text-white">The proposal, before it prints</DialogTitle>
            <p className="text-[12px] text-white/50">Click any part to edit it. Save writes your edits back to the rows; the PDF is built from what is on this page.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void save()} disabled={!dirty || !!busy} className="bg-transparent border-white/20 text-white/85 hover:bg-white/10 hover:text-white">
              {busy === "save" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Save
            </Button>
            <Button size="sm" onClick={() => void download()} disabled={!!busy} className="font-bold" style={{ backgroundColor: GC_BLUE, color: "#0a0a0a" }}>
              {busy === "download" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />} {dirty ? "Save and download PDF" : "Download PDF"}
            </Button>
          </div>
        </DialogHeader>

        {/* The page */}
        <div className="overflow-y-auto bg-neutral-800 p-4 sm:p-6">
          <div className="mx-auto max-w-[8.5in] bg-white text-neutral-900 shadow-2xl px-[0.9in] py-[0.8in] space-y-4">
            <div className="flex items-start gap-3 pb-3 border-b-[3px]" style={{ borderColor: "#bf0f3e" }}>
              <img src={nlaLogo} alt="" className="w-12 h-12 object-contain" />
              <div className="min-w-0">
                <p className="text-[17px] font-bold leading-tight">{letterhead.org}</p>
                <p className="text-[11px] text-neutral-500">{addr}</p>
                {bits && <p className="text-[11px] text-neutral-500">{bits}</p>}
              </div>
            </div>

            <p className="text-[13.5px]">{longDate(date)}</p>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-neutral-400">To</p>
              <Area value={toBlock} onChange={setToBlock} placeholder={"Jim Lutz, President\nAvalon Lions Charities Foundation\nP.O. Box 365\nAvalon, NJ 08202"} />
            </div>
            <div className="flex items-baseline gap-1 text-[13.5px] font-bold">
              <span className="shrink-0">Re:</span>
              <Area value={setup.subject} onChange={(v) => setSetup((s) => ({ ...s, subject: v }))} className="font-bold" placeholder="The subject line" />
            </div>
            <p className="text-[13.5px]">{salutation(setup)}</p>

            {sections.map((r) => {
              const text = answers[r.id] ?? "";
              const cost = isCostItem(r.label) ? parseCostLines(text) : null;
              const check = cost ? costCheck(text, folder.amount_requested) : null;
              return (
                <div key={r.id} className="space-y-1.5">
                  <p className="text-[14px] font-bold pt-1">{heading(r.label)}</p>
                  {cost ? (
                    <>
                      <p className="text-[11px] text-neutral-400">Written as lines; printed as the table below.</p>
                      <Area value={text} onChange={(v) => setAnswers((a) => ({ ...a, [r.id]: v }))} mono />
                      {check && <p className="text-[12px] text-amber-700 inline-flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {check}</p>}
                      {cost.lineCount > 0 && (
                        <div className="pt-1">
                          {costProse(text).before.map((p) => <p key={p} className="text-[13.5px] leading-relaxed mb-2">{p}</p>)}
                          <table className="w-full text-[13px] border-t border-neutral-200">
                            <thead><tr className="bg-neutral-100 font-bold"><td className="px-2 py-1">Item</td><td className="px-2 py-1 text-right">Amount</td></tr></thead>
                            <tbody>
                              {cost.groups.map((g, gi) => (
                                <>
                                  {g.heading && <tr key={`g${gi}`} className="font-bold border-b border-neutral-200"><td className="px-2 py-1">{g.heading}</td><td className="px-2 py-1 text-right">{money(g.lines.reduce((s, l) => s + l.amount, 0))}</td></tr>}
                                  {g.lines.map((l, li) => <tr key={`g${gi}l${li}`} className="border-b border-neutral-200"><td className={`px-2 py-1 ${g.heading ? "pl-6" : ""}`}>{l.item}</td><td className="px-2 py-1 text-right">{money(l.amount)}</td></tr>)}
                                </>
                              ))}
                              <tr className="bg-neutral-100 font-bold"><td className="px-2 py-1">Total request</td><td className="px-2 py-1 text-right">{money(cost.total)}</td></tr>
                            </tbody>
                          </table>
                          {costProse(text).after.map((p) => <p key={p} className="text-[13.5px] leading-relaxed mt-2">{p}</p>)}
                        </div>
                      )}
                    </>
                  ) : (
                    <Area value={text} onChange={(v) => setAnswers((a) => ({ ...a, [r.id]: v }))} placeholder={isContactItem(r.label) ? "Name, title · organization · phone · email" : "This section is empty."} />
                  )}
                </div>
              );
            })}

            <div className="pt-2 space-y-3">
              <Area value={setup.closing ?? ""} onChange={(v) => setSetup((s) => ({ ...s, closing: v }))} placeholder={closingText({ ...setup, closing: "" })} />
              <p className="text-[13.5px]">Sincerely,</p>
              <div className="pt-5 text-[13.5px] leading-snug">
                <p className="font-semibold">{signerName || "—"}</p>
                {signerTitle.length > 0 && <p>{signerTitle.join(", ")}</p>}
                <p>{letterhead.org}</p>
              </div>
              {enclosures.length > 0 && (
                <div className="text-[12.5px] pt-2">
                  <p className="font-bold text-neutral-500">{enclosures.length === 1 ? "Enclosure" : "Enclosures"}</p>
                  {enclosures.map((e) => <p key={e}>{e}</p>)}
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-white/40">The signer, the addressee and the closing are also in “The proposal — who it goes to, who signs” on the folder.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
