import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Clock, MessageCircle, User, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function CustomerArea() {
  const { t } = useTranslation();

  const { data: orders, isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["/api/orders"],
  });

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="title-customer-area">
              {t('customerArea.title', 'Minha Conta')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {user?.email}
            </p>
          </div>
          <Button variant="outline" data-testid="button-edit-profile">
            <User className="w-4 h-4 mr-2" />
            {t('customerArea.editProfile', 'Editar Perfil')}
          </Button>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList>
            <TabsTrigger value="orders" data-testid="tab-orders">
              <Package className="w-4 h-4 mr-2" />
              {t('customerArea.myOrders', 'Meus Pedidos')}
            </TabsTrigger>
            <TabsTrigger value="cart" data-testid="tab-cart">
              <ShoppingCart className="w-4 h-4 mr-2" />
              {t('customerArea.cart', 'Carrinho')}
            </TabsTrigger>
            <TabsTrigger value="support" data-testid="tab-support">
              <MessageCircle className="w-4 h-4 mr-2" />
              {t('customerArea.support', 'Suporte 24/7')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <div className="grid gap-4">
              {ordersLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <p className="text-muted-foreground">{t('common.loading', 'Carregando...')}</p>
                  </CardContent>
                </Card>
              ) : orders && orders.length > 0 ? (
                orders.map((order) => (
                  <Card key={order.id} data-testid={`card-order-${order.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {t('customerArea.orderNumber', 'Pedido #{{number}}', { number: order.id.slice(0, 8) })}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3" />
                            {new Date(order.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={order.status === 'completed' ? 'default' : 'secondary'}
                            data-testid={`badge-status-${order.id}`}
                          >
                            {order.status}
                          </Badge>
                          <p className="text-lg font-bold mt-1" data-testid={`text-total-${order.id}`}>
                            R$ {order.total}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.productName} x {item.quantity}</span>
                            <span className="text-muted-foreground">R$ {item.price}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4">
                        <Button variant="outline" size="sm" data-testid={`button-track-${order.id}`}>
                          {t('customerArea.trackOrder', 'Rastrear Pedido')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {t('customerArea.noOrders', 'Você ainda não tem pedidos')}
                    </p>
                    <Button className="mt-4" data-testid="button-shop-now">
                      {t('customerArea.shopNow', 'Começar a Comprar')}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="cart">
            <Card>
              <CardHeader>
                <CardTitle>{t('customerArea.shoppingCart', 'Carrinho de Compras')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('customerArea.cartEmpty', 'Seu carrinho está vazio')}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support">
            <Card>
              <CardHeader>
                <CardTitle>{t('customerArea.support247', 'Suporte 24/7')}</CardTitle>
                <CardDescription>
                  {t('customerArea.supportDescription', 'Nossa equipe está sempre disponível para ajudar você')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button className="w-full" data-testid="button-start-chat">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    {t('customerArea.startChat', 'Iniciar Chat com IA')}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    {t('customerArea.responseTime', 'Tempo de resposta: instantâneo')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
