import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import SignatureCanvas from "./SignatureCanvas";
import { RichText } from "@/components/ui/rich-text";

// One waiver: the text, an acknowledgement box, and a signature pad. The
// signer's typed name is asked once for the whole form, under all the
// waivers, rather than under each one. An optional waiver (required=false)
// shows no asterisks; the form decides whether an unsigned one is a problem.
interface WaiverSectionProps {
  title: string;
  text: string;
  onSignatureChange: (blob: Blob | null) => void;
  acknowledged: boolean;
  onAcknowledgeChange: (value: boolean) => void;
  required?: boolean;
}

const WaiverSection = ({
  title,
  text,
  onSignatureChange,
  acknowledged,
  onAcknowledgeChange,
  required = true,
}: WaiverSectionProps) => {
  const star = required ? <span className="text-destructive">*</span> : null;
  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <h3 className="font-semibold text-lg">{title}{!required && <span className="ml-2 text-sm font-normal text-muted-foreground">(optional)</span>}</h3>

      {/* Waiver Text */}
      <ScrollArea className="h-[200px] border border-input rounded-md p-3 bg-muted/30">
        <RichText html={text} className="text-sm leading-relaxed" />
      </ScrollArea>

      {/* Acknowledgement Checkbox */}
      <div className="flex items-start space-x-2">
        <Checkbox
          id={`ack-${title.replace(/s/g, "-")}`}
          checked={acknowledged}
          onCheckedChange={(checked) => onAcknowledgeChange(checked === true)}
        />
        <Label
          htmlFor={`ack-${title.replace(/s/g, "-")}`}
          className="text-sm leading-relaxed cursor-pointer"
        >
          I have read and agree to the terms of this {title.toLowerCase()}. {star}
        </Label>
      </div>

      {/* Signature Canvas */}
      <div>
        <Label>Signature {star}</Label>
        <SignatureCanvas onSignatureChange={onSignatureChange} />
      </div>
    </div>
  );
};

export default WaiverSection;
