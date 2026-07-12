// Shared field-type vocabulary + helpers for the standalone Form Builder
// (the multi-form system: create a form -> publish -> public link/QR ->
// collect responses). Kept separate from the registration-only builder.

import {
  Type, AlignLeft, Hash, CalendarDays, ChevronDown, ToggleLeft,
  CheckSquare, Phone, Mail, PenLine, Image as ImageIcon, ListChecks, Star,
  Heading, FileText, type LucideIcon,
} from "lucide-react";

export type FieldCondition = {
  field: string;                              // field_key this field depends on
  op: "eq" | "neq" | "contains" | "answered";
  value?: string | null;
};

export type FormFieldDef = {
  id: string;
  field_key: string;
  field_type: string;
  label: string;
  help_text: string | null;
  placeholder: string | null;
  required: boolean;
  options: string[] | null;
  sort_order: number;
  condition?: FieldCondition | null;          // show-if logic (optional)
};

export type FormSettings = {
  notifyEmail?: string | null;
  confirmationTitle?: string | null;
  confirmationMessage?: string | null;
  // Branding (Phase 1)
  accentColor?: string;
  headerColor?: string;
  showLogo?: boolean;
  theme?: "light" | "dark";
};

export type FormRecord = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  fields: FormFieldDef[];
  settings: FormSettings;
  status: "draft" | "published";
  created_at?: string;
  updated_at?: string;
};

export const FIELD_TYPES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "short_text", label: "Short Text", icon: Type },
  { value: "long_text", label: "Long Text", icon: AlignLeft },
  { value: "number", label: "Number", icon: Hash },
  { value: "date", label: "Date", icon: CalendarDays },
  { value: "dropdown", label: "Dropdown", icon: ChevronDown },
  { value: "multi_select", label: "Multiple Choice (pick many)", icon: ListChecks },
  { value: "yes_no", label: "Yes / No", icon: ToggleLeft },
  { value: "rating", label: "Rating (stars)", icon: Star },
  { value: "checkbox", label: "Checkbox / Consent", icon: CheckSquare },
  { value: "phone", label: "Phone", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "signature", label: "Signature", icon: PenLine },
  { value: "image", label: "Image / Photo", icon: ImageIcon },
  { value: "section_header", label: "Section Header", icon: Heading },
  { value: "paragraph", label: "Paragraph / Text", icon: FileText },
];

export const fieldTypeLabel = (t: string) =>
  FIELD_TYPES.find((f) => f.value === t)?.label || t;

export const fieldTypeIcon = (t: string): LucideIcon =>
  FIELD_TYPES.find((f) => f.value === t)?.icon || Type;

// Layout-only fields (headers, paragraphs) don't collect an answer.
export const isInputField = (t: string) =>
  !["section_header", "paragraph"].includes(t);

export const parseOptions = (opts: unknown): string[] => {
  if (!opts) return [];
  if (Array.isArray(opts)) return opts as string[];
  try {
    const p = JSON.parse(String(opts));
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
};

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "form";

const rid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);

export const makeField = (type: string, order: number): FormFieldDef => ({
  id: rid(),
  field_key: `field_${order}_${Math.floor(Math.random() * 1e4)}`,
  field_type: type,
  label: `New ${fieldTypeLabel(type)}`,
  help_text: null,
  placeholder: null,
  required: false,
  options: type === "dropdown" || type === "multi_select" ? ["Option 1", "Option 2"] : null,
  sort_order: order,
  condition: null,
});

// Evaluate a field's show-if condition against the current answers.
export function conditionMet(cond: FieldCondition | null | undefined, values: Record<string, unknown>): boolean {
  if (!cond || !cond.field) return true;
  const sv = values[cond.field];
  const val = cond.value ?? "";
  const arr = Array.isArray(sv) ? (sv as unknown[]).map(String) : null;
  switch (cond.op) {
    case "answered": return arr ? arr.length > 0 : sv !== undefined && sv !== null && sv !== "" && sv !== false;
    case "neq": return arr ? !arr.includes(val) : String(sv ?? "") !== val;
    case "contains": return arr ? arr.includes(val) : String(sv ?? "").toLowerCase().includes(String(val).toLowerCase());
    case "eq":
    default: return arr ? arr.includes(val) : String(sv ?? "") === val;
  }
}

export const blankForm = (): FormRecord => ({
  id: rid(),
  slug: "",
  title: "Untitled Form",
  description: "",
  fields: [],
  settings: {},
  status: "draft",
});
