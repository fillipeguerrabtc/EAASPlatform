import type { ThemeTokens } from "@/types/brandScanner";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

interface FooterProps {
  tokens: ThemeTokens;
  sections?: FooterSection[];
  copyright?: string;
  socialLinks?: Array<{ icon: React.ReactNode; href: string; label: string }>;
}

export function Footer({
  tokens,
  sections = [],
  copyright,
  socialLinks = [],
}: FooterProps) {
  const footerStyle = {
    backgroundColor: tokens.card.hex,
    color: tokens.cardForeground.hex,
    borderTop: `1px solid ${tokens.border.hex}`,
  };

  const linkStyle = {
    color: tokens.mutedForeground.hex,
  };

  const currentYear = new Date().getFullYear();
  const copyrightText = copyright || `© ${currentYear} Brand Clone. All rights reserved.`;

  return (
    <footer data-testid="marketplace-footer" style={footerStyle} className="mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Footer Sections */}
        {sections.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 mb-8">
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex} data-testid={`footer-section-${sectionIndex}`}>
                <h3
                  className="font-semibold text-lg mb-4"
                  style={{
                    color: tokens.foreground.hex,
                    fontFamily: tokens.fontPrimary.family,
                  }}
                >
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <a
                        href={link.href}
                        data-testid={`footer-link-${sectionIndex}-${linkIndex}`}
                        style={linkStyle}
                        className="hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        <div
          className="border-t mb-8"
          style={{ borderColor: tokens.border.hex }}
        />

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Copyright */}
          <p
            data-testid="footer-copyright"
            style={{ color: tokens.mutedForeground.hex }}
            className="text-sm"
          >
            {copyrightText}
          </p>

          {/* Social Links */}
          {socialLinks.length > 0 && (
            <div
              data-testid="footer-social-links"
              className="flex items-center gap-4"
            >
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  data-testid={`footer-social-${index}`}
                  aria-label={social.label}
                  style={{ color: tokens.mutedForeground.hex }}
                  className="hover:text-foreground transition-colors"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
