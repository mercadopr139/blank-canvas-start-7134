import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
interface HeaderProps {
  className?: string;
}

const Header = ({ className }: HeaderProps) => {
  return (
    <header className={cn("w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50", className)}>
      <div className="container flex h-16 items-center justify-between">
        <div className="font-display text-xl font-semibold text-foreground">
          Logo
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Home
          </a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            About
          </a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Services
          </a>
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Contact
          </a>
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6">
            DONATE
          </Button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
