import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, MessageCircle } from "lucide-react";
import ChatWidget from "./ChatWidget";

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const INFO_EMAIL = "info@nolimitsboxingacademy.org";
const CHRISSY_EMAIL = "chrissycasiello@nolimitsboxingacademy.org";

const mailtoHref = `mailto:${INFO_EMAIL}?cc=${encodeURIComponent(CHRISSY_EMAIL)}&subject=${encodeURIComponent("No Limits Academy Inquiry")}&body=${encodeURIComponent("Hi No Limits Academy,\n\nI have a question about:\n\nName:\nYouth Age (if applicable):\nPhone (optional):\nQuestion:\n\nThanks!")}`;

const ContactModal = ({ open, onOpenChange }: ContactModalProps) => {
  const [showChat, setShowChat] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setShowChat(false);
    }
  };

  const handleChatClick = () => {
    setShowChat(true);
  };

  const handleBackToOptions = () => {
    setShowChat(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            {showChat ? "Chat with NLA" : "Contact Options"}
          </DialogTitle>
        </DialogHeader>

        {!showChat ? (
          <div className="flex flex-col gap-4 py-4">
            <Button
              variant="default"
              size="lg"
              className="w-full justify-start gap-3 h-14 bg-primary hover:bg-primary/90 font-bold"
              onClick={handleChatClick}
              aria-label="Start a chat with No Limits Academy"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="flex flex-col items-start">
                <span className="font-bold">Chat with NLA</span>
                <span className="text-xs text-primary-foreground/80 font-normal">Get quick answers</span>
              </span>
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 h-14 font-bold"
              asChild
              aria-label="Send an email to No Limits Academy"
            >
              <a href={mailtoHref}>
                <Mail className="h-5 w-5" />
                <span className="flex flex-col items-start">
                  <span className="font-bold">Email NLA</span>
                  <span className="text-xs text-muted-foreground font-normal">{INFO_EMAIL}</span>
                </span>
              </a>
            </Button>
          </div>
        ) : (
          <ChatWidget onBack={handleBackToOptions} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContactModal;
