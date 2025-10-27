import type { ThemeTokens } from "@/types/brandScanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SectionProps {
  tokens: ThemeTokens;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  variant?: "default" | "card" | "muted";
}

export function Section({
  tokens,
  title,
  description,
  children,
  variant = "default",
}: SectionProps) {
  const sectionStyle: React.CSSProperties = {
    backgroundColor:
      variant === "muted"
        ? tokens.muted.hex
        : variant === "card"
        ? tokens.card.hex
        : tokens.background.hex,
    color: tokens.foreground.hex,
  };

  return (
    <section
      data-testid="marketplace-section"
      style={sectionStyle}
      className="py-16 px-4 sm:px-6 lg:px-8"
    >
      <div className="container mx-auto">
        {/* Section Header */}
        {(title || description) && (
          <div className="text-center mb-12">
            {title && (
              <h2
                data-testid="section-title"
                className="text-3xl sm:text-4xl font-bold mb-4"
                style={{ fontFamily: tokens.fontPrimary.family }}
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                data-testid="section-description"
                className="text-lg max-w-2xl mx-auto"
                style={{
                  color: tokens.mutedForeground.hex,
                  fontFamily: tokens.fontSecondary.family,
                }}
              >
                {description}
              </p>
            )}
          </div>
        )}

        {/* Section Content */}
        {children && (
          <div data-testid="section-content" className="max-w-6xl mx-auto">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * SectionCard - Card component styled with theme tokens
 */
interface SectionCardProps {
  tokens: ThemeTokens;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function SectionCard({ tokens, title, description, children }: SectionCardProps) {
  return (
    <Card
      data-testid="section-card"
      style={{
        backgroundColor: tokens.card.hex,
        borderColor: tokens.border.hex,
      }}
    >
      <CardHeader>
        <CardTitle
          data-testid="card-title"
          style={{
            color: tokens.cardForeground.hex,
            fontFamily: tokens.fontPrimary.family,
          }}
        >
          {title}
        </CardTitle>
        {description && (
          <CardDescription
            data-testid="card-description"
            style={{
              color: tokens.mutedForeground.hex,
              fontFamily: tokens.fontSecondary.family,
            }}
          >
            {description}
          </CardDescription>
        )}
      </CardHeader>
      {children && (
        <CardContent data-testid="card-content">{children}</CardContent>
      )}
    </Card>
  );
}
