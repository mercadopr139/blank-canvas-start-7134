import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

import { Card, CardContent } from "@/components/ui/card";
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
};

const FormPreview = ({ fields }: { fields: FormField[] }) => {
  const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);

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
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{field.label}</p>
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
      default:
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label}</Label>
            <Input className="mt-2" disabled />
          </div>
        );
    }
  };

  return (
    <Card className="shadow-lg">
      <CardContent className="pt-8 pb-8">
        <div className="text-center mb-8">
          <img src={nlaLogo} alt="No Limits Academy" className="w-20 h-20 mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold mb-2">2025-26 Registration</h1>
          <p className="text-muted-foreground text-sm">Must complete before participation at No Limits Academy.</p>
        </div>
        <div className="space-y-6">
          {sorted.map(renderField)}
          <div className="border-t pt-6 text-center text-sm text-muted-foreground">
            <p>— Waivers & Signatures section follows below —</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FormPreview;
