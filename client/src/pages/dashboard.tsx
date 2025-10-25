import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import {
  ShoppingCart,
  Users,
  MessageSquare,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";

export default function Dashboard() {
  const { t } = useTranslation();
  
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
  });

  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["/api/customers"],
  });

  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ["/api/conversations"],
  });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ["/api/orders"],
  });

  const stats = [
    {
      title: t('marketplace.products'),
      value: Array.isArray(products) ? products.length : 0,
      icon: ShoppingCart,
      loading: productsLoading,
      testId: "total-products",
      link: "/marketplace",
      gradient: "from-emerald-500/10 to-emerald-500/5",
      iconColor: "text-emerald-600 dark:text-emerald-500",
      bgIcon: "bg-emerald-500/10",
    },
    {
      title: t('crm.customers'),
      value: Array.isArray(customers) ? customers.length : 0,
      icon: Users,
      loading: customersLoading,
      testId: "total-customers",
      link: "/customers",
      gradient: "from-purple-500/10 to-purple-500/5",
      iconColor: "text-purple-600 dark:text-purple-500",
      bgIcon: "bg-purple-500/10",
    },
    {
      title: t('omnichat.conversations'),
      value: Array.isArray(conversations) ? conversations.filter((c: any) => c.status === "open").length : 0,
      icon: MessageSquare,
      loading: conversationsLoading,
      testId: "active-conversations",
      link: "/omnichat",
      gradient: "from-blue-500/10 to-blue-500/5",
      iconColor: "text-blue-600 dark:text-blue-500",
      bgIcon: "bg-blue-500/10",
    },
    {
      title: t('dashboard.metrics.orders'),
      value: Array.isArray(orders) ? orders.length : 0,
      icon: DollarSign,
      loading: ordersLoading,
      testId: "total-orders",
      link: "/orders",
      gradient: "from-amber-500/10 to-amber-500/5",
      iconColor: "text-amber-600 dark:text-amber-500",
      bgIcon: "bg-amber-500/10",
    },
  ];

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight" data-testid="text-dashboard-title">
                {t('dashboard.title')}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                {t('dashboard.welcome')}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
              <span className="font-medium">Atualizado agora</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Link key={stat.title} href={stat.link}>
                  <Card className={`
                    group relative overflow-hidden
                    hover-elevate active-elevate-2 
                    cursor-pointer transition-all duration-300
                    border-2 hover:border-primary/20
                    bg-gradient-to-br ${stat.gradient}
                  `}>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/10 transition-all duration-300" />
                    
                    <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="text-xs sm:text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                        {stat.title}
                      </CardTitle>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </CardHeader>
                    
                    <CardContent className="relative">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          {stat.loading ? (
                            <Skeleton className="h-10 w-20" />
                          ) : (
                            <div className="text-3xl sm:text-4xl font-bold tracking-tight" data-testid={`stat-${stat.testId}`}>
                              {stat.value}
                            </div>
                          )}
                        </div>
                        <div className={`
                          ${stat.bgIcon} ${stat.iconColor}
                          p-3 rounded-xl
                          group-hover:scale-110 transition-transform duration-300
                        `}>
                          <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
