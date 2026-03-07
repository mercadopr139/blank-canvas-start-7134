import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Eye, AlertTriangle, ExternalLink, Users, Loader2, Pencil, Trash2 } from "lucide-react";
import { format, parseISO, differenceInYears } from "date-fns";
import { toast } from "sonner";

const HeadshotThumbnail = ({ headshotPath, size = "sm" }: { headshotPath: string; size?: "sm" | "lg" }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    supabase.storage.from("registration-signatures").createSignedUrl(headshotPath, 300)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }, [headshotPath]);
  const sizeClass = size === "lg" ? "w-28 h-28" : "w-10 h-10";
  if (!url) return <div className={`${sizeClass} rounded-full bg-muted animate-pulse shrink-0`} />;
  return (
    <>
      <img
        src={url}
        alt="Youth"
        className={`${sizeClass} rounded-full object-cover border-2 border-border shrink-0 cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={() => setFullscreen(true)}
      />
      {fullscreen && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center" onClick={() => setFullscreen(false)}>
          <img src={url} alt="Youth fullscreen" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </>
  );
};

const AdminRegistrations = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [selectedRegistration, setSelectedRegistration] = useState<any | null>(null);
  const [editingRegistration, setEditingRegistration] = useState<any | null>(null);
  const [deletingRegistration, setDeletingRegistration] = useState<any | null>(null);

  const { data: registrations, isLoading } = useQuery({
    queryKey: ["youth-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youth_registrations")
        .select("*")
        .order("submission_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredRegistrations = registrations?.filter((reg) => {
    const matchesSearch =
      searchQuery === "" ||
      `${reg.child_first_name} ${reg.child_last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${reg.parent_first_name} ${reg.parent_last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.parent_email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesProgram = programFilter === "all" || reg.child_boxing_program === programFilter;
    const matchesDistrict = districtFilter === "all" || reg.child_school_district === districtFilter;

    return matchesSearch && matchesProgram && matchesDistrict;
  });

  const calculateAge = (dob: string) => {
    return differenceInYears(new Date(), parseISO(dob));
  };

  const hasMedicalAlerts = (reg: any) => {
    return (reg.allergies && reg.allergies.trim()) || (reg.asthma_inhaler_info && reg.asthma_inhaler_info.trim());
  };

  const handleDelete = async () => {
    if (!deletingRegistration) return;
    const { error } = await supabase
      .from("youth_registrations")
      .delete()
      .eq("id", deletingRegistration.id);
    if (error) {
      toast.error("Failed to delete registration");
    } else {
      toast.success("Registration deleted");
      queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
    }
    setDeletingRegistration(null);
  };

  const programs = [...new Set(registrations?.map((r) => r.child_boxing_program) || [])];
  const districts = [...new Set(registrations?.map((r) => r.child_school_district) || [])];

  return (
    <div className="bg-black text-white">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-white">Youth Registrations</h2>
        <p className="text-xs text-white/50">{filteredRegistrations?.length || 0} registrations</p>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="w-full md:w-[220px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Filter by program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={districtFilter} onValueChange={setDistrictFilter}>
                <SelectTrigger className="w-full md:w-[200px] bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Filter by district" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-white/50">Loading...</div>
            ) : filteredRegistrations?.length === 0 ? (
              <div className="p-8 text-center text-white/50">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No registrations found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="text-white/70 w-12">Photo</TableHead>
                      <TableHead className="text-white/70">Date</TableHead>
                      <TableHead className="text-white/70">Child</TableHead>
                      <TableHead className="text-white/70">Age</TableHead>
                      <TableHead className="text-white/70">Parent</TableHead>
                      <TableHead className="text-white/70">Program</TableHead>
                      <TableHead className="text-white/70">District</TableHead>
                      <TableHead className="text-white/70">Alerts</TableHead>
                      <TableHead className="text-right text-white/70">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegistrations?.map((reg) => (
                      <TableRow key={reg.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="whitespace-nowrap text-white">
                          {format(parseISO(reg.submission_date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="font-medium text-white">
                          {reg.child_first_name} {reg.child_last_name}
                        </TableCell>
                        <TableCell className="text-white">{calculateAge(reg.child_date_of_birth)}</TableCell>
                        <TableCell className="text-white">
                          {reg.parent_first_name} {reg.parent_last_name}
                        </TableCell>
                        <TableCell>
                          {reg.child_boxing_program?.includes("Senior") ? (
                            <Badge variant="secondary" className="text-xs whitespace-nowrap bg-[#bf0f3e]/10 border-[#bf0f3e]/30" style={{ color: '#bf0f3e' }}>
                              Senior Boxer
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs whitespace-nowrap bg-blue-500/10 text-blue-500 border-blue-500/30">
                              Junior Boxer
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-white/70">{reg.child_school_district}</TableCell>
                        <TableCell>
                          {hasMedicalAlerts(reg) && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" /> Medical
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedRegistration(reg)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 w-8 p-0"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingRegistration({ ...reg })}
                              className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-8 w-8 p-0"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingRegistration(reg)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Detail Dialog */}
      <Dialog open={!!selectedRegistration} onOpenChange={() => setSelectedRegistration(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="flex flex-row items-center gap-4">
            {selectedRegistration?.child_headshot_url && (
              <HeadshotThumbnail headshotPath={selectedRegistration.child_headshot_url} size="lg" />
            )}
            <DialogTitle>
              {selectedRegistration?.child_first_name} {selectedRegistration?.child_last_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {selectedRegistration && (
              <RegistrationDetail registration={selectedRegistration} />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingRegistration} onOpenChange={() => setEditingRegistration(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Edit Registration</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {editingRegistration && (
              <EditRegistrationForm
                registration={editingRegistration}
                onSave={async (updated) => {
                  const { id, created_at: _ca, updated_at: _ua, submission_date: _sd, ...rest } = updated;
                  const { error } = await supabase
                    .from("youth_registrations")
                    .update(rest)
                    .eq("id", id);
                  if (error) {
                    toast.error("Failed to save changes");
                  } else {
                    toast.success("Registration updated");
                    queryClient.invalidateQueries({ queryKey: ["youth-registrations"] });
                    setEditingRegistration(null);
                  }
                }}
                onCancel={() => setEditingRegistration(null)}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRegistration} onOpenChange={() => setDeletingRegistration(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Registration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete the registration for{" "}
              <strong>{deletingRegistration?.child_first_name} {deletingRegistration?.child_last_name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ── Edit Form ── */
const EditRegistrationForm = ({
  registration,
  onSave,
  onCancel,
}: {
  registration: any;
  onSave: (updated: any) => void;
  onCancel: () => void;
}) => {
  const [form, setForm] = useState(registration);
  const set = (key: string, value: any) => setForm((f: any) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-5">
      <Section title="Child Information">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" value={form.child_first_name} onChange={(v) => set("child_first_name", v)} />
          <Field label="Last Name" value={form.child_last_name} onChange={(v) => set("child_last_name", v)} />
        </div>
        <Field label="Date of Birth" value={form.child_date_of_birth} onChange={(v) => set("child_date_of_birth", v)} type="date" />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Sex" value={form.child_sex} onChange={(v) => set("child_sex", v)} options={["Male", "Female"]} />
          <SelectField
            label="Program"
            value={form.child_boxing_program}
            onChange={(v) => set("child_boxing_program", v)}
            options={["Junior Boxing (Ages 7-10)", "Senior Boxing (Ages 11-19)", "Grit & Grace (Ages 11-19)"]}
          />
        </div>
        <Field label="Phone" value={form.child_phone || ""} onChange={(v) => set("child_phone", v)} />
        <Field label="Primary Address" value={form.child_primary_address} onChange={(v) => set("child_primary_address", v)} />
      </Section>

      <Section title="Parent/Guardian">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name" value={form.parent_first_name} onChange={(v) => set("parent_first_name", v)} />
          <Field label="Last Name" value={form.parent_last_name} onChange={(v) => set("parent_last_name", v)} />
        </div>
        <Field label="Phone" value={form.parent_phone} onChange={(v) => set("parent_phone", v)} />
        <Field label="Email" value={form.parent_email} onChange={(v) => set("parent_email", v)} />
      </Section>

      <Section title="School & Demographics">
        <SelectField
          label="School District"
          value={form.child_school_district}
          onChange={(v) => set("child_school_district", v)}
          options={["Cape May City", "Lower Cape May Regional", "Middle Township", "Ocean City", "Upper Township", "Wildwood", "Wildwood Crest", "North Wildwood", "West Cape May", "Dennis Township", "Woodbine", "Other"]}
        />
        <Field label="Grade Level" value={form.child_grade_level?.toString() || ""} onChange={(v) => set("child_grade_level", v ? parseInt(v) : null)} type="number" />
        <SelectField
          label="Race/Ethnicity"
          value={form.child_race_ethnicity}
          onChange={(v) => set("child_race_ethnicity", v)}
          options={["American Indian or Alaska Native", "Asian", "Black or African American", "Hispanic or Latino", "Native Hawaiian or Other Pacific Islander", "White", "Two or More Races"]}
        />
      </Section>

      <Section title="Medical">
        <Field label="Allergies" value={form.allergies || ""} onChange={(v) => set("allergies", v)} textarea />
        <Field label="Asthma/Inhaler Info" value={form.asthma_inhaler_info || ""} onChange={(v) => set("asthma_inhaler_info", v)} textarea />
        <Field label="Important Notes" value={form.important_child_notes || ""} onChange={(v) => set("important_child_notes", v)} textarea />
      </Section>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)}>Save Changes</Button>
      </div>
    </div>
  );
};

/* ── Reusable form fields ── */
const Field = ({
  label, value, onChange, type = "text", textarea = false,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; textarea?: boolean;
}) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {textarea ? (
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="text-sm" rows={2} />
    ) : (
      <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="text-sm" />
    )}
  </div>
);

const SelectField = ({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

/* ── View Detail ── */
const RegistrationDetail = ({ registration: reg }: { registration: any }) => {
  const age = differenceInYears(new Date(), parseISO(reg.child_date_of_birth));
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState(true);

  useEffect(() => {
    const generateSignedUrls = async () => {
      const urlFields = [
        { key: 'medical_consent_signature_url', value: reg.medical_consent_signature_url },
        { key: 'liability_waiver_signature_url', value: reg.liability_waiver_signature_url },
        { key: 'transportation_excursions_signature_url', value: reg.transportation_excursions_signature_url },
        { key: 'media_consent_signature_url', value: reg.media_consent_signature_url },
        { key: 'spiritual_development_policy_signature_url', value: reg.spiritual_development_policy_signature_url },
        { key: 'counseling_services_signature_url', value: reg.counseling_services_signature_url },
        { key: 'child_headshot_url', value: reg.child_headshot_url },
      ].filter(f => f.value);

      const urls: Record<string, string> = {};
      
      for (const field of urlFields) {
        const filePath = field.value.includes('registration-signatures/') 
          ? field.value.split('registration-signatures/').pop() 
          : field.value;
        
        const { data } = await supabase.storage
          .from('registration-signatures')
          .createSignedUrl(filePath, 3600);
        
        if (data?.signedUrl) {
          urls[field.key] = data.signedUrl;
        }
      }
      
      setSignedUrls(urls);
      setLoadingUrls(false);
    };

    generateSignedUrls();
  }, [reg]);

  return (
    <div className="space-y-6">
      {(reg.allergies || reg.asthma_inhaler_info) && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5" /> Medical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {reg.allergies && <div><strong>Allergies:</strong> {reg.allergies}</div>}
            {reg.asthma_inhaler_info && <div><strong>Asthma/Inhaler:</strong> {reg.asthma_inhaler_info}</div>}
          </CardContent>
        </Card>
      )}

      <Section title="Child Information">
        <InfoRow label="Name" value={`${reg.child_first_name} ${reg.child_last_name}`} />
        <InfoRow label="Age" value={`${age} years old`} />
        <InfoRow label="Date of Birth" value={format(parseISO(reg.child_date_of_birth), "MMMM d, yyyy")} />
        <InfoRow label="Sex" value={reg.child_sex} />
        <InfoRow label="Race/Ethnicity" value={reg.child_race_ethnicity} />
      </Section>

      <Section title="Parent/Guardian">
        <InfoRow label="Name" value={`${reg.parent_first_name} ${reg.parent_last_name}`} />
        <InfoRow label="Phone" value={reg.parent_phone} />
        <InfoRow label="Email" value={reg.parent_email} />
        {reg.child_phone && <InfoRow label="Child's Phone" value={reg.child_phone} />}
      </Section>

      <Section title="Address & School">
        <InfoRow label="Address" value={reg.child_primary_address} />
        <InfoRow label="School District" value={reg.child_school_district} />
        {reg.child_grade_level && <InfoRow label="Grade Level" value={reg.child_grade_level} />}
      </Section>

      <Section title="Program & Household">
        <InfoRow label="Boxing Program" value={reg.child_boxing_program} />
        <InfoRow label="Adults in Household" value={reg.adults_in_household} />
        <InfoRow label="Siblings in Household" value={reg.siblings_in_household} />
      </Section>

      <Section title="Funding Information">
        <InfoRow label="Household Income" value={reg.household_income_range} />
        {reg.free_or_reduced_lunch && <InfoRow label="Free/Reduced Lunch" value={reg.free_or_reduced_lunch} />}
      </Section>

      {reg.important_child_notes && (
        <Section title="Coach Notes">
          <p className="text-sm">{reg.important_child_notes}</p>
        </Section>
      )}

      <Section title="Waivers & Signatures">
        {loadingUrls ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading signatures...
          </div>
        ) : (
          <>
            <SignatureRow label="Medical Consent" name={reg.medical_consent_name} url={signedUrls.medical_consent_signature_url} />
            <SignatureRow label="Liability Waiver" name={reg.liability_waiver_name} url={signedUrls.liability_waiver_signature_url} />
            <SignatureRow label="Transportation/Excursions" name={reg.transportation_excursions_waiver_name} url={signedUrls.transportation_excursions_signature_url} />
            <SignatureRow label="Media Consent" name={reg.media_consent_name} url={signedUrls.media_consent_signature_url} />
            <SignatureRow label="Spiritual Development" name={reg.spiritual_development_policy_name} url={signedUrls.spiritual_development_policy_signature_url} />
            {reg.counseling_services_name && (
              <SignatureRow label="Counseling Services" name={reg.counseling_services_name} url={signedUrls.counseling_services_signature_url} />
            )}
          </>
        )}
      </Section>

      {reg.child_headshot_url && (
        <Section title="Child Photo">
          {loadingUrls ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading photo...
            </div>
          ) : signedUrls.child_headshot_url ? (
            <a href={signedUrls.child_headshot_url} target="_blank" rel="noopener noreferrer">
              <img 
                src={signedUrls.child_headshot_url} 
                alt="Child headshot" 
                className="w-24 h-24 object-cover rounded-lg border border-border hover:opacity-80 transition-opacity"
              />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load photo</p>
          )}
        </Section>
      )}

      <Section title="Submission">
        <InfoRow label="Submitted On" value={format(parseISO(reg.submission_date), "MMMM d, yyyy")} />
        <InfoRow label="Registration ID" value={reg.id} />
        {reg.final_signature_name && <InfoRow label="Final Signature Name" value={reg.final_signature_name} />}
      </Section>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">{title}</h3>
    <div className="space-y-1">{children}</div>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between text-sm py-1 border-b border-border/50">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value}</span>
  </div>
);

const SignatureRow = ({ label, name, url }: { label: string; name: string; url?: string }) => (
  <div className="flex items-center justify-between text-sm py-2 border-b border-border/50">
    <div>
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-2 font-medium">({name})</span>
    </div>
    {url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline flex items-center gap-1"
      >
        View <ExternalLink className="w-3 h-3" />
      </a>
    ) : (
      <span className="text-muted-foreground text-xs">Unavailable</span>
    )}
  </div>
);

export default AdminRegistrations;
