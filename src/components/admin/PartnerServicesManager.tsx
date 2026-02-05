 import { useState, useEffect } from "react";
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
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
 import { useToast } from "@/hooks/use-toast";
 import { supabase } from "@/integrations/supabase/client";
 
 interface ClientService {
   id: string;
   client_id: string;
   service_name: string;
   rate_type: string;
   rate_amount: number;
 }
 
 interface PartnerServicesManagerProps {
   clientId: string;
   onServicesChange?: () => void;
 }
 
 const rateTypeOptions = [
   { value: "per_day", label: "Per Day" },
   { value: "per_hour", label: "Per Hour" },
   { value: "sponsorship", label: "Sponsorship" },
   { value: "other_service", label: "Other Service" },
 ];
 
 export default function PartnerServicesManager({
   clientId,
   onServicesChange,
 }: PartnerServicesManagerProps) {
   const [services, setServices] = useState<ClientService[]>([]);
   const [isLoading, setIsLoading] = useState(false);
   const [editingId, setEditingId] = useState<string | null>(null);
   const [isAdding, setIsAdding] = useState(false);
   const { toast } = useToast();
 
   // New service form state
   const [newService, setNewService] = useState({
     service_name: "",
     rate_type: "per_day",
     rate_amount: "",
   });
 
   // Edit form state
   const [editService, setEditService] = useState({
     service_name: "",
     rate_type: "",
     rate_amount: "",
   });
 
   const fetchServices = async () => {
     setIsLoading(true);
     const { data, error } = await supabase
       .from("client_services")
       .select("*")
       .eq("client_id", clientId)
       .order("service_name");
 
     if (error) {
       toast({ title: "Error fetching services", description: error.message, variant: "destructive" });
     } else {
       setServices(data || []);
     }
     setIsLoading(false);
   };
 
   useEffect(() => {
     if (clientId) {
       fetchServices();
     }
   }, [clientId]);
 
   const handleAddService = async () => {
     if (!newService.service_name.trim()) {
       toast({ title: "Service name is required", variant: "destructive" });
       return;
     }
 
     setIsLoading(true);
     const { error } = await supabase.from("client_services").insert([{
       client_id: clientId,
       service_name: newService.service_name.trim(),
       rate_type: newService.rate_type,
       rate_amount: parseFloat(newService.rate_amount) || 0,
     }]);
 
     if (error) {
       toast({ title: "Error adding service", description: error.message, variant: "destructive" });
     } else {
       toast({ title: "Service added" });
       setNewService({ service_name: "", rate_type: "per_day", rate_amount: "" });
       setIsAdding(false);
       fetchServices();
       onServicesChange?.();
     }
     setIsLoading(false);
   };
 
   const startEdit = (service: ClientService) => {
     setEditingId(service.id);
     setEditService({
       service_name: service.service_name,
       rate_type: service.rate_type,
       rate_amount: service.rate_amount.toString(),
     });
   };
 
   const handleUpdateService = async (id: string) => {
     if (!editService.service_name.trim()) {
       toast({ title: "Service name is required", variant: "destructive" });
       return;
     }
 
     setIsLoading(true);
     const { error } = await supabase
       .from("client_services")
       .update({
         service_name: editService.service_name.trim(),
         rate_type: editService.rate_type,
         rate_amount: parseFloat(editService.rate_amount) || 0,
       })
       .eq("id", id);
 
     if (error) {
       toast({ title: "Error updating service", description: error.message, variant: "destructive" });
     } else {
       toast({ title: "Service updated" });
       setEditingId(null);
       fetchServices();
       onServicesChange?.();
     }
     setIsLoading(false);
   };
 
   const handleDeleteService = async (id: string) => {
     setIsLoading(true);
     const { error } = await supabase
       .from("client_services")
       .delete()
       .eq("id", id);
 
     if (error) {
       toast({ title: "Error deleting service", description: error.message, variant: "destructive" });
     } else {
       toast({ title: "Service removed" });
       fetchServices();
       onServicesChange?.();
     }
     setIsLoading(false);
   };
 
   const formatCurrency = (amount: number) => {
     return new Intl.NumberFormat("en-US", {
       style: "currency",
       currency: "USD",
     }).format(amount);
   };
 
   const getRateLabel = (rateType: string) => {
     const option = rateTypeOptions.find((o) => o.value === rateType);
     return option?.label || rateType;
   };
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <CardTitle className="text-base">Services</CardTitle>
           {!isAdding && (
             <Button
               variant="outline"
               size="sm"
               onClick={() => setIsAdding(true)}
               disabled={isLoading}
             >
               <Plus className="w-4 h-4 mr-1" />
               Add Service
             </Button>
           )}
         </div>
       </CardHeader>
       <CardContent className="space-y-3">
         {/* Existing Services List */}
         {services.length === 0 && !isAdding ? (
           <p className="text-sm text-muted-foreground text-center py-4">
             No services defined. Add a service to get started.
           </p>
         ) : (
           <div className="space-y-2">
             {services.map((service) => (
               <div
                 key={service.id}
                 className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"
               >
                 {editingId === service.id ? (
                   <>
                     <Input
                       value={editService.service_name}
                       onChange={(e) =>
                         setEditService({ ...editService, service_name: e.target.value })
                       }
                       placeholder="Service name"
                       className="flex-1"
                     />
                     <Select
                       value={editService.rate_type}
                       onValueChange={(value) =>
                         setEditService({ ...editService, rate_type: value })
                       }
                     >
                       <SelectTrigger className="w-32">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         {rateTypeOptions.map((opt) => (
                           <SelectItem key={opt.value} value={opt.value}>
                             {opt.label}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                     <Input
                       type="number"
                       value={editService.rate_amount}
                       onChange={(e) =>
                         setEditService({ ...editService, rate_amount: e.target.value })
                       }
                       placeholder="Rate"
                       className="w-24"
                     />
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={() => handleUpdateService(service.id)}
                       disabled={isLoading}
                     >
                       <Check className="w-4 h-4 text-green-600" />
                     </Button>
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={() => setEditingId(null)}
                     >
                       <X className="w-4 h-4" />
                     </Button>
                   </>
                 ) : (
                   <>
                     <div className="flex-1">
                       <p className="font-medium text-sm">{service.service_name}</p>
                       <p className="text-xs text-muted-foreground">
                         {getRateLabel(service.rate_type)} • {formatCurrency(service.rate_amount)}
                       </p>
                     </div>
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={() => startEdit(service)}
                       disabled={isLoading}
                     >
                       <Edit2 className="w-4 h-4" />
                     </Button>
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={() => handleDeleteService(service.id)}
                       disabled={isLoading}
                     >
                       <Trash2 className="w-4 h-4 text-destructive" />
                     </Button>
                   </>
                 )}
               </div>
             ))}
           </div>
         )}
 
         {/* Add New Service Form */}
         {isAdding && (
           <div className="p-3 border rounded-lg space-y-3">
             <div className="space-y-2">
               <Label htmlFor="new_service_name">Service Name</Label>
               <Input
                 id="new_service_name"
                 value={newService.service_name}
                 onChange={(e) =>
                   setNewService({ ...newService, service_name: e.target.value })
                 }
                 placeholder='e.g., "Basketball Game" or "Practice Session"'
               />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <div className="space-y-2">
                 <Label>Rate Type</Label>
                 <Select
                   value={newService.rate_type}
                   onValueChange={(value) =>
                     setNewService({ ...newService, rate_type: value })
                   }
                 >
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {rateTypeOptions.map((opt) => (
                       <SelectItem key={opt.value} value={opt.value}>
                         {opt.label}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label htmlFor="new_rate_amount">Rate Amount ($)</Label>
                 <Input
                   id="new_rate_amount"
                   type="number"
                   step="0.01"
                   value={newService.rate_amount}
                   onChange={(e) =>
                     setNewService({ ...newService, rate_amount: e.target.value })
                   }
                   placeholder="0.00"
                 />
               </div>
             </div>
             <div className="flex gap-2 justify-end">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => {
                   setIsAdding(false);
                   setNewService({ service_name: "", rate_type: "per_day", rate_amount: "" });
                 }}
               >
                 Cancel
               </Button>
               <Button size="sm" onClick={handleAddService} disabled={isLoading}>
                 {isLoading ? "Adding..." : "Add Service"}
               </Button>
             </div>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }