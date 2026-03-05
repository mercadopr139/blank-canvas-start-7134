import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { YouTubeEmbed } from "@/components/orientation/YouTubeEmbed";

interface OrientationStepProps {
  stepNumber: number;
  title: string;
  videoId?: string;
  buttonLabel?: string;
  buttonLink?: string;
  isExternal?: boolean;
  secondaryButtonLabel?: string;
  secondaryButtonLink?: string;
  children?: ReactNode;
}

const OrientationStep = ({
  stepNumber,
  title,
  videoId,
  buttonLabel,
  buttonLink,
  isExternal = false,
  secondaryButtonLabel,
  secondaryButtonLink,
  children
}: OrientationStepProps) => {
  const anchorId = `step-${stepNumber}`;
  
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

        {/* Video Embed */}
        {videoId && <YouTubeEmbed videoId={videoId} title={title} />}

        {/* Primary Button */}
        {buttonLabel && buttonLink && (
          <div className="mt-5">
            {isExternal ? (
              <Button
                asChild
                size="lg"
                className="w-full text-white font-bold text-base py-6"
                style={{ backgroundColor: "#bf0f3e" }}
              >
                <a href={buttonLink} target="_blank" rel="noopener noreferrer">
                  {buttonLabel}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button
                asChild
                size="lg"
                className="w-full text-white font-bold text-base py-6"
                style={{ backgroundColor: "#bf0f3e" }}
              >
                <Link to={buttonLink}>{buttonLabel}</Link>
              </Button>
            )}
          </div>
        )}

        {/* Secondary Button (for scroll links) */}
        {secondaryButtonLabel && secondaryButtonLink && (
          <div className="mt-3">
            <Button
              asChild
              size="lg"
              className="w-full text-white font-bold text-base py-6"
              style={{ backgroundColor: "#bf0f3e" }}
            >
              {secondaryButtonLink.startsWith("#") ? (
                <a href={secondaryButtonLink}>{secondaryButtonLabel}</a>
              ) : (
                <Link to={secondaryButtonLink}>{secondaryButtonLabel}</Link>
              )}
            </Button>
          </div>
        )}

        {/* Additional Content */}
        {children}
      </div>
    </div>
  );
};

export default OrientationStep;
