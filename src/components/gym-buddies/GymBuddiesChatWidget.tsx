import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Flame, Anchor, Users, Star, MapPin, ClipboardList } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GymBuddiesChatWidgetProps {
  onClose: () => void;
}

type ChatStep = "role-select" | "info";

const CHRISSY_EMAIL = "chrissycasiello@nolimitsboxingacademy.org";

const roleOptions = [
  { id: "law-enforcement", label: "Law Enforcement", icon: Shield },
  { id: "firefighter", label: "Firefighter", icon: Flame },
  { id: "coast-guard", label: "U.S. Coast Guard", icon: Anchor },
  { id: "military", label: "Military (all branches welcome)", icon: Star },
  { id: "other", label: "Other First Responder", icon: Users },
];

const GymBuddiesChatWidget = ({ onClose }: GymBuddiesChatWidgetProps) => {
  const [step, setStep] = useState<ChatStep>("role-select");

  const handleRoleSelect = () => {
    setStep("info");
  };

  const handleBack = () => {
    setStep("role-select");
  };

  const renderContent = () => {
    switch (step) {
      case "role-select":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Thanks for your interest in Gym Buddies. Which best describes you?
            </p>
            <div className="flex flex-col gap-2">
              {roleOptions.map((role) => (
                <Button
                  key={role.id}
                  variant="outline"
                  className="h-auto py-3 px-4 flex items-center gap-3 justify-start hover:bg-accent font-bold"
                  onClick={() => handleRoleSelect()}
                  aria-label={`Select ${role.label}`}
                >
                  <role.icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-bold">{role.label}</span>
                </Button>
              ))}
            </div>
          </div>
        );

      case "info":
        return (
          <div className="space-y-5">
            {/* Thank you message */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-foreground">
                Thank you for your service and interest in Gym Buddies.
              </p>
            </div>

            {/* Schedule */}
            <div className="space-y-2">
              <p className="font-bold text-foreground text-sm">Gym Buddies Schedule</p>
              <p className="text-sm text-muted-foreground">
                Monday, Wednesday, and Thursday from 5:00–6:30 PM.
              </p>
              <p className="text-sm text-muted-foreground">
                1086 Rt. 47 South, Rio Grande, NJ 08242
              </p>
              <div className="flex justify-center pt-2">
                <a
                  href="https://www.google.com/maps/search/?api=1&query=1086+Rt+47+South+Rio+Grande+NJ+08242"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-md font-bold text-sm hover:bg-foreground/90 transition-colors"
                >
                  <MapPin className="h-4 w-4" />
                  Open in Google Maps
                </a>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <p className="font-bold text-foreground text-sm">Questions?</p>
              <p className="text-sm text-muted-foreground">
                Contact Coach Chrissy at:
              </p>
              <a
                href={`mailto:${CHRISSY_EMAIL}?subject=${encodeURIComponent("Gym Buddies Inquiry")}`}
                className="inline-block text-primary underline font-bold text-sm break-all"
              >
                {CHRISSY_EMAIL}
              </a>
            </div>

            <div className="pt-2">
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-extrabold rounded-lg text-center hover:bg-primary/90 transition-colors w-full"
              >
                <ClipboardList className="h-4 w-4" />
                Sign Up (Waiver Coming Soon)
              </a>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-[400px]">
      {step !== "role-select" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="self-start mb-3 -ml-2"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      )}

      <ScrollArea className="flex-1 pr-4">
        {renderContent()}
      </ScrollArea>
    </div>
  );
};

export default GymBuddiesChatWidget;
