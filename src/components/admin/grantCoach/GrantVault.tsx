// The Grant Vault — the one source of truth for grants (Josh, 2026-10-28:
// "I need one source of truth. This is crazy.").
//
// Until today the Snapshot (four approved paragraphs of the program year)
// and the Vault (the facts) were two tabs, and the Vault also carried prose
// that said the same things the Snapshot said, so the two drifted. Now the
// Vault is organized the way funders ask, and each section OPENS with the
// approved paragraph that answers it — locked, word for word — with the
// short facts it draws on underneath. The rule: every fact lives in one
// place. A number, name, date or address is a fact in the Vault; a paragraph
// about the year is a Snapshot section, written from those facts and the
// live numbers.
//
// It reads as a LIBRARY INDEX (Josh, later the same day): every card is
// folded to its title and a one-line gist — "Boxing Groups Explained" — and
// opens on a click. Copy works from the folded card; a search opens every
// card that matches. Same component on Grant Coach home and in the
// Resources pop-up, so the two never show different things. Edits save to
// grant_org_fields, which wins over the website seeds; every draft follows.
import { useMemo, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Check, Pencil, Loader2, Search, Library, AlertCircle, RotateCcw, X, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import SnapshotSectionCard, { useSnapshot, copyText, outline } from "@/components/admin/grantCoach/SnapshotSection";
import { useAsk } from "@/components/admin/AskDialog";
import { ORG_SECTIONS, orgFieldValue, orgCompleteness, formatEin, type OrgField } from "@/lib/grantCoach/orgProfile";
import { shortYear, snapshotText } from "@/lib/grantCoach/snapshot";

interface FieldRow { key: string; value: string | null; updated_at: string }

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

/** The first line or so of a text, for a folded card with no gist of its own. */
const firstLine = (text: string, max = 150) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, "") + "…" : t;
};

/** The Vault as saved: what was typed over the website seeds, with when. */
function useVault() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["grant-org-fields"],
    queryFn: async () => {
      const { data, error } = await supabase.from("grant_org_fields" as never).select("key, value, updated_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as FieldRow[];
    },
  });
  const saved = useMemo(() => Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string | null>, [rows]);
  const savedAt = useMemo(() => Object.fromEntries(rows.map((r) => [r.key, r.updated_at])) as Record<string, string>, [rows]);
  // Everywhere the Vault is read: this page, the Resources pop-up, the application, the writer's library.
  const invalidate = () => { for (const k of ["grant-org-fields", "grant-vault-raw", "grant-library"]) qc.invalidateQueries({ queryKey: [k] }); };
  const save = async (field: OrgField, raw: string) => {
    if (field.key === "ein") raw = formatEin(raw);
    const value = raw.trim() ? raw : null;
    const { error } = await supabase
      .from("grant_org_fields" as never)
      .upsert({ key: field.key, value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null } as never, { onConflict: "key" } as never);
    if (error) throw new Error(error.message);
    invalidate();
  };
  /** Back to the website's text: drop the saved row. */
  const reset = async (field: OrgField) => {
    const { error } = await supabase.from("grant_org_fields" as never).delete().eq("key", field.key);
    if (error) throw new Error(error.message);
    invalidate();
  };
  return { saved, savedAt, isLoading, save, reset };
}

interface FieldProps {
  field: OrgField; value: string; fromSite: boolean; savedWhen?: string;
  onSave: (v: string) => Promise<void>; onReset: () => Promise<void>;
}

/** A short fact: label, value, Copy, Edit in place. */
function FactRow({ field, value, fromSite, savedWhen, onSave, onReset }: FieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const empty = !value.trim();
  const shown = field.kind === "number" && value && /^\d+(\.\d+)?$/.test(value) && /\$/.test(field.label) ? `$${Number(value).toLocaleString("en-US")}` : value;
  const copy = () => void navigator.clipboard.writeText(value).then(
    () => { setDone(true); window.setTimeout(() => setDone(false), 1400); },
    () => toast.error("Couldn't copy. Select the text and copy it by hand."),
  );
  const save = async () => {
    setBusy(true);
    try { await onSave(draft); setEditing(false); toast.success(`${field.label} saved`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && field.kind !== "yesno") { e.preventDefault(); void save(); }
    if (e.key === "Escape") setEditing(false);
  };
  return (
    <div className="min-w-0 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">{field.label}</p>
        {field.required && empty && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-300"><AlertCircle className="w-3 h-3" /> Needed</span>}
        {fromSite && !empty && <span className="text-[9px] font-bold uppercase tracking-wide rounded px-1 py-0.5 bg-sky-500/15 text-sky-200">website</span>}
        {savedWhen && <span className="text-[10px] text-white/30">saved {savedWhen}</span>}
      </div>
      {editing ? (
        <div className="mt-1 flex items-center gap-2">
          {field.kind === "yesno" ? (
            <select value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} className="h-8 rounded-md bg-neutral-950 border border-white/20 px-2 text-sm text-white">
              <option value="">—</option><option value="Yes">Yes</option><option value="No">No</option>
            </select>
          ) : (
            <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
              type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"}
              className="h-8 text-sm bg-neutral-950 border-white/20 text-white" />
          )}
          <Button size="sm" className="h-8 font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </Button>
          <button type="button" className="text-white/50 hover:text-white p-1" onClick={() => setEditing(false)} aria-label="Cancel"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <div className="mt-0.5 flex items-start gap-2 group">
          <p className={`flex-1 min-w-0 text-sm leading-snug break-words ${empty ? "text-white/30" : "text-white/90"}`}>{empty ? "—" : shown}</p>
          <div className="flex items-center gap-0.5 shrink-0 opacity-60 group-hover:opacity-100">
            {!empty && (
              <button type="button" onClick={copy} className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10" title="Copy" aria-label={`Copy ${field.label}`}>
                {done ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
            <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className="p-1 rounded text-white/60 hover:text-white hover:bg-white/10" title={empty ? "Fill in" : "Edit"} aria-label={`Edit ${field.label}`}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {field.seed && savedWhen && (
              <button type="button" onClick={() => void onReset()} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10" title="Reset to website text" aria-label={`Reset ${field.label} to the website text`}>
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
      {editing && field.help && <p className="text-[11px] text-white/40 mt-1">{field.help}</p>}
    </div>
  );
}

/** A paragraph or a list: its own card, folded to title + gist; Copy from the fold, Edit once open. */
function TextCard({ field, value, fromSite, savedWhen, onSave, onReset, open, onToggle }: FieldProps & { open: boolean; onToggle: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const empty = !value.trim();
  const save = async () => {
    setBusy(true);
    try { await onSave(draft); setEditing(false); toast.success(`${field.label} saved to the Grant Vault`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <GcCard
      title={field.label}
      open={open}
      onToggle={onToggle}
      blurb={
        open ? (
          <span className="inline-flex items-center gap-2 flex-wrap">
            {field.required && empty && <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wide text-amber-300"><AlertCircle className="w-3 h-3" /> Needed</span>}
            {fromSite && !empty && <span className="font-bold uppercase tracking-wide rounded px-1 py-0.5 bg-sky-500/15 text-sky-200">From the website</span>}
            {savedWhen && <span>Your words · saved {savedWhen}</span>}
            {field.help && <span>{field.help}</span>}
          </span>
        ) : empty ? (
          <span className="inline-flex items-center gap-1 text-amber-300/80">{field.required && <AlertCircle className="w-3 h-3" />} Not filled in yet{field.gist ? ` — ${field.gist}` : ""}</span>
        ) : (
          field.gist ?? firstLine(value)
        )
      }
      right={
        !editing && (
          <>
            {!empty && (
              <Button size="sm" variant="outline" className={outline} onClick={() => copyText(value, field.label)}>
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
              </Button>
            )}
            {open && (
              <Button size="sm" variant="outline" className={outline} onClick={() => { setDraft(value); setEditing(true); }}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> {empty ? "Fill in" : "Edit"}
              </Button>
            )}
          </>
        )
      }
    >
      {editing ? (
        <div className="p-4 space-y-2">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(24, Math.max(4, draft.split("\n").length + 1))}
            placeholder={field.kind === "list" ? "One per line" : undefined}
            className="bg-black/40 border-white/15 text-sm leading-relaxed text-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy || draft.trim() === value.trim()} onClick={() => void save()}>
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />} Save to the Vault
            </Button>
            <Button size="sm" variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
            {field.seed && savedWhen && (
              <button type="button" onClick={() => { void onReset(); setEditing(false); }} className="ml-auto text-[11px] text-white/40 hover:text-white inline-flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Reset to website text
              </button>
            )}
          </div>
        </div>
      ) : empty ? (
        <p className="p-4 text-[12px] text-amber-300/80">Not filled in yet. Open Edit to fill it in.</p>
      ) : (
        <div className="p-4 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{value}</div>
      )}
    </GcCard>
  );
}

export default function GrantVault() {
  const { user } = useAuth();
  const { ask, dialog } = useAsk();
  const snap = useSnapshot();
  const vault = useVault();
  const [q, setQ] = useState("");
  // Which cards are open. Everything starts folded: the Vault is a library index.
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setOpened((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const completeness = orgCompleteness(vault.saved);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (...texts: string[]) => !words.length || words.every((w) => texts.join(" ").toLowerCase().includes(w));
  // A search opens every card it finds; without one, a card is open only when clicked.
  const isOpen = (id: string) => words.length > 0 || opened.has(id);
  const allApproved = snap.approved.length === snap.sections.length && snap.sections.length > 0;

  // Every card id, for Open all / Fold all.
  const allIds = useMemo(() => ORG_SECTIONS.flatMap((s) => [
    ...(s.snapshot ? [`snap:${s.snapshot}`] : []),
    ...(s.fields.some((f) => f.kind !== "long" && f.kind !== "list") ? [`facts:${s.key}`] : []),
    ...s.fields.filter((f) => f.kind === "long" || f.kind === "list").map((f) => `field:${f.key}`),
  ]), []);

  return (
    <div className="space-y-5">
      {dialog}
      <GcCard
        icon={<Library className="w-4 h-4" />}
        title="Grant Vault · one source of truth"
        blurb={`Everything a funder asks, in the order they ask it. Each section opens with the approved paragraph for ${shortYear(snap.shown)}, locked word for word, and the facts it draws on sit under it. Click a title to read it; Copy works without opening.`}
        right={
          <Button size="sm" variant="outline" className={outline} disabled={!snap.approved.length} onClick={() => copyText(snapshotText(snap.approved), `The ${shortYear(snap.shown)} story`)}>
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy the year
          </Button>
        }
      >
        <div className="px-4 py-3 flex flex-wrap items-center gap-2 text-xs">
          {snap.allYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => snap.setYear(y)}
              className={`rounded-full border px-3 py-1 font-semibold ${y === snap.shown ? "text-black" : "border-white/15 text-white/70 hover:bg-white/10"}`}
              style={y === snap.shown ? { backgroundColor: GC_BLUE, borderColor: GC_BLUE } : undefined}
            >
              {shortYear(y)}
            </button>
          ))}
          <span className="text-white/45">
            {allApproved ? "All four paragraphs approved." : `${snap.approved.length} of ${snap.sections.length} paragraphs approved — only approved ones are copied or used by Grant Coach.`}
            {" · "}{completeness.done} of {completeness.total} required facts filled.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setOpened(new Set(allIds))} className="inline-flex items-center gap-1 text-white/55 hover:text-white" title="Open every card">
              <ChevronsUpDown className="w-3.5 h-3.5" /> Open all
            </button>
            <button type="button" onClick={() => setOpened(new Set())} className="inline-flex items-center gap-1 text-white/55 hover:text-white" title="Fold every card to its title">
              <ChevronsDownUp className="w-3.5 h-3.5" /> Fold all
            </button>
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a fact or a line" className="h-8 pl-8 text-sm bg-neutral-950 border-white/15 text-white" />
            </div>
          </div>
        </div>
      </GcCard>

      {snap.isError && <p className="text-sm text-red-400">Couldn't load the year's paragraphs: {snap.error?.message}</p>}
      {(snap.isLoading || vault.isLoading) && <p className="text-sm text-white/50 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading the Vault…</p>}

      {ORG_SECTIONS.map((section) => {
        const snapRow = section.snapshot ? snap.sections.find((s) => s.section_key === section.snapshot) : undefined;
        const showSnap = snapRow && matches(snapRow.title, snapRow.body);
        const fields = section.fields.filter((f) => matches(f.label, f.gist ?? "", orgFieldValue(f, vault.saved)));
        if (!showSnap && !fields.length) return null;
        const facts = fields.filter((f) => f.kind !== "long" && f.kind !== "list");
        const texts = fields.filter((f) => f.kind === "long" || f.kind === "list");
        const needed = facts.filter((f) => f.required && !orgFieldValue(f, vault.saved).trim()).length;
        const props = (f: OrgField): FieldProps => ({
          field: f,
          value: orgFieldValue(f, vault.saved),
          fromSite: vault.saved[f.key] === undefined && !!f.seed,
          savedWhen: vault.saved[f.key] !== undefined ? when(vault.savedAt[f.key]) : undefined,
          onSave: (v: string) => vault.save(f, v),
          onReset: () => vault.reset(f),
        });
        const factsId = `facts:${section.key}`;
        return (
          <section key={section.key} className="space-y-3">
            <div className="pt-2">
              <h2 className="text-base font-black uppercase tracking-wide" style={{ color: GC_BLUE }}>{section.title}</h2>
              <p className="text-[12px] text-white/50">{section.blurb}</p>
            </div>
            {showSnap && snapRow && (
              <SnapshotSectionCard
                key={`${snapRow.program_year}-${snapRow.section_key}`}
                section={snapRow}
                previous={snap.previous.find((p) => p.section_key === snapRow.section_key && p.status === "approved")?.body ?? null}
                userId={user?.id ?? null}
                ask={ask}
                onChanged={snap.refresh}
                open={isOpen(`snap:${snapRow.section_key}`)}
                onToggle={() => toggle(`snap:${snapRow.section_key}`)}
              />
            )}
            {facts.length > 0 && (
              <GcCard
                title="The facts"
                open={isOpen(factsId)}
                onToggle={() => toggle(factsId)}
                blurb={
                  isOpen(factsId)
                    ? "Short answers that go straight into a portal box. Hover a line for Copy and Edit."
                    : <span className="inline-flex items-center gap-2 flex-wrap">
                        {needed > 0 && <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wide text-amber-300"><AlertCircle className="w-3 h-3" /> {needed} needed</span>}
                        <span>{facts.map((f) => f.label).join(" · ")}</span>
                      </span>
                }
              >
                <div className="px-4 py-1 grid gap-x-8 md:grid-cols-2 divide-y divide-white/[0.06] md:divide-y-0">
                  {facts.map((f) => <FactRow key={f.key} {...props(f)} />)}
                </div>
              </GcCard>
            )}
            {texts.map((f) => <TextCard key={f.key} {...props(f)} open={isOpen(`field:${f.key}`)} onToggle={() => toggle(`field:${f.key}`)} />)}
          </section>
        );
      })}
    </div>
  );
}
