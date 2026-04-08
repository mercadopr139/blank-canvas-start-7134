import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Bus, Lock } from "lucide-react";
import nlaLogo from "@/assets/nla-logo-white.png";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function TransportAdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/transport/admin/drivers", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email, password);
    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message.includes("Invalid login")
          ? "Invalid email or password."
          : "An error occurred during sign in.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A1628]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A1628] px-4">
      <img src={nlaLogo} alt="No Limits Academy" className="h-16 w-auto mb-4" />
      <div className="flex items-center gap-2 mb-6">
        <Bus className="w-5 h-5 text-[#DC2626]" />
        <span className="text-white/60 text-sm font-semibold uppercase tracking-widest">
          Transportation Admin
        </span>
      </div>

      <Card className="w-full max-w-sm bg-white/5 border-white/10">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 w-10 h-10 bg-[#DC2626]/20 rounded-full flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#DC2626]" />
          </div>
          <CardTitle className="text-xl text-white">Admin Login</CardTitle>
          <CardDescription className="text-white/40">
            Authorized personnel only
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70 text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                placeholder="admin@nolimitsboxingacademy.org"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
