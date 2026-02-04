import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClientServiceOption {
  id: string;
  service_name: string;
  rate_type: string;
  rate_amount: number;
}

export interface InvoiceLineItem {
  id: string;
  service_name: string;
  rate_type: string;
  rate_amount: number;
  quantity: number;
  total: number;
}

interface InvoiceLineItemsEditorProps {
  clientId: string;
  lineItems: InvoiceLineItem[];
  onChange: (items: InvoiceLineItem[]) => void;
}

const rateTypeLabels: Record<string, string> = {
  per_hour: "/hr",
  per_day: "/day",
  per_session: "/session",
  flat_fee: "flat",
};

export default function InvoiceLineItemsEditor({
  clientId,
  lineItems,
  onChange,
}: InvoiceLineItemsEditorProps) {
  const [clientServices, setClientServices] = useState<ClientServiceOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      if (!clientId) return;
      setLoading(true);
      const { data } = await supabase
        .from("client_services")
        .select("*")
        .eq("client_id", clientId)
        .order("service_name");
      
      setClientServices(data || []);
      setLoading(false);
    };

    fetchServices();
  }, [clientId]);

  const handleAddLineItem = () => {
    if (clientServices.length === 0) return;
    
    const firstService = clientServices[0];
    const newItem: InvoiceLineItem = {
      id: crypto.randomUUID(),
      service_name: firstService.service_name,
      rate_type: firstService.rate_type,
      rate_amount: firstService.rate_amount,
      quantity: 1,
      total: firstService.rate_amount,
    };
    onChange([...lineItems, newItem]);
  };

  const handleServiceChange = (index: number, serviceId: string) => {
    const service = clientServices.find((s) => s.id === serviceId);
    if (!service) return;

    const updated = [...lineItems];
    updated[index] = {
      ...updated[index],
      service_name: service.service_name,
      rate_type: service.rate_type,
      rate_amount: service.rate_amount,
      total: service.rate_type === "flat_fee" 
        ? service.rate_amount 
        : updated[index].quantity * service.rate_amount,
    };
    onChange(updated);
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const updated = [...lineItems];
    const item = updated[index];
    updated[index] = {
      ...item,
      quantity,
      total: item.rate_type === "flat_fee" ? item.rate_amount : quantity * item.rate_amount,
    };
    onChange(updated);
  };

  const handleRemoveItem = (index: number) => {
    onChange(lineItems.filter((_, i) => i !== index));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading services...</p>;
  }

  if (clientServices.length === 0) {
    return (
      <div className="p-4 text-center border rounded-lg bg-muted/30">
        <p className="text-sm text-muted-foreground">
          No services configured for this client. Edit the client to add services first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Invoice Line Items</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddLineItem}
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Service
        </Button>
      </div>

      {lineItems.length === 0 ? (
        <div className="p-4 text-center border rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Click "Add Service" to add line items to this invoice.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left text-sm font-medium">Service</th>
                <th className="px-3 py-2 text-center text-sm font-medium w-24">Qty</th>
                <th className="px-3 py-2 text-right text-sm font-medium w-28">Rate</th>
                <th className="px-3 py-2 text-right text-sm font-medium w-28">Total</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => {
                const matchingService = clientServices.find(
                  (s) => s.service_name === item.service_name
                );
                return (
                  <tr key={item.id} className="border-t">
                    <td className="px-3 py-2">
                      <Select
                        value={matchingService?.id || ""}
                        onValueChange={(val) => handleServiceChange(index, val)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientServices.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.service_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          handleQuantityChange(index, parseInt(e.target.value) || 1)
                        }
                        className="h-8 text-center"
                        disabled={item.rate_type === "flat_fee"}
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-sm">
                      {formatCurrency(item.rate_amount)}
                      <span className="text-muted-foreground ml-1">
                        {rateTypeLabels[item.rate_type] || ""}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-sm">
                      {formatCurrency(item.total)}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/50">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-medium">
                  Total:
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatCurrency(lineItems.reduce((sum, item) => sum + item.total, 0))}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
