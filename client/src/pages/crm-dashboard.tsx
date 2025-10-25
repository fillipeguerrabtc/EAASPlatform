import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Users,
  Target,
  Activity,
  DollarSign,
} from "lucide-react";
import type { Deal, Customer, Activity as ActivityType } from "@shared/schema";

export default function CRMDashboard() {
  const { data: deals, isLoading: dealsLoading } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: customers, isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<ActivityType[]>({
    queryKey: ["/api/activities"],
  });

  // Calculate metrics
  const totalCustomers = customers?.length || 0;
  const totalDeals = deals?.length || 0;
  const pipelineValue = deals?.reduce((sum, deal) => sum + parseFloat(deal.value), 0) || 0;
  const wonDeals = deals?.filter(d => d.actualCloseDate)?.length || 0;
  const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

  const metrics = [
    {
      title: "Total de Clientes",
      value: totalCustomers,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Negócios Ativos",
      value: totalDeals,
      icon: Target,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Valor do Pipeline",
      value: `R$ ${pipelineValue.toFixed(2)}`,
      icon: DollarSign,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      title: "Taxa de Conversão",
      value: `${winRate}%`,
      icon: TrendingUp,
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
  ];

  return (
    <div className="p-6 space-y-6" data-testid="page-crm-dashboard">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">
          Dashboard CRM
        </h1>
        <p className="text-muted-foreground" data-testid="text-dashboard-description">
          Visão geral do seu pipeline de vendas e clientes
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <Card key={index} data-testid={`card-metric-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium" data-testid={`text-metric-title-${index}`}>
                {metric.title}
              </CardTitle>
              <div className={`${metric.bgColor} p-2 rounded-lg`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-metric-value-${index}`}>
                {dealsLoading || customersLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  metric.value
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activities */}
      <Card data-testid="card-recent-activities">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Atividades Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activitiesLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="space-y-4">
              {activities.slice(0, 5).map((activity, index) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 pb-3 border-b last:border-0"
                  data-testid={`activity-item-${index}`}
                >
                  <div className={`p-2 rounded-lg bg-muted`}>
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium" data-testid={`activity-title-${index}`}>
                      {activity.title}
                    </p>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground" data-testid={`activity-description-${index}`}>
                        {activity.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full bg-muted"
                    data-testid={`activity-type-${index}`}
                  >
                    {activity.type}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-activities">
              Nenhuma atividade registrada
            </p>
          )}
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card data-testid="card-top-customers">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Principais Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customersLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : customers && customers.length > 0 ? (
            <div className="space-y-4">
              {customers
                .sort((a, b) => parseFloat(b.lifetimeValue) - parseFloat(a.lifetimeValue))
                .slice(0, 5)
                .map((customer, index) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between pb-3 border-b last:border-0"
                    data-testid={`customer-item-${index}`}
                  >
                    <div>
                      <p className="font-medium" data-testid={`customer-name-${index}`}>
                        {customer.name}
                      </p>
                      <p className="text-sm text-muted-foreground">{customer.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold" data-testid={`customer-value-${index}`}>
                        R$ {parseFloat(customer.lifetimeValue).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {customer.lifecycleStage}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8" data-testid="text-no-customers">
              Nenhum cliente cadastrado
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
