// Where to take the parent when a registration form refuses to submit.
//
// The forms validate top to bottom and report the first problem as a toast at
// the bottom of the page. On a long form that reads as "the form is broken":
// the missing field is a screen or two up, and it may be one that appeared
// only because of an earlier answer (the inhaler question appears when asthma
// is Yes). So the message is mapped back to the field it is about, and the
// form scrolls there and lights it up.

export interface FieldLike { field_key: string; label: string; field_type: string }
export interface WaiverLike { field_key: string; title: string }

/** The field_key a validation message is about, or null when it is general. */
export const problemFieldKey = (message: string, fields: FieldLike[], waivers: WaiverLike[]): string | null => {
  if (/picture of your participant/i.test(message)) return "child_headshot";
  if (/parent\/guardian phone/i.test(message)) return "parent_phone";
  if (/child phone/i.test(message)) return "child_phone";
  if (/valid email/i.test(message)) return "parent_email";
  if (/final confirmation box/i.test(message)) return "final_signature_name";

  // "Please fill in: <label>" / "Please check the box: <label>". Longest
  // label first, so a label that is a prefix of another cannot win by accident.
  const labelled = [...fields].sort((a, b) => b.label.length - a.label.length)
    .find((f) => f.label && message.endsWith(f.label));
  if (labelled) return labelled.field_key;

  // Waiver messages end with the waiver's title.
  const waiver = [...waivers].sort((a, b) => b.title.length - a.title.length)
    .find((w) => w.title && message.endsWith(w.title));
  if (waiver) return waiver.field_key;

  // The address check's messages mention the address.
  if (/address/i.test(message)) return "child_primary_address";
  return null;
};

/** Scroll the field into view, flash it, and put the cursor in it. */
export const focusProblemField = (key: string | null) => {
  if (!key || typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>(`[data-field-key="${key}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-red-500", "ring-offset-2", "rounded-md", "transition-shadow");
  window.setTimeout(() => el.classList.remove("ring-2", "ring-red-500", "ring-offset-2"), 2500);
  window.setTimeout(() => {
    el.querySelector<HTMLElement>("input:not([type=hidden]), textarea, button[role=combobox], button")?.focus({ preventScroll: true });
  }, 450);
};
