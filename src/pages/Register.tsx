 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Card, CardContent } from "@/components/ui/card";
 import { useToast } from "@/hooks/use-toast";
 import { CheckCircle2, Loader2, Upload } from "lucide-react";
 import Header from "@/components/layout/Header";
 import Footer from "@/components/layout/Footer";
 import WaiverSection from "@/components/registration/WaiverSection";
 import { WAIVER_TEXTS } from "@/components/registration/waiverTexts";
 import nlaLogo from "@/assets/nla-logo.png";
 
 const SEX_OPTIONS = ["Male", "Female", "Other"] as const;
 const RACE_OPTIONS = [
   "American Indian or Alaska Native",
   "Asian",
   "Black or African American",
   "Hispanic or Latino",
   "Native Hawaiian or Other Pacific Islander",
   "White",
   "Two or More Races",
   "Other",
 ] as const;
 const SCHOOL_DISTRICTS = [
   "Cape May City",
   "Lower Cape May Regional",
   "Middle Township",
   "Ocean City",
   "Upper Township",
   "Wildwood",
   "Wildwood Crest",
   "North Wildwood",
   "West Cape May",
   "Dennis Township",
   "Woodbine",
   "Other",
 ] as const;
 const BOXING_PROGRAMS = [
  "Junior Boxing (Ages 7-10)",
  "Senior Boxing (Ages 11-19)",
  "Grit & Grace (Ages 11-19)",
 ] as const;
 const INCOME_RANGES = [
   "Under $25,000",
   "$25,000 - $49,999",
   "$50,000 - $74,999",
   "$75,000 - $99,999",
   "$100,000 - $149,999",
   "$150,000 or more",
 ] as const;
 const LUNCH_OPTIONS = ["Yes", "No", "Not Applicable"] as const;
 
 interface FormData {
   child_first_name: string;
   child_last_name: string;
   child_sex: string;
   child_date_of_birth: string;
   child_race_ethnicity: string;
   parent_first_name: string;
   parent_last_name: string;
   parent_phone: string;
   child_phone: string;
   parent_email: string;
   child_primary_address: string;
   child_school_district: string;
   child_grade_level: string;
   child_boxing_program: string;
   adults_in_household: string;
   siblings_in_household: string;
   household_income_range: string;
   free_or_reduced_lunch: string;
   allergies: string;
   asthma_inhaler_info: string;
   important_child_notes: string;
   medical_consent_name: string;
   liability_waiver_name: string;
   transportation_excursions_waiver_name: string;
   media_consent_name: string;
   spiritual_development_policy_name: string;
   counseling_services_name: string;
   final_signature_name: string;
 }
 
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
 
 const Register = () => {
   const navigate = useNavigate();
   const { toast } = useToast();
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isSubmitted, setIsSubmitted] = useState(false);
   const [childHeadshot, setChildHeadshot] = useState<File | null>(null);
   const [headshotPreview, setHeadshotPreview] = useState<string | null>(null);
   const [formData, setFormData] = useState<FormData>({
     child_first_name: "",
     child_last_name: "",
     child_sex: "",
     child_date_of_birth: "",
     child_race_ethnicity: "",
     parent_first_name: "",
     parent_last_name: "",
     parent_phone: "",
     child_phone: "",
     parent_email: "",
     child_primary_address: "",
     child_school_district: "",
     child_grade_level: "",
     child_boxing_program: "",
     adults_in_household: "",
     siblings_in_household: "",
     household_income_range: "",
     free_or_reduced_lunch: "",
     allergies: "",
     asthma_inhaler_info: "",
     important_child_notes: "",
     medical_consent_name: "",
     liability_waiver_name: "",
     transportation_excursions_waiver_name: "",
     media_consent_name: "",
     spiritual_development_policy_name: "",
     counseling_services_name: "",
     final_signature_name: "",
   });
   const [signatures, setSignatures] = useState<Signatures>({
     medical_consent: null,
     liability_waiver: null,
     transportation_excursions: null,
     media_consent: null,
     spiritual_development: null,
     counseling_services: null,
   });
   const [acknowledgements, setAcknowledgements] = useState<Acknowledgements>({
     medical_consent: false,
     liability_waiver: false,
     transportation_excursions: false,
     media_consent: false,
     spiritual_development: false,
     counseling_services: false,
   });
 
   const handleInputChange = (field: keyof FormData, value: string) => {
     setFormData(prev => ({ ...prev, [field]: value }));
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
     
     const { data: urlData } = supabase.storage
       .from("registration-signatures")
       .getPublicUrl(data.path);
     
     return urlData.publicUrl;
   };
 
   const handleHeadshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
       setChildHeadshot(file);
       const reader = new FileReader();
       reader.onloadend = () => {
         setHeadshotPreview(reader.result as string);
       };
       reader.readAsDataURL(file);
     }
   };
 
   const uploadHeadshot = async (file: File): Promise<string> => {
     const fileName = `headshot_${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
     const { data, error } = await supabase.storage
       .from("registration-signatures")
       .upload(fileName, file, { contentType: file.type });
     
     if (error) throw error;
     
     const { data: urlData } = supabase.storage
       .from("registration-signatures")
       .getPublicUrl(data.path);
     
     return urlData.publicUrl;
   };
 
   const validateForm = (): string | null => {
     const requiredFields: (keyof FormData)[] = [
       "child_first_name", "child_last_name", "child_sex", "child_date_of_birth",
       "child_race_ethnicity", "parent_first_name", "parent_last_name", "parent_phone",
       "parent_email", "child_primary_address", "child_school_district", "child_boxing_program",
       "adults_in_household", "siblings_in_household", "household_income_range",
       "medical_consent_name", "liability_waiver_name", "transportation_excursions_waiver_name",
       "media_consent_name", "spiritual_development_policy_name", "counseling_services_name",
       "final_signature_name"
     ];
 
     for (const field of requiredFields) {
       if (!formData[field]) {
         return `Please fill in all required fields. Missing: ${field.replace(/_/g, " ")}`;
       }
     }
 
     const requiredSignatures: (keyof Signatures)[] = [
       "medical_consent", "liability_waiver", "transportation_excursions",
       "media_consent", "spiritual_development", "counseling_services"
     ];
 
     for (const sig of requiredSignatures) {
       if (!signatures[sig]) {
         return `Please sign all waivers. Missing signature for: ${sig.replace(/_/g, " ")}`;
       }
     }
 
     for (const ack of Object.keys(acknowledgements) as (keyof Acknowledgements)[]) {
       if (!acknowledgements[ack]) {
         return `Please acknowledge all waivers by checking the boxes.`;
       }
     }
 
     if (!childHeadshot) {
       return "Please upload a headshot photo of your child.";
     }
 
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(formData.parent_email)) {
       return "Please enter a valid email address.";
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
 
     setIsSubmitting(true);
 
     try {
       // Upload all signatures
       const [
         medicalSigUrl,
         liabilitySigUrl,
         transportSigUrl,
         mediaSigUrl,
         spiritualSigUrl,
         counselingSigUrl
       ] = await Promise.all([
         uploadSignature(signatures.medical_consent!, "medical"),
         uploadSignature(signatures.liability_waiver!, "liability"),
         uploadSignature(signatures.transportation_excursions!, "transport"),
         uploadSignature(signatures.media_consent!, "media"),
         uploadSignature(signatures.spiritual_development!, "spiritual"),
         uploadSignature(signatures.counseling_services!, "counseling"),
       ]);
 
       // Upload headshot
       const headshotUrl = await uploadHeadshot(childHeadshot!);
 
       // Insert registration
       const { error } = await (supabase.from("youth_registrations") as any).insert({
         submission_date: new Date().toISOString().split("T")[0],
         child_first_name: formData.child_first_name.trim(),
         child_last_name: formData.child_last_name.trim(),
         child_sex: formData.child_sex as any,
         child_date_of_birth: formData.child_date_of_birth,
         child_race_ethnicity: formData.child_race_ethnicity as any,
         parent_first_name: formData.parent_first_name.trim(),
         parent_last_name: formData.parent_last_name.trim(),
         parent_phone: formData.parent_phone.trim(),
         child_phone: formData.child_phone.trim() || null,
         parent_email: formData.parent_email.trim(),
         child_primary_address: formData.child_primary_address.trim(),
         child_school_district: formData.child_school_district as any,
         child_grade_level: formData.child_grade_level ? parseInt(formData.child_grade_level) : null,
         child_boxing_program: formData.child_boxing_program as any,
         adults_in_household: parseInt(formData.adults_in_household),
         siblings_in_household: parseInt(formData.siblings_in_household),
         household_income_range: formData.household_income_range as any,
         free_or_reduced_lunch: formData.free_or_reduced_lunch as any || null,
         allergies: formData.allergies.trim() || null,
         asthma_inhaler_info: formData.asthma_inhaler_info.trim() || null,
         important_child_notes: formData.important_child_notes.trim() || null,
         medical_consent_name: formData.medical_consent_name.trim(),
         medical_consent_signature_url: medicalSigUrl,
         liability_waiver_name: formData.liability_waiver_name.trim(),
         liability_waiver_signature_url: liabilitySigUrl,
         transportation_excursions_waiver_name: formData.transportation_excursions_waiver_name.trim(),
         transportation_excursions_signature_url: transportSigUrl,
         media_consent_name: formData.media_consent_name.trim(),
         media_consent_signature_url: mediaSigUrl,
         spiritual_development_policy_name: formData.spiritual_development_policy_name.trim(),
         spiritual_development_policy_signature_url: spiritualSigUrl,
         counseling_services_name: formData.counseling_services_name.trim(),
         counseling_services_signature_url: counselingSigUrl,
         child_headshot_url: headshotUrl,
         final_signature_name: formData.final_signature_name.trim(),
       });
 
       if (error) throw error;
 
       setIsSubmitted(true);
       toast({ title: "Registration Submitted!", description: "Thank you for registering with NLA Youth Boxing." });
     } catch (error: any) {
       console.error("Registration error:", error);
       toast({ 
         title: "Submission Failed", 
         description: error.message || "Please try again.", 
         variant: "destructive" 
       });
     } finally {
       setIsSubmitting(false);
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
                 Thank you for registering your child with NLA Youth Boxing. 
                 We will be in touch soon with next steps.
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
             {/* Header */}
             <div className="text-center mb-8">
               <img src={nlaLogo} alt="No Limits Academy" className="w-20 h-20 mx-auto mb-4 object-contain" />
               <h1 className="text-2xl font-bold mb-2">2025-26 Registration</h1>
               <p className="text-muted-foreground text-sm">Must complete before participation at No Limits Academy.</p>
             </div>
 
             <form onSubmit={handleSubmit} className="space-y-6">
               {/* Today's Date - Auto-filled but shown */}
               <div>
                 <Label className="text-base font-medium">Today's Date <span className="text-destructive">*</span></Label>
                 <Input
                   type="date"
                   value={new Date().toISOString().split('T')[0]}
                   disabled
                   className="mt-2 bg-muted"
                 />
               </div>

               {/* First Name of Child */}
               <div>
                 <Label htmlFor="child_first_name" className="text-base font-medium">First Name of Child <span className="text-destructive">*</span></Label>
                 <Input
                   id="child_first_name"
                   value={formData.child_first_name}
                   onChange={(e) => handleInputChange("child_first_name", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* Last Name of Child */}
               <div>
                 <Label htmlFor="child_last_name" className="text-base font-medium">Last Name of Child <span className="text-destructive">*</span></Label>
                 <Input
                   id="child_last_name"
                   value={formData.child_last_name}
                   onChange={(e) => handleInputChange("child_last_name", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* Child's Sex */}
               <div>
                 <Label htmlFor="child_sex" className="text-base font-medium">Child's Sex <span className="text-destructive">*</span></Label>
                 <Select value={formData.child_sex} onValueChange={(v) => handleInputChange("child_sex", v)}>
                   <SelectTrigger className="mt-2"><SelectValue placeholder="Select..." /></SelectTrigger>
                   <SelectContent>
                     {SEX_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>

               {/* Child's Date of Birth */}
               <div>
                 <Label htmlFor="child_date_of_birth" className="text-base font-medium">Child's Date of Birth <span className="text-destructive">*</span></Label>
                 <Input
                   id="child_date_of_birth"
                   type="date"
                   value={formData.child_date_of_birth}
                   onChange={(e) => handleInputChange("child_date_of_birth", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* Child's Race/Ethnicity */}
               <div>
                 <Label htmlFor="child_race_ethnicity" className="text-base font-medium">Child's Race/Ethnicity <span className="text-destructive">*</span></Label>
                 <Select value={formData.child_race_ethnicity} onValueChange={(v) => handleInputChange("child_race_ethnicity", v)}>
                   <SelectTrigger className="mt-2"><SelectValue placeholder="Select..." /></SelectTrigger>
                   <SelectContent>
                     {RACE_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>

               {/* First Name of Parent/Guardian */}
               <div>
                 <Label htmlFor="parent_first_name" className="text-base font-medium">First Name of Parent/Guardian <span className="text-destructive">*</span></Label>
                 <Input
                   id="parent_first_name"
                   value={formData.parent_first_name}
                   onChange={(e) => handleInputChange("parent_first_name", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* Last Name of Parent/Guardian */}
               <div>
                 <Label htmlFor="parent_last_name" className="text-base font-medium">Last Name of Parent/Guardian <span className="text-destructive">*</span></Label>
                 <Input
                   id="parent_last_name"
                   value={formData.parent_last_name}
                   onChange={(e) => handleInputChange("parent_last_name", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* Parent/Guardian Cell Phone # */}
               <div>
                 <Label htmlFor="parent_phone" className="text-base font-medium">Parent/Guardian Cell Phone # <span className="text-destructive">*</span></Label>
                 <Input
                   id="parent_phone"
                   type="tel"
                   value={formData.parent_phone}
                   onChange={(e) => handleInputChange("parent_phone", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* Child's Cell Phone # */}
               <div>
                 <Label htmlFor="child_phone" className="text-base font-medium">Child's Cell Phone #</Label>
                 <p className="text-sm text-muted-foreground">If no cell phone, SKIP</p>
                 <Input
                   id="child_phone"
                   type="tel"
                   value={formData.child_phone}
                   onChange={(e) => handleInputChange("child_phone", e.target.value)}
                   className="mt-2"
                 />
               </div>

               {/* Parent/Guardian Email */}
               <div>
                 <Label htmlFor="parent_email" className="text-base font-medium">Parent/Guardian Email <span className="text-destructive">*</span></Label>
                 <Input
                   id="parent_email"
                   type="email"
                   value={formData.parent_email}
                   onChange={(e) => handleInputChange("parent_email", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* Child's Primary Address */}
               <div>
                 <Label htmlFor="child_primary_address" className="text-base font-medium">Child's Primary Address <span className="text-destructive">*</span></Label>
                 <p className="text-sm text-muted-foreground">MUST BE FULL MAILING ADDRESS</p>
                 <Textarea
                   id="child_primary_address"
                   value={formData.child_primary_address}
                   onChange={(e) => handleInputChange("child_primary_address", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* Child's School District */}
               <div>
                 <Label htmlFor="child_school_district" className="text-base font-medium">Child's School District <span className="text-destructive">*</span></Label>
                 <Select value={formData.child_school_district} onValueChange={(v) => handleInputChange("child_school_district", v)}>
                   <SelectTrigger className="mt-2"><SelectValue placeholder="Select..." /></SelectTrigger>
                   <SelectContent>
                     {SCHOOL_DISTRICTS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>

               {/* Child's Grade Level */}
               <div>
                 <Label htmlFor="child_grade_level" className="text-base font-medium">Child's Grade Level <span className="text-destructive">*</span></Label>
                 <p className="text-sm text-muted-foreground">Use # Only (Ex: 9 for ninth grade)</p>
                 <p className="text-sm text-muted-foreground">Skip if not applicable</p>
                 <Input
                   id="child_grade_level"
                   type="number"
                   min="1"
                   max="12"
                   value={formData.child_grade_level}
                   onChange={(e) => handleInputChange("child_grade_level", e.target.value)}
                   className="mt-2"
                 />
               </div>

               {/* Child's Boxing Program */}
               <div>
                 <Label htmlFor="child_boxing_program" className="text-base font-medium">Child's Boxing Program <span className="text-destructive">*</span></Label>
                 <Select value={formData.child_boxing_program} onValueChange={(v) => handleInputChange("child_boxing_program", v)}>
                   <SelectTrigger className="mt-2"><SelectValue placeholder="Select..." /></SelectTrigger>
                   <SelectContent>
                     {BOXING_PROGRAMS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>

               {/* Adult(s) in Child's primary household */}
               <div>
                 <Label htmlFor="adults_in_household" className="text-base font-medium">Adult(s) in Child's primary household <span className="text-destructive">*</span></Label>
                 <Input
                   id="adults_in_household"
                   type="number"
                   min="1"
                   value={formData.adults_in_household}
                   onChange={(e) => handleInputChange("adults_in_household", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* How many siblings in Child's primary household? */}
               <div>
                 <Label htmlFor="siblings_in_household" className="text-base font-medium">How many siblings in Child's primary household? <span className="text-destructive">*</span></Label>
                 <Input
                   id="siblings_in_household"
                   type="number"
                   min="0"
                   value={formData.siblings_in_household}
                   onChange={(e) => handleInputChange("siblings_in_household", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* Household Income */}
               <div>
                 <Label htmlFor="household_income_range" className="text-base font-medium">For Program funding purposes, please indicate which below reflects your total household income. <span className="text-destructive">*</span></Label>
                 <p className="text-sm text-muted-foreground">This information is completely confidential and is used for data collection.</p>
                 <Select value={formData.household_income_range} onValueChange={(v) => handleInputChange("household_income_range", v)}>
                   <SelectTrigger className="mt-2"><SelectValue placeholder="Select..." /></SelectTrigger>
                   <SelectContent>
                     {INCOME_RANGES.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>

               {/* Free or reduced lunch */}
               <div>
                 <Label htmlFor="free_or_reduced_lunch" className="text-base font-medium">For Program funding purposes, does your Child receive free or reduced lunch at school?</Label>
                 <p className="text-sm text-muted-foreground">Skip if not applicable</p>
                 <Select value={formData.free_or_reduced_lunch} onValueChange={(v) => handleInputChange("free_or_reduced_lunch", v)}>
                   <SelectTrigger className="mt-2"><SelectValue placeholder="Select..." /></SelectTrigger>
                   <SelectContent>
                     {LUNCH_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>

               {/* Allergies */}
               <div>
                 <Label htmlFor="allergies" className="text-base font-medium">What allergies does your child have?   If none, please skip question.</Label>
                 <p className="text-sm text-muted-foreground">If your child requires an epinephrine injection, <strong>YOU MUST PROVIDE</strong> No Limits Academy Coaches with an up-to-date epi-pen that will remain at the No Limits Academy facility. NO EXCEPTIONS.</p>
                 <Textarea
                   id="allergies"
                   value={formData.allergies}
                   onChange={(e) => handleInputChange("allergies", e.target.value)}
                   className="mt-2"
                   maxLength={2000}
                 />
               </div>

               {/* Asthma */}
               <div>
                 <Label htmlFor="asthma_inhaler_info" className="text-base font-medium">If your child has asthma, please fill in the following information. If your child does not have asthma, please skip question.</Label>
                 <p className="text-sm text-muted-foreground">Name of the inhaler your child takes prior to strenuous exercise.</p>
                 <p className="text-sm text-muted-foreground"><strong>YOU MUST PROVIDE</strong> an inhaler that will remain at the No Limits Academy facility. NO EXCEPTIONS.</p>
                 <Textarea
                   id="asthma_inhaler_info"
                   value={formData.asthma_inhaler_info}
                   onChange={(e) => handleInputChange("asthma_inhaler_info", e.target.value)}
                   className="mt-2"
                   maxLength={2000}
                 />
               </div>

               {/* Medical Consent - Signature Required */}
               <div className="border-t pt-6">
                 <WaiverSection
                   title="Signature Required:"
                   text={WAIVER_TEXTS.medical_consent}
                   nameValue={formData.medical_consent_name}
                   onNameChange={(v) => handleInputChange("medical_consent_name", v)}
                   onSignatureChange={(blob) => handleSignatureChange("medical_consent", blob)}
                   acknowledged={acknowledgements.medical_consent}
                   onAcknowledgeChange={(v) => handleAcknowledgementChange("medical_consent", v)}
                 />
               </div>

               {/* Coach Notes */}
               <div>
                 <Label htmlFor="important_child_notes" className="text-base font-medium">Please share any important information about your child that would help our coaches support them.</Label>
                 <p className="text-sm text-muted-foreground">Ex: Recent life changes, social challenges, medical needs, etc.</p>
                 <p className="text-sm text-muted-foreground">Skip if not applicable</p>
                 <Textarea
                   id="important_child_notes"
                   value={formData.important_child_notes}
                   onChange={(e) => handleInputChange("important_child_notes", e.target.value)}
                   className="mt-2"
                   rows={4}
                 />
               </div>

               {/* Release of Liability & Waiver Form */}
               <div className="border-t pt-6">
                 <WaiverSection
                   title="Release of Liability & Waiver Form"
                   text={WAIVER_TEXTS.liability_waiver}
                   nameValue={formData.liability_waiver_name}
                   onNameChange={(v) => handleInputChange("liability_waiver_name", v)}
                   onSignatureChange={(blob) => handleSignatureChange("liability_waiver", blob)}
                   acknowledged={acknowledgements.liability_waiver}
                   onAcknowledgeChange={(v) => handleAcknowledgementChange("liability_waiver", v)}
                 />
               </div>

               {/* Waiver and Permission - Transportation and Excursions */}
               <div className="border-t pt-6">
                 <WaiverSection
                   title="Waiver and Permission - Transportation and Excursions"
                   text={WAIVER_TEXTS.transportation_excursions}
                   nameValue={formData.transportation_excursions_waiver_name}
                   onNameChange={(v) => handleInputChange("transportation_excursions_waiver_name", v)}
                   onSignatureChange={(blob) => handleSignatureChange("transportation_excursions", blob)}
                   acknowledged={acknowledgements.transportation_excursions}
                   onAcknowledgeChange={(v) => handleAcknowledgementChange("transportation_excursions", v)}
                 />
               </div>

               {/* Media Consent, Release & Waiver */}
               <div className="border-t pt-6">
                 <WaiverSection
                   title="Media Consent, Release & Waiver"
                   text={WAIVER_TEXTS.media_consent}
                   nameValue={formData.media_consent_name}
                   onNameChange={(v) => handleInputChange("media_consent_name", v)}
                   onSignatureChange={(blob) => handleSignatureChange("media_consent", blob)}
                   acknowledged={acknowledgements.media_consent}
                   onAcknowledgeChange={(v) => handleAcknowledgementChange("media_consent", v)}
                 />
               </div>

               {/* Spiritual Development Policy */}
               <div className="border-t pt-6">
                 <WaiverSection
                   title="Spiritual Development Policy"
                   text={WAIVER_TEXTS.spiritual_development}
                   nameValue={formData.spiritual_development_policy_name}
                   onNameChange={(v) => handleInputChange("spiritual_development_policy_name", v)}
                   onSignatureChange={(blob) => handleSignatureChange("spiritual_development", blob)}
                   acknowledged={acknowledgements.spiritual_development}
                   onAcknowledgeChange={(v) => handleAcknowledgementChange("spiritual_development", v)}
                 />
               </div>

               {/* Counseling Services Notice & Consent */}
               <div className="border-t pt-6">
                 <WaiverSection
                   title="Counseling Services Notice & Consent"
                   text={WAIVER_TEXTS.counseling_services}
                   nameValue={formData.counseling_services_name}
                   onNameChange={(v) => handleInputChange("counseling_services_name", v)}
                   onSignatureChange={(blob) => handleSignatureChange("counseling_services", blob)}
                   acknowledged={acknowledgements.counseling_services}
                   onAcknowledgeChange={(v) => handleAcknowledgementChange("counseling_services", v)}
                 />
               </div>

               {/* Final typed name */}
               <div className="border-t pt-6">
                 <Label htmlFor="final_signature_name" className="text-base font-medium">Please TYPE the FIRST and LAST name used in the Signatures above. <span className="text-destructive">*</span></Label>
                 <Input
                   id="final_signature_name"
                   value={formData.final_signature_name}
                   onChange={(e) => handleInputChange("final_signature_name", e.target.value)}
                   className="mt-2"
                   required
                 />
               </div>

               {/* Child Headshot Upload */}
               <div>
                 <Label className="text-base font-medium">For safety & security, upload a picture (headshot) of your child. <span className="text-destructive">*</span></Label>
                 <div className="mt-2">
                   <div className="flex items-center gap-4">
                     <label className="flex items-center gap-2 px-4 py-2 border border-input rounded-md cursor-pointer hover:bg-muted transition-colors">
                       <Upload className="w-4 h-4" />
                       <span className="text-sm">Choose Photo</span>
                       <input
                         type="file"
                         accept="image/*"
                         onChange={handleHeadshotChange}
                         className="hidden"
                       />
                     </label>
                     {childHeadshot && (
                       <span className="text-sm text-muted-foreground">{childHeadshot.name}</span>
                     )}
                   </div>
                   {headshotPreview && (
                     <div className="mt-4">
                       <img
                         src={headshotPreview}
                         alt="Child headshot preview"
                         className="w-32 h-32 object-cover rounded-lg border border-border"
                       />
                     </div>
                   )}
                 </div>
               </div>

               {/* Submit */}
               <div className="pt-6">
                 <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                   {isSubmitting ? (
                     <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Submitting...
                     </>
                   ) : (
                     "Submit"
                   )}
                 </Button>
               </div>
             </form>
           </CardContent>
         </Card>
       </main>
       <Footer />
     </div>
   );
 };
 
 export default Register;