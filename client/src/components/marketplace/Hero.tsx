import type { ThemeTokens } from "@/types/brandScanner";
import { Button } from "@/components/ui/button";

interface HeroProps {
  tokens: ThemeTokens;
  title: string;
  subtitle?: string;
  backgroundImage?: string;
  ctaText?: string;
  ctaHref?: string;
}

export function Hero({
  tokens,
  title,
  subtitle,
  backgroundImage,
  ctaText = "Get Started",
  ctaHref = "#",
}: HeroProps) {
  const heroStyle: React.CSSProperties = {
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
    backgroundColor: backgroundImage ? undefined : tokens.primary.hex,
    backgroundSize: "cover",
    backgroundPosition: "center",
    color: tokens.background.hex, // Light text on dark/image background
    position: "relative",
  };

  return (
    <section
      data-testid="marketplace-hero"
      style={heroStyle}
      className="relative min-h-[60vh] flex items-center justify-center overflow-hidden"
    >
      {/* Dark overlay for better text readability on images */}
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/70"
          aria-hidden="true"
        />
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1
          data-testid="hero-title"
          className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6"
          style={{ fontFamily: tokens.fontPrimary.family }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            data-testid="hero-subtitle"
            className="text-lg sm:text-xl md:text-2xl mb-8 max-w-3xl mx-auto opacity-90"
            style={{ fontFamily: tokens.fontSecondary.family }}
          >
            {subtitle}
          </p>
        )}

        {ctaText && (
          <Button
            asChild
            size="lg"
            data-testid="hero-cta-button"
            style={{
              backgroundColor: tokens.accent.hex,
              color: tokens.background.hex,
            }}
            className="text-lg px-8 py-6 rounded-md font-semibold"
          >
            <a href={ctaHref}>{ctaText}</a>
          </Button>
        )}
      </div>
    </section>
  );
}
