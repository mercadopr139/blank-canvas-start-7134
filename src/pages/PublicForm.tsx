import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import SignatureCanvas from "@/components/registration/SignatureCanvas";
import nlaLogo from "@/assets/nla-logo.png";
import {
  type FormRecord, type FormFieldDef, parseOptions, isInputField,
} from "@/lib/formKit";

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });

const PublicForm = () => {
  const { slug } = useParams<{ slug: string }>();
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [sigs, setSigs] = useState<Record<string, Blob | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: form, isLoading, isError } = useQuery({
    queryKey: ["public-form", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms" as never)
        .select("*")
        .eq("slug", slug as string)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as FormRecord | null;
    },
    enabled: !!slug,
  });

  const fields: FormFieldDef[] = useMemo(
    () => (form?.fields ? [...form.fields].sort((a, b) => a.sort_order - b.sort_order) : []),
    [form],
  );

  const setVal = (key: string, v: string | boolean) => setValues((p) => ({ ...p, [key]: v }));

  const validate = (): string | null => {
    for (const f of fields) {
      if (!isInputField(f.field_type) || !f.required) continue;
      if (f.field_type === "signature") {
        if (!sigs[f.field_key]) return `Please sign: ${f.label}`;
      } else if (f.field_type === "checkbox") {
        if (values[f.field_key] !== true) return `Please check: ${f.label}`;
      } else {
        const v = values[f.field_key];
        if (v === undefined || v === null || String(v).trim() === "") return `Please complete: ${f.label}`;
      }
      if (f.field_type === "email" && values[f.field_key]) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values[f.field_key]))) return `Enter a valid email for: ${f.label}`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) { setError(v); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (!form) return;
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {};
      for (const f of fields) {
        if (!isInputField(f.field_type)) continue;
        if (f.field_type === "signature") {
          const blob = sigs[f.field_key];
          data[f.field_key] = blob ? await blobToDataUrl(blob) : null;
        } else if (values[f.field_key] !== undefined) {
          data[f.field_key] = values[f.field_key];
        }
      }
      const { error: insErr } = await supabase
        .from("form_responses" as never)
        .insert({ form_id: form.id, data } as never);
      if (insErr) throw insErr;
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (f: FormFieldDef) => {
    const key = f.field_key;
    const req = f.required ? <span className="text-red-500"> *</span> : null;
    const help = f.help_text ? <p className="text-sm text-neutral-500 mt-0.5">{f.help_text}</p> : null;

    switch (f.field_type) {
      case "section_header":
        return (
          <div key={f.id} className="pt-4 pb-1 border-b border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-900">{f.label}</h3>
            {help}
          </div>
        );
      case "paragraph":
        return (
          <div key={f.id} className="py-1">
            <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed">{f.label}</p>
          </div>
        );
      case "long_text":
        return (
          <div key={f.id}>
            <Label className="font-medium text-neutral-800">{f.label}{req}</Label>
            {help}
            <Textarea className="mt-1.5" rows={4} placeholder={f.placeholder || ""}
              value={(values[key] as string) || ""} onChange={(e) => setVal(key, e.target.value)} />
          </div>
        );
      case "dropdown": {
        const opts = parseOptions(f.options);
        return (
          <div key={f.id}>
            <Label className="font-medium text-neutral-800">{f.label}{req}</Label>
            {help}
            <Select value={(values[key] as string) || ""} onValueChange={(v) => setVal(key, v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder={f.placeholder || "Select…"} /></SelectTrigger>
              <SelectContent>
                {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      }
      case "yes_no":
        return (
          <div key={f.id}>
            <Label className="font-medium text-neutral-800">{f.label}{req}</Label>
            {help}
            <Select value={(values[key] as string) || ""} onValueChange={(v) => setVal(key, v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case "checkbox":
        return (
          <div key={f.id} className="flex items-start gap-3 py-1">
            <Checkbox className="mt-1" checked={values[key] === true}
              onCheckedChange={(c) => setVal(key, c === true)} />
            <div>
              <Label className="font-medium text-neutral-800 leading-snug">{f.label}{req}</Label>
              {help}
            </div>
          </div>
        );
      case "signature":
        return (
          <div key={f.id}>
            <Label className="font-medium text-neutral-800">{f.label}{req}</Label>
            {help}
            <div className="mt-1.5">
              <SignatureCanvas onSignatureChange={(blob) => setSigs((p) => ({ ...p, [key]: blob }))} />
            </div>
          </div>
        );
      default: {
        // short_text, number, date, phone, email
        const type = f.field_type === "number" ? "number"
          : f.field_type === "date" ? "date"
          : f.field_type === "phone" ? "tel"
          : f.field_type === "email" ? "email" : "text";
        return (
          <div key={f.id}>
            <Label className="font-medium text-neutral-800">{f.label}{req}</Label>
            {help}
            <Input type={type} className="mt-1.5" placeholder={f.placeholder || ""}
              value={(values[key] as string) || ""} onChange={(e) => setVal(key, e.target.value)} />
          </div>
        );
      }
    }
  };

  // ── states ──
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#bf0f3e]" />
      </div>
    );
  }

  if (isError || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
        <div className="text-center max-w-md">
          <img src={nlaLogo} alt="No Limits Academy" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-xl font-bold text-neutral-900">Form not available</h1>
          <p className="text-neutral-500 mt-2">This form doesn’t exist or isn’t currently accepting responses. Please check the link or contact No Limits Academy.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    const s = form.settings || {};
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 max-w-md w-full p-8 text-center">
          <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-green-500" />
          <h1 className="text-2xl font-bold text-neutral-900">{s.confirmationTitle || "Thank you!"}</h1>
          <p className="text-neutral-600 mt-2">{s.confirmationMessage || "Your response has been recorded. You may now close this page."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-black text-center py-7 px-6">
            <img src={nlaLogo} alt="No Limits Academy" className="w-16 h-16 mx-auto mb-3 object-contain" />
            <h1 className="text-2xl font-bold text-white">{form.title}</h1>
            {form.description && <p className="text-white/60 text-sm mt-1.5 max-w-sm mx-auto">{form.description}</p>}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
            )}
            {fields.map(renderField)}
            <Button type="submit" disabled={submitting}
              className="w-full bg-[#bf0f3e] hover:bg-[#a50d35] text-white font-semibold py-6 text-base">
              {submitting ? "Submitting…" : "Submit"}
            </Button>
            <p className="text-center text-xs text-neutral-400 pt-1">Powered by No Limits Academy</p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PublicForm;
