import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { Card, CardContent } from "@/components/ui/card";
import { getProgramYearForRegistration, shortProgramYear } from "@/lib/programYear";
import { RichText } from "@/components/ui/rich-text";
import { Upload } from "lucide-react";
import nlaLogo from "@/assets/nla-logo.png";

type FormField = {
  id: string;
  field_key: string;
  field_type: string;
  label: string;
  help_text: string | null;
  placeholder: string | null;
  required: boolean;
  options: any;
  sort_order: number;
  is_active: boolean;
  is_core: boolean;
  db_column: string | null;
  default_value: string | null;
  section: string | null;
  // Show-if, as the live form reads it (e.g. inhaler info when has_asthma = Yes).
  condition?: { field: string; op?: string; value?: string } | string | null;
};

const conditionOf = (f: FormField): { field: string; op?: string; value?: string } | null => {
  if (!f.condition) return null;
  if (typeof f.condition === "string") { try { return JSON.parse(f.condition); } catch { return null; } }
  return f.condition;
};

// `program` decides the framing: NLA's heading on the default background,
// or Hawk Squad's heading on Hawk Squad green -- the same as the live forms.
const FormPreview = ({ fields, program = "nla" }: { fields: FormField[]; program?: "nla" | "hawk" }) => {
  const hawk = program === "hawk";
  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
  const labelOf = (key: string) => fields.find((x) => x.field_key === key)?.label ?? key;

  const parseOptions = (opts: any): string[] => {
    if (!opts) return [];
    if (Array.isArray(opts)) return opts;
    try { return JSON.parse(opts); } catch { return []; }
  };

  const renderField = (field: FormField) => {
    switch (field.field_type) {
      case "section_header":
        return (
          <div key={field.id} className="pt-4 pb-2">
            <h3 className="text-lg font-semibold">{field.label}</h3>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
          </div>
        );
      case "paragraph":
        return (
          <div key={field.id} className="py-2">
            <RichText html={field.label} className="text-sm text-muted-foreground" />
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
          </div>
        );
      case "short_text":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input placeholder={field.placeholder || ""} className="mt-2" disabled />
          </div>
        );
      case "long_text":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Textarea placeholder={field.placeholder || ""} className="mt-2" disabled />
          </div>
        );
      case "number":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input type="number" placeholder={field.placeholder || ""} className="mt-2" disabled />
          </div>
        );
      case "date":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input type="date" className="mt-2" disabled />
          </div>
        );
      case "dropdown":
      case "multi_select": {
        const opts = parseOptions(field.options);
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Select disabled>
              <SelectTrigger className="mt-2"><SelectValue placeholder={field.placeholder || "Select..."} /></SelectTrigger>
              <SelectContent>
                {opts.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      }
      case "yes_no":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Select disabled>
              <SelectTrigger className="mt-2"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "checkbox":
        return (
          <div key={field.id} className="flex items-start gap-3">
            <Checkbox disabled className="mt-1" />
            <div>
              <Label className="text-base font-medium">
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </Label>
              {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            </div>
          </div>
        );
      case "phone":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input type="tel" placeholder={field.placeholder || "(555) 555-5555"} className="mt-2" disabled />
          </div>
        );
      case "email":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input type="email" placeholder={field.placeholder || "email@example.com"} className="mt-2" disabled />
          </div>
        );
      case "address":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input placeholder="Start typing address..." className="mt-2" disabled />
          </div>
        );
      case "file_upload":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <div className="mt-2 flex items-center gap-2 px-4 py-2 border border-input rounded-md bg-muted/30">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Choose File</span>
            </div>
          </div>
        );
      case "waiver":
        return (
          <div key={field.id} className="border-t pt-4">
            {field.help_text && (
              <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">{field.help_text}</p>
            )}
            <h3 className="text-lg font-semibold">
              {field.label}{!field.required && <span className="ml-2 text-sm font-normal text-muted-foreground">(optional)</span>}
            </h3>
            <RichText html={field.default_value} className="text-sm text-muted-foreground max-h-40 overflow-auto border rounded p-2 mt-2 block" />
            <p className="text-xs text-muted-foreground mt-2">
              ☑ "I have read and agree" box + drawn signature{field.required ? " required" : " (only if the parent chooses to sign)"}. The name is typed once at the end.
            </p>
          </div>
        );
      default:
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label}</Label>
            <Input className="mt-2" disabled />
          </div>
        );
    }
  };

  const renderWithRule = (field: FormField) => {
    const c = conditionOf(field);
    if (!c?.field) return renderField(field);
    const rule = c.op === "neq" ? `is not "${c.value ?? ""}"` : c.op === "answered" ? "is answered" : `is "${c.value ?? ""}"`;
    return (
      <div key={field.id} className="rounded-md border border-dashed border-amber-300 bg-amber-50/40 p-3">
        <p className="text-[11px] font-medium text-amber-700 mb-2">Only shown when "{labelOf(c.field)}" {rule}</p>
        {renderField(field)}
      </div>
    );
  };

  return (
    <Card className={hawk ? "shadow-lg bg-[#0f4c2f] border-0" : "shadow-lg"}>
      <CardContent className={hawk ? "pt-8 pb-8 m-3 rounded-lg bg-background" : "pt-8 pb-8"}>
        <div className="text-center mb-8">
          <img src={nlaLogo} alt="No Limits Academy" className="w-20 h-20 mx-auto mb-4 object-contain" />
          {/* Same derivation as the live form, so the preview cannot show a
              different year from the thing it is previewing. */}
          <h1 className="text-2xl font-bold mb-2">
            {shortProgramYear(getProgramYearForRegistration())} {hawk ? "Hawk Squad " : ""}Registration
          </h1>
          <p className="text-muted-foreground text-sm">Must complete before participation {hawk ? "in Hawk Squad " : ""}at No Limits Academy.</p>
        </div>
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium">Today's Date <span className="text-destructive">*</span></Label>
            <Input type="date" value={new Date().toISOString().split("T")[0]} disabled className="mt-2 bg-muted" />
          </div>
          {sorted.map(renderWithRule)}
          <div className="border-t pt-6">
            <Label className="text-base font-medium">
              Please TYPE the FIRST and LAST name used in the Signatures above. <span className="text-destructive">*</span>
            </Label>
            <Input className="mt-2" disabled />
          </div>
          <div className="pt-2">
            <Button type="button" size="lg" disabled className="w-full">Submit</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FormPreview;
