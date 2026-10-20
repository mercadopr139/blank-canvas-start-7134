// The standing checklist under a checkpoint (Josh, 2026-10-19): what we
// look at every week at this topic. Two levels and no more — a heading
// ("Daily Duties") with sub-lines under it ("Review Current System"), ticked
// as they are reviewed; ticks belong to the lap, so they reset each Monday.
// Any line carries a standing note (click the line). A line that needs
// doing becomes a weekly goal (the green target, as on the Workbench). A sub-line never has children: the
// database refuses it, and nothing here offers it.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Check, Circle, Plus, Pencil, X, StickyNote, ExternalLink, Link2, Flag, Globe, Paperclip, LayoutGrid, ChevronRight, ChevronLeft } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { linkTarget, linkChoices, markLeavingLap } from "@/lib/lap/links";
import { Input } from "@/components/ui/input";
import LapLineNote from "@/components/lap/LapLineNote";
import { parseNote, countOpen } from "@/lib/lap/noteList";
import { Button } from "@/components/ui/button";
import type { useAsk } from "@/components/admin/AskDialog";

const NLA_RED = "#bf0f3e";

export interface ChecklistItem {
  id: string; title: string; sort_order: number; parent_id: string | null; note: string | null; link_app: string | null;
  /** A web address the line opens (the USA Boxing schedule), and one file (a PDF or an image) kept in the lap-files bucket. */
  link_url: string | null; attachment_path: string | null; attachment_name: string | null;
}
const LAP_FILES_BUCKET = "lap-files";

interface Props {
  lapId: string;
  topicId: string;
  ask: ReturnType<typeof useAsk>["ask"];
  /** Turn a line (or sub-line) into a weekly goal: the page opens its weekly-goal window with these words. */
  onMakeGoal: (title: string, itemId: string) => void;
  /** "All reviewed": every line here is ticked and the lap moves to the next checkpoint. */
  onAllReviewed?: () => void;
}

const LapChecklist = ({ lapId, topicId, ask, onMakeGoal, onAllReviewed }: Props) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [subDraft, setSubDraft] = useState<{ parentId: string; text: string } | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["lap-checklist", topicId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lap_checklist_items" as never).select("id, title, sort_order, parent_id, note, link_app, link_url, attachment_path, attachment_name").eq("topic_id", topicId).is("retired_at", null).order("sort_order");
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
  /* A line that became a weekly goal this lap shows a gold tag; done, the
     line is ticked by the database (signals_tick_lap_line). */
  const { data: lineGoals = [] } = useQuery({
    queryKey: ["lap-line-goals", lapId],
    queryFn: async () => {
      const { data, error } = await supabase.from("signals").select("lap_checklist_item_id, status, title" as never).eq("lap_id" as never, lapId).not("lap_checklist_item_id" as never, "is", null).eq("is_archived", false).eq("is_trashed", false);
      if (error) throw error;
      return (data ?? []) as unknown as { lap_checklist_item_id: string; status: string; title: string | null }[];
    },
  });
  const goalOf = (itemId: string) => {
    const rows = lineGoals.filter((g) => g.lap_checklist_item_id === itemId);
    return rows.length ? { done: rows.every((g) => g.status === "Complete") } : null;
  };
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
  /* Most stops on most Mondays are "looked at, nothing new" — one tap (Josh, 2026-10-19). */
  const allReviewed = async () => {
    const left = leaves.filter((i) => !ticked.includes(i.id)).map((i) => i.id);
    if (left.length) await setTicks(left, true);
    onAllReviewed?.();
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
    if (openNote === item.id) setOpenNote(null);
    refresh();
  };
  // The note's running list saves itself after every change (no Save button).
  const saveNote = async (id: string, note: string | null) => {
    const { error } = await supabase.from("lap_checklist_items" as never).update({ note, updated_at: new Date().toISOString() } as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const setLink = async (item: ChecklistItem, appKey: string | null) => {
    const { error } = await supabase.from("lap_checklist_items" as never).update({ link_app: appKey, updated_at: new Date().toISOString() } as never).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  /* ── A web address or a file on the line (Josh, 2026-10-19) ── */
  const setWebLink = async (item: ChecklistItem) => {
    const r = await ask.prompt({ title: item.link_url ? "Change the web address" : "Open a web address from this line", body: "The USA Boxing schedule, a Drive file, any page on the web.", fields: [{ key: "url", label: "Web address", placeholder: "https://…", defaultValue: item.link_url ?? "" }], confirmLabel: "Save" });
    if (!r) return;
    const url = r.url.trim();
    if (!/^https?:\/\//i.test(url)) { toast.error("That doesn't look like a web address. It starts with https://"); return; }
    const { error } = await supabase.from("lap_checklist_items" as never).update({ link_url: url, updated_at: new Date().toISOString() } as never).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const clearWebLink = async (item: ChecklistItem) => {
    const { error } = await supabase.from("lap_checklist_items" as never).update({ link_url: null, updated_at: new Date().toISOString() } as never).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const fileInput = useRef<HTMLInputElement>(null);
  const attachTo = useRef<ChecklistItem | null>(null);
  const pickFile = (item: ChecklistItem) => { attachTo.current = item; fileInput.current?.click(); };
  const attach = async (file: File | undefined) => {
    const item = attachTo.current;
    if (!file || !item) return;
    if (file.size > 25 * 1024 * 1024) { toast.error("That file is over 25 MB."); return; }
    setBusy(true);
    try {
      const path = `checklist/${item.id}/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_").slice(0, 80)}`;
      const { error } = await supabase.storage.from(LAP_FILES_BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (error) throw error;
      const { error: e2 } = await supabase.from("lap_checklist_items" as never).update({ attachment_path: path, attachment_name: file.name, updated_at: new Date().toISOString() } as never).eq("id", item.id);
      if (e2) throw e2;
      if (item.attachment_path) await supabase.storage.from(LAP_FILES_BUCKET).remove([item.attachment_path]);
      toast.success(`${file.name} is on the line.`);
      refresh();
    } catch (e) {
      toast.error(`Couldn't attach the file: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
      attachTo.current = null;
    }
  };
  const openAttachment = async (item: ChecklistItem) => {
    if (!item.attachment_path) return;
    const { data, error } = await supabase.storage.from(LAP_FILES_BUCKET).createSignedUrl(item.attachment_path, 60 * 60);
    if (error || !data?.signedUrl) { toast.error("Couldn't open that file."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const removeAttachment = async (item: ChecklistItem) => {
    if (!item.attachment_path) return;
    const ok = await ask.confirm({ title: `Remove "${item.attachment_name ?? "the file"}"?`, body: "The file is deleted. The line stays.", confirmLabel: "Remove", danger: true });
    if (!ok) return;
    await supabase.storage.from(LAP_FILES_BUCKET).remove([item.attachment_path]);
    const { error } = await supabase.from("lap_checklist_items" as never).update({ attachment_path: null, attachment_name: null, updated_at: new Date().toISOString() } as never).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  /** Leave for the page a line is about; the "Back to the lap" pill follows. */
  const openLink = (path: string) => { markLeavingLap(); navigate(path); };
  const choices = linkChoices();
  // The link menu has two levels in one panel: what the line opens, and, a
  // level in, our pages. A side flyout ran off the screen edge (Josh, 2026-10-19).
  const [pagesFor, setPagesFor] = useState<string | null>(null);
  const toggleNote = (item: ChecklistItem) => setOpenNote((o) => (o === item.id ? null : item.id));

  const renderLine = (item: ChecklistItem, sub: boolean) => {
    const reviewed = isReviewed(item);
    const noteOpen = openNote === item.id;
    const target = linkTarget(item.link_app);
    const goal = goalOf(item.id);
    return (
      <li key={item.id} className={sub ? "ml-7" : ""}>
        <div className="group flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-white/[0.04]">
          <button onClick={() => toggle(item)} className={`shrink-0 ${reviewed ? "text-emerald-300" : "text-white/35 hover:text-white"}`} aria-label={reviewed ? "Not reviewed yet" : "Reviewed"}>
            {reviewed ? <Check className={sub ? "w-4 h-4" : "w-5 h-5"} /> : <Circle className={sub ? "w-4 h-4" : "w-5 h-5"} />}
          </button>
          <button onClick={() => toggleNote(item)} title={item.note ? "Open the note" : "Add a note"} className={`flex-1 min-w-0 text-left truncate ${sub ? "text-sm" : "text-[15px] font-semibold"} ${reviewed ? "text-white/45" : sub ? "text-white/80" : "text-white"}`}>
            {item.title}
            {item.note && (() => { const open = countOpen(parseNote(item.note)); return (
              <span className="inline-flex items-center gap-1 ml-2 align-[-2px] text-amber-300/80" aria-label={open ? `${open} open in its list` : "Has a note"}>
                <StickyNote className="w-3.5 h-3.5" />
                {open > 0 && <span className="text-[10px] font-semibold">{open}</span>}
              </span>
            ); })()}
          </button>
          {goal && (
            <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${goal.done ? "border-lime-400/30 bg-lime-400/10 text-lime-400/70" : "border-lime-400/50 bg-lime-400/15 text-lime-400"}`} title={goal.done ? "This week's goal, done" : "This week's goal"}>
              {goal.done ? <Check className="w-3 h-3" /> : <Flag className="w-3 h-3" />}
              <span className="hidden sm:inline">{goal.done ? "Goal done" : "Weekly goal"}</span>
            </span>
          )}
          {item.link_url && (
            <a href={item.link_url} target="_blank" rel="noreferrer" title={item.link_url} className="shrink-0 inline-flex items-center gap-1 rounded-full border border-sky-300/25 bg-sky-400/[0.06] px-2 py-0.5 text-[11px] font-medium text-sky-300/90 hover:text-sky-200 hover:border-sky-300/50">
              <Globe className="w-3 h-3" />
              <span className="hidden sm:inline max-w-[120px] truncate">{(() => { try { return new URL(item.link_url).hostname.replace(/^www\./, ""); } catch { return "Link"; } })()}</span>
            </a>
          )}
          {item.attachment_path && (
            <button onClick={() => void openAttachment(item)} title={`Open ${item.attachment_name ?? "the file"}`} className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-white/60 hover:text-white hover:border-white/30">
              <Paperclip className="w-3 h-3" />
              <span className="hidden sm:inline max-w-[140px] truncate">{item.attachment_name ?? "File"}</span>
            </button>
          )}
          {target && (
            <button onClick={() => openLink(target.path)} title={`Open ${target.label}`} className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium text-white/60 hover:text-white hover:border-[#bf0f3e] hover:bg-[#bf0f3e]/15 transition-colors">
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Open</span>
            </button>
          )}
          <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {!sub && <button onClick={() => setSubDraft((d) => (d?.parentId === item.id ? null : { parentId: item.id, text: "" }))} title="Add a sub-line" aria-label="Add a sub-line" className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"><Plus className="w-4 h-4" /></button>}
            <button onClick={() => onMakeGoal(item.title, item.id)} title="Make this a weekly goal" aria-label="Make this a weekly goal" className="p-1 rounded text-white/50 hover:text-lime-400 hover:bg-lime-400/10"><Flag className="w-4 h-4" /></button>
            <button onClick={() => void rename(item)} title="Rename" aria-label="Rename" className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"><Pencil className="w-3.5 h-3.5" /></button>
            <DropdownMenu onOpenChange={(o) => { if (!o) setPagesFor(null); }}>
              <DropdownMenuTrigger asChild>
                <button title={target || item.link_url || item.attachment_path ? "Change what this line opens" : "Add a web address, a file, or one of our pages"} aria-label="Link or attach" className={`p-1 rounded hover:bg-white/10 ${target || item.link_url || item.attachment_path ? "text-[#bf0f3e] hover:text-white" : "text-white/50 hover:text-white"}`}><Link2 className="w-4 h-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-neutral-900 border-white/[0.08] shadow-2xl text-white">
                {pagesFor === item.id ? (
                  <div className="max-h-80 overflow-y-auto">
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPagesFor(null); }} className="cursor-pointer text-zinc-400 focus:text-white focus:bg-white/10">
                      <ChevronLeft className="w-4 h-4 mr-1.5" /> Back
                    </DropdownMenuItem>
                    {choices.map((g, gi) => (
                      <div key={g.group}>
                        {gi > 0 && <DropdownMenuSeparator className="bg-white/10" />}
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">{g.group}</DropdownMenuLabel>
                        {g.apps.map((a) => (
                          <DropdownMenuItem key={a.key} onSelect={() => void setLink(item, a.key)} className="cursor-pointer text-white/85 focus:text-white focus:bg-white/10">
                            <span className="w-4 mr-2 inline-flex justify-center shrink-0">{a.key === item.link_app ? <Check className="w-3.5 h-3.5 text-[#bf0f3e]" /> : null}</span>{a.label}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                    {target && (
                      <>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onSelect={() => void setLink(item, null)} className="cursor-pointer text-zinc-400 focus:text-white focus:bg-white/10"><span className="w-4 mr-2" />Remove the page link</DropdownMenuItem>
                      </>
                    )}
                  </div>
                ) : (
                <>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">This line opens</DropdownMenuLabel>
                {/* A web address */}
                <DropdownMenuItem onSelect={() => void setWebLink(item)} className="cursor-pointer text-white/85 focus:text-white focus:bg-white/10">
                  <Globe className={`w-4 h-4 mr-2 shrink-0 ${item.link_url ? "text-sky-300" : "text-white/40"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block">{item.link_url ? "Web address" : "A web address…"}</span>
                    {item.link_url && <span className="block text-[11px] text-sky-300/80 truncate">{item.link_url.replace(/^https?:\/\/(www\.)?/i, "")}</span>}
                  </span>
                  {item.link_url && <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); void clearWebLink(item); }} title="Remove the web address" className="ml-2 p-1 rounded text-white/35 hover:text-red-300 hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>}
                </DropdownMenuItem>
                {/* A file */}
                <DropdownMenuItem onSelect={() => pickFile(item)} className="cursor-pointer text-white/85 focus:text-white focus:bg-white/10">
                  <Paperclip className={`w-4 h-4 mr-2 shrink-0 ${item.attachment_path ? "text-amber-300" : "text-white/40"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block">{item.attachment_path ? "Replace the file" : "A PDF or image…"}</span>
                    {item.attachment_name && <span className="block text-[11px] text-amber-300/80 truncate">{item.attachment_name}</span>}
                  </span>
                  {item.attachment_path && <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); void removeAttachment(item); }} title="Remove the file" className="ml-2 p-1 rounded text-white/35 hover:text-red-300 hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>}
                </DropdownMenuItem>
                {/* One of our pages: a level in, same panel */}
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPagesFor(item.id); }} className="cursor-pointer text-white/85 focus:text-white focus:bg-white/10">
                  <LayoutGrid className={`w-4 h-4 mr-2 shrink-0 ${target ? "text-[#bf0f3e]" : "text-white/40"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block">{target ? "One of our pages" : "One of our pages…"}</span>
                    {target && <span className="block text-[11px] text-white/50 truncate">{target.label}</span>}
                  </span>
                  <ChevronRight className="w-4 h-4 ml-2 text-white/35" />
                </DropdownMenuItem>
                </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={() => void remove(item)} title="Remove from this checkpoint" aria-label="Remove" className="p-1 rounded text-white/50 hover:text-red-300 hover:bg-white/10"><X className="w-4 h-4" /></button>
          </span>
        </div>
        {noteOpen && (
          <div className={sub ? "ml-7" : "ml-8"}>
            <LapLineNote
              note={item.note}
              onChange={(note) => void saveNote(item.id, note)}
              onClose={() => setOpenNote(null)}
              onMakeGoal={(title) => onMakeGoal(title, item.id)}
              goals={lineGoals.filter((g) => g.lap_checklist_item_id === item.id).map((g) => ({ title: g.title ?? "", done: g.status === "Complete" }))}
            />
          </div>
        )}
      </li>
    );
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-bold text-sm uppercase tracking-wide text-white/60">Every week, we look at</h3>
        <div className="flex items-center gap-3">
          {leaves.length > 0 && <span className={`text-xs font-semibold ${done === leaves.length ? "text-emerald-300" : "text-white/40"}`}>{done}/{leaves.length} reviewed</span>}
          {onAllReviewed && leaves.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => void allReviewed()} disabled={busy} className="h-7 bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white">
              <Check className="w-3.5 h-3.5 mr-1" /> All reviewed, next
            </Button>
          )}
        </div>
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
      <input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => void attach(e.target.files?.[0])} />
      <p className="text-[11px] text-white/35">Same lines every lap; ticks reset each Monday. Click a line for its note. Hover: + adds a sub-line, the flag makes it a weekly goal, the link icon adds a web address, a PDF or image, or one of our pages.</p>
    </section>
  );
};

export default LapChecklist;
