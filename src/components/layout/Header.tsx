import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, ChevronDown } from "lucide-react";
import nlaLogo from "@/assets/nla-logo.png";

interface HeaderProps {
  className?: string;
}

const aboutSubLinks = [
  { href: "/our-story", label: "Our Story" },
  { href: "/impact", label: "Our Impact" },
  { href: "/vision", label: "Our Vision" },
];

const Header = ({ className }: HeaderProps) => {
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/programs", label: "Programs" },
    { href: "/meal-train", label: "Meal Train" },
  ];

  return (
    <header className={cn("w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50", className)}>
      <div className="container flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src={nlaLogo} alt="No Limits Academy - Go to Home" className="h-32 w-auto" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="text-sm text-foreground hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}

          {/* About Us Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1 text-sm text-foreground hover:text-primary transition-colors">
              About Us
              <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-180" />
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <div className="bg-background border border-border rounded-lg shadow-lg py-2 min-w-[160px]">
                {aboutSubLinks.map((sub) => (
                  <Link
                    key={sub.label}
                    to={sub.href}
                    className="block px-4 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {sub.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6" asChild>
              <Link to="/supporters">
                DONATE
              </Link>
            </Button>
            <Link to="/admin" className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              Admin
            </Link>
          </div>
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
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={() => setOpen(false)}
                  className="text-lg text-foreground hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile About Us Accordion */}
              <div>
                <button
                  onClick={() => setAboutOpen(!aboutOpen)}
                  className="flex items-center justify-between w-full text-lg text-foreground hover:text-primary transition-colors"
                >
                  About Us
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", aboutOpen && "rotate-180")} />
                </button>
                <div className={cn(
                  "overflow-hidden transition-all duration-200",
                  aboutOpen ? "max-h-48 mt-3" : "max-h-0"
                )}>
                  <div className="flex flex-col gap-4 pl-4 border-l-2 border-primary/30">
                    {aboutSubLinks.map((sub) => (
                      <Link
                        key={sub.label}
                        to={sub.href}
                        onClick={() => setOpen(false)}
                        className="text-base text-muted-foreground hover:text-primary transition-colors"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold w-full" asChild>
                <Link to="/supporters" onClick={() => setOpen(false)}>
                  DONATE
                </Link>
              </Button>
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors text-center mt-4"
              >
                Admin
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Header;
