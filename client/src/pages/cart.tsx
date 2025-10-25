import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Trash2, Package, ArrowLeft, CreditCard } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Cart, type Product } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { useEffect } from "react";
import { EaasLogo } from "@/components/eaas-logo";
import { ThemeToggle } from "@/components/theme-toggle";

interface CartItem {
  productId: string;
  quantity: number;
  price?: string; // Server-provided, never sent from client
}

export default function CartPage() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, navigate] = useLocation();

  const { data: cart } = useQuery<Cart>({
    queryKey: ["/api/carts"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const updateCartMutation = useMutation({
    mutationFn: async (items: CartItem[]) => {
      // SECURE: Server recalculates total from actual product prices
      return apiRequest("PATCH", `/api/carts/${cart?.id}`, { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carts"] });
      toast({
        title: t('cart.cartUpdated'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cartItems: CartItem[] = Array.isArray(cart?.items) ? cart.items as CartItem[] : [];
  
  const cartWithProducts = cartItems.map(item => {
    const product = products?.find(p => p.id === item.productId);
    return { ...item, product };
  }).filter(item => item.product);

  const handleRemoveItem = (productId: string) => {
    // SECURE: Only send productId and quantity
    const newItems = cartItems
      .filter(item => item.productId !== productId)
      .map(item => ({ productId: item.productId, quantity: item.quantity }));
    updateCartMutation.mutate(newItems);
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    // SECURE: Only send productId and quantity - no price
    const newItems = cartItems.map(item => ({
      productId: item.productId,
      quantity: item.productId === productId ? newQuantity : item.quantity
    }));
    updateCartMutation.mutate(newItems);
  };

  const handleCheckout = async () => {
    if (!cart || cartItems.length === 0) return;

    try {
      // SECURE: Server validates cart and recalculates total from actual product prices
      const response = await apiRequest("POST", "/api/create-checkout-session", {});

      if (response.url) {
        window.location.href = response.url;
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message || t('checkout.sessionError'),
        variant: "destructive",
      });
    }
  };

  const subtotal = parseFloat(cart?.total || "0");

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-lg z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="cursor-pointer" onClick={() => navigate("/")}>
              <EaasLogo size="md" variant="full" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ThemeToggle />
              <Button 
                variant="ghost" 
                onClick={() => navigate("/shop")}
                data-testid="button-header-shop"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Marketplace
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Premium Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-emerald-50/50 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-emerald-950/20 border rounded-xl mb-8">
          <div className="p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
              <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-500" />
              <span className="text-sm font-medium">Meu Carrinho</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2" data-testid="text-cart-title">
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent dark:from-blue-500 dark:via-purple-500 dark:to-emerald-500">
                {t('cart.title')}
              </span>
            </h1>
            <p className="text-muted-foreground">
              {t('cart.subtitle')}
            </p>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent pointer-events-none rounded-xl" />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6">

            {!cart || !products ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : cartWithProducts.length > 0 ? (
              <div className="space-y-4">
                {cartWithProducts.map((item) => (
                  <Card key={item.productId} data-testid={`card-cart-item-${item.productId}`}>
                    <CardContent className="p-6">
                      <div className="flex gap-6">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold mb-2">
                            {item.product!.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                            {item.product!.description}
                          </p>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <label className="text-sm text-muted-foreground">
                                {t('cart.quantity')}:
                              </label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newQty = parseInt(e.target.value);
                                  if (newQty > 0) {
                                    handleUpdateQuantity(item.productId, newQty);
                                  }
                                }}
                                className="w-20"
                                data-testid={`input-quantity-${item.productId}`}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end justify-between">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.productId)}
                            disabled={updateCartMutation.isPending}
                            data-testid={`button-remove-${item.productId}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">
                              R$ {item.product!.price} x {item.quantity}
                            </div>
                            <div className="text-2xl font-bold" data-testid={`text-item-total-${item.productId}`}>
                              R$ {(parseFloat(item.product!.price) * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-2xl font-semibold mb-2">{t('cart.empty')}</h3>
                <p className="text-muted-foreground mb-6">
                  {t('cart.emptyDesc')}
                </p>
                <Button onClick={() => navigate("/shop")} data-testid="button-continue-shopping-empty">
                  <Package className="mr-2 h-4 w-4" />
                  {t('cart.continueShopping')}
                </Button>
              </Card>
            )}
          </div>

          {/* Order Summary - Premium */}
          {cartWithProducts.length > 0 && (
            <div className="lg:col-span-1">
              <Card className="sticky top-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-purple-500/5 to-blue-500/5" />
                <CardHeader className="relative">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/10 to-purple-500/10">
                      <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                    </div>
                    <CardTitle>{t('checkout.title')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 relative">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      {cartItems.length} {cartItems.length === 1 ? 'item' : t('cart.items')}
                    </span>
                  </div>
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">{t('cart.subtotal')}</span>
                      <span className="font-medium" data-testid="text-subtotal">R$ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xl font-bold pt-2 border-t">
                      <span>{t('cart.total')}</span>
                      <span className="text-emerald-600 dark:text-emerald-500" data-testid="text-total">
                        R$ {subtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-3 text-center">
                      {t('checkout.testModeNote')}
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="relative">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleCheckout}
                    data-testid="button-proceed-checkout"
                  >
                    <CreditCard className="mr-2 h-5 w-5" />
                    {t('cart.proceedToCheckout')}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
