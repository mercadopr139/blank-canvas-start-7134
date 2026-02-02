import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, DollarSign, ClipboardList, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatWidgetProps {
  onBack: () => void;
}

type QuickOption = "schedule" | "registration" | "location" | "cost" | "person" | null;

const INFO_EMAIL = "info@nolimitsboxingacademy.org";
const CHRISSY_EMAIL = "chrissycasiello@nolimitsboxingacademy.org";

const SENIOR_BOXING_SCHEDULE = `Monday – Friday, 2:30 PM – 8:30 PM
Ages 11–19`;

const JUNIOR_BOXING_SCHEDULE = `Tuesdays, 5:15 PM – 7:15 PM
Ages 7–10`;

const chatResponses: Record<Exclude<QuickOption, null>, { title: string; content: React.ReactNode }> = {
  schedule: {
    title: "Schedule",
    content: (
      <div className="space-y-4">
        <div>
          <p className="font-bold text-foreground">Senior Boxing:</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{SENIOR_BOXING_SCHEDULE}</p>
          <p className="text-xs italic text-muted-foreground mt-1">*Senior Boxers must arrive by 5pm</p>
        </div>
        <div>
          <p className="font-bold text-foreground">Junior Boxing:</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{JUNIOR_BOXING_SCHEDULE}</p>
        </div>
        <p className="text-sm text-muted-foreground italic">
          Note: No Limits Academy is a free, year-round youth development program serving youth ages 7–19 in Cape May County.
        </p>
      </div>
    ),
  },
  registration: {
    title: "Registration",
    content: (
      <div className="space-y-3">
        <p className="font-bold text-foreground">Registration / Sign Up</p>
        <p className="text-sm text-muted-foreground">Please choose a program option below:</p>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
          <li>Junior Boxing</li>
          <li>Senior Boxing</li>
          <li>Grit & Grace Program</li>
        </ul>
        <div className="flex justify-center mt-4">
          <a 
            href="https://wkf.ms/45C6tce"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-5 py-3 bg-foreground text-background font-extrabold rounded-lg text-center hover:bg-foreground/90 transition-colors"
          >
            Sign Up for a Program
          </a>
        </div>
        <p className="text-sm text-muted-foreground mt-2 text-center">
          If you have questions before signing up, email us at{" "}
          <a href={`mailto:${INFO_EMAIL}`} className="text-primary underline">{INFO_EMAIL}</a>.
        </p>
      </div>
    ),
  },
  location: {
    title: "Location",
    content: (
      <div className="space-y-3">
        <p className="font-bold text-foreground">Location</p>
        <p className="text-sm text-muted-foreground">
          1086 Rt. 47 South, Rio Grande, NJ 08242
        </p>
        <p className="text-sm text-muted-foreground italic">
          (Directly behind Mr. Tire)
        </p>
        <div className="flex justify-center mt-2">
          <a
            href="https://www.google.com/maps/search/?api=1&query=1086+Rt+47+South+Rio+Grande+NJ+08242"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            <MapPin className="h-4 w-4" />
            Open in Google Maps
          </a>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Need help finding us? Email:{" "}
          <a href={`mailto:${INFO_EMAIL}`} className="text-primary underline">{INFO_EMAIL}</a>
        </p>
      </div>
    ),
  },
  cost: {
    title: "Cost",
    content: (
      <div className="space-y-3">
        <p className="font-bold text-foreground">Cost</p>
        <p className="text-sm text-muted-foreground">
          No Limits Academy is a <strong>free</strong>, year-round youth development program.<br />
          There is no cost to participate.
        </p>
        <div className="flex justify-center mt-8">
          <a
            href="https://www.paypal.com/ncp/payment/TMMDVUSEQKHJC"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            <DollarSign className="h-4 w-4" />
            Donate to Support NLA
          </a>
        </div>
      </div>
    ),
  },
  person: {
    title: "Talk to a Person",
    content: (
      <div className="space-y-3">
        <p className="font-bold text-foreground">Talk to a Person</p>
        <p className="text-sm text-muted-foreground">
          Email Coach Chrissy, and she will get back to you as soon as possible:
        </p>
        <a 
          href={`mailto:${CHRISSY_EMAIL}?subject=${encodeURIComponent("No Limits Academy Inquiry")}&body=${encodeURIComponent("Hi Coach Chrissy,\n\nI have a question about:\n\nName:\nYouth Age (if applicable):\nPhone (optional):\nQuestion:\n\nThanks!")}`}
          className="inline-block mt-2 text-primary underline font-bold text-sm break-all"
        >
          {CHRISSY_EMAIL}
        </a>
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
              Welcome to No Limits Academy! How can we help you today?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {quickOptions.map((option) => (
                <Button
                  key={option.id}
                  variant="outline"
                  className={`h-auto py-3 px-3 flex flex-col items-center gap-2 hover:bg-accent font-bold ${option.id === "person" ? "col-span-2" : ""}`}
                  onClick={() => handleOptionClick(option.id)}
                  aria-label={`Learn about ${option.label}`}
                >
                  <option.icon className="h-5 w-5" />
                  <span className="text-xs font-bold text-center">{option.label}</span>
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
