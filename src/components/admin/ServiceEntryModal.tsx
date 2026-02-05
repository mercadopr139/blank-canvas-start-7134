import { useState, useEffect, useMemo } from "react";
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
import { RefreshCw, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Client = Tables<"clients">;
type ServiceLog = Tables<"service_logs">;

interface ClientService {
  id: string;
  client_id: string;
  service_name: string;
  rate_type: string;
  rate_amount: number;
}

interface ServiceEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  date: Date;
  existingLog?: ServiceLog | null;
  existingLogsForDate?: ServiceLog[];
  onEditLog?: (log: ServiceLog) => void;
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
  existingLogsForDate = [],
  onEditLog,
  onSuccess,
}: ServiceEntryModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Form state
  const [billingMethod, setBillingMethod] = useState<"per_day" | "hourly" | "flat_rate">("per_day");
  const [hours, setHours] = useState<number>(1);
  const [clientServices, setClientServices] = useState<ClientService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [isServicesLoading, setIsServicesLoading] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(true);

  const fetchClientServices = async () => {
    setIsServicesLoading(true);
    const { data, error } = await supabase
      .from("client_services")
      .select("*")
      .eq("client_id", client.id)
      .order("service_name");

    if (error) {
      toast({
        title: "Error fetching services",
        description: error.message,
        variant: "destructive",
      });
      setClientServices([]);
    } else {
      setClientServices(data || []);
    }
    setIsServicesLoading(false);
  };

  // Fetch client services on mount
  useEffect(() => {
    if (open) {
      fetchClientServices();
    }
  }, [open, client.id]);

  // Determine the active rate source (selected service or client default)
  const activeService = useMemo(() => {
    if (selectedServiceId && selectedServiceId !== "__default__" && clientServices.length > 0) {
      const service = clientServices.find(s => s.id === selectedServiceId);
      if (service) {
        return {
          name: service.service_name,
          rateType: service.rate_type,
          rateAmount: service.rate_amount,
        };
      }
    }
    // Fall back to client defaults
    return {
      name: client.service_description_default || "Service",
      rateType: client.rate_type || "per_day",
      rateAmount: client.rate_amount || 0,
    };
  }, [selectedServiceId, clientServices, client]);

  const rateTypeLabel = getRateTypeLabel(activeService.rateType);

  // Reset form when modal opens or log changes
  useEffect(() => {
    if (open) {
      if (existingLog) {
        // Editing an existing log
        setIsAddingNew(false);
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
        // Try to match existing log to a service
        if (existingLog.service_type && clientServices.length > 0) {
          const matchingService = clientServices.find(s => s.service_name === existingLog.service_type);
          setSelectedServiceId(matchingService?.id || "__default__");
        } else {
          setSelectedServiceId("__default__");
        }
      } else {
        // Adding new entry - select first service if available
        setIsAddingNew(true);
        const defaultServiceId = clientServices.length > 0 ? clientServices[0].id : "__default__";
        setSelectedServiceId(defaultServiceId);
        const defaultRateType = clientServices.length > 0 
          ? clientServices[0].rate_type 
          : client.rate_type;
        const defaultMethod = getBillingMethodFromRateType(defaultRateType);
        setBillingMethod(defaultMethod);
        setHours(1);
      }
    }
  }, [open, existingLog, client.rate_type, clientServices]);

  // Update billing method when service changes
  useEffect(() => {
    if (selectedServiceId && clientServices.length > 0) {
      const service = clientServices.find(s => s.id === selectedServiceId);
      if (service) {
        const method = getBillingMethodFromRateType(service.rate_type);
        setBillingMethod(method);
      }
    }
  }, [selectedServiceId, clientServices]);

  // Calculate line total based on billing method
  const lineTotal = billingMethod === "hourly" 
    ? hours * activeService.rateAmount 
    : activeService.rateAmount;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Helper to switch to add new mode
  const handleAddNew = () => {
    setIsAddingNew(true);
    if (onEditLog) onEditLog(null as any);
    // Reset form to defaults
    const defaultServiceId = clientServices.length > 0 ? clientServices[0].id : "__default__";
    setSelectedServiceId(defaultServiceId);
    const defaultRateType = clientServices.length > 0 
      ? clientServices[0].rate_type 
      : client.rate_type;
    const defaultMethod = getBillingMethodFromRateType(defaultRateType);
    setBillingMethod(defaultMethod);
    setHours(1);
  };

  // Helper to switch to edit mode
  const handleEditExisting = (log: ServiceLog) => {
    if (onEditLog) onEditLog(log);
    setIsAddingNew(false);
  };

  const handleSave = async () => {
    setIsLoading(true);
    const dateStr = format(date, "yyyy-MM-dd");

    const selectedService = clientServices.find(s => s.id === selectedServiceId);

    const entryData = {
      client_id: client.id,
      service_date: dateStr,
      billing_method: billingMethod,
      hours: billingMethod === "hourly" ? hours : null,
      flat_amount: activeService.rateAmount, // Store the rate used for historical consistency
      line_total: lineTotal,
      service_type: selectedService?.service_name || activeService.name,
      // Note: service_type_id references service_types table, not client_services
      // We store the service name in service_type text field instead
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

  const handleDeleteEntry = async (logId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("service_logs")
        .delete()
        .eq("id", logId);

      if (error) throw error;
      toast({ title: "Service entry removed" });
      onSuccess();
      // If we deleted the one being edited, switch to add mode
      if (existingLog?.id === logId) {
        handleAddNew();
      }
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
          {/* Existing entries for this date */}
          {existingLogsForDate.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Entries on this date ({existingLogsForDate.length})
              </Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {existingLogsForDate.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-center justify-between p-2 rounded-md border text-sm ${
                      existingLog?.id === log.id 
                        ? "border-primary bg-primary/5" 
                        : "border-border bg-muted/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium truncate block">
                        {log.service_type || "Service"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(log.line_total || 0)}
                        {log.billing_method === "hourly" && ` (${log.hours}h)`}
                      </span>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleEditExisting(log)}
                        disabled={existingLog?.id === log.id}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteEntry(log.id)}
                        disabled={isLoading}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Add another button */}
              {!isAddingNew && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleAddNew}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another Service
                </Button>
              )}
            </div>
          )}

          {/* Form section header */}
          {existingLogsForDate.length > 0 && (
            <div className="border-t pt-4">
              <Badge variant={isAddingNew ? "default" : "secondary"} className="mb-3">
                {isAddingNew ? "New Entry" : "Editing Entry"}
              </Badge>
            </div>
          )}

          {/* Service Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Service Type</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={fetchClientServices}
                disabled={isServicesLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isServicesLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

          {clientServices.length > 0 ? (
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">
                    (Use Partner Default)
                  </SelectItem>
                  {clientServices.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.service_name} — {formatCurrency(service.rate_amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
          ) : (
            <div className="p-3 bg-muted rounded-md text-sm">
              Using partner default: <span className="font-medium">{client.service_description_default || "Service"}</span>
            </div>
            )}

          {clientServices.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Rate: {getRateTypeLabel(client.rate_type)} • {formatCurrency(client.rate_amount || 0)}
            </p>
          )}

          {clientServices.length === 1 && clientServices.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Only 1 service is set for this partner—add a second service to get more dropdown options here.
              </p>
            )}
          </div>

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
                  {formatCurrency(activeService.rateAmount)} / hour
                </div>
              </div>
            </>
          )}

          {billingMethod === "per_day" && (
            /* Per Day Rate (read-only) */
            <div className="space-y-2">
              <Label>Per Day Rate</Label>
              <div className="p-3 bg-muted rounded-md text-sm font-medium">
                {formatCurrency(activeService.rateAmount)} / day
              </div>
            </div>
          )}

          {billingMethod === "flat_rate" && (
            /* Custom/Flat Rate (read-only) */
            <div className="space-y-2">
              <Label>{rateTypeLabel} Rate</Label>
              <div className="p-3 bg-muted rounded-md text-sm font-medium">
                {formatCurrency(activeService.rateAmount)}
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
                {hours} {hours === 1 ? "hour" : "hours"} × {formatCurrency(activeService.rateAmount)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {existingLog && !isAddingNew && (
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
            {isLoading ? "Saving..." : (existingLog && !isAddingNew) ? "Update Entry" : "Add Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
