import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, DollarSign, ClipboardList, User, Mail } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatWidgetProps {
  onBack: () => void;
}

type QuickOption = "schedule" | "registration" | "location" | "cost" | "person" | null;

const chatResponses: Record<Exclude<QuickOption, null>, { title: string; content: React.ReactNode }> = {
  schedule: {
    title: "Schedule",
    content: (
      <div className="space-y-3">
        <p className="font-semibold">Program Hours:</p>
        <div className="space-y-2 text-sm">
          <p><strong>Junior Program (Ages 6-12):</strong></p>
          <p>Monday - Friday: 3:00 PM - 6:00 PM</p>
          <p className="mt-2"><strong>Senior Program (Ages 13-18):</strong></p>
          <p>Monday - Friday: 4:00 PM - 7:00 PM</p>
          <p className="mt-2"><strong>Saturday Sessions:</strong></p>
          <p>10:00 AM - 1:00 PM (All ages)</p>
        </div>
      </div>
    ),
  },
  registration: {
    title: "Registration",
    content: (
      <div className="space-y-3">
        <p className="font-semibold">How to Register:</p>
        <div className="space-y-2 text-sm">
          <p>Registration is open year-round! To enroll your child:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Contact us via email or phone</li>
            <li>Complete the registration form</li>
            <li>Attend an orientation session</li>
            <li>Start training!</li>
          </ol>
          <p className="mt-2">Email us at <a href="mailto:info@nolimitsboxingacademy.org" className="text-primary underline">info@nolimitsboxingacademy.org</a> to get started.</p>
        </div>
      </div>
    ),
  },
  location: {
    title: "Location",
    content: (
      <div className="space-y-3">
        <p className="font-semibold">Our Location:</p>
        <div className="space-y-2 text-sm">
          <p><strong>No Limits Academy</strong></p>
          <p>Cape May County, New Jersey</p>
          <p className="mt-2">We serve youth throughout Cape May County with our programs.</p>
          <p className="mt-2">Contact us for specific address and directions.</p>
        </div>
      </div>
    ),
  },
  cost: {
    title: "Cost",
    content: (
      <div className="space-y-3">
        <p className="font-semibold">Program Cost:</p>
        <div className="space-y-2 text-sm">
          <p><strong>All programs are FREE!</strong></p>
          <p className="mt-2">No Limits Academy is committed to providing free access to all youth in our community. We believe every child deserves the opportunity to learn, grow, and succeed regardless of financial circumstances.</p>
          <p className="mt-2">Our programs are funded through generous donations and community support.</p>
        </div>
      </div>
    ),
  },
  person: {
    title: "Talk to a Person",
    content: (
      <div className="space-y-3">
        <p className="font-semibold">Get in Touch:</p>
        <div className="space-y-2 text-sm">
          <p>We'd love to hear from you! The best way to reach us is via email:</p>
          <a 
            href="mailto:info@nolimitsboxingacademy.org?subject=No%20Limits%20Academy%20Inquiry" 
            className="inline-flex items-center gap-2 mt-2 text-primary underline font-medium"
          >
            <Mail className="h-4 w-4" />
            info@nolimitsboxingacademy.org
          </a>
          <p className="mt-3">We typically respond within 24-48 hours.</p>
        </div>
      </div>
    ),
  },
};

const quickOptions = [
  { id: "schedule" as const, label: "Schedule", icon: Calendar },
  { id: "registration" as const, label: "Registration", icon: ClipboardList },
  { id: "location" as const, label: "Location", icon: MapPin },
  { id: "cost" as const, label: "Cost", icon: DollarSign },
  { id: "person" as const, label: "Talk to a person", icon: User },
];

const ChatWidget = ({ onBack }: ChatWidgetProps) => {
  const [selectedOption, setSelectedOption] = useState<QuickOption>(null);

  const handleOptionClick = (option: QuickOption) => {
    setSelectedOption(option);
  };

  const handleBackToQuickOptions = () => {
    setSelectedOption(null);
  };

  return (
    <div className="flex flex-col h-[350px]">
      <Button
        variant="ghost"
        size="sm"
        onClick={selectedOption ? handleBackToQuickOptions : onBack}
        className="self-start mb-3 -ml-2"
        aria-label={selectedOption ? "Back to quick options" : "Back to contact options"}
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        {selectedOption ? "Back" : "Contact Options"}
      </Button>

      <ScrollArea className="flex-1 pr-4">
        {!selectedOption ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              What would you like to know about No Limits Academy?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {quickOptions.map((option) => (
                <Button
                  key={option.id}
                  variant="outline"
                  className="h-auto py-3 px-3 flex flex-col items-center gap-2 hover:bg-accent"
                  onClick={() => handleOptionClick(option.id)}
                  aria-label={`Learn about ${option.label}`}
                >
                  <option.icon className="h-5 w-5" />
                  <span className="text-xs font-medium text-center">{option.label}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-muted/50 rounded-lg p-4">
            {chatResponses[selectedOption].content}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ChatWidget;
