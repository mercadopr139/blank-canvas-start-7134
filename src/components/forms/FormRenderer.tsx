import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Upload } from "lucide-react";
import SignatureCanvas from "@/components/registration/SignatureCanvas";
import { supabase } from "@/integrations/supabase/client";
import nlaLogo from "@/assets/nla-logo.png";
import { type FormFieldDef, parseOptions, isInputField } from "@/lib/formKit";

export type FormBranding = {
  accentColor?: string;
  headerColor?: string;
  showLogo?: boolean;
  theme?: "light" | "dark";
};

const DEFAULT_BRANDING: Required<FormBranding> = {
  accentColor: "#bf0f3e",
  headerColor: "#000000",
  showLogo: true,
  theme: "light",
};

// Pick black/white text for a given background hex so it stays readable.
const readableOn = (hex: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, bl = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * bl) / 255;
  return lum > 0.62 ? "#111827" : "#ffffff";
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });

// Image/photo upload field — stores the file in the public youth-photos
// bucket (same place the registration headshots live) and keeps the URL.
function ImageFieldControl({ value, onChange, preview, dark }: { value?: string; onChange: (url: string) => void; preview?: boolean; dark: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (preview) { onChange(URL.createObjectURL(file)); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `form-uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("youth-photos").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("youth-photos").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch {
      setErr("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="mt-1.5">
      {value && <img src={value} alt="upload preview" className="mb-2 rounded-lg max-h-40 border object-contain" />}
      <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm ${dark ? "border-neutral-700 text-neutral-200 hover:bg-neutral-800" : "border-neutral-300 text-neutral-700 hover:bg-neutral-50"}`}>
        <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={uploading} />
        <Upload className="w-4 h-4" />
        {uploading ? "Uploading…" : value ? "Replace photo" : "Choose photo"}
      </label>
      {err && <p className="text-red-600 text-sm mt-1">{err}</p>}
    </div>
  );
}

export function FormRenderer({
  title, description, fields, branding, confirmation, onSubmit, preview = false,
}: {
  title: string;
  description?: string | null;
  fields: FormFieldDef[];
  branding?: FormBranding;
  confirmation?: { title?: string | null; message?: string | null };
  onSubmit?: (data: Record<string, unknown>) => Promise<void> | void;
  preview?: boolean;
}) {
  const b = { ...DEFAULT_BRANDING, ...(branding || {}) };
  const dark = b.theme === "dark";
  const headerText = readableOn(b.headerColor);
  const accentText = readableOn(b.accentColor);

  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [sigs, setSigs] = useState<Record<string, Blob | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...fields].sort((a, c) => a.sort_order - c.sort_order);
  const setVal = (k: string, v: string | boolean) => setValues((p) => ({ ...p, [k]: v }));

  // theme tokens
  const page = dark ? "bg-neutral-950" : "bg-neutral-100";
  const card = dark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
  const labelC = dark ? "text-neutral-200" : "text-neutral-800";
  const mutedC = dark ? "text-neutral-400" : "text-neutral-500";

  const validate = (): string | null => {
    for (const f of sorted) {
      if (!isInputField(f.field_type) || !f.required) continue;
      if (f.field_type === "signature") {
        if (!sigs[f.field_key]) return `Please sign: ${f.label}`;
      } else if (f.field_type === "checkbox") {
        if (values[f.field_key] !== true) return `Please check: ${f.label}`;
      } else if (String(values[f.field_key] ?? "").trim() === "") {
        return `Please complete: ${f.label}`;
      }
      if (f.field_type === "email" && values[f.field_key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values[f.field_key]))) {
        return `Enter a valid email for: ${f.label}`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview || !onSubmit) return;
    setError(null);
    const v = validate();
    if (v) { setError(v); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {};
      for (const f of sorted) {
        if (!isInputField(f.field_type)) continue;
        if (f.field_type === "signature") {
          const blob = sigs[f.field_key];
          data[f.field_key] = blob ? await blobToDataUrl(blob) : null;
        } else if (values[f.field_key] !== undefined) {
          data[f.field_key] = values[f.field_key];
        }
      }
      await onSubmit(data);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const req = (on: boolean) => (on ? <span style={{ color: b.accentColor }}> *</span> : null);

  const renderField = (f: FormFieldDef) => {
    const key = f.field_key;
    const help = f.help_text ? <p className={`text-sm mt-0.5 ${mutedC}`}>{f.help_text}</p> : null;
    switch (f.field_type) {
      case "section_header":
        return (
          <div key={f.id} className="pt-3 pb-1 border-b" style={{ borderColor: b.accentColor + "55" }}>
            <h3 className={`text-lg font-semibold ${labelC}`}>{f.label}</h3>
            {help}
          </div>
        );
      case "paragraph":
        return <p key={f.id} className={`text-sm whitespace-pre-wrap leading-relaxed ${mutedC}`}>{f.label}</p>;
      case "long_text":
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <Textarea className="mt-1.5" rows={4} placeholder={f.placeholder || ""} value={(values[key] as string) || ""} onChange={(e) => setVal(key, e.target.value)} />
          </div>
        );
      case "dropdown": {
        const opts = parseOptions(f.options);
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <Select value={(values[key] as string) || ""} onValueChange={(v) => setVal(key, v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder={f.placeholder || "Select…"} /></SelectTrigger>
              <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        );
      }
      case "yes_no":
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <Select value={(values[key] as string) || ""} onValueChange={(v) => setVal(key, v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent><SelectItem value="Yes">Yes</SelectItem><SelectItem value="No">No</SelectItem></SelectContent>
            </Select>
          </div>
        );
      case "checkbox":
        return (
          <div key={f.id} className="flex items-start gap-3 py-1">
            <Checkbox className="mt-1" checked={values[key] === true} onCheckedChange={(c) => setVal(key, c === true)} />
            <div><Label className={`font-medium leading-snug ${labelC}`}>{f.label}{req(f.required)}</Label>{help}</div>
          </div>
        );
      case "signature":
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <div className="mt-1.5"><SignatureCanvas onSignatureChange={(blob) => setSigs((p) => ({ ...p, [key]: blob }))} /></div>
          </div>
        );
      case "image":
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <ImageFieldControl value={values[key] as string} onChange={(url) => setVal(key, url)} preview={preview} dark={dark} />
          </div>
        );
      default: {
        const type = f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : f.field_type === "phone" ? "tel" : f.field_type === "email" ? "email" : "text";
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <Input type={type} className="mt-1.5" placeholder={f.placeholder || ""} value={(values[key] as string) || ""} onChange={(e) => setVal(key, e.target.value)} />
          </div>
        );
      }
    }
  };

  if (submitted) {
    return (
      <div className={`${preview ? "" : "min-h-screen"} ${page} flex items-center justify-center ${preview ? "p-6" : "px-4"}`}>
        <div className={`rounded-2xl shadow-sm border max-w-md w-full p-8 text-center ${card}`}>
          <CheckCircle2 className="w-14 h-14 mx-auto mb-4" style={{ color: b.accentColor }} />
          <h1 className={`text-2xl font-bold ${labelC}`}>{confirmation?.title || "Thank you!"}</h1>
          <p className={`mt-2 ${mutedC}`}>{confirmation?.message || "Your response has been recorded. You may now close this page."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${preview ? "" : "min-h-screen"} ${page} ${preview ? "p-3" : "py-8 px-4"}`}>
      <div className="max-w-xl mx-auto">
        <div className={`rounded-2xl shadow-sm border overflow-hidden ${card}`}>
          <div className="text-center py-7 px-6" style={{ background: b.headerColor }}>
            {b.showLogo && <img src={nlaLogo} alt="No Limits Academy" className="w-16 h-16 mx-auto mb-3 object-contain" />}
            <h1 className="text-2xl font-bold" style={{ color: headerText }}>{title || "Untitled Form"}</h1>
            {description && <p className="text-sm mt-1.5 max-w-sm mx-auto" style={{ color: headerText, opacity: 0.75 }}>{description}</p>}
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}
            {sorted.length === 0 && <p className={`text-center text-sm py-6 ${mutedC}`}>No fields yet — add some in the builder.</p>}
            {sorted.map(renderField)}
            {sorted.length > 0 && (
              <Button type="submit" disabled={submitting || preview} style={{ backgroundColor: b.accentColor, color: accentText }} className="w-full font-semibold py-6 text-base hover:opacity-90">
                {preview ? "Submit (preview)" : submitting ? "Submitting…" : "Submit"}
              </Button>
            )}
            <p className={`text-center text-xs pt-1 ${mutedC}`}>Powered by No Limits Academy</p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default FormRenderer;
