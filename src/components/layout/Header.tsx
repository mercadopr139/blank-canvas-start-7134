import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import nlaLogo from "@/assets/nla-logo.png";

interface HeaderProps {
  className?: string;
}

const Header = ({ className }: HeaderProps) => {
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/programs", label: "Programs" },
    { href: "#meal-train", label: "Meal Train" },
    { href: "#about", label: "Our Story" },
    { href: "#impact", label: "Our Impact" },
    { href: "#vision", label: "Our Vision" },
  ];

  return (
    <header className={cn("w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50", className)}>
      <div className="container flex items-center justify-between">
        <div className="flex items-center">
          <img src={nlaLogo} alt="No Limits Academy" className="h-32 w-auto" />
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-foreground hover:text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6" asChild>
            <a href="https://www.paypal.com/ncp/payment/TMMDVUSEQKHJC" target="_blank" rel="noopener noreferrer">
              DONATE
            </a>
          </Button>
        </nav>

        {/* Mobile Navigation */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px]">
            <nav className="flex flex-col gap-6 mt-8">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-lg text-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold w-full" asChild>
                <a href="https://www.paypal.com/ncp/payment/TMMDVUSEQKHJC" target="_blank" rel="noopener noreferrer">
                  DONATE
                </a>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Header;
