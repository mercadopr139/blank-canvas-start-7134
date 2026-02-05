import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

interface YouTubeEmbedProps {
  url: string;
}

const YouTubeEmbed = ({ url }: YouTubeEmbedProps) => {
  // Extract video ID from various YouTube URL formats
  const getVideoId = (url: string) => {
    if (!url) return null;
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/
    );
    return match ? match[1] : null;
  };

  const videoId = getVideoId(url);

  if (!videoId) {
    return (
      <div className="aspect-video bg-neutral-800 rounded-lg flex items-center justify-center">
        <p className="text-neutral-400 text-sm">Video coming soon</p>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="w-full h-full rounded-lg"
      />
    </div>
  );
};

interface OrientationStepProps {
  stepNumber: number;
  title: string;
  videoUrl?: string;
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
  videoUrl,
  buttonLabel,
  buttonLink,
  isExternal = false,
  secondaryButtonLabel,
  secondaryButtonLink,
  children,
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
        {videoUrl !== undefined && <YouTubeEmbed url={videoUrl} />}

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
              variant="outline"
              size="lg"
              className="w-full font-bold text-base py-6 border-neutral-600 text-white hover:bg-neutral-800"
            >
              <a href={secondaryButtonLink}>{secondaryButtonLabel}</a>
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
