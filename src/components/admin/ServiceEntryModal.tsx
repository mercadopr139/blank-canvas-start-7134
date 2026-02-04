import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
  const [billingMethod, setBillingMethod] = useState<"hourly" | "flat_rate">("hourly");
  const [hours, setHours] = useState<number>(1);
  const [flatAmount, setFlatAmount] = useState<string>("");

  // Reset form when modal opens or log changes
  useEffect(() => {
    if (open) {
      if (existingLog) {
        setBillingMethod((existingLog.billing_method as "hourly" | "flat_rate") || "hourly");
        setHours(existingLog.hours || 1);
        setFlatAmount(existingLog.flat_amount?.toString() || client.default_flat_rate?.toString() || "");
      } else {
        // Default from client settings
        const defaultMethod = (client.default_billing_method as "hourly" | "flat_rate") || "hourly";
        setBillingMethod(defaultMethod);
        setHours(1);
        setFlatAmount(client.default_flat_rate?.toString() || "");
      }
    }
  }, [open, existingLog, client]);

  const hourlyRate = client.hourly_rate || 0;
  const lineTotal = billingMethod === "hourly" 
    ? hours * hourlyRate 
    : parseFloat(flatAmount) || 0;

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
      flat_amount: billingMethod === "flat_rate" ? parseFloat(flatAmount) || 0 : null,
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
          {/* Billing Method */}
          <div className="space-y-2">
            <Label htmlFor="billing_method">Billing Method</Label>
            <Select
              value={billingMethod}
              onValueChange={(value) => setBillingMethod(value as "hourly" | "flat_rate")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select billing method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="flat_rate">Flat Rate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {billingMethod === "hourly" ? (
            <>
              {/* Hours Dropdown */}
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
                  {formatCurrency(hourlyRate)} / hour
                </div>
              </div>
            </>
          ) : (
            /* Flat Amount Input */
            <div className="space-y-2">
              <Label htmlFor="flat_amount">Flat Amount ($)</Label>
              <Input
                id="flat_amount"
                type="number"
                step="0.01"
                min="0"
                value={flatAmount}
                onChange={(e) => setFlatAmount(e.target.value)}
                placeholder="Enter flat rate amount"
              />
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
                {hours} {hours === 1 ? "hour" : "hours"} × {formatCurrency(hourlyRate)}
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
