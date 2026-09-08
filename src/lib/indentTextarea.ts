// Tab to indent, inside a textarea.
//
// A browser gives Tab to focus, not to text, so a coach pressing it in a drill
// box jumps to the next field instead of nesting the line. This intercepts it
// and indents the way any editor would.
//
// Escape still blurs the field, so trapping Tab never leaves a keyboard user
// stuck inside the box with no way out.

/** Two spaces. Enough to read as nested, small enough not to eat the line. */
const INDENT = "  ";

/**
 * Tab / Shift+Tab on a textarea, indenting every line the selection touches.
 *
 * The textareas this serves are uncontrolled (defaultValue + onBlur), so the
 * value is written straight to the element and picked up when it blurs.
 */
export const handleIndentKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === "Escape") {
    e.currentTarget.blur();
    return;
  }
  if (e.key !== "Tab") return;

  e.preventDefault();
  const el = e.currentTarget;
  const value = el.value;
  const start = el.selectionStart;
  const end = el.selectionEnd;

  // Widen the selection to whole lines: indenting is a line operation, even
  // when the cursor sits in the middle of a word.
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = value.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;

  const before = value.slice(0, lineStart);
  const block = value.slice(lineStart, lineEnd);
  const after = value.slice(lineEnd);

  let firstDelta = 0;
  let totalDelta = 0;

  const lines = block.split("\n").map((line, i) => {
    if (e.shiftKey) {
      // Outdent: take back an indent, or a single space if that is all there is.
      const removed = line.startsWith(INDENT) ? INDENT.length : line.startsWith(" ") ? 1 : 0;
      if (i === 0) firstDelta = -removed;
      totalDelta -= removed;
      return line.slice(removed);
    }
    if (i === 0) firstDelta = INDENT.length;
    totalDelta += INDENT.length;
    return INDENT + line;
  });

  el.value = before + lines.join("\n") + after;

  // Put the caret back where the typing was, allowing for what just moved.
  if (start === end) {
    const at = Math.max(lineStart, start + firstDelta);
    el.setSelectionRange(at, at);
  } else {
    el.setSelectionRange(Math.max(lineStart, start + firstDelta), end + totalDelta);
  }
};
