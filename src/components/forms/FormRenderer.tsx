import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Upload, Star } from "lucide-react";
import SignatureCanvas from "@/components/registration/SignatureCanvas";
import { supabase } from "@/integrations/supabase/client";
import nlaLogo from "@/assets/nla-logo.png";
import { type FormFieldDef, parseOptions, isInputField, conditionMet, ageFromDob } from "@/lib/formKit";

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

// US phone formatting -> (555) 555-5555, kept consistent for later texting / CRM use.
const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

// Build a clean one-line address from a Photon geocoder result.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fmtAddress = (p: any) => {
  const line1 = [p.housenumber, p.street || p.name].filter(Boolean).join(" ");
  const cs = [p.city || p.district || p.county, [p.state, p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [line1, cs].filter(Boolean).join(", ");
};

// Address field with free autocomplete (Photon / OpenStreetMap, no API key).
// Degrades to a plain text box if the service is unavailable.
function AddressInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [q, setQ] = useState(value || "");
  const [sugs, setSugs] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setQ(value || ""); }, [value]);
  const search = (text: string) => {
    setQ(text); onChange(text); setOpen(true);
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 4) { setSugs([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=5&lang=en`);
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = (data.features || []).map((ft: any) => fmtAddress(ft.properties)).filter((x: string) => x);
        setSugs(Array.from(new Set(list)) as string[]);
      } catch { setSugs([]); }
    }, 300);
  };
  const pick = (label: string) => { onChange(label); setQ(label); setSugs([]); setOpen(false); };
  return (
    <div className="relative mt-1.5">
      <Input value={q} autoComplete="off" placeholder={placeholder || "Start typing your address…"}
        onChange={(e) => search(e.target.value)}
        onFocus={() => { if (sugs.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && sugs.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg max-h-56 overflow-auto">
          {sugs.map((s, i) => (
            <button type="button" key={i} onMouseDown={(e) => { e.preventDefault(); pick(s); }} className="block w-full text-left px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-100">{s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Money field: keeps a numeric string, prefixes $, formats to 2 decimals on blur.
function CurrencyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value || "");
  useEffect(() => { setText(value || ""); }, [value]);
  const clean = (s: string) => s.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  return (
    <div className="relative mt-1.5">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">$</span>
      <Input value={text} inputMode="decimal" className="pl-7" placeholder="0.00"
        onChange={(e) => { const c = clean(e.target.value); setText(c); onChange(c); }}
        onBlur={() => { if (text.trim() === "") return; const n = parseFloat(text.replace(/,/g, "")); if (!isNaN(n)) { const f = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); setText(f); onChange(f); } }} />
    </div>
  );
}

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

  const [values, setValues] = useState<Record<string, string | boolean | string[] | number>>({});
  const [sigs, setSigs] = useState<Record<string, Blob | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const sorted = [...fields].sort((a, c) => a.sort_order - c.sort_order);
  const setVal = (k: string, v: string | boolean | string[] | number) => setValues((p) => ({ ...p, [k]: v }));
  const visible = (f: FormFieldDef) => conditionMet(f.condition, values);
  const todayLong = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Split visible fields into pages at each "page_break".
  const pages: FormFieldDef[][] = [[]];
  for (const f of sorted) {
    if (f.field_type === "page_break") { pages.push([]); continue; }
    if (visible(f)) pages[pages.length - 1].push(f);
  }
  const pageIdx = Math.min(step, pages.length - 1);
  const multi = pages.length > 1;

  // theme tokens
  const page = dark ? "bg-neutral-950" : "bg-neutral-100";
  const card = dark ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200";
  const labelC = dark ? "text-neutral-200" : "text-neutral-800";
  const mutedC = dark ? "text-neutral-400" : "text-neutral-500";

  const validate = (fs: FormFieldDef[]): string | null => {
    for (const f of fs) {
      if (!visible(f)) continue;
      if (!isInputField(f.field_type) || !f.required) continue;
      if (f.field_type === "signature") {
        if (!sigs[f.field_key]) return `Please sign: ${f.label}`;
      } else if (f.field_type === "checkbox") {
        if (values[f.field_key] !== true) return `Please check: ${f.label}`;
      } else if (f.field_type === "multi_select") {
        if (!Array.isArray(values[f.field_key]) || (values[f.field_key] as string[]).length === 0) return `Please choose at least one: ${f.label}`;
      } else if (f.field_type === "rating") {
        if (!values[f.field_key]) return `Please rate: ${f.label}`;
      } else if (String(values[f.field_key] ?? "").trim() === "") {
        return `Please complete: ${f.label}`;
      }
      if (f.field_type === "email" && values[f.field_key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values[f.field_key]))) {
        return `Enter a valid email for: ${f.label}`;
      }
      if (f.field_type === "phone" && values[f.field_key] && String(values[f.field_key]).replace(/\D/g, "").length !== 10) {
        return `Enter a complete 10-digit phone number for: ${f.label}`;
      }
      if (f.field_type === "dob" && values[f.field_key] && String(values[f.field_key]) > new Date().toISOString().slice(0, 10)) {
        return `Date of birth can’t be in the future: ${f.label}`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview || !onSubmit) return;
    setError(null);
    const v = validate(sorted);
    if (v) { setError(v); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = {};
      for (const f of sorted) {
        if (!isInputField(f.field_type)) continue;
        if (!visible(f)) continue;
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

  const goNext = () => {
    const v = validate(pages[pageIdx]);
    if (v) { setError(v); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setError(null); setStep(pageIdx + 1); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBack = () => { setError(null); setStep(Math.max(0, pageIdx - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };

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
      case "multi_select": {
        const opts = parseOptions(f.options);
        const sel = Array.isArray(values[key]) ? (values[key] as string[]) : [];
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <div className="mt-1.5 space-y-2">
              {opts.map((o) => (
                <label key={o} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={sel.includes(o)} onCheckedChange={() => setVal(key, sel.includes(o) ? sel.filter((x) => x !== o) : [...sel, o])} />
                  <span className={`text-sm ${labelC}`}>{o}</span>
                </label>
              ))}
            </div>
          </div>
        );
      }
      case "rating": {
        const rv = typeof values[key] === "number" ? (values[key] as number) : 0;
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <div className="mt-1.5 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setVal(key, n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
                  <Star className="w-7 h-7 transition-transform hover:scale-110" style={{ fill: n <= rv ? b.accentColor : "transparent", color: b.accentColor }} />
                </button>
              ))}
            </div>
          </div>
        );
      }
      case "phone":
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <Input type="tel" inputMode="tel" className="mt-1.5" placeholder={f.placeholder || "(555) 555-5555"} value={(values[key] as string) || ""} onChange={(e) => setVal(key, formatPhone(e.target.value))} />
          </div>
        );
      case "address":
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <AddressInput value={(values[key] as string) || ""} onChange={(v) => setVal(key, v)} placeholder={f.placeholder || undefined} />
          </div>
        );
      case "currency":
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <CurrencyInput value={(values[key] as string) || ""} onChange={(v) => setVal(key, v)} />
          </div>
        );
      case "time":
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <Input type="time" className="mt-1.5" value={(values[key] as string) || ""} onChange={(e) => setVal(key, e.target.value)} />
          </div>
        );
      case "radio": {
        const ropts = parseOptions(f.options);
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <div className="mt-1.5 space-y-2">
              {ropts.map((o) => (
                <label key={o} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={f.id} checked={values[key] === o} onChange={() => setVal(key, o)} style={{ accentColor: b.accentColor }} />
                  <span className={`text-sm ${labelC}`}>{o}</span>
                </label>
              ))}
            </div>
          </div>
        );
      }
      case "dob": {
        const maxDay = new Date().toISOString().slice(0, 10);
        const age = ageFromDob(values[key] as string);
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <Input type="date" max={maxDay} className="mt-1.5" value={(values[key] as string) || ""} onChange={(e) => setVal(key, e.target.value)} />
            {age !== null && <p className={`text-xs mt-1 ${mutedC}`}>Age: {age}</p>}
          </div>
        );
      }
      default: {
        const type = f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : f.field_type === "email" ? "email" : "text";
        return (
          <div key={f.id}>
            <Label className={`font-medium ${labelC}`}>{f.label}{req(f.required)}</Label>{help}
            <Input type={type} inputMode={f.field_type === "email" ? "email" : undefined} className="mt-1.5" placeholder={f.placeholder || (f.field_type === "email" ? "you@example.com" : "")} value={(values[key] as string) || ""} onChange={(e) => setVal(key, e.target.value)} />
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
            {pageIdx === 0 && (
              <div>
                <Label className={`font-medium ${labelC}`}>Today's Date</Label>
                <Input value={todayLong} readOnly disabled className="mt-1.5" />
              </div>
            )}
            {multi && (
              <div>
                <div className={`flex justify-between text-xs mb-1 ${mutedC}`}><span>Step {pageIdx + 1} of {pages.length}</span></div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${((pageIdx + 1) / pages.length) * 100}%`, background: b.accentColor }} />
                </div>
              </div>
            )}
            {sorted.length === 0 && <p className={`text-center text-sm py-6 ${mutedC}`}>No fields yet — add some in the builder.</p>}
            {pages[pageIdx].map(renderField)}
            {multi ? (
              <div className="flex gap-3 pt-1">
                {pageIdx > 0 && <Button type="button" variant="outline" onClick={goBack} className="flex-1 py-6">Back</Button>}
                {pageIdx < pages.length - 1
                  ? <Button type="button" onClick={goNext} style={{ backgroundColor: b.accentColor, color: accentText }} className="flex-1 font-semibold py-6 hover:opacity-90">Next</Button>
                  : <Button type="submit" disabled={submitting || preview} style={{ backgroundColor: b.accentColor, color: accentText }} className="flex-1 font-semibold py-6 hover:opacity-90">{preview ? "Submit (preview)" : submitting ? "Submitting…" : "Submit"}</Button>}
              </div>
            ) : (
              sorted.length > 0 && (
                <Button type="submit" disabled={submitting || preview} style={{ backgroundColor: b.accentColor, color: accentText }} className="w-full font-semibold py-6 text-base hover:opacity-90">
                  {preview ? "Submit (preview)" : submitting ? "Submitting…" : "Submit"}
                </Button>
              )
            )}
            <p className={`text-center text-xs pt-1 ${mutedC}`}>Powered by No Limits Academy</p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default FormRenderer;
