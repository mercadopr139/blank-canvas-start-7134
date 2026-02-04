import { useState, useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const clientSchema = z.object({
  client_name: z.string().min(1, "Client name is required").max(255),
  contact_name: z.string().max(255).optional(),
  billing_email: z.string().email("Invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  billing_address: z.string().max(500).optional(),
  rate_type: z.enum(["per_day", "per_session", "per_hour", "flat_monthly"]).optional().nullable(),
  rate_amount: z.number().min(0).optional().nullable(),
  hourly_rate: z.number().min(0).optional().nullable(),
  default_billing_method: z.enum(["hourly", "flat_rate"]).optional().nullable(),
  default_flat_rate: z.number().min(0).optional().nullable(),
  service_description_default: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

type Client = Tables<"clients">;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSuccess: () => void;
}

const rateTypeLabels: Record<string, string> = {
  per_day: "Per Day",
  hourly_rate: "Hourly Rate",
  other: "Other",
};

export default function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: ClientFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    client_name: "",
    contact_name: "",
    billing_email: "",
    phone: "",
    billing_address: "",
    rate_type: "" as string,
    custom_rate_type: "",
    rate_amount: "",
    hourly_rate: "",
    default_billing_method: "hourly" as string,
    default_flat_rate: "",
    service_description_default: "",
    notes: "",
  });

  useEffect(() => {
    if (client) {
      // Check if rate_type is a custom value (not in predefined options)
      const isCustomRateType = client.rate_type && !["per_day", "hourly_rate", "other"].includes(client.rate_type);
      setFormData({
        client_name: client.client_name || "",
        contact_name: client.contact_name || "",
        billing_email: client.billing_email || "",
        phone: client.phone || "",
        billing_address: client.billing_address || "",
        rate_type: isCustomRateType ? "other" : (client.rate_type || ""),
        custom_rate_type: isCustomRateType ? (client.rate_type || "") : "",
        rate_amount: client.rate_amount?.toString() || "",
        hourly_rate: (client as any).hourly_rate?.toString() || "",
        default_billing_method: (client as any).default_billing_method || "hourly",
        default_flat_rate: (client as any).default_flat_rate?.toString() || "",
        service_description_default: client.service_description_default || "",
        notes: client.notes || "",
      });
    } else {
      setFormData({
        client_name: "",
        contact_name: "",
        billing_email: "",
        phone: "",
        billing_address: "",
        rate_type: "",
        custom_rate_type: "",
        rate_amount: "",
        hourly_rate: "",
        default_billing_method: "hourly",
        default_flat_rate: "",
        service_description_default: "",
        notes: "",
      });
    }
  }, [client, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const dataToValidate = {
      client_name: formData.client_name,
      contact_name: formData.contact_name || undefined,
      billing_email: formData.billing_email || undefined,
      phone: formData.phone || undefined,
      billing_address: formData.billing_address || undefined,
      rate_type: formData.rate_type || null,
      rate_amount: formData.rate_amount ? parseFloat(formData.rate_amount) : null,
      hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      default_billing_method: formData.default_billing_method || null,
      default_flat_rate: formData.default_flat_rate ? parseFloat(formData.default_flat_rate) : null,
      service_description_default: formData.service_description_default || undefined,
      notes: formData.notes || undefined,
    };

    const validation = clientSchema.safeParse(dataToValidate);
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Determine final rate type value (use custom if "other" is selected)
    const finalRateType = formData.rate_type === "other" 
      ? (formData.custom_rate_type || null)
      : (formData.rate_type || null);

    const clientData = {
      client_name: formData.client_name,
      contact_name: formData.contact_name || null,
      billing_email: formData.billing_email || null,
      phone: formData.phone || null,
      billing_address: formData.billing_address || null,
      rate_type: finalRateType as any,
      rate_amount: formData.rate_amount ? parseFloat(formData.rate_amount) : null,
      hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
      default_billing_method: formData.default_billing_method || null,
      default_flat_rate: formData.default_flat_rate ? parseFloat(formData.default_flat_rate) : null,
      service_description_default: formData.service_description_default || null,
      notes: formData.notes || null,
    };

    try {
      if (client) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", client.id);

        if (error) throw error;
        toast({ title: "Client updated successfully" });
      } else {
        const { error } = await supabase.from("clients").insert([clientData]);
        if (error) throw error;
        toast({ title: "Client created successfully" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? "Edit Client" : "Add Client"}</DialogTitle>
          <DialogDescription>
            {client ? "Update the client details below." : "Fill in the client details below."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">Client Name *</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_email">Billing Email</Label>
              <Input
                id="billing_email"
                type="email"
                value={formData.billing_email}
                onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing_address">Billing Address</Label>
            <Textarea
              id="billing_address"
              value={formData.billing_address}
              onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rate_type">Rate Type</Label>
              <Select
                value={formData.rate_type}
                onValueChange={(value) => setFormData({ ...formData, rate_type: value, custom_rate_type: value === "other" ? formData.custom_rate_type : "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rate type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(rateTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.rate_type === "other" && (
              <div className="space-y-2">
                <Label htmlFor="custom_rate_type">Custom Rate Type</Label>
                <Input
                  id="custom_rate_type"
                  value={formData.custom_rate_type}
                  onChange={(e) => setFormData({ ...formData, custom_rate_type: e.target.value })}
                  placeholder="e.g. Facility Rental, Event Fee"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rate_amount">Rate Amount ($)</Label>
              <Input
                id="rate_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.rate_amount}
                onChange={(e) => setFormData({ ...formData, rate_amount: e.target.value })}
              />
            </div>
          </div>

          {/* New Billing Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                placeholder="e.g., 100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_billing_method">Default Billing Method</Label>
              <Select
                value={formData.default_billing_method}
                onValueChange={(value) => setFormData({ ...formData, default_billing_method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="flat_rate">Flat Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="default_flat_rate">Default Flat Rate ($)</Label>
              <Input
                id="default_flat_rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.default_flat_rate}
                onChange={(e) => setFormData({ ...formData, default_flat_rate: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service_description_default">Default Service Description</Label>
            <Textarea
              id="service_description_default"
              value={formData.service_description_default}
              onChange={(e) => setFormData({ ...formData, service_description_default: e.target.value })}
              placeholder='e.g., "Fee-for-service youth development programming"'
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : client ? "Update Client" : "Add Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
