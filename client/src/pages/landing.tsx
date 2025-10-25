import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MessageSquare, ShoppingCart, Users, Sparkles, CalendarDays, ArrowRight, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EaasLogo } from "@/components/eaas-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "wouter";

export default function Landing() {
  const { t } = useTranslation();

  const features = [
    {
      icon: ShoppingCart,
      title: t('nav.marketplace'),
      description: t('landing.marketplace.desc'),
    },
    {
      icon: Users,
      title: t('nav.crm'),
      description: t('landing.crm.desc'),
    },
    {
      icon: MessageSquare,
      title: t('nav.omnichat'),
      description: t('landing.omnichat.desc'),
    },
    {
      icon: Sparkles,
      title: t('nav.knowledgeBase'),
      description: t('landing.ai.desc'),
    },
    {
      icon: CalendarDays,
      title: t('nav.calendar'),
      description: t('landing.calendar.desc'),
    },
    {
      icon: Building2,
      title: t('nav.tenants'),
      description: t('landing.tenants.desc'),
    },
  ];

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <EaasLogo size="lg" variant="full" />
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/shop">
                <Button variant="ghost" data-testid="link-shop">
                  Marketplace
                </Button>
              </Link>
              <ThemeToggle />
              <Button 
                onClick={handleLogin}
                data-testid="button-header-login"
              >
                {t('landing.login')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Premium Gradient */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-emerald-50/10 via-purple-50/10 to-blue-50/10 dark:from-background dark:via-emerald-950/20 dark:via-purple-950/20 dark:to-blue-950/20">
        <div className="container mx-auto px-4 sm:px-6 py-20 sm:py-32">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/10 via-purple-500/10 to-blue-500/10 border border-emerald-500/20">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
              <span className="text-sm font-medium">
                Everything As A Service
              </span>
            </div>

            {/* Hero Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight" data-testid="text-landing-title">
              <span className="bg-gradient-to-r from-emerald-600 via-purple-600 to-blue-600 bg-clip-text text-transparent dark:from-emerald-500 dark:via-purple-500 dark:to-blue-500">
                Toda a sua empresa
              </span>
              <br />
              <span className="text-foreground">
                em uma plataforma
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.subtitle')}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button 
                onClick={handleLogin} 
                size="lg" 
                className="text-base sm:text-lg px-6 sm:px-8 min-h-11 sm:min-h-12"
                data-testid="button-login"
              >
                {t('landing.login')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link href="/shop">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="text-base sm:text-lg px-6 sm:px-8 min-h-11 sm:min-h-12"
                  data-testid="button-view-marketplace"
                >
                  Ver Marketplace
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                <span>Multi-tenant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-500" />
                <span>IA Autônoma</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                <span>Tudo integrado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            6 Módulos, 1 Plataforma
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tudo que sua empresa precisa para crescer, integrado e automatizado
          </p>
        </div>

        <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const gradients = [
              "from-emerald-500/10 to-emerald-600/5",
              "from-purple-500/10 to-purple-600/5",
              "from-blue-500/10 to-blue-600/5",
              "from-amber-500/10 to-amber-600/5",
              "from-emerald-500/10 to-purple-600/5",
              "from-purple-500/10 to-blue-600/5",
            ];
            const iconColors = [
              "text-emerald-600 dark:text-emerald-500",
              "text-purple-600 dark:text-purple-500",
              "text-blue-600 dark:text-blue-500",
              "text-amber-600 dark:text-amber-500",
              "text-emerald-600 dark:text-emerald-500",
              "text-purple-600 dark:text-purple-500",
            ];
            return (
              <Card key={feature.title} className="hover-elevate relative overflow-hidden group">
                <div className={`absolute inset-0 bg-gradient-to-br ${gradients[index]} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <CardHeader className="relative">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-background/50 backdrop-blur-sm">
                      <Icon className={`h-6 w-6 ${iconColors[index]}`} />
                    </div>
                    <CardTitle>{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <Card className="max-w-3xl mx-auto relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-purple-500/10 to-blue-500/10" />
          <CardHeader className="relative text-center">
            <CardTitle className="text-3xl sm:text-4xl mb-4">
              {t('landing.ready.title')}
            </CardTitle>
            <CardDescription className="text-base sm:text-lg">
              {t('landing.ready.desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="relative text-center">
            <Button 
              onClick={handleLogin} 
              size="lg"
              className="text-base sm:text-lg px-8 min-h-11"
              data-testid="button-get-started"
            >
              {t('landing.getStarted')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <EaasLogo size="sm" variant="full" />
            <p className="text-sm text-muted-foreground">
              © 2025 EAAS Platform. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
