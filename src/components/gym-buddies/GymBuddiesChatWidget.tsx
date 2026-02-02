import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Mail, ClipboardList, Shield, Flame, Anchor, Users, Star } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GymBuddiesChatWidgetProps {
  onClose: () => void;
}

type ChatStep = "role-select" | "options" | "schedule" | "contact" | "signup";

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
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setStep("options");
  };

  const handleBack = () => {
    if (step === "options") {
      setSelectedRole(null);
      setStep("role-select");
    } else if (step === "schedule" || step === "contact" || step === "signup") {
      setStep("options");
    }
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
                  onClick={() => handleRoleSelect(role.id)}
                  aria-label={`Select ${role.label}`}
                >
                  <role.icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-bold">{role.label}</span>
                </Button>
              ))}
            </div>
          </div>
        );

      case "options":
        return (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-foreground">
                Awesome — thank you for stepping up. Gym Buddies is relationship-based mentorship. It starts in the gym, but it often grows into advocacy and support outside the gym too.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="h-auto py-3 px-4 flex items-center gap-3 justify-start hover:bg-accent font-bold"
                onClick={() => setStep("schedule")}
              >
                <Calendar className="h-5 w-5 shrink-0" />
                <span className="text-sm font-bold">Schedule</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-3 px-4 flex items-center gap-3 justify-start hover:bg-accent font-bold"
                onClick={() => setStep("contact")}
              >
                <Mail className="h-5 w-5 shrink-0" />
                <span className="text-sm font-bold">Contact Coach Chrissy</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-3 px-4 flex items-center gap-3 justify-start hover:bg-accent font-bold"
                onClick={() => setStep("signup")}
              >
                <ClipboardList className="h-5 w-5 shrink-0" />
                <span className="text-sm font-bold">Sign Up</span>
              </Button>
            </div>
          </div>
        );

      case "schedule":
        return (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <p className="font-bold text-foreground">Schedule</p>
            <p className="text-sm text-muted-foreground">
              Gym Buddies meets Monday, Wednesday, and Thursday from 5:00–6:30 PM.
            </p>
          </div>
        );

      case "contact":
        return (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <p className="font-bold text-foreground">Contact Coach Chrissy</p>
            <p className="text-sm text-muted-foreground">
              You can contact Coach Chrissy directly at:
            </p>
            <a
              href={`mailto:${CHRISSY_EMAIL}?subject=${encodeURIComponent("Gym Buddies Inquiry")}`}
              className="inline-block text-primary underline font-bold text-sm break-all"
            >
              {CHRISSY_EMAIL}
            </a>
          </div>
        );

      case "signup":
        return (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <p className="font-bold text-foreground">Sign Up</p>
            <p className="text-sm text-muted-foreground">
              Ready to become a Gym Buddy? Click below to get started.
            </p>
            <a
              href="#"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-foreground text-background font-extrabold rounded-lg text-center hover:bg-foreground/90 transition-colors w-full"
            >
              <ClipboardList className="h-4 w-4" />
              Sign Up (Waiver Coming Soon)
            </a>
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

      {/* Secondary Sign Up button always visible at bottom */}
      <div className="pt-4 mt-auto border-t">
        <a
          href="#"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-foreground/20 bg-background text-foreground font-bold rounded-lg text-center hover:bg-muted transition-colors w-full text-sm"
        >
          <ClipboardList className="h-4 w-4" />
          Sign Up (Waiver Coming Soon)
        </a>
      </div>
    </div>
  );
};

export default GymBuddiesChatWidget;
