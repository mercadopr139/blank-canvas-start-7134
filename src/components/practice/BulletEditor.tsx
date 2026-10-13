// A bullet editor for a block's drills.
//
// The old box was a plain textarea: every line became a bullet on the wall,
// and Tab nested a line with two invisible spaces — so a coach could not see
// what they had nested until they left edit mode (Josh, 2026-10-13). This
// shows the bullets as bullets while typing: Enter makes the next bullet,
// Tab nests it, Shift+Tab brings it back, Backspace on an empty bullet
// removes it. On a phone or the wall there is no Tab key, so the bullet
// that has focus shows a nest / un-nest button.
//
// Underneath it is still the same plain text (src/lib/bulletText.ts), saved
// when focus leaves the editor — the same moment the old box saved.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { parseBullets, serializeBullets, type BulletLine } from "@/lib/bulletText";

interface Row extends BulletLine {
  id: number;
}

let nextId = 1;
const newRow = (text = "", nested = false): Row => ({ id: nextId++, text, nested });

const rowsFrom = (detail: string | null | undefined): Row[] => {
  const rows = parseBullets(detail).map((l) => newRow(l.text, l.nested));
  return rows.length ? rows : [newRow()];
};

/** A textarea grows to fit its text and never scrolls. */
const fit = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
};

const BulletEditor = ({
  defaultValue,
  onSave,
  accent = "#ffffff",
  dark = false,
  className = "",
  textClassName = "text-base",
  placeholder = "Type a drill. Enter for the next, Tab to nest.",
  autoFocus = false,
}: {
  defaultValue: string | null | undefined;
  /** Called once, when focus leaves the editor, with the text as the board will read it. */
  onSave: (detail: string | null) => void;
  /** Bullet colour — the group's, so the editor matches the tile. */
  accent?: string;
  /** The board's black surface rather than the editor's neutral one. */
  dark?: boolean;
  className?: string;
  /** Text size for the drills, e.g. "text-lg" on the wall, "text-sm" in the admin. */
  textClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) => {
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(defaultValue));
  const [focused, setFocused] = useState<number | null>(null);
  const areas = useRef(new Map<number, HTMLTextAreaElement>());
  const box = useRef<HTMLDivElement>(null);
  // Where the caret goes after the next render (a new bullet, a merged one).
  const pending = useRef<{ id: number; caret: number } | null>(null);
  const saved = useRef<string | null>(serializeBullets(parseBullets(defaultValue)));

  useLayoutEffect(() => {
    rows.forEach((r) => fit(areas.current.get(r.id) ?? null));
    if (pending.current) {
      const el = areas.current.get(pending.current.id);
      if (el) {
        el.focus();
        const c = Math.min(pending.current.caret, el.value.length);
        el.setSelectionRange(c, c);
      }
      pending.current = null;
    }
  }, [rows]);

  useEffect(() => {
    if (autoFocus) {
      const first = rows[0];
      if (first) pending.current = { id: first.id, caret: areas.current.get(first.id)?.value.length ?? 0 };
      setRows((r) => [...r]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const focusRow = (id: number, caret: number) => {
    pending.current = { id, caret };
    setRows((r) => [...r]);
  };

  /** Save when focus leaves the whole editor, not when it moves between bullets. */
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (box.current && e.relatedTarget instanceof Node && box.current.contains(e.relatedTarget)) return;
    setFocused(null);
    const v = serializeBullets(rows);
    if (v !== saved.current) {
      saved.current = v;
      onSave(v);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    const row = rows[i];
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (e.key === "Escape") {
      e.preventDefault();
      el.blur();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      update(row.id, { nested: !e.shiftKey });
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Enter on an empty sub-bullet backs it out to a main bullet, the way
      // every list editor does: Enter, Enter after a run of sub-bullets lands
      // on a fresh main bullet (Josh, 2026-10-13).
      if (row.nested && !row.text.trim()) {
        update(row.id, { nested: false, text: "" });
        return;
      }
      const before = row.text.slice(0, start);
      const after = row.text.slice(end);
      const fresh = newRow(after, row.nested);
      pending.current = { id: fresh.id, caret: 0 };
      setRows((prev) => prev.flatMap((r) => (r.id === row.id ? [{ ...r, text: before }, fresh] : [r])));
      return;
    }
    if (e.key === "Backspace" && start === 0 && end === 0) {
      if (row.nested) {
        e.preventDefault();
        update(row.id, { nested: false });
        return;
      }
      if (i > 0) {
        e.preventDefault();
        const prev = rows[i - 1];
        pending.current = { id: prev.id, caret: prev.text.length };
        setRows((all) =>
          all.filter((r) => r.id !== row.id).map((r) => (r.id === prev.id ? { ...r, text: r.text + row.text } : r))
        );
      }
      return;
    }
    if (e.key === "Delete" && start === row.text.length && end === start && i < rows.length - 1) {
      e.preventDefault();
      const next = rows[i + 1];
      pending.current = { id: row.id, caret: row.text.length };
      setRows((all) => all.filter((r) => r.id !== next.id).map((r) => (r.id === row.id ? { ...r, text: r.text + next.text } : r)));
      return;
    }
    // Up and down walk the bullets. Inside a bullet that wraps onto several
    // lines they still move within it, as a caret would expect, until it
    // reaches the top or bottom.
    const singleLine = el.scrollHeight <= parseFloat(getComputedStyle(el).lineHeight) * 1.5;
    if (e.key === "ArrowUp" && i > 0 && (singleLine || start === 0)) {
      e.preventDefault();
      focusRow(rows[i - 1].id, rows[i - 1].text.length);
      return;
    }
    if (e.key === "ArrowDown" && i < rows.length - 1 && (singleLine || end === row.text.length)) {
      e.preventDefault();
      focusRow(rows[i + 1].id, 0);
    }
  };

  /** Pasting several lines makes several bullets, nesting read the board's way. */
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, i: number) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n")) return;
    e.preventDefault();
    const row = rows[i];
    const el = e.currentTarget;
    const lines = parseBullets(text);
    if (!lines.length) return;
    const before = row.text.slice(0, el.selectionStart);
    const after = row.text.slice(el.selectionEnd);
    const [first, ...rest] = lines;
    const extra = rest.map((l) => newRow(l.text, l.nested));
    const lastId = extra.length ? extra[extra.length - 1].id : row.id;
    if (extra.length) extra[extra.length - 1].text += after;
    pending.current = { id: lastId, caret: extra.length ? extra[extra.length - 1].text.length - after.length : before.length + first.text.length };
    setRows((prev) =>
      prev.flatMap((r) =>
        r.id === row.id
          ? [{ ...r, text: before + first.text + (extra.length ? "" : after), nested: r.nested || (first.nested && !before) }, ...extra]
          : [r]
      )
    );
  };

  const surface = dark
    ? "bg-black/60 border-white/15 focus-within:border-white/40"
    : "bg-neutral-950 border-neutral-800 focus-within:border-neutral-600";
  const muted = dark ? "text-white/30" : "text-neutral-600";

  return (
    <div
      ref={box}
      onBlur={onBlur}
      onMouseDown={(e) => {
        // A tap on the box's own padding lands in the last bullet.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        const last = rows[rows.length - 1];
        focusRow(last.id, last.text.length);
      }}
      className={`w-full rounded-lg border px-3 py-2 text-white cursor-text ${surface} ${className}`}
    >
      {rows.map((row, i) => (
        <div
          key={row.id}
          className={`flex items-start gap-2 ${textClassName}`}
          style={row.nested ? { marginLeft: "1.15em" } : undefined}
        >
          <span
            aria-hidden
            className="shrink-0 rounded-full"
            style={{
              width: row.nested ? "0.3em" : "0.4em",
              height: row.nested ? "0.3em" : "0.4em",
              marginTop: row.nested ? "0.62em" : "0.55em",
              backgroundColor: accent,
              opacity: row.nested ? 0.55 : 1,
            }}
          />
          <textarea
            ref={(el) => {
              if (el) areas.current.set(row.id, el);
              else areas.current.delete(row.id);
            }}
            value={row.text}
            rows={1}
            placeholder={rows.length === 1 && i === 0 ? placeholder : undefined}
            onChange={(e) => {
              update(row.id, { text: e.target.value });
              fit(e.target);
            }}
            onFocus={() => setFocused(row.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onPaste={(e) => onPaste(e, i)}
            aria-label={row.nested ? `Sub-bullet ${i + 1}` : `Bullet ${i + 1}`}
            className={`flex-1 min-w-0 resize-none overflow-hidden bg-transparent border-0 p-0 leading-snug outline-none focus:ring-0 text-inherit placeholder:${muted} ${
              row.nested ? "opacity-85" : ""
            }`}
            style={{ color: "inherit" }}
          />
          {/* Nest / un-nest for a finger: shown on the bullet being edited. */}
          {focused === row.id && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => update(row.id, { nested: !row.nested })}
              title={row.nested ? "Un-nest (Shift+Tab)" : "Nest under the line above (Tab)"}
              aria-label={row.nested ? "Un-nest this bullet" : "Nest this bullet"}
              className={`shrink-0 mt-[0.1em] rounded p-0.5 ${muted} hover:text-white`}
            >
              {row.nested ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default BulletEditor;
