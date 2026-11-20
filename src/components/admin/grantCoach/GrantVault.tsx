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
//
// SHELVES AND CARDS BY SUBJECT (Josh, 2026-11-20: "it has so much… I think
// we need to regroup", then "I want this area to be so user friendly that
// anyone can easily pull important NLA info from it", then "read a section
// and think, yup, that's where I will find the information"). Three kinds of
// content had shared one list organized the way funders ask. The page is now
// five shelves named for the question in his head: THE PARAGRAPHS (the six
// standard paragraphs — what he reuses: Copy, Talk to Grant Coach, the
// narrative), NLA ON PAPER, THE MONEY, WHAT WE DO AND WHO WE SERVE, OUR
// STORY, OUR PEOPLE, OUR PARTNERS — each a few cards named for what is
// inside, each card with one Copy for the whole of it; long prose carries a
// "source material" tag so a figure in it never outranks a paragraph or the
// live numbers. A shelf's title can be renamed in place (the pencil beside
// it; kept in grant_org_fields under shelf_title:<key>). Below an amber line:
// "How Grant Coach writes", settings for the writer, not NLA information.
// The shelves and cards are vaultShelves.ts; the fields and their saved
// values did not move.
import { useMemo, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Check, Pencil, Loader2, Search, Library, AlertCircle, RotateCcw, X, ChevronsDownUp, ChevronsUpDown, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import GcCard, { GC_BLUE } from "@/components/admin/grantCoach/GcCard";
import SnapshotSectionCard, { useSnapshot, copyText, outline } from "@/components/admin/grantCoach/SnapshotSection";
import { useAsk } from "@/components/admin/AskDialog";
import { ORG_SECTIONS, ORG_FIELDS, orgFieldValue, orgCompleteness, formatEin, type OrgField } from "@/lib/grantCoach/orgProfile";
import { VAULT_SHELVES, WRITER_CARDS, ALL_VAULT_CARDS, PARAGRAPHS_SHELF, shelfTitleKey, cardTitleKey, type VaultCardDef } from "@/lib/grantCoach/vaultShelves";
import { shortYear, snapshotText } from "@/lib/grantCoach/snapshot";

interface FieldRow { key: string; value: string | null; updated_at: string }

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

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
  /** A row that is not a field — a renamed shelf title (2026-11-20); null drops it. */
  const saveRaw = async (key: string, value: string | null) => {
    const { error } = value === null
      ? await supabase.from("grant_org_fields" as never).delete().eq("key", key)
      : await supabase.from("grant_org_fields" as never).upsert({ key, value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null } as never, { onConflict: "key" } as never);
    if (error) throw new Error(error.message);
    invalidate();
  };
  return { saved, savedAt, isLoading, save, reset, saveRaw };
}

interface FieldProps {
  field: OrgField; value: string; fromSite: boolean; savedWhen?: string;
  onSave: (v: string) => Promise<void>; onReset: () => Promise<void>;
}

/** A row in a card: short, a number, a date, yes/no. Lists and long texts are blocks. */
const isRow = (f: OrgField) => f.kind !== "long" && f.kind !== "list";

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

/** A list or a long text inside a card: its label, Copy and Edit, the text. `bare` when it is the card's only field. */
function TextBlock({ field, value, fromSite, savedWhen, onSave, onReset, bare }: FieldProps & { bare: boolean }) {
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
    <div className={bare ? "" : "border-t border-white/[0.06] first:border-0"}>
      <div className="px-4 pt-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {!bare && <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">{field.label}</p>}
          <p className="text-[11px] text-white/40 inline-flex items-center gap-2 flex-wrap">
            {field.required && empty && <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wide text-amber-300"><AlertCircle className="w-3 h-3" /> Needed</span>}
            {fromSite && !empty && <span className="font-bold uppercase tracking-wide rounded px-1 py-0.5 bg-sky-500/15 text-sky-200">From the website</span>}
            {savedWhen && <span>Your words · saved {savedWhen}</span>}
            {field.help && <span>{field.help}</span>}
          </p>
        </div>
        {!editing && (
          <span className="inline-flex items-center gap-1.5 shrink-0">
            {!empty && (
              <Button size="sm" variant="outline" className={outline} onClick={() => copyText(value, field.label)}>
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
              </Button>
            )}
            <Button size="sm" variant="outline" className={outline} onClick={() => { setDraft(value); setEditing(true); }}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> {empty ? "Fill in" : "Edit"}
            </Button>
          </span>
        )}
      </div>
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
        <p className="px-4 pb-3 pt-1 text-[12px] text-amber-300/80">Not filled in yet. Open Edit to fill it in.</p>
      ) : (
        <div className="px-4 pb-4 pt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{value}</div>
      )}
    </div>
  );
}

/** The whole card as text for the clipboard: rows as "Label: value", blocks under their label; a one-field card is just its text. */
const cardText = (fields: OrgField[], valueOf: (f: OrgField) => string) => {
  const filled = fields.filter((f) => valueOf(f).trim());
  if (filled.length === 1 && !isRow(filled[0])) return valueOf(filled[0]);
  return filled.map((f) => (isRow(f) ? `${f.label}: ${valueOf(f)}` : `${f.label.toUpperCase()}\n${valueOf(f)}`)).join("\n\n");
};

/**
 * One card of a shelf: its subject, the rows, then the lists and long texts.
 * One Copy for all of it. Its title can be renamed in place (Josh,
 * 2026-11-20): the pencil in the header, Enter saves, Escape cancels, and a
 * renamed card offers its shipped name back.
 */
function VaultCard({ def, title, fields, props, open, onToggle, onRename }: {
  def: VaultCardDef; title: string; fields: OrgField[]; props: (f: OrgField) => FieldProps; open: boolean; onToggle: () => void;
  onRename: (name: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);
  const rows = fields.filter(isRow);
  const blocks = fields.filter((f) => !isRow(f));
  const valueOf = (f: OrgField) => props(f).value;
  const needed = fields.filter((f) => f.required && !valueOf(f).trim()).length;
  const filled = fields.filter((f) => valueOf(f).trim()).length;
  const bare = fields.length === 1 && blocks.length === 1;
  const saveName = async (name: string | null) => {
    setBusy(true);
    try { await onRename(name); setEditing(false); toast.success(name ? `Card renamed to "${name}"` : `Card named "${def.title}" again`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const nameOrNull = (v: string) => (v.trim() && v.trim() !== def.title ? v.trim() : null);
  return (
    <GcCard
      title={
        editing ? (
          // Inside the header band, which toggles the card on a click: the edit swallows its clicks.
          <span className="inline-flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveName(nameOrNull(draft)); } if (e.key === "Escape") setEditing(false); }}
              className="h-8 w-72 text-sm font-black uppercase tracking-wide bg-neutral-950 border-white/20 text-white"
              aria-label="Card title"
            />
            <Button size="sm" className="h-8 font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy || !draft.trim()} onClick={() => void saveName(nameOrNull(draft))}>
              {busy ? <Loader2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            </Button>
            <button type="button" className="text-white/50 hover:text-white p-1" onClick={() => setEditing(false)} aria-label="Cancel"><X className="w-4 h-4" /></button>
            {title !== def.title && (
              <button type="button" onClick={() => void saveName(null)} className="text-[11px] normal-case tracking-normal font-normal text-white/40 hover:text-white inline-flex items-center gap-1" title={`Back to "${def.title}"`}>
                <RotateCcw className="w-3 h-3" /> Back to "{def.title}"
              </button>
            )}
          </span>
        ) : title
      }
      open={open}
      onToggle={onToggle}
      blurb={
        <span className="inline-flex items-center gap-2 flex-wrap">
          {needed > 0 && <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wide text-amber-300"><AlertCircle className="w-3 h-3" /> {needed} needed</span>}
          {def.source && <span className="font-bold uppercase tracking-wide rounded px-1 py-0.5 bg-white/10 text-white/60" title="Grant Coach reads this for story and voice. A figure here never outranks a standard paragraph or the live numbers.">Source material</span>}
          <span>{def.gist}</span>
        </span>
      }
      right={
        !editing && (
          <>
            <button type="button" onClick={() => { setDraft(title); setEditing(true); }} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10" title="Rename this card" aria-label={`Rename the card "${title}"`}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {filled > 0 && (
              <Button size="sm" variant="outline" className={outline} onClick={() => copyText(cardText(fields, valueOf), title)} title={bare ? "Copy the text" : "Copy the whole card, each line with its label"}>
                <Copy className="w-3.5 h-3.5 mr-1.5" /> {bare ? "Copy" : "Copy the card"}
              </Button>
            )}
          </>
        )
      }
    >
      {rows.length > 0 && (
        <div className="px-4 py-1 grid gap-x-8 md:grid-cols-2 divide-y divide-white/[0.06] md:divide-y-0">
          {rows.map((f) => <FactRow key={f.key} {...props(f)} />)}
        </div>
      )}
      {blocks.map((f) => <TextBlock key={f.key} {...props(f)} bare={bare} />)}
    </GcCard>
  );
}

/**
 * A shelf's heading: its number, its name, one line on what sits there. The
 * name can be changed in place (Josh, 2026-11-20: "I want the ability to
 * manually edit the section title"): the pencil, Enter saves, Escape cancels,
 * and a renamed shelf offers its shipped name back.
 */
function Shelf({ n, title, shipped, blurb, onRename }: {
  n: number; title: string; shipped: string; blurb: string; onRename: (name: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [busy, setBusy] = useState(false);
  const save = async (name: string | null) => {
    setBusy(true);
    try { await onRename(name); setEditing(false); toast.success(name ? `Shelf renamed to "${name}"` : `Shelf named "${shipped}" again`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="pt-3">
      <div className="flex items-center gap-2 flex-wrap group">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-black" style={{ backgroundColor: GC_BLUE }}>{n}</span>
        {editing ? (
          <>
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(draft.trim() && draft.trim() !== shipped ? draft.trim() : null); } if (e.key === "Escape") setEditing(false); }}
              className="h-8 w-72 text-sm font-black uppercase tracking-wide bg-neutral-950 border-white/20 text-white"
              aria-label="Shelf title"
            />
            <Button size="sm" className="h-8 font-bold text-black hover:brightness-110" style={{ backgroundColor: GC_BLUE }} disabled={busy || !draft.trim()} onClick={() => void save(draft.trim() !== shipped ? draft.trim() : null)}>
              {busy ? <Loader2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            </Button>
            <button type="button" className="text-white/50 hover:text-white p-1" onClick={() => setEditing(false)} aria-label="Cancel"><X className="w-4 h-4" /></button>
            {title !== shipped && (
              <button type="button" onClick={() => void save(null)} className="text-[11px] text-white/40 hover:text-white inline-flex items-center gap-1" title={`Back to "${shipped}"`}>
                <RotateCcw className="w-3 h-3" /> Back to "{shipped}"
              </button>
            )}
          </>
        ) : (
          <>
            <h2 className="text-base font-black uppercase tracking-wide" style={{ color: GC_BLUE }}>{title}</h2>
            <button type="button" onClick={() => { setDraft(title); setEditing(true); }} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 opacity-50 group-hover:opacity-100" title="Rename this shelf" aria-label={`Rename the shelf "${title}"`}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      <p className="text-[12px] text-white/50">{blurb}</p>
    </div>
  );
}

const fieldByKey = new Map(ORG_FIELDS.map((f) => [f.key, f]));
const fieldsOf = (def: VaultCardDef) => def.fields.map((k) => fieldByKey.get(k)).filter((f): f is OrgField => !!f);

export default function GrantVault({ memoryBelow = false }: {
  /** On Grant Coach home the story bank and the past answers follow; the amber line says so. */
  memoryBelow?: boolean;
}) {
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
  const allIds = useMemo(() => [
    ...ORG_SECTIONS.flatMap((s) => (s.snapshot ? [`snap:${s.snapshot}`] : [])),
    ...ALL_VAULT_CARDS.map((c) => `card:${c.key}`),
  ], []);

  const props = (f: OrgField): FieldProps => ({
    field: f,
    value: orgFieldValue(f, vault.saved),
    fromSite: vault.saved[f.key] === undefined && !!f.seed,
    savedWhen: vault.saved[f.key] !== undefined ? when(vault.savedAt[f.key]) : undefined,
    onSave: (v: string) => vault.save(f, v),
    onReset: () => vault.reset(f),
  });
  /** A card's name: Josh's, if he renamed it, else as shipped. */
  const cardTitle = (def: VaultCardDef) => vault.saved[cardTitleKey(def.key)]?.trim() || def.title;
  /** A card shows when its title (either name), its gist, or any line in it matches the search. */
  const cardOf = (def: VaultCardDef) => {
    const fields = fieldsOf(def);
    if (!matches(def.title, cardTitle(def), def.gist, ...fields.flatMap((f) => [f.label, orgFieldValue(f, vault.saved)]))) return null;
    return (
      <VaultCard
        key={def.key} def={def} title={cardTitle(def)} fields={fields} props={props}
        open={isOpen(`card:${def.key}`)} onToggle={() => toggle(`card:${def.key}`)}
        onRename={(name) => vault.saveRaw(cardTitleKey(def.key), name)}
      />
    );
  };

  // Shelf 1: one card per standard paragraph, in funder order.
  const paragraphs = ORG_SECTIONS.flatMap((section) => {
    const snapRow = section.snapshot ? snap.sections.find((s) => s.section_key === section.snapshot) : undefined;
    if (!snapRow || !matches(snapRow.title, snapRow.body)) return [];
    return [
      <SnapshotSectionCard
        key={`${snapRow.program_year}-${snapRow.section_key}`}
        section={snapRow}
        others={snap.sections}
        previous={snap.previous.find((p) => p.section_key === snapRow.section_key && p.status === "approved")?.body ?? null}
        userId={user?.id ?? null}
        ask={ask}
        onChanged={snap.refresh}
        open={isOpen(`snap:${snapRow.section_key}`)}
        onToggle={() => toggle(`snap:${snapRow.section_key}`)}
      />,
    ];
  });
  const writer = WRITER_CARDS.map(cardOf).filter(Boolean);
  /** A shelf's name: Josh's, if he renamed it, else as shipped. */
  const shelfTitle = (key: string, shipped: string) => vault.saved[shelfTitleKey(key)]?.trim() || shipped;
  const rename = (key: string) => (name: string | null) => vault.saveRaw(shelfTitleKey(key), name);

  return (
    <div className="space-y-5">
      {dialog}
      <GcCard
        icon={<Library className="w-4 h-4" />}
        title="Grant Vault · one source of truth"
        blurb={`Five shelves, named for what you came for: the six standard paragraphs for ${shortYear(snap.shown)}, NLA on paper, the money, what we do and who we serve, our story and our people. Click a title to read a card; Copy works without opening; the pencil beside a shelf renames it.`}
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
            {allApproved ? `All ${snap.sections.length} standard paragraphs approved.` : `${snap.approved.length} of ${snap.sections.length} standard paragraphs approved — only approved ones are offered on a question or used by Grant Coach.`}
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
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="EIN, board, Littles, 990…" className="h-8 pl-8 text-sm bg-neutral-950 border-white/15 text-white" />
            </div>
          </div>
        </div>
      </GcCard>

      {snap.isError && <p className="text-sm text-red-400">Couldn't load the year's paragraphs: {snap.error?.message}</p>}
      {(snap.isLoading || vault.isLoading) && <p className="text-sm text-white/50 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading the Vault…</p>}

      {/* Shelf 1 · the paragraphs: the six standard paragraphs, in funder order. */}
      {paragraphs.length > 0 && (
        <section className="space-y-3">
          <Shelf
            n={1}
            title={shelfTitle(PARAGRAPHS_SHELF.key, PARAGRAPHS_SHELF.title)}
            shipped={PARAGRAPHS_SHELF.title}
            onRename={rename(PARAGRAPHS_SHELF.key)}
            blurb={`The six standard paragraphs for ${shortYear(snap.shown)}, approved word for word. Use one in an answer, Copy it for another application, or talk to Grant Coach about it. Grant Coach reads these before anything else.`}
          />
          {paragraphs}
        </section>
      )}

      {/* Shelves 2–5: cards by subject (vaultShelves.ts). A shelf hides when the search finds nothing on it. */}
      {VAULT_SHELVES.map((shelf, i) => {
        const cards = shelf.cards.map(cardOf).filter(Boolean);
        if (!cards.length) return null;
        return (
          <section key={shelf.key} className="space-y-3">
            <Shelf n={i + 2} title={shelfTitle(shelf.key, shelf.title)} shipped={shelf.title} blurb={shelf.blurb} onRename={rename(shelf.key)} />
            {cards}
          </section>
        );
      })}

      {/* Below the amber line: not NLA information. The writer's settings, and (on Grant Coach home) its memory. */}
      {writer.length > 0 && (
        <section className="space-y-3 pt-5 border-t-2 border-dashed border-amber-400/60">
          <div>
            <h2 className="text-base font-black uppercase tracking-wide text-amber-300 inline-flex items-center gap-2">
              {/* Josh's words for it (2026-11-20): "sort of like a Grant Coach brain". */}
              <History className="w-4 h-4" /> Grant Coach's brain · how it writes and what it remembers
            </h2>
            <p className="text-[12px] text-amber-100/60 max-w-3xl">
              {memoryBelow
                ? "Not NLA information. How it writes: the proposal it imitates and the rules it learned from your edits. What it remembers: the story bank, and every answer you approved in a grant, reused as a starting point when the same question comes up. The Vault always wins over a memory."
                : "Not NLA information. How it writes: the proposal it imitates and the rules it learned from your edits. Its memory, the story bank and the answers from past grants, is on Grant Coach home. The Vault always wins over a memory."}
            </p>
          </div>
          {writer}
        </section>
      )}
    </div>
  );
}
