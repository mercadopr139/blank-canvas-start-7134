import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import OrientationStep from "@/components/orientation/OrientationStep";
import { Step1DoneBadge } from "@/components/orientation/Step1DoneBadge";

const SESSION_KEY = "rookie_orientation_unlocked";

// Storage keys for localStorage persistence
const STORAGE_KEY_PREFIX = "rookie_orientation_video_";
const HOUSE_RULES_TEST_URL = "#"; // External link placeholder

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
    <div className="min-h-screen flex flex-col bg-black">
      <Header />
      <main className="flex-1">
        {/* Hero Title */}
        <div className="py-12 md:py-16 text-center">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight">
            ROOKIE ORIENTATION DAY
          </h1>
        </div>

        {/* Steps Container */}
        <div className="max-w-[1100px] mx-auto px-4 pb-16 md:pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* STEP 1: Registration */}
            <OrientationStep
              stepNumber={1}
              title="REGISTRATION"
            >
              <Step1DoneBadge />
            </OrientationStep>

            {/* STEP 2: Coach Mercado Intro */}
            <OrientationStep
              stepNumber={2}
              title="COACH MERCADO INTRO"
              videoStorageKey={`${STORAGE_KEY_PREFIX}step_2`}
            />

            {/* STEP 3: Mission Statement */}
            <OrientationStep
              stepNumber={3}
              title="MISSION STATEMENT"
              videoStorageKey={`${STORAGE_KEY_PREFIX}step_3`}
            />

            {/* STEP 4: House Rules Intro & Test */}
            <OrientationStep
              stepNumber={4}
              title="HOUSE RULES INTRO & TEST"
              videoStorageKey={`${STORAGE_KEY_PREFIX}step_4`}
              secondaryButtonLabel="READ HOUSE RULES"
              secondaryButtonLink="#step-5"
            />

            {/* STEP 5: House Rules Test */}
            <OrientationStep
              stepNumber={5}
              title="HOUSE RULES TEST"
              buttonLabel="OPEN TEST"
              buttonLink={HOUSE_RULES_TEST_URL}
              isExternal={true}
            />

            {/* STEP 6: The Big 3! */}
            <OrientationStep
              stepNumber={6}
              title="THE BIG 3!"
              videoStorageKey={`${STORAGE_KEY_PREFIX}step_6`}
            />

            {/* STEP 7: Wrapping Your Hands */}
            <OrientationStep
              stepNumber={7}
              title="WRAPPING YOUR HANDS"
              videoStorageKey={`${STORAGE_KEY_PREFIX}step_7`}
            />

            {/* STEP 8: Punch Code */}
            <OrientationStep
              stepNumber={8}
              title="PUNCH CODE"
              videoStorageKey={`${STORAGE_KEY_PREFIX}step_8`}
            />

            {/* STEP 9: Congrats */}
            <div className="md:col-span-2">
              <OrientationStep
                stepNumber={9}
                title="CONGRATS! YOU'RE READY TO SIGN-IN!"
                videoStorageKey={`${STORAGE_KEY_PREFIX}step_9`}
              />
            </div>
          </div>
        </div>
      </main>
      <Footer className="bg-neutral-950 border-neutral-800" />
    </div>
  );
};

export default RookieOrientation;
