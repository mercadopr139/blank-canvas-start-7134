import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { YouTubeEmbed } from "@/components/orientation/YouTubeEmbed";

const TEST_PASSED_KEY = "house_rules_test_passed";

interface OrientationStepGatedProps {
  stepNumber: number;
  title: string;
  videoId?: string;
}

const OrientationStepGated = ({
  stepNumber,
  title,
  videoId
}: OrientationStepGatedProps) => {
  const [hasPassed, setHasPassed] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const passed = localStorage.getItem(TEST_PASSED_KEY) === "true";
    setHasPassed(passed);
  }, []);

  const anchorId = `step-${stepNumber}`;

  const handleBlockedClick = () => {
    if (!hasPassed) {
      setShowWarning(true);
    }
  };

  return (
    <div id={anchorId} className="scroll-mt-24">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 md:p-6 h-full">
        {/* Step Label */}
        <div className="mb-3">
          <span className="text-xs font-bold tracking-widest text-neutral-400 uppercase">
            Step {stepNumber}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg md:text-xl font-bold text-white mb-5">
          {title}
        </h3>

        {/* Warning Alert */}
        {showWarning && !hasPassed && (
          <Alert className="mb-4 bg-red-500/10 border-red-500/30">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <AlertDescription className="text-red-300 ml-2">
              You must get 10 out of 10 on the House Rules Test before opening Step {stepNumber}.
            </AlertDescription>
          </Alert>
        )}

        {/* Gated Content */}
        {hasPassed ? (
          <>
            {videoId && <YouTubeEmbed videoId={videoId} title={title} />}
          </>
        ) : (
          <div onClick={handleBlockedClick} className="cursor-pointer">
            <div className="relative">
              {/* Locked overlay */}
              <div className="aspect-video bg-neutral-800 rounded-lg flex items-center justify-center border border-neutral-700">
                <div className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-neutral-700 flex items-center justify-center mx-auto mb-3">
                    <AlertCircle className="w-6 h-6 text-neutral-400" />
                  </div>
                  <p className="text-neutral-400 text-sm">
                    Complete the House Rules Test first
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Take Test Button when blocked */}
        {showWarning && !hasPassed && (
          <div className="mt-4">
            <Button
              asChild
              size="lg"
              className="w-full text-white font-bold text-base py-6"
              style={{ backgroundColor: "#bf0f3e" }}
            >
              <Link to="/house-rules-test">Take the House Rules Test</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrientationStepGated;
