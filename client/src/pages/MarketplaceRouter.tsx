import { Route, Switch, useLocation } from "wouter";
import { useManifest } from "@/hooks/useTokens";
import { Nav } from "@/components/marketplace/Nav";
import { Hero } from "@/components/marketplace/Hero";
import { Section, SectionCard } from "@/components/marketplace/Section";
import { Gallery } from "@/components/marketplace/Gallery";
import { Footer } from "@/components/marketplace/Footer";
import { BuyButton } from "@/components/marketplace/BuyButton";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import type { PageBlueprint, LayoutHint } from "@/types/brandScanner";

/**
 * MarketplaceRouter
 * 
 * Lazy-loads manifest.json from /public/marketplace/manifest.json
 * and dynamically renders pages based on the manifest structure.
 * 
 * Each page is rendered using the layout hints (hero, section, gallery, footer, nav)
 * provided in the manifest.
 */
export default function MarketplaceRouter() {
  const { manifest, isLoading, error } = useManifest();

  // Loading state
  if (isLoading) {
    return (
      <div
        data-testid="marketplace-loading"
        className="flex items-center justify-center min-h-screen"
      >
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg text-muted-foreground">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !manifest) {
    return (
      <div
        data-testid="marketplace-error"
        className="flex items-center justify-center min-h-screen p-4"
      >
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-xl font-semibold mb-2">
                  Failed to Load Marketplace
                </h2>
                <p className="text-muted-foreground mb-4">
                  {error?.message || "Unable to load marketplace manifest"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Make sure the marketplace has been cloned and the manifest exists at{" "}
                  <code className="bg-muted px-1 py-0.5 rounded">
                    /public/marketplace/manifest.json
                  </code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract navigation items from manifest (first nav layout hint)
  const navItems = manifest.pages
    .filter((page) => page.layout.some((hint) => hint.kind === "nav"))
    .map((page) => ({
      label: page.route.replace("/", "") || "Home",
      href: page.route,
    }));

  // Render marketplace with dynamic pages
  return (
    <div data-testid="marketplace-router" className="min-h-screen flex flex-col">
      {/* Global Navigation */}
      <Nav tokens={manifest.tokens} items={navItems} />

      {/* Dynamic Page Routing */}
      <Switch>
        {manifest.pages.map((page, index) => (
          <Route key={index} path={page.route}>
            <DynamicPage page={page} manifest={manifest} />
          </Route>
        ))}

        {/* 404 Not Found */}
        <Route>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-2">404</h1>
              <p className="text-muted-foreground">Page not found</p>
            </div>
          </div>
        </Route>
      </Switch>

      {/* Global Footer */}
      <Footer
        tokens={manifest.tokens}
        copyright={`© ${new Date().getFullYear()} ${new URL(manifest.siteUrl).hostname}`}
      />
    </div>
  );
}

/**
 * DynamicPage
 * Renders a page based on its layout hints
 */
interface DynamicPageProps {
  page: PageBlueprint;
  manifest: typeof useManifest extends () => { manifest: infer T } ? NonNullable<T> : never;
}

function DynamicPage({ page, manifest }: DynamicPageProps) {
  const [location] = useLocation();

  return (
    <main data-testid={`page-${page.route.replace("/", "") || "home"}`}>
      {page.layout.map((hint, index) => (
        <LayoutComponent
          key={index}
          hint={hint}
          tokens={manifest.tokens}
          assets={manifest.assets}
          pageUrl={page.url}
        />
      ))}
    </main>
  );
}

/**
 * LayoutComponent
 * Renders a single layout component based on the hint kind
 */
interface LayoutComponentProps {
  hint: LayoutHint;
  tokens: DynamicPageProps["manifest"]["tokens"];
  assets: DynamicPageProps["manifest"]["assets"];
  pageUrl: string;
}

function LayoutComponent({ hint, tokens, assets, pageUrl }: LayoutComponentProps) {
  switch (hint.kind) {
    case "hero":
      // Find hero background image from assets (first image)
      const heroImage = assets.find((a) => a.type === "image");
      return (
        <Hero
          tokens={tokens}
          title={hint.notes || "Welcome"}
          subtitle="Explore our curated collection"
          backgroundImage={heroImage?.cdnUrl}
          ctaText="Shop Now"
          ctaHref="#products"
        />
      );

    case "section":
      return (
        <Section
          tokens={tokens}
          title={hint.notes || "Featured Section"}
          description="Discover our carefully crafted offerings"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <SectionCard
                key={i}
                tokens={tokens}
                title={`Feature ${i}`}
                description="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
              >
                <BuyButton
                  tokens={tokens}
                  productName={`Product ${i}`}
                  price={99.99 * i}
                  currency="USD"
                  onAddToCart={async () => {
                    console.log(`Added Product ${i} to cart`);
                  }}
                />
              </SectionCard>
            ))}
          </div>
        </Section>
      );

    case "gallery":
      return (
        <Section tokens={tokens} title={hint.notes || "Gallery"} variant="muted">
          <Gallery tokens={tokens} assets={assets} columns={3} />
        </Section>
      );

    case "content":
      return (
        <Section
          tokens={tokens}
          title={hint.notes || "Content"}
          description="Additional information about our offerings"
        >
          <div className="prose max-w-none">
            <p style={{ color: tokens.foreground.hex }}>
              This is a dynamically generated content section based on the cloned
              website's layout structure. The actual content would be populated from
              the source website during the clone process.
            </p>
          </div>
        </Section>
      );

    case "footer":
      // Footer is rendered globally, skip here
      return null;

    case "nav":
      // Nav is rendered globally, skip here
      return null;

    default:
      return null;
  }
}
