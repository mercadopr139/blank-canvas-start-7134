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
          <DialogTitle className="text-center text-xl font-semibold">
            {showChat ? "Chat with NLA" : "Contact No Limits Academy"}
          </DialogTitle>
        </DialogHeader>

        {!showChat ? (
          <div className="flex flex-col gap-4 py-4">
            <Button
              variant="outline"
              size="lg"
              className="w-full justify-start gap-3 h-14"
              asChild
              aria-label="Send an email to No Limits Academy"
            >
              <a href="mailto:info@nolimitsboxingacademy.org?subject=No%20Limits%20Academy%20Inquiry">
                <Mail className="h-5 w-5" />
                <span className="flex flex-col items-start">
                  <span className="font-semibold">Email NLA</span>
                  <span className="text-xs text-muted-foreground">info@nolimitsboxingacademy.org</span>
                </span>
              </a>
            </Button>

            <Button
              variant="default"
              size="lg"
              className="w-full justify-start gap-3 h-14 bg-primary hover:bg-primary/90"
              onClick={handleChatClick}
              aria-label="Start a chat with No Limits Academy"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="flex flex-col items-start">
                <span className="font-semibold">Chat with NLA</span>
                <span className="text-xs text-primary-foreground/80">Get quick answers</span>
              </span>
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
