 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Checkbox } from "@/components/ui/checkbox";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import SignatureCanvas from "./SignatureCanvas";
 
 interface WaiverSectionProps {
   title: string;
   text: string;
   nameValue: string;
   onNameChange: (value: string) => void;
   onSignatureChange: (blob: Blob | null) => void;
   acknowledged: boolean;
   onAcknowledgeChange: (value: boolean) => void;
 }
 
 const WaiverSection = ({
   title,
   text,
   nameValue,
   onNameChange,
   onSignatureChange,
   acknowledged,
   onAcknowledgeChange,
 }: WaiverSectionProps) => {
   return (
     <div className="border border-border rounded-lg p-4 space-y-4">
       <h3 className="font-semibold text-lg">{title}</h3>
       
       {/* Waiver Text */}
       <ScrollArea className="h-[200px] border border-input rounded-md p-3 bg-muted/30">
         <div className="text-sm whitespace-pre-wrap">{text}</div>
       </ScrollArea>
 
       {/* Acknowledgement Checkbox */}
       <div className="flex items-start space-x-2">
         <Checkbox
           id={`ack-${title.replace(/\s/g, "-")}`}
           checked={acknowledged}
           onCheckedChange={(checked) => onAcknowledgeChange(checked === true)}
         />
         <Label 
           htmlFor={`ack-${title.replace(/\s/g, "-")}`} 
           className="text-sm leading-relaxed cursor-pointer"
         >
           I have read and agree to the terms of this {title.toLowerCase()}. *
         </Label>
       </div>
 
       {/* Name Input */}
       <div>
         <Label>Type Your Full Name *</Label>
         <Input
           value={nameValue}
           onChange={(e) => onNameChange(e.target.value)}
           placeholder="Type your full legal name"
           required
         />
       </div>
 
       {/* Signature Canvas */}
       <div>
         <Label>Signature *</Label>
         <SignatureCanvas onSignatureChange={onSignatureChange} />
       </div>
     </div>
   );
 };
 
 export default WaiverSection;