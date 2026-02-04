import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

type Client = Tables<"clients">;
type ServiceLog = Tables<"service_logs">;

interface ServiceEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  date: Date;
  existingLog?: ServiceLog | null;
  onSuccess: () => void;
}

const HOUR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

// Helper to determine billing method from client rate_type
function getBillingMethodFromRateType(rateType: string | null): "per_day" | "hourly" | "flat_rate" {
  if (!rateType) return "per_day";
  const normalized = rateType.toLowerCase();
  if (normalized === "per_day") return "per_day";
  if (normalized === "per_hour" || normalized === "hourly_rate") return "hourly";
  // Custom rate types are treated as flat rate
  return "flat_rate";
}

// Helper to get display label for rate type
function getRateTypeLabel(rateType: string | null): string {
  if (!rateType) return "Per Day";
  const normalized = rateType.toLowerCase();
  if (normalized === "per_day") return "Per Day";
  if (normalized === "per_hour" || normalized === "hourly_rate") return "Hourly";
  // Return the custom label as-is
  return rateType;
}

export default function ServiceEntryModal({
  open,
  onOpenChange,
  client,
  date,
  existingLog,
  onSuccess,
}: ServiceEntryModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Form state
  const [billingMethod, setBillingMethod] = useState<"per_day" | "hourly" | "flat_rate">("per_day");
  const [hours, setHours] = useState<number>(1);

  // Get rate from client
  const clientRateAmount = client.rate_amount || 0;
  const clientRateType = client.rate_type;
  const rateTypeLabel = getRateTypeLabel(clientRateType);

  // Reset form when modal opens or log changes
  useEffect(() => {
    if (open) {
      if (existingLog) {
        // Load from existing log
        const savedMethod = existingLog.billing_method || "per_day";
        if (savedMethod === "hourly") {
          setBillingMethod("hourly");
        } else if (savedMethod === "per_day") {
          setBillingMethod("per_day");
        } else {
          setBillingMethod("flat_rate");
        }
        setHours(existingLog.hours || 1);
      } else {
        // Default from client's rate_type
        const defaultMethod = getBillingMethodFromRateType(clientRateType);
        setBillingMethod(defaultMethod);
        setHours(1);
      }
    }
  }, [open, existingLog, clientRateType]);

  // Calculate line total based on billing method
  const lineTotal = billingMethod === "hourly" 
    ? hours * clientRateAmount 
    : clientRateAmount;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleSave = async () => {
    setIsLoading(true);
    const dateStr = format(date, "yyyy-MM-dd");

    const entryData = {
      client_id: client.id,
      service_date: dateStr,
      billing_method: billingMethod,
      hours: billingMethod === "hourly" ? hours : null,
      flat_amount: clientRateAmount, // Store the rate used for historical consistency
      line_total: lineTotal,
    };

    try {
      if (existingLog) {
        // Update existing
        const { error } = await supabase
          .from("service_logs")
          .update(entryData)
          .eq("id", existingLog.id);

        if (error) throw error;
        toast({ title: "Service entry updated" });
      } else {
        // Create new
        const { error } = await supabase
          .from("service_logs")
          .insert([entryData]);

        if (error) throw error;
        toast({ title: "Service entry added" });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error saving service entry",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingLog) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("service_logs")
        .delete()
        .eq("id", existingLog.id);

      if (error) throw error;
      toast({ title: "Service entry removed" });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error removing service entry",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Service Entry</DialogTitle>
          <DialogDescription>
            {format(date, "EEEE, MMMM d, yyyy")} — {client.client_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Rate Type Info (read-only) */}
          <div className="space-y-2">
            <Label>Rate Type</Label>
            <div className="p-3 bg-muted rounded-md text-sm font-medium">
              {rateTypeLabel}
            </div>
          </div>

          {billingMethod === "hourly" && (
            <>
              {/* Hours Dropdown - only for hourly billing */}
              <div className="space-y-2">
                <Label htmlFor="hours">Hours</Label>
                <Select
                  value={hours.toString()}
                  onValueChange={(value) => setHours(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select hours" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h.toString()}>
                        {h} {h === 1 ? "hour" : "hours"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Hourly Rate (read-only) */}
              <div className="space-y-2">
                <Label>Hourly Rate</Label>
                <div className="p-3 bg-muted rounded-md text-sm font-medium">
                  {formatCurrency(clientRateAmount)} / hour
                </div>
              </div>
            </>
          )}

          {billingMethod === "per_day" && (
            /* Per Day Rate (read-only) */
            <div className="space-y-2">
              <Label>Per Day Rate</Label>
              <div className="p-3 bg-muted rounded-md text-sm font-medium">
                {formatCurrency(clientRateAmount)} / day
              </div>
            </div>
          )}

          {billingMethod === "flat_rate" && (
            /* Custom/Flat Rate (read-only) */
            <div className="space-y-2">
              <Label>{rateTypeLabel} Rate</Label>
              <div className="p-3 bg-muted rounded-md text-sm font-medium">
                {formatCurrency(clientRateAmount)}
              </div>
            </div>
          )}

          {/* Line Total */}
          <div className="p-4 bg-primary/10 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium">Line Total:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(lineTotal)}
              </span>
            </div>
            {billingMethod === "hourly" && (
              <p className="text-xs text-muted-foreground mt-1">
                {hours} {hours === 1 ? "hour" : "hours"} × {formatCurrency(clientRateAmount)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {existingLog && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
              className="sm:mr-auto"
            >
              Remove Entry
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : existingLog ? "Update Entry" : "Add Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
