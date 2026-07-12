// Shared field-type vocabulary + helpers for the standalone Form Builder
// (the multi-form system: create a form -> publish -> public link/QR ->
// collect responses). Kept separate from the registration-only builder.

import {
  Type, AlignLeft, Hash, CalendarDays, ChevronDown, ToggleLeft,
  CheckSquare, Phone, Mail, PenLine, Heading, FileText, type LucideIcon,
} from "lucide-react";

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
};

export type FormSettings = {
  notifyEmail?: string | null;
  confirmationTitle?: string | null;
  confirmationMessage?: string | null;
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
  { value: "yes_no", label: "Yes / No", icon: ToggleLeft },
  { value: "checkbox", label: "Checkbox / Consent", icon: CheckSquare },
  { value: "phone", label: "Phone", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "signature", label: "Signature", icon: PenLine },
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
  options: type === "dropdown" ? ["Option 1", "Option 2"] : null,
  sort_order: order,
});

export const blankForm = (): FormRecord => ({
  id: rid(),
  slug: "",
  title: "Untitled Form",
  description: "",
  fields: [],
  settings: {},
  status: "draft",
});
