import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MessageSquare, ShoppingCart, Users, Sparkles, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-6" data-testid="text-landing-title">
            EAAS
          </h1>
          <p className="text-2xl text-muted-foreground mb-8">
            {t('landing.subtitle')}
          </p>
          <Button 
            onClick={handleLogin} 
            size="lg" 
            className="text-lg px-8 py-6"
            data-testid="button-login"
          >
            {t('landing.login')}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6 text-primary" />
                    <CardTitle>{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>{t('landing.ready.title')}</CardTitle>
              <CardDescription>{t('landing.ready.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleLogin} 
                size="lg"
                data-testid="button-get-started"
              >
                {t('landing.getStarted')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
