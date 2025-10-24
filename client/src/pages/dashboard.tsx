import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart,
  Users,
  MessageSquare,
  DollarSign,
} from "lucide-react";

export default function Dashboard() {
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
      title: "Total Products",
      value: products?.length || 0,
      icon: ShoppingCart,
      loading: productsLoading,
    },
    {
      title: "Total Customers",
      value: customers?.length || 0,
      icon: Users,
      loading: customersLoading,
    },
    {
      title: "Active Conversations",
      value: conversations?.filter((c: any) => c.status === "open").length || 0,
      icon: MessageSquare,
      loading: conversationsLoading,
    },
    {
      title: "Total Orders",
      value: orders?.length || 0,
      icon: DollarSign,
      loading: ordersLoading,
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold" data-testid="text-dashboard-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Welcome to your EAAS control center
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
                  <div className="text-3xl font-bold" data-testid={`stat-${stat.title.toLowerCase().replace(" ", "-")}`}>
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
