import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  AlertTriangle,
  PackageX,
  CreditCard,
  Brain,
  TrendingDown,
} from "lucide-react";
import { SEO } from "@/components/seo";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DashboardKpis {
  totalRevenue: number;
  revenueGrowth: number;
  totalOrders: number;
  ordersGrowth: number;
  totalCustomers: number;
  customersGrowth: number;
  conversionRate: number;
  activeConversations: number;
  criticalAlerts: {
    lowStockProducts: number;
    pendingPayments: number;
    criticsEscalations: number;
  };
  salesTrend: Array<{ date: string; revenue: number; orders: number }>;
}

export default function Dashboard() {
  const { t } = useTranslation();
  
  const { data: kpis, isLoading: kpisLoading } = useQuery<DashboardKpis>({
    queryKey: ["/api/dashboard/kpis"],
  });

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
    <>
      <SEO
        title="Dashboard - EAAS | Real-time Business Metrics"
        description="Monitor your business performance with real-time metrics, analytics, and insights. Track products, customers, conversations, and orders."
        keywords="dashboard, business analytics, real-time metrics, business intelligence, kpi tracking"
        canonical="https://eaas.com/dashboard"
        ogTitle="EAAS Dashboard - Business Command Center"
        ogDescription="Real-time business metrics and analytics at your fingertips"
      />
      <div className="min-h-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Hero Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight" data-testid="text-dashboard-title">
                {t('dashboard.title')}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                {t('dashboard.welcome')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
              <span className="font-medium">Atualizado agora</span>
            </div>
          </div>
        </div>
      </div>

      {/* Executive KPIs */}
      <div className="px-4 sm:px-6 lg:px-8 pb-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {/* Revenue KPI */}
            <Link to="/finance">
              <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid="card-revenue">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  {kpisLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold" data-testid="text-total-revenue">
                        R$ {kpis?.totalRevenue?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        {kpis && kpis.revenueGrowth >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                        <span className={kpis && kpis.revenueGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                          {kpis?.revenueGrowth?.toFixed(1) || '0.0'}%
                        </span>
                        <span>vs período anterior</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* Orders KPI */}
            <Link to="/orders">
              <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid="card-orders">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  {kpisLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold" data-testid="text-total-orders-kpi">
                        {kpis?.totalOrders || 0}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        {kpis && kpis.ordersGrowth >= 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                        <span className={kpis && kpis.ordersGrowth >= 0 ? "text-green-600" : "text-red-600"}>
                          {kpis?.ordersGrowth?.toFixed(1) || '0.0'}%
                        </span>
                        <span>crescimento</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* Customers KPI */}
            <Link to="/customers">
              <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid="card-customers-kpi">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Novos Clientes</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  {kpisLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold" data-testid="text-total-customers-kpi">
                        {kpis?.totalCustomers || 0}
                      </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <span className="font-medium">Taxa de conversão: {kpis?.conversionRate?.toFixed(1) || '0.0'}%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            </Link>

            {/* Active Conversations KPI */}
            <Link to="/omnichat">
              <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid="card-active-conversations">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
                <MessageSquare className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {kpisLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <>
                    <div className="text-2xl font-bold" data-testid="text-active-conversations">
                      {kpis?.activeConversations || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Atendimentos em andamento
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
            </Link>
          </div>
        </div>
      </div>

      {/* Critical Alerts */}
      {kpis && (kpis.criticalAlerts.lowStockProducts > 0 || kpis.criticalAlerts.pendingPayments > 0 || kpis.criticalAlerts.criticsEscalations > 0) && (
        <div className="px-4 sm:px-6 lg:px-8 pb-6">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-lg font-semibold mb-4">🚨 Alertas Críticos</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {kpis.criticalAlerts.lowStockProducts > 0 && (
                <Link to="/inventory">
                  <Alert className="hover-elevate cursor-pointer border-orange-500/50" data-testid="alert-low-stock">
                    <PackageX className="h-4 w-4 text-orange-600" />
                    <AlertTitle>Estoque Baixo</AlertTitle>
                    <AlertDescription>
                      {kpis.criticalAlerts.lowStockProducts} produto(s) com estoque abaixo do mínimo
                    </AlertDescription>
                  </Alert>
                </Link>
              )}
              {kpis.criticalAlerts.pendingPayments > 0 && (
                <Link to="/payments">
                  <Alert className="hover-elevate cursor-pointer border-yellow-500/50" data-testid="alert-pending-payments">
                    <CreditCard className="h-4 w-4 text-yellow-600" />
                    <AlertTitle>Pagamentos Pendentes</AlertTitle>
                    <AlertDescription>
                      {kpis.criticalAlerts.pendingPayments} pagamento(s) aguardando confirmação
                    </AlertDescription>
                  </Alert>
                </Link>
              )}
              {kpis.criticalAlerts.criticsEscalations > 0 && (
                <Link to="/admin/ai-governance">
                  <Alert className="hover-elevate cursor-pointer border-red-500/50" data-testid="alert-critics-escalation">
                    <Brain className="h-4 w-4 text-red-600" />
                    <AlertTitle>Escalação de IA</AlertTitle>
                    <AlertDescription>
                      {kpis.criticalAlerts.criticsEscalations} decisão(ões) da IA requerem revisão humana
                    </AlertDescription>
                  </Alert>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sales Trend Chart */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Tendência de Vendas</CardTitle>
              <CardDescription>Receita e pedidos dos últimos 7 dias</CardDescription>
            </CardHeader>
            <CardContent>
              {kpisLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : kpis && kpis.salesTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={kpis.salesTrend}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10A37F" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10A37F" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10A37F"
                      fill="url(#colorRevenue)"
                      name="Receita (R$)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="orders"
                      stroke="#8B5CF6"
                      name="Pedidos"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  Sem dados de vendas para exibir
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Basic Stats Grid */}
      <div className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold mb-4">Visão Geral</h2>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Link key={stat.title} to={stat.link}>
                  <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid={`card-${stat.testId}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </CardTitle>
                      <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                    </CardHeader>
                    <CardContent>
                      {stat.loading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        <div className="text-2xl font-bold" data-testid={`stat-${stat.testId}`}>
                          {stat.value}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
