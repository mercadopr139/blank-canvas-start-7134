import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock, Smartphone, KeyRound, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import OrientationStep from "@/components/orientation/OrientationStep";
import OrientationStepGated from "@/components/orientation/OrientationStepGated";
import { Step1DoneBadge } from "@/components/orientation/Step1DoneBadge";
import mascotEagle from "@/assets/mascot-eagle.png";
const SESSION_KEY = "rookie_orientation_unlocked";
const ADMIN_BYPASS_KEY = "orientation_admin_bypass";
const ADMIN_PASSWORD = "COACH";
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

const Step5WithBypass = ({ testUrl }: { testUrl: string }) => {
  const [showBypass, setShowBypass] = useState(false);
  const [bypassCode, setBypassCode] = useState("");
  const [bypassError, setBypassError] = useState("");
  const hasPassed = localStorage.getItem("house_rules_test_passed") === "true";

  const handleBypassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bypassCode.toUpperCase() === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_BYPASS_KEY, "true");
      localStorage.setItem("house_rules_test_passed", "true");
      window.location.reload();
    } else {
      setBypassError("Incorrect password.");
    }
  };

  const handleReset = () => {
    localStorage.removeItem("house_rules_test_passed");
    sessionStorage.removeItem(ADMIN_BYPASS_KEY);
    window.location.reload();
  };

  return (
    <div id="step-5" className="scroll-mt-24">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 md:p-6 h-full">
        <div className="mb-3">
          <span className="text-xs font-bold tracking-widest text-neutral-400 uppercase">
            Step 5
          </span>
        </div>
        <h3 className="text-lg md:text-xl font-bold text-white mb-5">
          HOUSE RULES TEST
        </h3>
        <div className="space-y-3">
          <Button
            asChild
            size="lg"
            className="w-full text-white font-bold text-base py-6"
            style={{ backgroundColor: "#bf0f3e" }}
          >
            <Link to={testUrl}>OPEN TEST</Link>
          </Button>

          {/* Admin controls */}
          <div className="flex items-center justify-center gap-3">
            {!showBypass ? (
              <button
                onClick={() => setShowBypass(true)}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <KeyRound className="h-3 w-3" />
                Admin bypass
              </button>
            ) : (
              <form onSubmit={handleBypassSubmit} className="flex gap-2">
                <Input
                  type="password"
                  value={bypassCode}
                  onChange={(e) => setBypassCode(e.target.value)}
                  placeholder="Admin password"
                  className="text-sm bg-neutral-800 border-neutral-700 text-white"
                  autoFocus
                />
                <Button type="submit" size="sm" className="bg-[#bf0f3e] hover:bg-[#bf0f3e]/90 text-white">
                  Go
                </Button>
              </form>
            )}

            {hasPassed && (
              <>
                <span className="text-neutral-700 text-xs">|</span>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  <XCircle className="h-3 w-3" />
                  Reset test
                </button>
              </>
            )}
          </div>
          {bypassError && (
            <p className="text-red-400 text-xs text-center">{bypassError}</p>
          )}
        </div>
      </div>
    </div>
  );
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
        <div className="py-12 md:py-16 text-center border-b border-neutral-800 flex items-center justify-center bg-secondary">
          <div className="max-w-[900px] mx-auto px-4 flex items-center gap-6 md:gap-10">
            




            <div className="bg-neutral-900 rounded-xl py-10 px-4 flex-1 text-center">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-2">CALL-OUT</h2>
              <Smartphone className="w-8 h-8 text-white mx-auto mb-4" />
              <p className="text-lg md:text-xl font-bold text-white mb-2">
                100% Attendance is not Required,
              </p>
              <p className="text-lg md:text-xl font-bold text-white mb-8">
                100% Communication is Required!
              </p>
              <a
              href="https://forms.monday.com/forms/583578aa7eb854fe388d49e84780eee4?r=use1"
              target="_blank"
              rel="noopener noreferrer">

                <Button
                className="text-white font-bold px-8 py-3 text-lg"
                style={{ backgroundColor: "#bf0f3e" }}>

                  CALL-OUT FORM
                </Button>
              </a>
            </div>
          </div>
        </div>

        {/* Hero Title */}
        <div className="py-12 md:py-16 text-center">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight">ROOKIE  ORIENTATION  DAY

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
            <OrientationStep stepNumber={4} title="HOUSE RULES INTRO & TEST" videoId={VIDEO_IDS.step4} secondaryButtonLabel="READ HOUSE RULES" secondaryButtonLink="/house-rules" />

            {/* STEP 5: House Rules Test + Admin Bypass */}
            <Step5WithBypass testUrl={HOUSE_RULES_TEST_URL} />

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