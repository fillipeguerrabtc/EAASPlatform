import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Shield, Globe, Users, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CentralMarketplace() {
  const { t } = useTranslation();

  const plans = [
    {
      name: "Starter",
      price: "R$ 299",
      period: "/mês",
      features: [
        "Até 1.000 produtos",
        "CRM completo",
        "Omnichat WhatsApp",
        "1 usuário admin",
        "Suporte por email",
      ],
    },
    {
      name: "Professional",
      price: "R$ 799",
      period: "/mês",
      popular: true,
      features: [
        "Produtos ilimitados",
        "CRM 360° avançado",
        "Omnichat multi-canal",
        "5 usuários admin",
        "IA autônoma",
        "Brand Scanner",
        "Suporte prioritário",
      ],
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      features: [
        "Tudo do Professional",
        "Usuários ilimitados",
        "White-label completo",
        "Suporte 24/7",
        "SLA garantido",
        "Onboarding dedicado",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.02] -z-10" />
        <div className="container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-4" variant="outline" data-testid="badge-platform">
              <Zap className="w-3 h-3 mr-1" />
              Everything As A Service
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent" data-testid="title-hero">
              A Plataforma Definitiva para Seu Negócio
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Marketplace, CRM 360°, ERP Completo, IA Autônoma, Omnichat e muito mais. Tudo em uma única plataforma.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button size="lg" data-testid="button-start-trial">
                Iniciar Teste Grátis
              </Button>
              <Button size="lg" variant="outline" data-testid="button-schedule-demo">
                Agendar Demo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12" data-testid="title-features">
          Recursos Completos
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Globe,
              title: "Marketplace Universal",
              description: "Venda produtos físicos, digitais e serviços em um único lugar",
            },
            {
              icon: Users,
              title: "CRM 360°",
              description: "Gestão completa de clientes com pipeline, segmentação e automação",
            },
            {
              icon: TrendingUp,
              title: "ERP Completo",
              description: "Financeiro, Inventário, RH e Relatórios integrados",
            },
            {
              icon: Zap,
              title: "IA Autônoma",
              description: "Assistente inteligente com base de conhecimento editável",
            },
            {
              icon: Shield,
              title: "Multi-tenant Seguro",
              description: "Isolamento total de dados entre tenants com RBAC",
            },
            {
              icon: Check,
              title: "Brand Scanner",
              description: "Extração automática de identidade visual com Puppeteer",
            },
          ].map((feature, idx) => (
            <Card key={idx} className="hover-elevate" data-testid={`card-feature-${idx}`}>
              <CardHeader>
                <feature.icon className="w-10 h-10 text-primary mb-2" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12" data-testid="title-pricing">
          Planos e Preços
        </h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, idx) => (
            <Card 
              key={idx} 
              className={`hover-elevate ${plan.popular ? 'border-primary shadow-lg' : ''}`}
              data-testid={`card-plan-${idx}`}
            >
              {plan.popular && (
                <div className="bg-primary text-primary-foreground text-center py-2 rounded-t-lg">
                  <Badge variant="secondary">Mais Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIdx) => (
                    <li key={featureIdx} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-6" variant={plan.popular ? "default" : "outline"} data-testid={`button-select-plan-${idx}`}>
                  Selecionar Plano
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Final */}
      <div className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-primary to-purple-600 text-primary-foreground">
          <CardContent className="p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Pronto para Transformar Seu Negócio?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Comece seu teste grátis de 14 dias. Sem cartão de crédito.
            </p>
            <Button size="lg" variant="secondary" data-testid="button-cta-final">
              Criar Meu Tenant Agora
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
