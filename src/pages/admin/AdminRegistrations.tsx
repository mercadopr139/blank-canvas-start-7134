import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Search, Eye, AlertTriangle, ExternalLink, Users, Loader2 } from "lucide-react";
import { format, parseISO, differenceInYears } from "date-fns";

const AdminRegistrations = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [districtFilter, setDistrictFilter] = useState<string>("all");
  const [selectedRegistration, setSelectedRegistration] = useState<any | null>(null);

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

  const programs = [...new Set(registrations?.map((r) => r.child_boxing_program) || [])];
  const districts = [...new Set(registrations?.map((r) => r.child_school_district) || [])];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-black border-b border-white/10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">Youth Registrations</h1>
            <p className="text-sm text-white/50">
              {filteredRegistrations?.length || 0} registrations
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
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
                          <Badge variant="secondary" className="text-xs whitespace-nowrap bg-[#bf0f3e]/10 text-[#bf0f3e] border-[#bf0f3e]/30">
                            {reg.child_boxing_program?.split(" ")[1] || reg.child_boxing_program}
                          </Badge>
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRegistration(reg)}
                            className="border-white/10 text-white hover:bg-white/10 hover:text-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRegistration} onOpenChange={() => setSelectedRegistration(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
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
    </div>
  );
};

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
