 import { useState } from "react";
 import { useNavigate } from "react-router-dom";
 import { supabase } from "@/integrations/supabase/client";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { useToast } from "@/hooks/use-toast";
 import { CheckCircle2, Loader2 } from "lucide-react";
 import Header from "@/components/layout/Header";
 import Footer from "@/components/layout/Footer";
 import WaiverSection from "@/components/registration/WaiverSection";
 import { WAIVER_TEXTS } from "@/components/registration/waiverTexts";
 
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
   "Prefer not to say",
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
   "Boxing Fundamentals (Ages 7-12)",
   "Boxing Development (Ages 13-16)",
   "Boxing Advanced (Ages 17-19)",
   "Boxing Fitness Only",
 ] as const;
 const INCOME_RANGES = [
   "Under $25,000",
   "$25,000 - $49,999",
   "$50,000 - $74,999",
   "$75,000 - $99,999",
   "$100,000 - $149,999",
   "$150,000 or more",
   "Prefer not to say",
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
 }
 
 interface Signatures {
   medical_consent: Blob | null;
   liability_waiver: Blob | null;
   transportation_excursions: Blob | null;
   media_consent: Blob | null;
   spiritual_development: Blob | null;
 }
 
 interface Acknowledgements {
   medical_consent: boolean;
   liability_waiver: boolean;
   transportation_excursions: boolean;
   media_consent: boolean;
   spiritual_development: boolean;
 }
 
 const Register = () => {
   const navigate = useNavigate();
   const { toast } = useToast();
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isSubmitted, setIsSubmitted] = useState(false);
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
   });
   const [signatures, setSignatures] = useState<Signatures>({
     medical_consent: null,
     liability_waiver: null,
     transportation_excursions: null,
     media_consent: null,
     spiritual_development: null,
   });
   const [acknowledgements, setAcknowledgements] = useState<Acknowledgements>({
     medical_consent: false,
     liability_waiver: false,
     transportation_excursions: false,
     media_consent: false,
     spiritual_development: false,
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
 
   const validateForm = (): string | null => {
     const requiredFields: (keyof FormData)[] = [
       "child_first_name", "child_last_name", "child_sex", "child_date_of_birth",
       "child_race_ethnicity", "parent_first_name", "parent_last_name", "parent_phone",
       "parent_email", "child_primary_address", "child_school_district", "child_boxing_program",
       "adults_in_household", "siblings_in_household", "household_income_range",
       "medical_consent_name", "liability_waiver_name", "transportation_excursions_waiver_name",
       "media_consent_name", "spiritual_development_policy_name"
     ];
 
     for (const field of requiredFields) {
       if (!formData[field]) {
         return `Please fill in all required fields. Missing: ${field.replace(/_/g, " ")}`;
       }
     }
 
     const requiredSignatures: (keyof Signatures)[] = [
       "medical_consent", "liability_waiver", "transportation_excursions",
       "media_consent", "spiritual_development"
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
         spiritualSigUrl
       ] = await Promise.all([
         uploadSignature(signatures.medical_consent!, "medical"),
         uploadSignature(signatures.liability_waiver!, "liability"),
         uploadSignature(signatures.transportation_excursions!, "transport"),
         uploadSignature(signatures.media_consent!, "media"),
         uploadSignature(signatures.spiritual_development!, "spiritual"),
       ]);
 
       // Insert registration
       const { error } = await supabase.from("youth_registrations").insert({
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
       <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
         <div className="text-center mb-8">
           <h1 className="text-3xl font-bold mb-2">NLA Youth Registration</h1>
           <p className="text-muted-foreground">Complete all sections below to register your child for NLA Boxing programs.</p>
         </div>
 
         <form onSubmit={handleSubmit} className="space-y-8">
           {/* Section 1: Child Information */}
           <Card>
             <CardHeader>
               <CardTitle>1. Child Information</CardTitle>
               <CardDescription>Tell us about your child</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <Label htmlFor="child_first_name">First Name *</Label>
                   <Input
                     id="child_first_name"
                     value={formData.child_first_name}
                     onChange={(e) => handleInputChange("child_first_name", e.target.value)}
                     required
                   />
                 </div>
                 <div>
                   <Label htmlFor="child_last_name">Last Name *</Label>
                   <Input
                     id="child_last_name"
                     value={formData.child_last_name}
                     onChange={(e) => handleInputChange("child_last_name", e.target.value)}
                     required
                   />
                 </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <Label htmlFor="child_sex">Sex *</Label>
                   <Select value={formData.child_sex} onValueChange={(v) => handleInputChange("child_sex", v)}>
                     <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                     <SelectContent>
                       {SEX_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
                 <div>
                   <Label htmlFor="child_date_of_birth">Date of Birth *</Label>
                   <Input
                     id="child_date_of_birth"
                     type="date"
                     value={formData.child_date_of_birth}
                     onChange={(e) => handleInputChange("child_date_of_birth", e.target.value)}
                     required
                   />
                 </div>
               </div>
               <div>
                 <Label htmlFor="child_race_ethnicity">Race/Ethnicity *</Label>
                 <Select value={formData.child_race_ethnicity} onValueChange={(v) => handleInputChange("child_race_ethnicity", v)}>
                   <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                   <SelectContent>
                     {RACE_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
             </CardContent>
           </Card>
 
           {/* Section 2: Parent/Guardian Information */}
           <Card>
             <CardHeader>
               <CardTitle>2. Parent/Guardian Information</CardTitle>
               <CardDescription>Primary contact details</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <Label htmlFor="parent_first_name">Parent First Name *</Label>
                   <Input
                     id="parent_first_name"
                     value={formData.parent_first_name}
                     onChange={(e) => handleInputChange("parent_first_name", e.target.value)}
                     required
                   />
                 </div>
                 <div>
                   <Label htmlFor="parent_last_name">Parent Last Name *</Label>
                   <Input
                     id="parent_last_name"
                     value={formData.parent_last_name}
                     onChange={(e) => handleInputChange("parent_last_name", e.target.value)}
                     required
                   />
                 </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <Label htmlFor="parent_phone">Parent Phone *</Label>
                   <Input
                     id="parent_phone"
                     type="tel"
                     value={formData.parent_phone}
                     onChange={(e) => handleInputChange("parent_phone", e.target.value)}
                     placeholder="(555) 123-4567"
                     required
                   />
                 </div>
                 <div>
                   <Label htmlFor="child_phone">Child's Phone (optional)</Label>
                   <Input
                     id="child_phone"
                     type="tel"
                     value={formData.child_phone}
                     onChange={(e) => handleInputChange("child_phone", e.target.value)}
                     placeholder="(555) 123-4567"
                   />
                 </div>
               </div>
               <div>
                 <Label htmlFor="parent_email">Parent Email *</Label>
                 <Input
                   id="parent_email"
                   type="email"
                   value={formData.parent_email}
                   onChange={(e) => handleInputChange("parent_email", e.target.value)}
                   required
                 />
               </div>
             </CardContent>
           </Card>
 
           {/* Section 3: Address + School */}
           <Card>
             <CardHeader>
               <CardTitle>3. Address & School</CardTitle>
               <CardDescription>Location and education information</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div>
                 <Label htmlFor="child_primary_address">Primary Address *</Label>
                 <Textarea
                   id="child_primary_address"
                   value={formData.child_primary_address}
                   onChange={(e) => handleInputChange("child_primary_address", e.target.value)}
                   placeholder="Street, City, State, ZIP"
                   required
                 />
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <Label htmlFor="child_school_district">School District *</Label>
                   <Select value={formData.child_school_district} onValueChange={(v) => handleInputChange("child_school_district", v)}>
                     <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                     <SelectContent>
                       {SCHOOL_DISTRICTS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
                 <div>
                   <Label htmlFor="child_grade_level">Grade Level (optional)</Label>
                   <Input
                     id="child_grade_level"
                     type="number"
                     min="1"
                     max="12"
                     value={formData.child_grade_level}
                     onChange={(e) => handleInputChange("child_grade_level", e.target.value)}
                   />
                 </div>
               </div>
             </CardContent>
           </Card>
 
           {/* Section 4: Program + Household */}
           <Card>
             <CardHeader>
               <CardTitle>4. Program & Household</CardTitle>
               <CardDescription>Program selection and household info</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div>
                 <Label htmlFor="child_boxing_program">Boxing Program *</Label>
                 <Select value={formData.child_boxing_program} onValueChange={(v) => handleInputChange("child_boxing_program", v)}>
                   <SelectTrigger><SelectValue placeholder="Select program..." /></SelectTrigger>
                   <SelectContent>
                     {BOXING_PROGRAMS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                   <Label htmlFor="adults_in_household">Adults in Household *</Label>
                   <Input
                     id="adults_in_household"
                     type="number"
                     min="1"
                     value={formData.adults_in_household}
                     onChange={(e) => handleInputChange("adults_in_household", e.target.value)}
                     required
                   />
                 </div>
                 <div>
                   <Label htmlFor="siblings_in_household">Siblings in Household *</Label>
                   <Input
                     id="siblings_in_household"
                     type="number"
                     min="0"
                     value={formData.siblings_in_household}
                     onChange={(e) => handleInputChange("siblings_in_household", e.target.value)}
                     required
                   />
                 </div>
               </div>
             </CardContent>
           </Card>
 
           {/* Section 5: Funding Questions */}
           <Card>
             <CardHeader>
               <CardTitle>5. Funding Questions</CardTitle>
               <CardDescription>This helps us seek grants and funding</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div>
                 <Label htmlFor="household_income_range">Household Income Range *</Label>
                 <Select value={formData.household_income_range} onValueChange={(v) => handleInputChange("household_income_range", v)}>
                   <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                   <SelectContent>
                     {INCOME_RANGES.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
               <div>
                 <Label htmlFor="free_or_reduced_lunch">Does your child receive free or reduced lunch? (optional)</Label>
                 <Select value={formData.free_or_reduced_lunch} onValueChange={(v) => handleInputChange("free_or_reduced_lunch", v)}>
                   <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                   <SelectContent>
                     {LUNCH_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                 </Select>
               </div>
             </CardContent>
           </Card>
 
           {/* Section 6: Medical Info */}
           <Card>
             <CardHeader>
               <CardTitle>6. Medical Information</CardTitle>
               <CardDescription>Important health details (optional)</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div>
                 <Label htmlFor="allergies">Allergies</Label>
                 <Textarea
                   id="allergies"
                   value={formData.allergies}
                   onChange={(e) => handleInputChange("allergies", e.target.value)}
                   placeholder="List any allergies..."
                 />
               </div>
               <div>
                 <Label htmlFor="asthma_inhaler_info">Asthma / Inhaler Information</Label>
                 <Textarea
                   id="asthma_inhaler_info"
                   value={formData.asthma_inhaler_info}
                   onChange={(e) => handleInputChange("asthma_inhaler_info", e.target.value)}
                   placeholder="Describe any asthma conditions or inhaler needs..."
                 />
               </div>
             </CardContent>
           </Card>
 
           {/* Section 7: Coach Notes */}
           <Card>
             <CardHeader>
               <CardTitle>7. Coach Notes</CardTitle>
               <CardDescription>Anything else we should know?</CardDescription>
             </CardHeader>
             <CardContent>
               <div>
                 <Label htmlFor="important_child_notes">Important Notes About Your Child</Label>
                 <Textarea
                   id="important_child_notes"
                   value={formData.important_child_notes}
                   onChange={(e) => handleInputChange("important_child_notes", e.target.value)}
                   placeholder="Special needs, behavioral notes, goals, etc."
                   rows={4}
                 />
               </div>
             </CardContent>
           </Card>
 
           {/* Section 8: Waivers & Consents */}
           <Card>
             <CardHeader>
               <CardTitle>8. Waivers & Consents</CardTitle>
               <CardDescription>Please read each waiver carefully, type your name, and sign</CardDescription>
             </CardHeader>
             <CardContent className="space-y-8">
               {/* Medical Consent */}
               <WaiverSection
                 title="Medical Consent"
                 text={WAIVER_TEXTS.medical_consent}
                 nameValue={formData.medical_consent_name}
                 onNameChange={(v) => handleInputChange("medical_consent_name", v)}
                 onSignatureChange={(blob) => handleSignatureChange("medical_consent", blob)}
                 acknowledged={acknowledgements.medical_consent}
                 onAcknowledgeChange={(v) => handleAcknowledgementChange("medical_consent", v)}
               />
 
               {/* Liability Waiver */}
               <WaiverSection
                 title="Liability Waiver"
                 text={WAIVER_TEXTS.liability_waiver}
                 nameValue={formData.liability_waiver_name}
                 onNameChange={(v) => handleInputChange("liability_waiver_name", v)}
                 onSignatureChange={(blob) => handleSignatureChange("liability_waiver", blob)}
                 acknowledged={acknowledgements.liability_waiver}
                 onAcknowledgeChange={(v) => handleAcknowledgementChange("liability_waiver", v)}
               />
 
               {/* Transportation & Excursions */}
               <WaiverSection
                 title="Transportation & Excursions Waiver"
                 text={WAIVER_TEXTS.transportation_excursions}
                 nameValue={formData.transportation_excursions_waiver_name}
                 onNameChange={(v) => handleInputChange("transportation_excursions_waiver_name", v)}
                 onSignatureChange={(blob) => handleSignatureChange("transportation_excursions", blob)}
                 acknowledged={acknowledgements.transportation_excursions}
                 onAcknowledgeChange={(v) => handleAcknowledgementChange("transportation_excursions", v)}
               />
 
               {/* Media Consent */}
               <WaiverSection
                 title="Media Consent"
                 text={WAIVER_TEXTS.media_consent}
                 nameValue={formData.media_consent_name}
                 onNameChange={(v) => handleInputChange("media_consent_name", v)}
                 onSignatureChange={(blob) => handleSignatureChange("media_consent", blob)}
                 acknowledged={acknowledgements.media_consent}
                 onAcknowledgeChange={(v) => handleAcknowledgementChange("media_consent", v)}
               />
 
               {/* Spiritual Development Policy */}
               <WaiverSection
                 title="Spiritual Development Policy"
                 text={WAIVER_TEXTS.spiritual_development}
                 nameValue={formData.spiritual_development_policy_name}
                 onNameChange={(v) => handleInputChange("spiritual_development_policy_name", v)}
                 onSignatureChange={(blob) => handleSignatureChange("spiritual_development", blob)}
                 acknowledged={acknowledgements.spiritual_development}
                 onAcknowledgeChange={(v) => handleAcknowledgementChange("spiritual_development", v)}
               />
             </CardContent>
           </Card>
 
           {/* Submit */}
           <div className="flex justify-center">
             <Button type="submit" size="lg" disabled={isSubmitting} className="w-full md:w-auto min-w-[200px]">
               {isSubmitting ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Submitting...
                 </>
               ) : (
                 "Submit Registration"
               )}
             </Button>
           </div>
         </form>
       </main>
       <Footer />
     </div>
   );
 };
 
 export default Register;