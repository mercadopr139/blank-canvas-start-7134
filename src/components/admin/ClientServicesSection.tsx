import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface ClientService {
  id?: string;
  service_name: string;
  rate_type: string;
  rate_amount: string;
  isNew?: boolean;
  toDelete?: boolean;
}

interface ClientServicesSectionProps {
  services: ClientService[];
  onChange: (services: ClientService[]) => void;
}

const rateTypeLabels: Record<string, string> = {
  per_hour: "Per Hour",
  per_day: "Per Day",
  per_session: "Per Session",
  flat_fee: "Flat Fee",
};

export default function ClientServicesSection({
  services,
  onChange,
}: ClientServicesSectionProps) {
  const handleAddService = () => {
    onChange([
      ...services,
      {
        service_name: "",
        rate_type: "per_hour",
        rate_amount: "",
        isNew: true,
      },
    ]);
  };

  const handleRemoveService = (index: number) => {
    const service = services[index];
    if (service.id) {
      // Mark existing service for deletion
      const updated = [...services];
      updated[index] = { ...service, toDelete: true };
      onChange(updated);
    } else {
      // Remove new unsaved service
      onChange(services.filter((_, i) => i !== index));
    }
  };

  const handleUpdateService = (
    index: number,
    field: keyof ClientService,
    value: string
  ) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const visibleServices = services.filter((s) => !s.toDelete);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Client Services</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddService}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Service
        </Button>
      </div>

      {visibleServices.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg bg-muted/30">
          No services added yet. Click "Add Service" to create one.
        </p>
      ) : (
        <div className="space-y-3">
          {services.map((service, index) => {
            if (service.toDelete) return null;
            return (
              <div
                key={service.id || `new-${index}`}
                className="flex flex-col sm:flex-row gap-3 p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground">
                    Service Name
                  </Label>
                  <Input
                    value={service.service_name}
                    onChange={(e) =>
                      handleUpdateService(index, "service_name", e.target.value)
                    }
                    placeholder="e.g., Youth Basketball Practice"
                    className="mt-1"
                  />
                </div>
                <div className="w-full sm:w-36">
                  <Label className="text-xs text-muted-foreground">
                    Rate Type
                  </Label>
                  <Select
                    value={service.rate_type}
                    onValueChange={(value) =>
                      handleUpdateService(index, "rate_type", value)
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
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
                <div className="w-full sm:w-28">
                  <Label className="text-xs text-muted-foreground">
                    Rate ($)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={service.rate_amount}
                    onChange={(e) =>
                      handleUpdateService(index, "rate_amount", e.target.value)
                    }
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveService(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
