import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import {
  ShoppingCart,
  Users,
  MessageSquare,
  DollarSign,
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
      value: products?.length || 0,
      icon: ShoppingCart,
      loading: productsLoading,
      testId: "total-products",
    },
    {
      title: t('crm.customers'),
      value: customers?.length || 0,
      icon: Users,
      loading: customersLoading,
      testId: "total-customers",
    },
    {
      title: t('omnichat.conversations'),
      value: conversations?.filter((c: any) => c.status === "open").length || 0,
      icon: MessageSquare,
      loading: conversationsLoading,
      testId: "active-conversations",
    },
    {
      title: t('dashboard.metrics.orders'),
      value: orders?.length || 0,
      icon: DollarSign,
      loading: ordersLoading,
      testId: "total-orders",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold" data-testid="text-dashboard-title">
          {t('dashboard.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('dashboard.welcome')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover-elevate">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {stat.loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold" data-testid={`stat-${stat.testId}`}>
                    {stat.value}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
