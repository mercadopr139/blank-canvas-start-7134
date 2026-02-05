import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const SESSION_KEY = "rookie_orientation_unlocked";

const RookieOrientation = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unlocked = sessionStorage.getItem(SESSION_KEY);
    if (unlocked === "true") {
      setIsUnlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (code.toUpperCase() === "NLA") {
      sessionStorage.setItem(SESSION_KEY, "true");
      setIsUnlocked(true);
    } else {
      setError("Incorrect code. Please try again.");
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().slice(0, 3);
    setCode(value);
  };

  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm">
            <div className="bg-card border border-border rounded-lg p-6 md:p-8 shadow-lg">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Lock className="w-7 h-7 text-muted-foreground" />
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">
                  Rookie Orientation
                </h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter the 3-letter access code to continue
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    type="text"
                    value={code}
                    onChange={handleCodeChange}
                    placeholder="Enter code"
                    className="text-center text-lg tracking-widest uppercase font-mono"
                    maxLength={3}
                    autoFocus
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  style={{ backgroundColor: "#bf0f3e" }}
                  disabled={code.length !== 3}
                >
                  Unlock
                </Button>
              </form>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-12 md:py-16 px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Rookie Orientation Day
        </h1>
        <p className="text-muted-foreground text-lg">
          Content goes here.
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default RookieOrientation;
