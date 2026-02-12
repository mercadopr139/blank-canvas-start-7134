import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock, Smartphone } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import OrientationStep from "@/components/orientation/OrientationStep";
import OrientationStepGated from "@/components/orientation/OrientationStepGated";
import { Step1DoneBadge } from "@/components/orientation/Step1DoneBadge";
const SESSION_KEY = "rookie_orientation_unlocked";
const HOUSE_RULES_TEST_URL = "/house-rules-test";

// Hardcoded YouTube video IDs - these will work on published site
const VIDEO_IDS = {
  step2: "5uGnTwcK0_s",
  // Coach Mercado Intro
  step3: "_iIjs2i2u9M",
  // Mission Statement
  step4: "16hfqu556yI",
  // House Rules Intro
  step6: "k50NkTgNlKs",
  // The Big 3
  step7: "3iJ_mTmpcFQ",
  // Wrapping Your Hands
  step8: "O2cYqka9-js",
  // Punch Code
  step9: "TDWUNwJK3Rg" // Congrats - Sign In
};
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
    return <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm">
            <div className="border border-border rounded-lg p-6 md:p-8 shadow-lg text-primary-foreground bg-primary">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center mb-4">
                  <Lock className="w-7 h-7 text-black" />
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-primary-foreground">
                  Rookie Orientation
                </h1>
                <p className="text-sm mt-2 text-primary-foreground">
                  Enter the 3-letter access code to continue
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input type="text" value={code} onChange={handleCodeChange} placeholder="Enter code" className="text-center text-lg tracking-widest uppercase font-mono text-black" maxLength={3} autoFocus />
                </div>

                {error && <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>}

                <Button type="submit" className="w-full" style={{
                backgroundColor: "#bf0f3e"
              }} disabled={code.length !== 3}>
                  Unlock
                </Button>
              </form>
            </div>
          </div>
        </main>
        <Footer />
      </div>;
  }
  return <div className="min-h-screen flex flex-col bg-black">
      <Header />
      <main className="flex-1">
        {/* Call-Out Section */}
        <div className="py-12 md:py-16 text-center bg-neutral-950 border-b border-neutral-800">
          <div className="max-w-[700px] mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2">CALL-OUT</h2>
            <Smartphone className="w-8 h-8 text-white mx-auto mb-4" />
            <p className="text-lg md:text-xl font-bold text-white mb-2">
              100% Attendance is not Required,
            </p>
            <p className="text-lg md:text-xl font-bold text-white mb-8">
              100% Communication is Required!
            </p>
            <a
              href="https://forms.monday.com/forms/54ec87b1697f78b22490889e70bfe459?r=use1"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                className="text-white font-bold px-8 py-3 text-lg"
                style={{ backgroundColor: "#bf0f3e" }}
              >
                CALL-OUT FORM
              </Button>
            </a>
          </div>
        </div>

        {/* Hero Title */}
        <div className="py-12 md:py-16 text-center border-primary-foreground">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight border-primary-foreground border mx-0 py-[20px]">
            ROOKIE ORIENTATION DAY
          </h1>
        </div>

        {/* Steps Container */}
        <div className="max-w-[1100px] mx-auto px-4 pb-16 md:pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* STEP 1: Registration */}
            <OrientationStep stepNumber={1} title="REGISTRATION">
              <Step1DoneBadge />
            </OrientationStep>

            {/* STEP 2: Coach Mercado Intro */}
            <OrientationStep stepNumber={2} title="COACH MERCADO INTRO" videoId={VIDEO_IDS.step2} />

            {/* STEP 3: Mission Statement */}
            <OrientationStep stepNumber={3} title="MISSION STATEMENT" videoId={VIDEO_IDS.step3} />

            {/* STEP 4: House Rules Intro & Test */}
            <OrientationStep stepNumber={4} title="HOUSE RULES INTRO & TEST" videoId={VIDEO_IDS.step4} secondaryButtonLabel="READ HOUSE RULES" secondaryButtonLink="#step-5" />

            {/* STEP 5: House Rules Test */}
            <OrientationStep stepNumber={5} title="HOUSE RULES TEST" buttonLabel="OPEN TEST" buttonLink={HOUSE_RULES_TEST_URL} isExternal={false} />

            {/* STEP 6: The Big 3! (Gated - requires passing House Rules Test) */}
            <OrientationStepGated stepNumber={6} title="HOUSE RULES IN ACTION!" videoId={VIDEO_IDS.step6} />

            {/* STEP 7: Wrapping Your Hands */}
            <OrientationStepGated stepNumber={7} title="WRAPPING YOUR HANDS" videoId={VIDEO_IDS.step7} />

            {/* STEP 8: Punch Code */}
            <OrientationStepGated stepNumber={8} title="PUNCH CODE" videoId={VIDEO_IDS.step8} />

            {/* STEP 9: Congrats */}
            <div className="md:col-span-2">
              <OrientationStepGated stepNumber={9} title="CONGRATS! YOU'RE READY TO SIGN-IN!" videoId={VIDEO_IDS.step9} />
            </div>
          </div>
        </div>
      </main>
      <Footer className="bg-neutral-950 border-neutral-800" />
    </div>;
};
export default RookieOrientation;