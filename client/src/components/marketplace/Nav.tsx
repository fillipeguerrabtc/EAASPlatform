import type { ThemeTokens } from "@/types/brandScanner";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface NavProps {
  tokens: ThemeTokens;
  items?: Array<{ label: string; href: string }>;
}

export function Nav({ tokens, items = [] }: NavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navStyle = {
    backgroundColor: tokens.background.hex,
    color: tokens.foreground.hex,
    borderBottom: `1px solid ${tokens.border.hex}`,
  };

  const linkStyle = {
    color: tokens.mutedForeground.hex,
  };

  const linkHoverStyle = {
    color: tokens.foreground.hex,
  };

  return (
    <nav
      data-testid="marketplace-nav"
      style={navStyle}
      className="sticky top-0 z-50 w-full backdrop-blur-sm"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div data-testid="nav-logo" className="flex-shrink-0">
            <a
              href="/"
              style={{ color: tokens.primary.hex }}
              className="text-xl font-bold"
            >
              Brand Clone
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {items.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  data-testid={`nav-link-${index}`}
                  style={linkStyle}
                  className="px-3 py-2 rounded-md text-sm font-medium transition-colors hover:text-foreground"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = linkHoverStyle.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = linkStyle.color;
                  }}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              size="icon"
              variant="ghost"
              data-testid="button-mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div
          data-testid="mobile-nav-menu"
          style={{ backgroundColor: tokens.card.hex }}
          className="md:hidden"
        >
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {items.map((item, index) => (
              <a
                key={index}
                href={item.href}
                data-testid={`mobile-nav-link-${index}`}
                style={linkStyle}
                className="block px-3 py-2 rounded-md text-base font-medium transition-colors hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
