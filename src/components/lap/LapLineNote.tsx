// The note on a checklist line, as a running list (Josh, 2026-10-20): add
// items, nest one with Tab, cross them off, clear the done ones, send one
// up as a weekly goal. Every change saves itself; there is no Save button.
// Crossed-off items stay crossed off week to week — the line's own tick is
// the thing that resets each Monday.
import { useEffect, useRef, useState } from "react";
import { Check, Circle, Plus, X, Flag, CornerDownRight } from "lucide-react";
import { sameGoal } from "@/lib/lap/goals";
import { LAP_GREEN } from "@/lib/lap/commitments";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  parseNote, serializeNote, orderForDisplay, toggleItem, setItemText, setItemLevel, addItem, removeItem, clearDone, countOpen,
  type NoteItem,
} from "@/lib/lap/noteList";

interface Props {
  note: string | null;
  /** Called with the text to store after every change; null clears the note. */
  onChange: (note: string | null) => void;
  onClose: () => void;
  /** Send an item up as this week's goal. */
  onMakeGoal: (title: string) => void;
  /** This week's goals made from this line, so an item that became one wears the flag (Josh, 2026-10-20). */
  goals?: { title: string; done: boolean }[];
}

const LapLineNote = ({ note, onChange, onClose, onMakeGoal, goals = [] }: Props) => {
  const [items, setItems] = useState<NoteItem[]>(() => parseNote(note));
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  // Follow a change made elsewhere (another device, a goal ticking an item).
  useEffect(() => { setItems(parseNote(note)); }, [note]);

  const commit = (next: NoteItem[]) => {
    setItems(next);
    onChange(serializeNote(next));
  };
  const add = () => {
    const next = addItem(items, draft);
    if (next === items) return;
    commit(next);
    setDraft("");
    addRef.current?.focus();
  };
  const display = orderForDisplay(items);
  // Display order differs from storage order; map a display row back to its index.
  const indexOf = (item: NoteItem) => items.indexOf(item);
  const doneCount = items.length - countOpen(items);

  return (
    <div className="mr-1 mb-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.04] p-3 space-y-2" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      {items.length === 0 && <p className="text-xs text-white/35">A running list for this line. It stays week to week; cross things off as they get done.</p>}
      <ul className="space-y-0.5">
        {display.map((item) => {
          const idx = indexOf(item);
          // An item that is this week's goal: a filled lime flag, always visible;
          // a lime check once the goal is done. Matched by its words.
          const goal = goals.find((g) => sameGoal(g.title, item.text)) ?? null;
          return (
            <li key={idx} className={`group/note flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-white/[0.04] ${item.level ? "ml-6" : ""}`}>
              <button onClick={() => commit(toggleItem(items, idx))} className={`shrink-0 ${item.done ? "text-emerald-300" : "text-white/35 hover:text-white"}`} aria-label={item.done ? "Bring it back" : "Cross it off"}>
                {item.done ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </button>
              {editing === idx ? (
                <Input
                  autoFocus
                  defaultValue={item.text}
                  onBlur={(e) => { commit(setItemText(items, idx, e.target.value)); setEditing(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditing(null);
                    if (e.key === "Tab") { e.preventDefault(); commit(setItemLevel(items, idx, e.shiftKey ? 0 : 1)); }
                  }}
                  className="h-7 flex-1 bg-neutral-950 border-neutral-800 text-white text-sm"
                />
              ) : (
                <button onClick={() => setEditing(idx)} className={`flex-1 min-w-0 text-left text-sm truncate ${item.done ? "line-through text-white/40" : "text-white/85"}`} title="Click to edit · Tab nests it">
                  {goal && (
                    <span className="inline-flex items-center gap-1 mr-1.5 align-[-2px] rounded-full border px-1.5 py-px text-[10px] font-semibold" style={{ borderColor: `${LAP_GREEN}66`, background: `${LAP_GREEN}1a`, color: LAP_GREEN }} title={goal.done ? "This week's goal — done" : "This week's goal"}>
                      {goal.done ? <Check className="w-3 h-3" /> : <Flag className="w-3 h-3" fill={LAP_GREEN} />}
                      {goal.done ? "Goal done" : "Weekly goal"}
                    </span>
                  )}
                  {item.text}
                </button>
              )}
              <span className="flex items-center gap-0.5 opacity-0 group-hover/note:opacity-100 focus-within:opacity-100 transition-opacity">
                {!item.done && <button onClick={() => commit(setItemLevel(items, idx, item.level ? 0 : 1))} title={item.level ? "Un-nest" : "Nest under the item above"} aria-label="Nest" className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10"><CornerDownRight className="w-3.5 h-3.5" /></button>}
                {!item.done && !goal && <button onClick={() => onMakeGoal(item.text)} title="Make this a weekly goal" aria-label="Make this a weekly goal" className="p-1 rounded text-white/50 hover:text-lime-400 hover:bg-lime-400/10"><Flag className="w-3.5 h-3.5" /></button>}
                <button onClick={() => commit(removeItem(items, idx))} title="Remove" aria-label="Remove" className="p-1 rounded text-white/50 hover:text-red-300 hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2 pt-1">
        <Input
          ref={addRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder=""
          aria-label="Add an item"
          className="h-8 bg-neutral-950 border-neutral-800 text-white text-sm"
        />
        <Button size="sm" onClick={add} disabled={!draft.trim()} className="h-8 text-white" style={{ backgroundColor: "#bf0f3e" }}><Plus className="w-4 h-4" /></Button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-white/35">{items.length ? `${countOpen(items)} open${doneCount ? ` · ${doneCount} done` : ""}` : ""}</span>
        <span className="flex items-center gap-1">
          {doneCount > 0 && <Button size="sm" variant="ghost" onClick={() => commit(clearDone(items))} className="h-7 text-xs text-white/60 hover:text-white hover:bg-white/10">Clear done</Button>}
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 text-xs text-white/60 hover:text-white hover:bg-white/10">Close</Button>
        </span>
      </div>
    </div>
  );
};

export default LapLineNote;
