// BAM registration -- the public form at /bam/register.
//
// GENERATED from the NLA form (Register.tsx) by scripts/make-program-register.mjs
// rather than written twice: the NLA form already does the things a good form
// does -- address confirmed as it is typed, phones and emails validated, the
// asthma and allergy gates, the photo upload, the signature pads, the
// same-year duplicate check -- and a second copy would drift. What differs is
// the tables it reads and writes, the title, the insert payload, the colour
// and the waivers.
//
// If the NLA form gains something this program should have too, edit
// Register.tsx and re-run the script; do not hand-edit this file.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import WaiverSection from "@/components/registration/WaiverSection";
import { getProgramYearForRegistration, shortProgramYear } from "@/lib/programYear";
import ChildPrimaryAddressField, { type AddressPin } from "@/components/registration/ChildPrimaryAddressField";
import { addressProblem } from "@/lib/address";
import nlaLogo from "@/assets/nla-logo.png";
import { digitsOnly, formatPhoneDisplay, toE164, isValidPhone } from "@/lib/validators";
import { problemFieldKey, focusProblemField } from "@/lib/validationFocus";

type FormFieldDef = {
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
  condition: { field: string; op?: string; value?: string } | null;
};

// Show-if logic for a registration field. A field with no condition always
// shows; otherwise it renders (and is required, if flagged) only when the
// referenced field's answer matches.
function conditionMet(
  cond: { field: string; op?: string; value?: string } | null | undefined,
  values: Record<string, string>
): boolean {
  if (!cond || !cond.field) return true;
  const answer = values[cond.field] ?? "";
  const target = cond.value ?? "";
  switch (cond.op) {
    case "neq":
      return answer !== target;
    case "answered":
      return answer.trim() !== "";
    case "eq":
    default:
      return answer === target;
  }
}

// Waivers are dynamic (admin-editable). Each waiver's drawn signature,
// acknowledgement checkbox, and typed name are held in Records keyed by the
// waiver's field_key.

const parseOptions = (opts: any): string[] => {
  if (!opts) return [];
  if (Array.isArray(opts)) return opts;
  try { return JSON.parse(opts); } catch { return []; }
};

const BamRegister = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [childHeadshot, setChildHeadshot] = useState<File | null>(null);
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState(""); // Spam protection
  const [waiverSigs, setWaiverSigs] = useState<Record<string, Blob | null>>({});
  const [waiverAcks, setWaiverAcks] = useState<Record<string, boolean>>({});

  // Fetch form fields from DB
  const { data: formFields, isLoading: fieldsLoading } = useQuery({
    queryKey: ["bam-form-fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bam_form_fields" as never)
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      // `condition` is jsonb in the generated types and a shaped object here.
      return data as unknown as FormFieldDef[];
    },
  });

  const handleInputChange = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  // The map pin for the child's address, when the parent picked it from the
  // suggestions. Saved with the registration so it never needs geocoding.
  // Null when they typed past the list — the geocoder handles those later.
  const [addressPin, setAddressPin] = useState<AddressPin | null>(null);

  // Waivers come from the DB (field_type 'waiver', ordered after the questions)
  // once they've been set up in the Registration Form Editor; otherwise fall back to
  // the bundled defaults so the live form always shows the waivers.
  const questionFields = (formFields || []).filter((f) => f.field_type !== "waiver");
  const dbWaivers = (formFields || []).filter((f) => f.field_type === "waiver");
  const waivers = dbWaivers.map((f) => ({
    field_key: f.field_key,
    title: f.label,
    body: f.default_value || "",
    required: !!f.required,
    help: f.help_text || "",
  }));

  const uploadSignature = async (blob: Blob, prefix: string): Promise<string> => {
    const fileName = `bam/${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
    const { data, error } = await supabase.storage
      .from("registration-signatures")
      .upload(fileName, blob, { contentType: "image/png" });
    if (error) throw error;
    return data.path;
  };

  const handleHeadshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setChildHeadshot(file);
      const reader = new FileReader();
      reader.onloadend = () => setHeadshotPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadHeadshot = async (file: File): Promise<string> => {
    const fileName = `bam/headshot_${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage
      .from("youth-photos")
      .upload(fileName, file, { contentType: file.type });
    if (error) throw error;
    return data.path;
  };

  const checkForDuplicates = async (): Promise<string | null> => {
    const childFirst = (formValues["child_first_name"] || "").trim().toLowerCase();
    const childLast = (formValues["child_last_name"] || "").trim().toLowerCase();
    const dob = formValues["child_date_of_birth"];
    const parentEmail = (formValues["parent_email"] || "").trim().toLowerCase();

    const parentPhone = digitsOnly(formValues["parent_phone"] || "");
    if (!childFirst || !childLast) return null;

    // Only a registration for the SAME program year counts as a duplicate.
    // NLA re-registers annually (Sept 1 → Aug 31), so a prior year's record
    // is expected and must never block a new-year sign-up. `currentPY` is the
    // same tag we stamp on this submission below.
    const currentPY = getProgramYearForRegistration();
    const norm = (s: string | null | undefined) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    try {
      // Pull this year's registrations under the same last name, then decide in
      // code. It used to filter by birthday alone, so a parent who re-submitted
      // with the birthday mistyped sailed through and created a second record
      // (the Alexander boys, 2026-09-14). Same name plus ANY of birthday,
      // parent email or parent phone is the same kid.
      const { data, error } = await (supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
        "bam_same_year_matches",
        { _last_name: childLast, _program_year: currentPY }
      );

      if (error) throw error as Error;

      const rows = (data as unknown as Array<{
        child_first_name: string | null; child_last_name: string | null; child_date_of_birth: string | null;
        parent_email: string | null; parent_phone: string | null;
      }>) || [];

      for (const existing of rows) {
        if (norm(existing.child_first_name) !== norm(childFirst) || norm(existing.child_last_name) !== norm(childLast)) continue;
        const sameDob = !!dob && existing.child_date_of_birth === dob;
        const sameEmail = !!parentEmail && (existing.parent_email || "").trim().toLowerCase() === parentEmail;
        const samePhone = !!parentPhone && digitsOnly(existing.parent_phone || "") === parentPhone;
        if (sameDob || sameEmail || samePhone) {
          return `${formValues["child_first_name"]} ${formValues["child_last_name"]} is already registered for the ${currentPY} program year. If you need to update information, please contact us.`;
        }
      }
    } catch (error) {
      console.error("Duplicate check error:", error);
      // Don't block submission if duplicate check fails
    }

    return null;
  };

  const validateForm = (): string | null => {
    // Honeypot spam protection
    if (honeypot) {
      console.warn("Honeypot triggered - likely spam");
      return "Invalid submission. Please try again.";
    }

    if (!formFields) return "Form not loaded";

    // The address has to be somewhere a child can live. A season of the
    // district map taught us what gets typed otherwise: an email, a PO box,
    // "Elemental 2". The field says the same thing underneath as they type;
    // this is the door.
    const badAddress = addressProblem(formValues["child_primary_address"]);
    if (badAddress) return badAddress;

    for (const field of formFields) {
      if (!field.required || !field.is_active) continue;
      // Skip fields hidden by their show-if condition (e.g. inhaler info when
      // "Does your child have asthma?" is No) — hidden means not required.
      if (!conditionMet(field.condition, formValues)) continue;
      if (field.field_key === "child_headshot") {
        if (!childHeadshot) return `Please upload a picture of your participant.`;
        continue;
      }
      if (["section_header", "paragraph", "waiver"].includes(field.field_type)) continue;

      const val = formValues[field.field_key];
      if (field.field_type === "checkbox") {
        if (val !== "true") return `Please check the box: ${field.label}`;
        continue;
      }
      if (!val || !val.trim()) {
        return `Please fill in: ${field.label}`;
      }
    }

    // Validate phones
    const parentPhone = formValues["parent_phone"];
    if (parentPhone && !isValidPhone(parentPhone)) return "Please enter a valid 10-digit parent/guardian phone number.";
    const childPhone = formValues["child_phone"];
    if (childPhone && childPhone.trim() && !isValidPhone(childPhone)) return "Please enter a valid 10-digit child phone number.";

    // Validate email
    const email = formValues["parent_email"];
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address.";

    // Waiver validations (dynamic — one per active waiver)
    for (const w of waivers) {
      const touched = !!waiverAcks[w.field_key] || !!waiverSigs[w.field_key];
      // An optional waiver: leave it entirely alone and it is simply not
      // signed. Start it and it has to be finished.
      if (!w.required && !touched) continue;
      if (!waiverAcks[w.field_key]) return `Please check the box to acknowledge the waiver: ${w.title}`;
      if (!waiverSigs[w.field_key]) return `Please sign all waivers. Missing: ${w.title}`;
    }
    if (!formValues["final_signature_name"]?.trim()) return "Please type your name in the final confirmation box.";

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      toast({ title: "Validation Error", description: validationError, variant: "destructive" });
      // Take them to the field the message is about; on a long form the
      // toast alone reads as "the form is broken".
      focusProblemField(problemFieldKey(validationError, formFields || [], waivers));
      return;
    }

    // Check for duplicates
    const duplicateError = await checkForDuplicates();
    if (duplicateError) {
      toast({ title: "Duplicate Registration", description: duplicateError, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload every waiver's signature and build the flexible waivers_data store.
      const signedWaivers = waivers.filter((w) => w.required || !!waiverSigs[w.field_key]);
      const waiverEntries = await Promise.all(signedWaivers.map(async (w) => {
        const path = await uploadSignature(waiverSigs[w.field_key]!, w.field_key);
        return [w.field_key, { title: w.title, name: (formValues["final_signature_name"] || "").trim(), signaturePath: path }] as const;
      }));
      const waiversData = Object.fromEntries(waiverEntries);
      const headshotUrl = await uploadHeadshot(childHeadshot!);

      // Collect custom fields (non-core)
      const customData: Record<string, string> = {};
      for (const field of (formFields || [])) {
        if (!field.is_core && !["section_header", "paragraph", "waiver"].includes(field.field_type)) {
          // Don't persist answers to fields hidden by their condition (e.g. the
          // asthma acknowledgment if they switched asthma back to No).
          if (!conditionMet(field.condition, formValues)) continue;
          const val = formValues[field.field_key];
          if (val) customData[field.field_key] = val;
        }
      }

      const { error } = await (supabase.from("bam_registrations" as never) as any).insert({
        submission_date: new Date().toISOString().split("T")[0],
        // Same program-year rules as NLA: rolls over 1 August by itself.
        program_year: getProgramYearForRegistration(),
        child_first_name: (formValues["child_first_name"] || "").trim(),
        child_last_name: (formValues["child_last_name"] || "").trim(),
        child_sex: formValues["child_sex"] || null,
        child_date_of_birth: formValues["child_date_of_birth"] || null,
        child_race_ethnicity: formValues["child_race_ethnicity"] || null,
        grade_level: formValues["grade_level"] || null,
        cte_program: formValues["cte_program"] || null,
        child_primary_address: (formValues["child_primary_address"] || "").trim() || null,
        // A picked address arrives with its pin; a typed one is geocoded later.
        latitude: addressPin?.lat ?? null,
        longitude: addressPin?.lng ?? null,
        geocoded_at: addressPin ? new Date().toISOString() : null,
        parent_first_name: (formValues["parent_first_name"] || "").trim(),
        parent_last_name: (formValues["parent_last_name"] || "").trim(),
        parent_phone: toE164(formValues["parent_phone"] || "") || (formValues["parent_phone"] || "").trim(),
        parent_email: (formValues["parent_email"] || "").trim(),
        free_or_reduced_lunch: formValues["free_or_reduced_lunch"] || null,
        has_allergies: formValues["has_allergies"] === "Yes" ? true : formValues["has_allergies"] === "No" ? false : null,
        // The list only when they answered Yes -- the field is hidden otherwise.
        allergies: formValues["has_allergies"] === "Yes" ? ((formValues["allergies"] || "").trim() || null) : null,
        has_asthma: formValues["has_asthma"] === "Yes" ? true : formValues["has_asthma"] === "No" ? false : null,
        // Inhaler details only when they answered Yes -- the field is hidden otherwise.
        asthma_inhaler_info: formValues["has_asthma"] === "Yes" ? ((formValues["asthma_inhaler_info"] || "").trim() || null) : null,
        important_child_notes: (formValues["important_child_notes"] || "").trim() || null,
        waivers_data: waiversData,
        // No dismissal choice in this program: the school moves the students.
        dismissal_waiver_signed_at: null,
        child_headshot_url: headshotUrl,
        final_signature_name: (formValues["final_signature_name"] || "").trim(),
        custom_fields_data: Object.keys(customData).length > 0 ? customData : null,
      });

      if (error) throw error;
      setIsSubmitted(true);
      toast({ title: "Registration Submitted!", description: "Thank you for registering for BAM." });

      // Send admin notification email (fire-and-forget, don't block user)
      try {
        await supabase.functions.invoke("notify-new-registration", {
          body: {
            child_first_name: (formValues["child_first_name"] || "").trim(),
            child_last_name: (formValues["child_last_name"] || "").trim(),
            child_date_of_birth: formValues["child_date_of_birth"],
            child_boxing_program: "BAM",
            child_school_district: "Cape May County Special Services",
            parent_first_name: (formValues["parent_first_name"] || "").trim(),
            parent_last_name: (formValues["parent_last_name"] || "").trim(),
            parent_phone: toE164(formValues["parent_phone"] || "") || (formValues["parent_phone"] || "").trim(),
            parent_email: (formValues["parent_email"] || "").trim(),
            submission_date: new Date().toISOString().split("T")[0],
            child_headshot_url: headshotUrl || null,
          },
        });
      } catch (notifyErr) {
        console.error("Admin notification failed (non-blocking):", notifyErr);
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({ title: "Submission Failed", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Render a single dynamic field ─── */
  const renderDynamicField = (field: FormFieldDef) => {
    const val = formValues[field.field_key] || "";
    const opts = parseOptions(field.options);

    switch (field.field_type) {
      case "section_header":
        return (
          <div key={field.id} className="pt-4 pb-1">
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
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input value={val} onChange={e => handleInputChange(field.field_key, e.target.value)} placeholder={field.placeholder || ""} className="mt-2" />
          </div>
        );
      case "long_text":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Textarea value={val} onChange={e => handleInputChange(field.field_key, e.target.value)} placeholder={field.placeholder || ""} className="mt-2" maxLength={2000} />
          </div>
        );
      case "number":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input type="number" value={val} onChange={e => handleInputChange(field.field_key, e.target.value)} placeholder={field.placeholder || ""} className="mt-2" />
          </div>
        );
      case "date":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input type="date" value={val} onChange={e => handleInputChange(field.field_key, e.target.value)} className="mt-2" />
          </div>
        );
      case "dropdown":
        // Special handling for grade level dropdown
        if (field.field_key === "child_grade_level") {
          const gradeOptions = [
            { value: "not_applicable", label: "Not Applicable" },
            { value: "1", label: "1st Grade" },
            { value: "2", label: "2nd Grade" },
            { value: "3", label: "3rd Grade" },
            { value: "4", label: "4th Grade" },
            { value: "5", label: "5th Grade" },
            { value: "6", label: "6th Grade" },
            { value: "7", label: "7th Grade" },
            { value: "8", label: "8th Grade" },
            { value: "9", label: "9th Grade" },
            { value: "10", label: "10th Grade" },
            { value: "11", label: "11th Grade" },
            { value: "12", label: "12th Grade" },
          ];
          return (
            <div key={field.id}>
              <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
              {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
              <Select value={val} onValueChange={v => handleInputChange(field.field_key, v)}>
                <SelectTrigger className="mt-2"><SelectValue placeholder={field.placeholder || "Select grade level"} /></SelectTrigger>
                <SelectContent>
                  {gradeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        }
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Select value={val} onValueChange={v => handleInputChange(field.field_key, v)}>
              <SelectTrigger className="mt-2"><SelectValue placeholder={field.placeholder || "Select..."} /></SelectTrigger>
              <SelectContent>
                {opts.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        );
      case "multi_select":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <div className="mt-2 space-y-2">
              {opts.map(opt => {
                const selected = val.split(",").filter(Boolean);
                const checked = selected.includes(opt);
                return (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const newSel = c ? [...selected, opt] : selected.filter(s => s !== opt);
                        handleInputChange(field.field_key, newSel.join(","));
                      }}
                    />
                    <span className="text-sm">{opt}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case "yes_no":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Select value={val} onValueChange={v => handleInputChange(field.field_key, v)}>
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
          <div key={field.id} className="flex items-start gap-3 py-1">
            <Checkbox
              checked={val === "true"}
              onCheckedChange={(c) => handleInputChange(field.field_key, c ? "true" : "")}
              className="mt-1"
            />
            <div>
              <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
              {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            </div>
          </div>
        );
      case "phone":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input
              type="tel"
              placeholder={field.placeholder || "(555) 555-5555"}
              value={val}
              onChange={e => {
                const digits = digitsOnly(e.target.value).slice(0, 10);
                handleInputChange(field.field_key, formatPhoneDisplay(digits));
              }}
              className="mt-2"
            />
            {val && !isValidPhone(val) && <p className="text-sm text-destructive mt-1">Please enter a valid 10-digit phone number</p>}
          </div>
        );
      case "email":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <Input type="email" value={val} onChange={e => handleInputChange(field.field_key, e.target.value)} placeholder={field.placeholder || ""} className="mt-2" />
          </div>
        );
      case "address":
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <ChildPrimaryAddressField
              value={val}
              onChange={v => handleInputChange(field.field_key, v)}
              onLocate={setAddressPin}
              className="mt-2"
            />
          </div>
        );
      case "file_upload":
        // The headshot upload uses special handling
        if (field.field_key === "child_headshot") {
          return (
            <div key={field.id}>
              <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
              {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
              <div className="mt-2">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 px-4 py-2 border border-input rounded-md cursor-pointer hover:bg-muted transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm">Choose Photo</span>
                    <input type="file" accept="image/*" onChange={handleHeadshotChange} className="hidden" />
                  </label>
                  {childHeadshot && <span className="text-sm text-muted-foreground">{childHeadshot.name}</span>}
                </div>
                {headshotPreview && (
                  <div className="mt-4">
                    <img src={headshotPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-border" />
                  </div>
                )}
              </div>
            </div>
          );
        }
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label} {field.required && <span className="text-destructive">*</span>}</Label>
            {field.help_text && <p className="text-sm text-muted-foreground">{field.help_text}</p>}
            <div className="mt-2">
              <label className="flex items-center gap-2 px-4 py-2 border border-input rounded-md cursor-pointer hover:bg-muted transition-colors">
                <Upload className="w-4 h-4" />
                <span className="text-sm">Choose File</span>
                <input type="file" className="hidden" />
              </label>
            </div>
          </div>
        );
      default:
        return (
          <div key={field.id}>
            <Label className="text-base font-medium">{field.label}</Label>
            <Input value={val} onChange={e => handleInputChange(field.field_key, e.target.value)} className="mt-2" />
          </div>
        );
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex flex-col bg-[#374151]">
        <Header />
        <main className="flex-1 container max-w-2xl mx-auto px-4 py-12">
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardContent className="pt-12 pb-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                </div>
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-bold text-foreground">Welcome to BAM!</h1>
                <p className="text-xl text-foreground">Keep up the great week &mdash; we&rsquo;ll see you Friday!</p>
                <p className="text-base text-muted-foreground pt-2">
                  If you have any questions, please email{" "}
                  <a href="mailto:chrissycasiello@nolimitsboxingacademy.org" className="font-medium text-foreground underline">chrissycasiello@nolimitsboxingacademy.org</a>.
                </p>
              </div>
              <div className="pt-4">
                <Button onClick={() => navigate("/")} size="lg" className="min-w-48">
                  Return to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#374151]">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-xl">
        <Card className="shadow-lg">
          <CardContent className="pt-8 pb-8">
            <div className="text-center mb-8">
              <img src={nlaLogo} alt="No Limits Academy" className="w-20 h-20 mx-auto mb-4 object-contain" />
              {/* Derived from the SAME function that tags the submission a few
                  hundred lines below, so the heading and the year the record is
                  actually filed under can never disagree. It was a hardcoded
                  "2025-26" and spent five weeks telling people the wrong year
                  while quietly filing them under the right one. Rolls over on
                  1 August by itself — see programYear.ts. */}
              <h1 className="text-2xl font-bold mb-2">
                {shortProgramYear(getProgramYearForRegistration())} BAM Registration
              </h1>
              <p className="text-muted-foreground text-sm">Must complete before participation in BAM at No Limits Academy.</p>
            </div>

            {fieldsLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading form...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Honeypot field for spam protection - hidden from users */}
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                {/* Today's Date */}
                <div>
                  <Label className="text-base font-medium">Today's Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={new Date().toISOString().split('T')[0]} disabled className="mt-2 bg-muted" />
                </div>

                {/* Dynamic fields from DB — a field with a show-if condition
                    (e.g. inhaler info) only renders when its condition is met. */}
                {questionFields.filter((f) => conditionMet(f.condition, formValues)).map((f) => (
                  <div key={f.id} data-field-key={f.field_key}>{renderDynamicField(f)}</div>
                ))}

                {/* === WAIVERS (admin-editable via the Registration Form Editor; falls back to bundled defaults) === */}
                {waivers.map((w) => (
                  <div key={w.field_key} data-field-key={w.field_key} className="border-t pt-6">
                    {w.help && (
                      <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">{w.help}</p>
                    )}
                    <WaiverSection
                      required={w.required}
                      title={w.title}
                      text={w.body}
                      onSignatureChange={(blob) => setWaiverSigs((prev) => ({ ...prev, [w.field_key]: blob }))}
                      acknowledged={waiverAcks[w.field_key] || false}
                      onAcknowledgeChange={(v) => setWaiverAcks((prev) => ({ ...prev, [w.field_key]: v }))}
                    />
                  </div>
                ))}

                {/* Final typed name */}
                <div className="border-t pt-6" data-field-key="final_signature_name">
                  <Label htmlFor="final_signature_name" className="text-base font-medium">
                    Please TYPE the FIRST and LAST name used in the Signatures above. <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="final_signature_name"
                    value={formValues["final_signature_name"] || ""}
                    onChange={e => handleInputChange("final_signature_name", e.target.value)}
                    className="mt-2"
                    required
                  />
                </div>

                <div className="pt-6">
                  <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                    ) : "Submit"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default BamRegister;
