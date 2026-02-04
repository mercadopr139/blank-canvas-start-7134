import { useState, useEffect } from "react";
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
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type ServiceLog = Tables<"service_logs">;

interface ServiceType {
  id: string;
  name: string;
  rate_type: string;
  rate_amount: number;
  description: string | null;
}

interface ServiceLogEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceLog: ServiceLog | null;
  onSuccess: () => void;
}

const rateTypeLabels: Record<string, string> = {
  per_hour: "/hr",
  per_day: "/day",
  per_session: "/session",
  flat_fee: "flat",
};

export default function ServiceLogEditDialog({
  open,
  onOpenChange,
  serviceLog,
  onSuccess,
}: ServiceLogEditDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    service_type_id: "",
    service_type: "Fee for Service",
    quantity: "1",
    notes: "",
  });

  // Fetch service types
  useEffect(() => {
    const fetchServiceTypes = async () => {
      const { data, error } = await supabase
        .from("service_types")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (!error && data) {
        setServiceTypes(data);
      }
    };
    if (open) {
      fetchServiceTypes();
    }
  }, [open]);

  useEffect(() => {
    if (serviceLog) {
      setFormData({
        service_type_id: (serviceLog as any).service_type_id || "",
        service_type: serviceLog.service_type || "Fee for Service",
        quantity: serviceLog.quantity?.toString() || "1",
        notes: serviceLog.notes || "",
      });
    }
  }, [serviceLog, open]);

  const handleServiceTypeChange = (serviceTypeId: string) => {
    const selectedService = serviceTypes.find(st => st.id === serviceTypeId);
    if (selectedService) {
      setFormData({
        ...formData,
        service_type_id: serviceTypeId,
        service_type: selectedService.name,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceLog) return;
    
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("service_logs")
        .update({
          service_type: formData.service_type,
          service_type_id: formData.service_type_id || null,
          quantity: parseInt(formData.quantity) || 1,
          notes: formData.notes || null,
        })
        .eq("id", serviceLog.id);

      if (error) throw error;
      
      toast({ title: "Service log updated" });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error updating service log",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!serviceLog) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Service Log</DialogTitle>
          <DialogDescription>
            {format(new Date(serviceLog.service_date), "MMMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service_type">Service Type</Label>
            <Select
              value={formData.service_type_id}
              onValueChange={handleServiceTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                {serviceTypes.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    {st.name} — {formatCurrency(st.rate_amount)}{rateTypeLabels[st.rate_type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!formData.service_type_id && (
              <Input
                id="service_type_manual"
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                placeholder="Or enter custom service type"
                className="mt-2"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity (hours/sessions)</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              step="0.5"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
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
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
