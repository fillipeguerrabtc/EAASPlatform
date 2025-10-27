import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Calendar,
  DollarSign,
  User,
  ShoppingBag,
} from "lucide-react";
import { format } from "date-fns";
import { SEO } from "@/components/seo";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { PaginationControls } from "@/components/ui/pagination-controls";

export default function OrdersPage() {
  const { t } = useTranslation();

  const {
    data: orders,
    pagination,
    isLoading,
    page,
    pageSize,
    search,
    setPage,
    setPageSize,
    setSearch,
    hasNextPage,
    hasPrevPage,
  } = usePaginatedQuery<any>(["/api/orders"], "/api/orders", {
    initialPageSize: 10,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      case "pending":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Concluído";
      case "pending":
        return "Pendente";
      case "cancelled":
        return "Cancelado";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-6 border-b">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex flex-wrap items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl">
                  <ShoppingBag className="h-8 w-8 text-amber-600 dark:text-amber-500" />
                </div>
                Pedidos
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                Gerencie todos os pedidos do marketplace
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-sm font-medium">
                {pagination ? `${pagination.totalCount} ${pagination.totalCount === 1 ? 'pedido' : 'pedidos'}` : '0 pedidos'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card>
            <CardContent className="pt-6">
              <PaginationControls
                pagination={pagination}
                page={page}
                pageSize={pageSize}
                search={search}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onSearchChange={setSearch}
                hasNextPage={hasNextPage}
                hasPrevPage={hasPrevPage}
                showSearch={false}
              />
            </CardContent>
          </Card>
          
          {isLoading ? (
            <div className="grid gap-4 sm:gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-40" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !Array.isArray(orders) || orders.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-muted rounded-full">
                  <Package className="h-12 w-12 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Nenhum pedido encontrado</h3>
                  <p className="text-muted-foreground">
                    Os pedidos dos clientes aparecerão aqui
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 sm:gap-6">
              {orders.map((order: any) => (
                <Card 
                  key={order.id} 
                  className="group hover-elevate transition-all duration-300 overflow-hidden"
                  data-testid={`card-order-${order.id}`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full" />
                  
                  <CardHeader>
                    <div className="flex flex-wrap flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base sm:text-lg" data-testid={`text-order-id-${order.id}`}>
                            Pedido #{order.id.slice(0, 8)}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {order.customerId}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        className={`${getStatusColor(order.status)} border-2 font-medium`}
                        data-testid={`badge-status-${order.id}`}
                      >
                        {getStatusLabel(order.status)}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-lg font-bold" data-testid={`text-order-total-${order.id}`}>
                            R$ {parseFloat(order.total || "0").toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Data</p>
                          <p className="text-sm font-medium">
                            {order.createdAt ? format(new Date(order.createdAt), "dd/MM/yyyy") : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <User className="h-5 w-5 text-purple-600 dark:text-purple-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Cliente</p>
                          <p className="text-sm font-medium truncate">
                            {order.customerId.slice(0, 12)}...
                          </p>
                        </div>
                      </div>
                    </div>

                    {order.items && Array.isArray(order.items) && order.items.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Itens do pedido:</p>
                        <div className="space-y-2">
                          {order.items.map((item: any, idx: number) => (
                            <div 
                              key={idx}
                              className="flex flex-wrap items-center justify-between gap-2 text-sm p-2 bg-muted/30 rounded-md"
                            >
                              <span className="font-medium">{item.productId}</span>
                              <span className="text-muted-foreground">
                                Qtd: {item.quantity} × R$ {item.price}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
