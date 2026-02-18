import { cn } from "@/lib/utils";
import { Instagram, Facebook } from "lucide-react";

interface FooterProps {
  className?: string;
}

const Footer = ({ className }: FooterProps) => {
  return (
    <footer className={cn("w-full bg-black text-white", className)}>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm font-bold tracking-widest uppercase">
            No Limits Academy
          </p>
          <div className="flex items-center gap-4 relative z-50">
            <a
              href="https://www.instagram.com/nolimitsboxingacademy/?hl=en"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-white hover:text-white/70 transition-colors p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Instagram className="h-5 w-5 pointer-events-none" />
            </a>
            <a
              href="https://www.facebook.com/nolimitsboxingacademy/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-white hover:text-white/70 transition-colors p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Facebook className="h-5 w-5 pointer-events-none" />
            </a>
          </div>
          <a
            href="mailto:info@nolimitsboxingacademy.org"
            className="text-sm text-white/80 hover:text-white transition-colors"
          >
            info@nolimitsboxingacademy.org
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
