import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CoachPasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  registrationId: string;
}

export default function CoachPasswordModal({
  open,
  onClose,
  onSuccess,
  registrationId,
}: CoachPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setChecking(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "validate-coach-password",
        { body: { password, registration_id: registrationId } }
      );

      if (fnError || !data?.valid) {
        setError(data?.error || "Incorrect password");
        setChecking(false);
        return;
      }

      setPassword("");
      setError(null);
      onSuccess();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm bg-zinc-900 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Lock className="w-5 h-5" />
            Admin Access Required
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-white/60">
          Enter password to change profile picture
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password..."
            className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
            autoFocus
          />
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="flex-1 text-white/60 hover:text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!password || checking}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {checking ? "Verifying..." : "Continue"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
