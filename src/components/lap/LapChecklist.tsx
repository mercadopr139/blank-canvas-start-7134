// The standing checklist under a checkpoint (Josh, 2026-10-19): what we
// look at every week at this topic. Two levels and no more — a heading
// ("Daily Duties") with sub-lines under it ("Review Current System"), ticked
// as they are reviewed; ticks belong to the lap, so they reset each Monday.
// Any line carries a standing note (click the line). A line that needs
// doing becomes a commitment ("+"). A sub-line never has children: the
// database refuses it, and nothing here offers it.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Check, Circle, Plus, Pencil, X, StickyNote, CornerDownRight, ExternalLink, Link2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { linkTarget, linkChoices, markLeavingLap } from "@/lib/lap/links";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { useAsk } from "@/components/admin/AskDialog";

const NLA_RED = "#bf0f3e";

export interface ChecklistItem { id: string; title: string; sort_order: number; parent_id: string | null; note: string | null; link_app: string | null }

interface Props {
  lapId: string;
  topicId: string;
  ask: ReturnType<typeof useAsk>["ask"];
  /** Turn a line into a commitment: the page prefills its "Add a commitment" box. */
  onMakeCommitment: (title: string) => void;
}

const LapChecklist = ({ lapId, topicId, ask, onMakeCommitment }: Props) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [subDraft, setSubDraft] = useState<{ parentId: string; text: string } | null>(null);
  const [openNote, setOpenNote] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["lap-checklist", topicId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_checklist_items" as never).select("id, title, sort_order, parent_id, note, link_app").eq("topic_id", topicId).is("retired_at", null).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as ChecklistItem[];
    },
  });
  const { data: ticked = [] } = useQuery({
    queryKey: ["lap-checklist-ticks", lapId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_checklist_ticks" as never).select("item_id").eq("lap_id", lapId);
      if (error) throw error;
      return ((data ?? []) as unknown as { item_id: string }[]).map((r) => r.item_id);
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["lap-checklist", topicId] });
    qc.invalidateQueries({ queryKey: ["lap-checklist-ticks", lapId] });
  };

  const headings = items.filter((i) => !i.parent_id);
  const childrenOf = (id: string) => items.filter((i) => i.parent_id === id);
  /** A heading with sub-lines is reviewed when all of them are; alone, it has its own tick. */
  const isReviewed = (item: ChecklistItem): boolean => {
    const kids = item.parent_id ? [] : childrenOf(item.id);
    return kids.length ? kids.every((k) => ticked.includes(k.id)) : ticked.includes(item.id);
  };
  const leaves = items.filter((i) => i.parent_id || childrenOf(i.id).length === 0);
  const done = leaves.filter((i) => ticked.includes(i.id)).length;

  const setTicks = async (ids: string[], on: boolean) => {
    const { error } = on
      ? await supabase.from("lap_checklist_ticks" as never).upsert(ids.map((item_id) => ({ lap_id: lapId, item_id, ticked_by: user?.id ?? null })) as never, { onConflict: "lap_id,item_id", ignoreDuplicates: true })
      : await supabase.from("lap_checklist_ticks" as never).delete().eq("lap_id", lapId).in("item_id", ids);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const toggle = (item: ChecklistItem) => {
    const kids = item.parent_id ? [] : childrenOf(item.id);
    const ids = kids.length ? kids.map((k) => k.id) : [item.id];
    void setTicks(ids, !isReviewed(item));
  };

  const addLine = async (title: string, parentId: string | null) => {
    const t = title.trim();
    if (!t) return false;
    const siblings = parentId ? childrenOf(parentId) : headings;
    setBusy(true);
    const { error } = await supabase.from("lap_checklist_items" as never).insert({ topic_id: topicId, parent_id: parentId, title: t, sort_order: siblings.length, created_by: user?.id ?? null } as never);
    setBusy(false);
    if (error) { toast.error(error.message); return false; }
    refresh();
    return true;
  };
  const addHeading = async () => { if (await addLine(draft, null)) setDraft(""); };
  const addSub = async () => {
    if (!subDraft) return;
    if (await addLine(subDraft.text, subDraft.parentId)) setSubDraft({ parentId: subDraft.parentId, text: "" });
  };
  const rename = async (item: ChecklistItem) => {
    const r = await ask.prompt({ title: "Rename this line", fields: [{ key: "title", label: "Line", defaultValue: item.title, required: true }], confirmLabel: "Save" });
    const title = r?.title?.trim();
    if (!title || title === item.title) return;
    const { error } = await supabase.from("lap_checklist_items" as never).update({ title, updated_at: new Date().toISOString() } as never).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const remove = async (item: ChecklistItem) => {
    const kids = item.parent_id ? [] : childrenOf(item.id);
    const ok = await ask.confirm({
      title: `Remove "${item.title}" from this checkpoint?`,
      body: kids.length ? `Its ${kids.length} sub-line${kids.length === 1 ? "" : "s"} go with it. Past laps keep their record.` : "It leaves the list for every lap from now on. Past laps keep their record.",
      confirmLabel: "Remove", danger: true,
    });
    if (!ok) return;
    const ids = [item.id, ...kids.map((k) => k.id)];
    const { error } = await supabase.from("lap_checklist_items" as never).update({ retired_at: new Date().toISOString() } as never).in("id", ids);
    if (error) { toast.error(error.message); return; }
    if (openNote?.id === item.id) setOpenNote(null);
    refresh();
  };
  const saveNote = async () => {
    if (!openNote) return;
    const note = openNote.text.trim() || null;
    const { error } = await supabase.from("lap_checklist_items" as never).update({ note, updated_at: new Date().toISOString() } as never).eq("id", openNote.id);
    if (error) { toast.error(error.message); return; }
    setOpenNote(null);
    refresh();
  };
  const setLink = async (item: ChecklistItem, appKey: string | null) => {
    const { error } = await supabase.from("lap_checklist_items" as never).update({ link_app: appKey, updated_at: new Date().toISOString() } as never).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  /** Leave for the page a line is about; the "Back to the lap" pill follows. */
  const openLink = (path: string) => { markLeavingLap(); navigate(path); };
  const choices = linkChoices();
  const toggleNote = (item: ChecklistItem) => setOpenNote((o) => (o?.id === item.id ? null : { id: item.id, text: item.note ?? "" }));

  const renderLine = (item: ChecklistItem, sub: boolean) => {
    const reviewed = isReviewed(item);
    const noteOpen = openNote?.id === item.id;
    const target = linkTarget(item.link_app);
    return (
      <li key={item.id} className={sub ? "ml-7" : ""}>
        <div className="group flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-white/[0.04]">
          <button onClick={() => toggle(item)} className={`shrink-0 ${reviewed ? "text-emerald-300" : "text-white/35 hover:text-white"}`} aria-label={reviewed ? "Not reviewed yet" : "Reviewed"}>
            {reviewed ? <Check className={sub ? "w-4 h-4" : "w-5 h-5"} /> : <Circle className={sub ? "w-4 h-4" : "w-5 h-5"} />}
          </button>
          <button onClick={() => toggleNote(item)} title={item.note ? "Open the note" : "Add a note"} className={`flex-1 min-w-0 text-left truncate ${sub ? "text-sm" : "text-[15px] font-semibold"} ${reviewed ? "text-white/45" : sub ? "text-white/80" : "text-white"}`}>
            {item.title}
            {item.note && <StickyNote className="inline w-3.5 h-3.5 ml-2 align-[-2px] text-amber-300/80" aria-label="Has a note" />}
          </button>
          {target && (
            <button onClick={() => openLink(target.path)} title={`Open ${target.label}`} className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-white/60 hover:text-white hover:border-[#bf0f3e] hover:bg-[#bf0f3e]/15 transition-colors">
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Open</span>
            </button>
          )}
          <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {!sub && <button onClick={() => setSubDraft((d) => (d?.parentId === item.id ? null : { parentId: item.id, text: "" }))} title="Add a sub-line" aria-label="Add a sub-line" className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"><CornerDownRight className="w-4 h-4" /></button>}
            <button onClick={() => onMakeCommitment(item.title)} title="Make this a commitment" aria-label="Make this a commitment" className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"><Plus className="w-4 h-4" /></button>
            <button onClick={() => void rename(item)} title="Rename" aria-label="Rename" className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"><Pencil className="w-3.5 h-3.5" /></button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button title={target ? `Linked to ${target.label} — change` : "Link this line to a page"} aria-label="Link to a page" className={`p-1 rounded hover:bg-white/10 ${target ? "text-[#bf0f3e] hover:text-white" : "text-white/50 hover:text-white"}`}><Link2 className="w-4 h-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto bg-neutral-900 border-white/[0.08] shadow-2xl text-white">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">Open this page from the line</DropdownMenuLabel>
                {choices.map((g) => (
                  <div key={g.group}>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">{g.group}</DropdownMenuLabel>
                    {g.apps.map((a) => (
                      <DropdownMenuItem key={a.key} onSelect={() => void setLink(item, a.key)} className="cursor-pointer text-white/85 focus:text-white focus:bg-white/10">
                        <span className="w-4 mr-1.5 inline-flex justify-center">{a.key === item.link_app ? <Check className="w-3.5 h-3.5 text-[#bf0f3e]" /> : null}</span>{a.label}
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}
                {target && (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onSelect={() => void setLink(item, null)} className="cursor-pointer text-zinc-400 focus:text-white focus:bg-white/10"><span className="w-4 mr-1.5" />Remove the link</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={() => void remove(item)} title="Remove from this checkpoint" aria-label="Remove" className="p-1 rounded text-white/50 hover:text-red-300 hover:bg-white/10"><X className="w-4 h-4" /></button>
          </span>
        </div>
        {noteOpen && (
          <div className="ml-8 mr-1 mb-2 rounded-lg border border-amber-300/20 bg-amber-300/5 p-2 space-y-2">
            <Textarea autoFocus value={openNote.text} onChange={(e) => setOpenNote({ id: item.id, text: e.target.value })} placeholder="A standing note for this line — it stays week to week." rows={3} className="bg-neutral-950 border-neutral-800 text-white text-sm" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpenNote(null)} className="text-white/60 hover:text-white hover:bg-white/10">Close</Button>
              <Button size="sm" onClick={() => void saveNote()} className="text-white" style={{ backgroundColor: NLA_RED }}>Save note</Button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-bold text-sm uppercase tracking-wide text-white/60">Every week, we look at</h3>
        {leaves.length > 0 && <span className={`text-xs font-semibold ${done === leaves.length ? "text-emerald-300" : "text-white/40"}`}>{done}/{leaves.length} reviewed</span>}
      </div>
      {items.length === 0 && <p className="text-sm text-white/35">Nothing standing here yet. Add the topics you review every week at this checkpoint.</p>}
      <ul className="space-y-0.5">
        {headings.map((h) => (
          <li key={h.id}>
            <ul className="space-y-0.5">
              {renderLine(h, false)}
              {childrenOf(h.id).map((c) => renderLine(c, true))}
              {subDraft?.parentId === h.id && (
                <li className="ml-7 flex gap-2 py-1">
                  <Input autoFocus value={subDraft.text} onChange={(e) => setSubDraft({ parentId: h.id, text: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") void addSub(); if (e.key === "Escape") setSubDraft(null); }} placeholder={`A sub-line under ${h.title}…`} className="h-8 bg-neutral-950 border-neutral-800 text-white text-sm" />
                  <Button size="sm" onClick={() => void addSub()} disabled={busy || !subDraft.text.trim()} className="h-8 text-white" style={{ backgroundColor: NLA_RED }}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setSubDraft(null)} className="h-8 text-white/60 hover:text-white hover:bg-white/10">Done</Button>
                </li>
              )}
            </ul>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 pt-2 border-t border-white/10">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void addHeading(); }} placeholder="Add a topic we review every week…" className="bg-neutral-950 border-neutral-800 text-white" />
        <Button size="sm" onClick={() => void addHeading()} disabled={busy || !draft.trim()} className="text-white" style={{ backgroundColor: NLA_RED }}>Add</Button>
      </div>
      <p className="text-[11px] text-white/35">Same lines every lap; ticks reset each Monday. Click a line for its note. Hover: ↵ adds a sub-line, + turns it into a commitment, the link icon makes it open a page.</p>
    </section>
  );
};

export default LapChecklist;
