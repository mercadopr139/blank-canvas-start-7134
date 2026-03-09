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
import { WAIVER_TEXTS } from "@/components/registration/waiverTexts";
import ChildPrimaryAddressField from "@/components/registration/ChildPrimaryAddressField";
import nlaLogo from "@/assets/nla-logo.png";
import { digitsOnly, formatPhoneDisplay, toE164, isValidPhone } from "@/lib/validators";

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
};

interface Signatures {
  medical_consent: Blob | null;
  liability_waiver: Blob | null;
  transportation_excursions: Blob | null;
  media_consent: Blob | null;
  spiritual_development: Blob | null;
  counseling_services: Blob | null;
}

interface Acknowledgements {
  medical_consent: boolean;
  liability_waiver: boolean;
  transportation_excursions: boolean;
  media_consent: boolean;
  spiritual_development: boolean;
  counseling_services: boolean;
}

const parseOptions = (opts: any): string[] => {
  if (!opts) return [];
  if (Array.isArray(opts)) return opts;
  try { return JSON.parse(opts); } catch { return []; }
};

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [childHeadshot, setChildHeadshot] = useState<File | null>(null);
  const [headshotPreview, setHeadshotPreview] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState(""); // Spam protection
  const [signatures, setSignatures] = useState<Signatures>({
    medical_consent: null, liability_waiver: null, transportation_excursions: null,
    media_consent: null, spiritual_development: null, counseling_services: null,
  });
  const [acknowledgements, setAcknowledgements] = useState<Acknowledgements>({
    medical_consent: false, liability_waiver: false, transportation_excursions: false,
    media_consent: false, spiritual_development: false, counseling_services: false,
  });

  // Fetch form fields from DB
  const { data: formFields, isLoading: fieldsLoading } = useQuery({
    queryKey: ["registration-form-fields"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registration_form_fields")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as FormFieldDef[];
    },
  });

  const handleInputChange = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSignatureChange = (field: keyof Signatures, blob: Blob | null) => {
    setSignatures(prev => ({ ...prev, [field]: blob }));
  };
  const handleAcknowledgementChange = (field: keyof Acknowledgements, value: boolean) => {
    setAcknowledgements(prev => ({ ...prev, [field]: value }));
  };

  const uploadSignature = async (blob: Blob, prefix: string): Promise<string> => {
    const fileName = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
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
    const fileName = `headshot_${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
    const { data, error } = await supabase.storage
      .from("registration-signatures")
      .upload(fileName, file, { contentType: file.type });
    if (error) throw error;
    return data.path;
  };

  const checkForDuplicates = async (): Promise<string | null> => {
    const childFirst = (formValues["child_first_name"] || "").trim().toLowerCase();
    const childLast = (formValues["child_last_name"] || "").trim().toLowerCase();
    const dob = formValues["child_date_of_birth"];
    const parentEmail = (formValues["parent_email"] || "").trim().toLowerCase();

    if (!childFirst || !childLast || !dob) return null;

    try {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("id, child_first_name, child_last_name, parent_email")
        .eq("child_date_of_birth", dob);

      if (error) throw error;

      if (data && data.length > 0) {
        for (const existing of data) {
          const existingFirst = (existing.child_first_name || "").toLowerCase();
          const existingLast = (existing.child_last_name || "").toLowerCase();
          const existingEmail = (existing.parent_email || "").toLowerCase();

          // Check if names match
          if (existingFirst === childFirst && existingLast === childLast) {
            return `A registration for ${formValues["child_first_name"]} ${formValues["child_last_name"]} with this date of birth already exists. If you need to update information, please contact us.`;
          }

          // Check if email matches with same DOB
          if (parentEmail && existingEmail === parentEmail) {
            return `A registration with this parent email and date of birth already exists. If you need to update information, please contact us.`;
          }
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

    for (const field of formFields) {
      if (!field.required || !field.is_active) continue;
      if (field.field_key === "child_headshot") {
        if (!childHeadshot) return `Please upload a picture of your participant.`;
        continue;
      }
      if (["section_header", "paragraph"].includes(field.field_type)) continue;

      const val = formValues[field.field_key];
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

    // Waiver validations
    const requiredSignatures: (keyof Signatures)[] = [
      "medical_consent", "liability_waiver", "transportation_excursions",
      "media_consent", "spiritual_development", "counseling_services"
    ];
    for (const sig of requiredSignatures) {
      if (!signatures[sig]) return `Please sign all waivers. Missing: ${sig.replace(/_/g, " ")}`;
    }
    for (const ack of Object.keys(acknowledgements) as (keyof Acknowledgements)[]) {
      if (!acknowledgements[ack]) return "Please acknowledge all waivers by checking the boxes.";
    }

    // Waiver names
    const waiverNames = ["medical_consent_name", "liability_waiver_name", "transportation_excursions_waiver_name",
      "media_consent_name", "spiritual_development_policy_name", "counseling_services_name", "final_signature_name"];
    for (const wn of waiverNames) {
      if (!formValues[wn]?.trim()) return `Please fill in your name for all waiver signatures.`;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      toast({ title: "Validation Error", description: validationError, variant: "destructive" });
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
      const [medicalSigUrl, liabilitySigUrl, transportSigUrl, mediaSigUrl, spiritualSigUrl, counselingSigUrl] = await Promise.all([
        uploadSignature(signatures.medical_consent!, "medical"),
        uploadSignature(signatures.liability_waiver!, "liability"),
        uploadSignature(signatures.transportation_excursions!, "transport"),
        uploadSignature(signatures.media_consent!, "media"),
        uploadSignature(signatures.spiritual_development!, "spiritual"),
        uploadSignature(signatures.counseling_services!, "counseling"),
      ]);
      const headshotUrl = await uploadHeadshot(childHeadshot!);

      // Build core fields payload
      const adultsVal = formValues["adults_in_household"] || "1";
      const adultsNum = (() => {
        if (adultsVal === "1" || adultsVal === "1_m" || adultsVal === "1_g" || adultsVal === "1_o" ||
            adultsVal === "Dad Only" || adultsVal === "Mom Only" || adultsVal === "Grandparent(s)" || adultsVal === "Other") return 1;
        return 2;
      })();

      const siblingsVal = formValues["siblings_in_household"] || "0";
      const siblingsNum = (() => {
        if (siblingsVal === "Only child") return 0;
        const match = siblingsVal.match(/\d+/);
        return match ? parseInt(match[0]) : parseInt(siblingsVal) || 0;
      })();

      // Collect custom fields (non-core)
      const customData: Record<string, string> = {};
      for (const field of (formFields || [])) {
        if (!field.is_core && !["section_header", "paragraph"].includes(field.field_type)) {
          const val = formValues[field.field_key];
          if (val) customData[field.field_key] = val;
        }
      }

      const { error } = await (supabase.from("youth_registrations") as any).insert({
        submission_date: new Date().toISOString().split("T")[0],
        child_first_name: (formValues["child_first_name"] || "").trim(),
        child_last_name: (formValues["child_last_name"] || "").trim(),
        child_sex: formValues["child_sex"] as any,
        child_date_of_birth: formValues["child_date_of_birth"],
        child_race_ethnicity: formValues["child_race_ethnicity"] as any,
        parent_first_name: (formValues["parent_first_name"] || "").trim(),
        parent_last_name: (formValues["parent_last_name"] || "").trim(),
        parent_phone: toE164(formValues["parent_phone"] || "") || (formValues["parent_phone"] || "").trim(),
        child_phone: formValues["child_phone"] ? (toE164(formValues["child_phone"]) || formValues["child_phone"].trim()) : null,
        parent_email: (formValues["parent_email"] || "").trim(),
        child_primary_address: (formValues["child_primary_address"] || "").trim(),
        child_school_district: formValues["child_school_district"] as any,
        child_grade_level: formValues["child_grade_level"] ? parseInt(formValues["child_grade_level"]) : null,
        child_boxing_program: formValues["child_boxing_program"] as any,
        adults_in_household: adultsNum,
        siblings_in_household: siblingsNum,
        household_income_range: formValues["household_income_range"] as any,
        free_or_reduced_lunch: (formValues["free_or_reduced_lunch"] as any) || null,
        allergies: (formValues["allergies"] || "").trim() || null,
        asthma_inhaler_info: (formValues["asthma_inhaler_info"] || "").trim() || null,
        important_child_notes: (formValues["important_child_notes"] || "").trim() || null,
        medical_consent_name: (formValues["medical_consent_name"] || "").trim(),
        medical_consent_signature_url: medicalSigUrl,
        liability_waiver_name: (formValues["liability_waiver_name"] || "").trim(),
        liability_waiver_signature_url: liabilitySigUrl,
        transportation_excursions_waiver_name: (formValues["transportation_excursions_waiver_name"] || "").trim(),
        transportation_excursions_signature_url: transportSigUrl,
        media_consent_name: (formValues["media_consent_name"] || "").trim(),
        media_consent_signature_url: mediaSigUrl,
        spiritual_development_policy_name: (formValues["spiritual_development_policy_name"] || "").trim(),
        spiritual_development_policy_signature_url: spiritualSigUrl,
        counseling_services_name: (formValues["counseling_services_name"] || "").trim(),
        counseling_services_signature_url: counselingSigUrl,
        child_headshot_url: headshotUrl,
        final_signature_name: (formValues["final_signature_name"] || "").trim(),
        custom_fields_data: Object.keys(customData).length > 0 ? customData : null,
      });

      if (error) throw error;
      setIsSubmitted(true);
      toast({ title: "Registration Submitted!", description: "Thank you for registering with NLA Youth Boxing." });
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
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Registration Complete!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you for registering your child with NLA Youth Boxing. We will be in touch soon with next steps.
              </p>
              <Button onClick={() => navigate("/")}>Return to Home</Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-xl">
        <Card className="shadow-lg">
          <CardContent className="pt-8 pb-8">
            <div className="text-center mb-8">
              <img src={nlaLogo} alt="No Limits Academy" className="w-20 h-20 mx-auto mb-4 object-contain" />
              <h1 className="text-2xl font-bold mb-2">2025-26 Registration</h1>
              <p className="text-muted-foreground text-sm">Must complete before participation at No Limits Academy.</p>
            </div>

            {fieldsLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Loading form...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Today's Date */}
                <div>
                  <Label className="text-base font-medium">Today's Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={new Date().toISOString().split('T')[0]} disabled className="mt-2 bg-muted" />
                </div>

                {/* Dynamic fields from DB */}
                {(formFields || []).map(renderDynamicField)}

                {/* === WAIVERS (always rendered, not editable via form builder) === */}
                <div className="border-t pt-6">
                  <WaiverSection
                    title="Signature Required:"
                    text={WAIVER_TEXTS.medical_consent}
                    nameValue={formValues["medical_consent_name"] || ""}
                    onNameChange={v => handleInputChange("medical_consent_name", v)}
                    onSignatureChange={blob => handleSignatureChange("medical_consent", blob)}
                    acknowledged={acknowledgements.medical_consent}
                    onAcknowledgeChange={v => handleAcknowledgementChange("medical_consent", v)}
                  />
                </div>

                <div className="border-t pt-6">
                  <WaiverSection
                    title="Release of Liability & Waiver Form"
                    text={WAIVER_TEXTS.liability_waiver}
                    nameValue={formValues["liability_waiver_name"] || ""}
                    onNameChange={v => handleInputChange("liability_waiver_name", v)}
                    onSignatureChange={blob => handleSignatureChange("liability_waiver", blob)}
                    acknowledged={acknowledgements.liability_waiver}
                    onAcknowledgeChange={v => handleAcknowledgementChange("liability_waiver", v)}
                  />
                </div>

                <div className="border-t pt-6">
                  <WaiverSection
                    title="Waiver and Permission - Transportation and Excursions"
                    text={WAIVER_TEXTS.transportation_excursions}
                    nameValue={formValues["transportation_excursions_waiver_name"] || ""}
                    onNameChange={v => handleInputChange("transportation_excursions_waiver_name", v)}
                    onSignatureChange={blob => handleSignatureChange("transportation_excursions", blob)}
                    acknowledged={acknowledgements.transportation_excursions}
                    onAcknowledgeChange={v => handleAcknowledgementChange("transportation_excursions", v)}
                  />
                </div>

                <div className="border-t pt-6">
                  <WaiverSection
                    title="Media Consent, Release & Waiver"
                    text={WAIVER_TEXTS.media_consent}
                    nameValue={formValues["media_consent_name"] || ""}
                    onNameChange={v => handleInputChange("media_consent_name", v)}
                    onSignatureChange={blob => handleSignatureChange("media_consent", blob)}
                    acknowledged={acknowledgements.media_consent}
                    onAcknowledgeChange={v => handleAcknowledgementChange("media_consent", v)}
                  />
                </div>

                <div className="border-t pt-6">
                  <WaiverSection
                    title="Spiritual Development Policy"
                    text={WAIVER_TEXTS.spiritual_development}
                    nameValue={formValues["spiritual_development_policy_name"] || ""}
                    onNameChange={v => handleInputChange("spiritual_development_policy_name", v)}
                    onSignatureChange={blob => handleSignatureChange("spiritual_development", blob)}
                    acknowledged={acknowledgements.spiritual_development}
                    onAcknowledgeChange={v => handleAcknowledgementChange("spiritual_development", v)}
                  />
                </div>

                <div className="border-t pt-6">
                  <WaiverSection
                    title="Counseling Services Notice & Consent"
                    text={WAIVER_TEXTS.counseling_services}
                    nameValue={formValues["counseling_services_name"] || ""}
                    onNameChange={v => handleInputChange("counseling_services_name", v)}
                    onSignatureChange={blob => handleSignatureChange("counseling_services", blob)}
                    acknowledged={acknowledgements.counseling_services}
                    onAcknowledgeChange={v => handleAcknowledgementChange("counseling_services", v)}
                  />
                </div>

                {/* Final typed name */}
                <div className="border-t pt-6">
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

export default Register;
