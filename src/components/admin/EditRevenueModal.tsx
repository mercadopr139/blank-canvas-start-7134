import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const REVENUE_TYPES = ["Donation", "Fundraising", "Fee for Service", "Re-Grant"] as const;
const METHODS = ["Cash", "Check", "Venmo", "PayPal", "Square"] as const;

const FUNDRAISING_DESCRIPTIONS = [
  "Presale tickets", "Sponsor", "Event day tickets", "Raffle", "Merchandise", "Concessions", "Other",
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  donationId: string | null;
  onSaved: () => void;
}

const EditRevenueModal = ({ open, onOpenChange, donationId, onSaved }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [revenueType, setRevenueType] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [depositDate, setDepositDate] = useState<Date | undefined>(undefined);
  const [referenceId, setReferenceId] = useState("");
  const [notes, setNotes] = useState("");

  // Donation fields
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [receiptStatus, setReceiptStatus] = useState("Pending");

  // Fee for Service fields
  const [vendorName, setVendorName] = useState("");
  const [programName, setProgramName] = useState("");

  // Re-Grant fields
  const [partnerName, setPartnerName] = useState("");
  const [grantDate, setGrantDate] = useState<Date | undefined>(undefined);

  // Fundraising fields
  const [eventName, setEventName] = useState("");
  const [fundraisingDescSelect, setFundraisingDescSelect] = useState("");
  const [fundraisingDescOther, setFundraisingDescOther] = useState("");

  // Shared fields
  const [recognitionPeriod, setRecognitionPeriod] = useState("");

  // Load donation data when opened
  useEffect(() => {
    if (!open || !donationId) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .eq("id", donationId)
        .single();

      if (error || !data) {
        toast({ title: "Failed to load record", variant: "destructive" });
        onOpenChange(false);
        setLoading(false);
        return;
      }

      setRevenueType(data.revenue_type);
      setAmount(Number(data.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setMethod(data.method);
      setDepositDate(data.deposit_date ? new Date(data.deposit_date + "T00:00:00") : undefined);
      setReferenceId(data.reference_id || "");
      setNotes(data.notes || "");
      setRecognitionPeriod(data.recognition_period || "");

      // Type-specific
      setDonorName(data.donor_name || "");
      setDonorEmail(data.source_email || data.donor_email || "");
      setReceiptStatus(data.receipt_status || "Pending");
      setVendorName(data.vendor_name || "");
      setProgramName(data.program_name || "");
      setPartnerName(data.partner_name || "");
      setGrantDate(data.grant_date ? new Date(data.grant_date + "T00:00:00") : undefined);
      setEventName(data.event_name || "");

      const desc = data.revenue_description || "";
      const knownDescs = ["Presale tickets", "Sponsor", "Event day tickets", "Raffle", "Merchandise", "Concessions"];
      if (knownDescs.includes(desc)) {
        setFundraisingDescSelect(desc);
        setFundraisingDescOther("");
      } else if (desc) {
        setFundraisingDescSelect("Other");
        setFundraisingDescOther(desc);
      } else {
        setFundraisingDescSelect("");
        setFundraisingDescOther("");
      }

      setLoading(false);
    };

    load();
  }, [open, donationId]);

  const isValid = () => {
    if (!revenueType || !amount || !depositDate) return false;
    const parsed = parseFloat(amount.replace(/,/g, ""));
    if (isNaN(parsed) || parsed <= 0) return false;

    switch (revenueType) {
      case "Donation": return !!donorName.trim() && !!method;
      case "Fee for Service": return !!vendorName.trim() && !!method;
      case "Re-Grant": return !!partnerName.trim();
      case "Fundraising":
        if (fundraisingDescSelect === "Other" && !fundraisingDescOther.trim()) return false;
        return !!eventName.trim() && !!method;
      default: return false;
    }
  };

  const getSourceName = () => {
    switch (revenueType) {
      case "Donation": return donorName.trim();
      case "Fee for Service": return vendorName.trim();
      case "Re-Grant": return partnerName.trim();
      case "Fundraising": return eventName.trim();
      default: return "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid() || !donationId) return;

    setSaving(true);
    const sourceName = getSourceName();

    const record: Record<string, any> = {
      revenue_type: revenueType,
      amount: parseFloat(amount.replace(/,/g, "")),
      method: (revenueType === "Re-Grant" ? "Other" : method) as any,
      deposit_date: format(depositDate!, "yyyy-MM-dd"),
      reference_id: referenceId.trim() || null,
      notes: notes.trim() || null,
      source_name: sourceName || null,
      donor_name: sourceName || "N/A",
      date_received: format(depositDate!, "yyyy-MM-dd"),
      recognition_period: recognitionPeriod || null,
    };

    if (revenueType === "Donation") {
      record.source_email = donorEmail.trim() || null;
      record.receipt_status = receiptStatus as any;
    } else {
      record.receipt_status = "Not Needed" as any;
    }

    if (revenueType === "Fee for Service") {
      record.vendor_name = vendorName.trim() || null;
      record.program_name = programName.trim() || null;
    }

    if (revenueType === "Re-Grant") {
      record.partner_name = partnerName.trim() || null;
      record.grant_date = grantDate ? format(grantDate, "yyyy-MM-dd") : null;
    }

    if (revenueType === "Fundraising") {
      record.event_name = eventName.trim() || null;
      const desc = fundraisingDescSelect === "Other" ? fundraisingDescOther.trim() : fundraisingDescSelect;
      record.revenue_description = desc || null;
    }

    const { error } = await supabase.from("donations").update(record as any).eq("id", donationId);
    setSaving(false);

    if (error) {
      toast({ title: "Failed to update.", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Revenue updated." });
    onOpenChange(false);
    onSaved();
  };

  const DateField = ({
    label, value, onChange, required = false,
  }: {
    label: string; value: Date | undefined; onChange: (d: Date | undefined) => void; required?: boolean;
  }) => (
    <div className="space-y-1">
      <Label className="text-white/70">{label}{required ? " *" : ""}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-white/5 border-white/20 text-white",
              !value && "text-white/40"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-black border-white/20" align="start">
          <Calendar
            mode="single" selected={value} onSelect={onChange} initialFocus
            className={cn("p-3 pointer-events-auto text-white")}
            classNames={{
              caption_label: "text-sm font-medium text-white",
              nav_button: cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border-white/20 text-white"),
              head_cell: "text-white/50 rounded-md w-9 font-normal text-[0.8rem]",
              day: cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 p-0 font-normal aria-selected:opacity-100 text-white hover:bg-white/10 hover:text-white"),
              day_selected: "bg-white text-black hover:bg-white hover:text-black focus:bg-white focus:text-black",
              day_today: "bg-white/20 text-white",
              day_outside: "day-outside text-white/30 opacity-50 aria-selected:bg-white/10 aria-selected:text-white/50 aria-selected:opacity-30",
              day_disabled: "text-white/30 opacity-50",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black border-white/20 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Revenue</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-white/50 text-center py-8">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Revenue Type */}
            <div className="space-y-1">
              <Label className="text-white/70">Revenue Type *</Label>
              <Select value={revenueType} onValueChange={setRevenueType}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 z-50">
                  {REVENUE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-black">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {revenueType && (
              <>
                {/* ===== DONATION ===== */}
                {revenueType === "Donation" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-white/70">Donor Name *</Label>
                      <Input value={donorName} onChange={(e) => setDonorName(e.target.value)} className="bg-white/5 border-white/20 text-white" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-white/70">Donor Email</Label>
                      <Input type="email" value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} className="bg-white/5 border-white/20 text-white" />
                    </div>
                  </>
                )}

                {/* ===== FEE FOR SERVICE ===== */}
                {revenueType === "Fee for Service" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-white/70">Vendor Name *</Label>
                      <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="bg-white/5 border-white/20 text-white" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-white/70">Program Name</Label>
                      <Input value={programName} onChange={(e) => setProgramName(e.target.value)} className="bg-white/5 border-white/20 text-white" />
                    </div>
                  </>
                )}

                {/* ===== RE-GRANT ===== */}
                {revenueType === "Re-Grant" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-white/70">Partner Name *</Label>
                      <Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} className="bg-white/5 border-white/20 text-white" />
                    </div>
                    <DateField label="Grant Date" value={grantDate} onChange={setGrantDate} />
                  </>
                )}

                {/* ===== FUNDRAISING ===== */}
                {revenueType === "Fundraising" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-white/70">Event Name *</Label>
                      <Input value={eventName} onChange={(e) => setEventName(e.target.value)} className="bg-white/5 border-white/20 text-white" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-white/70">Revenue Description</Label>
                      <Select value={fundraisingDescSelect} onValueChange={(v) => { setFundraisingDescSelect(v); if (v !== "Other") setFundraisingDescOther(""); }}>
                        <SelectTrigger className="bg-white/5 border-white/20 text-white">
                          <SelectValue placeholder="Select description" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200 z-50">
                          {FUNDRAISING_DESCRIPTIONS.map((d) => (
                            <SelectItem key={d} value={d} className="text-black">{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {fundraisingDescSelect === "Other" && (
                      <div className="space-y-1">
                        <Label className="text-white/70">Other Description *</Label>
                        <Input value={fundraisingDescOther} onChange={(e) => setFundraisingDescOther(e.target.value)} placeholder="Describe the revenue…" className="bg-white/5 border-white/20 text-white placeholder:text-white/30" />
                      </div>
                    )}
                  </>
                )}

                {/* ===== SHARED FIELDS ===== */}
                <div className="space-y-1">
                  <Label className="text-white/70">Amount *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">$</span>
                    <Input
                      type="text" inputMode="decimal" value={amount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, "");
                        const parts = raw.split(".");
                        const cleaned = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
                        setAmount(cleaned);
                      }}
                      onBlur={() => {
                        const num = parseFloat(amount);
                        if (!isNaN(num) && num > 0) {
                          setAmount(num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        }
                      }}
                      onFocus={() => setAmount(amount.replace(/,/g, ""))}
                      placeholder="0.00"
                      className="bg-white/5 border-white/20 text-white pl-7 placeholder:text-white/30"
                    />
                  </div>
                </div>

                {revenueType !== "Re-Grant" && (
                  <div className="space-y-1">
                    <Label className="text-white/70">Payment Method *</Label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger className="bg-white/5 border-white/20 text-white">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200 z-50">
                        {METHODS.map((m) => (
                          <SelectItem key={m} value={m} className="text-black">{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <DateField label="Date of Deposit" value={depositDate} onChange={setDepositDate} required />

                <div className="space-y-1">
                  <Label className="text-white/70">Recognition Period</Label>
                  <Select value={recognitionPeriod} onValueChange={setRecognitionPeriod}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 z-50">
                      {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m) => (
                        <SelectItem key={m} value={m} className="text-black">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-white/70">Reference ID</Label>
                  <Input value={referenceId} onChange={(e) => setReferenceId(e.target.value)} placeholder="Check # or transaction ID" className="bg-white/5 border-white/20 text-white placeholder:text-white/30" />
                </div>

                <div className="space-y-1">
                  <Label className="text-white/70">Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="bg-white/5 border-white/20 text-white" />
                </div>

                <Button type="submit" disabled={saving || !isValid()} className="w-full bg-white text-black hover:bg-white/90">
                  {saving ? "Saving…" : "Update Revenue Entry"}
                </Button>
              </>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditRevenueModal;
