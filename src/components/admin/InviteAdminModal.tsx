import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus } from "lucide-react";

const InviteAdminModal = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-admin", {
        body: { email: email.trim(), password },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Admin Invited", description: `Account created for ${email.trim()}` });
        setEmail("");
        setPassword("");
        setOpen(false);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to invite admin", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-white/50 hover:text-white hover:bg-white/10">
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Admin
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-black border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Invite New Admin</DialogTitle>
          <DialogDescription className="text-white/50">
            Create a backend account for a new team member. They will have full admin access.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email" className="text-white/70">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="newadmin@nolimitsboxingacademy.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-password" className="text-white/70">Temporary Password</Label>
            <Input
              id="invite-password"
              type="text"
              placeholder="Set a temporary password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
            />
            <p className="text-xs text-white/30">Share this securely. They can change it after first login.</p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InviteAdminModal;
