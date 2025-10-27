import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  ShoppingCart, 
  Package, 
  Home as HomeIcon, 
  Car, 
  Briefcase,
  MapPin,
  Sparkles
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Product, type ProductVariantOption, type ProductVariantValue, type ProductVariant } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EaasLogo } from "@/components/eaas-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { SEO } from "@/components/seo";
import { ChatWidget } from "@/components/chat-widget";
import { WhatsAppWidget } from "@/components/whatsapp-widget";

const productTypeIcons = {
  product: Package,
  service: Briefcase,
  experience: Sparkles,
  real_estate: HomeIcon,
  vehicle: Car,
};

export default function Shop() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Check for active clone (Brand Scanner 2.0 Clone Mode)
  const { data: activeClone, isLoading: isLoadingClone } = useQuery<{ htmlBundle: string } | null>({
    queryKey: ['/api/brand/clones/active'],
  });

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: cart } = useQuery<any>({
    queryKey: ["/api/carts"],
  });

  const [, setLocation] = useLocation();

  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId?: string }) => {
      const currentItems = Array.isArray(cart?.items) ? cart.items as any[] : [];
      const existingItemIndex = currentItems.findIndex(
        (item) => item.productId === productId && item.variantId === variantId
      );
      
      // SECURE: Only send productId, variantId, and quantity - server calculates prices
      let newItems;
      if (existingItemIndex >= 0) {
        newItems = currentItems.map((item, index) => 
          index === existingItemIndex 
            ? { productId: item.productId, variantId: item.variantId, quantity: item.quantity + 1 }
            : { productId: item.productId, variantId: item.variantId, quantity: item.quantity }
        );
      } else {
        newItems = [...currentItems, { 
          productId, 
          variantId,
          quantity: 1
        }];
      }
      
      // Server recalculates total from actual product prices or variant prices
      if (cart?.id) {
        return apiRequest("PATCH", `/api/carts/${cart.id}`, { items: newItems });
      } else {
        return apiRequest("POST", "/api/carts", { items: newItems });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carts"] });
      toast({
        title: t('shop.addedToCart'),
        description: t('shop.addedToCartDesc'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('shop.addToCartError'),
        variant: "destructive",
      });
    },
  });

  // Buy Now mutation - adds to cart and redirects to checkout
  const buyNowMutation = useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId?: string }) => {
      const currentItems = Array.isArray(cart?.items) ? cart.items as any[] : [];
      const existingItemIndex = currentItems.findIndex(
        (item) => item.productId === productId && item.variantId === variantId
      );
      
      let newItems;
      if (existingItemIndex >= 0) {
        newItems = currentItems.map((item, index) => 
          index === existingItemIndex 
            ? { productId: item.productId, variantId: item.variantId, quantity: item.quantity + 1 }
            : { productId: item.productId, variantId: item.variantId, quantity: item.quantity }
        );
      } else {
        newItems = [...currentItems, { 
          productId, 
          variantId,
          quantity: 1
        }];
      }
      
      if (cart?.id) {
        return apiRequest("PATCH", `/api/carts/${cart.id}`, { items: newItems });
      } else {
        return apiRequest("POST", "/api/carts", { items: newItems });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carts"] });
      // Redirect to checkout immediately
      setLocation('/checkout');
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || "Erro ao processar compra",
        variant: "destructive",
      });
    },
  });

  // Filter only active products
  const activeProducts = products?.filter(p => p.isActive) || [];

  // Apply filters
  const filteredProducts = activeProducts.filter(product => {
    const matchesSearch = !searchQuery || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === "all" || product.type === selectedType;
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    
    return matchesSearch && matchesType && matchesCategory;
  });

  // Get unique categories
  const categories = Array.from(new Set(activeProducts.map(p => p.category).filter(Boolean)));

  // Calculate cart items
  const cartItems = Array.isArray(cart?.items) ? cart.items as any[] : [];
  const cartItemCount = cartItems.length;

  // Component for variant selection
  const ProductVariantSelector = ({ product }: { product: Product }) => {
    const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [dialogOpen, setDialogOpen] = useState(false);

    const { data: options } = useQuery<ProductVariantOption[]>({
      queryKey: ["/api/products", product.id, "variant-options"],
      enabled: dialogOpen,
    });

    const { data: allOptionValues } = useQuery<Record<string, ProductVariantValue[]>>({
      queryKey: ["/api/products", product.id, "all-option-values"],
      queryFn: async () => {
        if (!options || options.length === 0) return {};
        
        const valuesMap: Record<string, ProductVariantValue[]> = {};
        for (const option of options) {
          const response = await fetch(`/api/variant-options/${option.id}/values`);
          if (response.ok) {
            valuesMap[option.id] = await response.json();
          } else {
            valuesMap[option.id] = [];
          }
        }
        return valuesMap;
      },
      enabled: !!options && options.length > 0,
    });

    const { data: variants } = useQuery<ProductVariant[]>({
      queryKey: ["/api/products", product.id, "variants"],
      enabled: dialogOpen,
    });

    const handleAddToCart = () => {
      if (!selectedVariantId && options && options.length > 0) {
        toast({
          title: "Selecione as opções",
          description: "Por favor, selecione todas as opções do produto antes de adicionar ao carrinho.",
          variant: "destructive",
        });
        return;
      }

      addToCartMutation.mutate({ productId: product.id, variantId: selectedVariantId });
      setDialogOpen(false);
      setSelectedOptions({});
      setSelectedVariantId(undefined);
    };

    const handleBuyNow = () => {
      if (!selectedVariantId && options && options.length > 0) {
        toast({
          title: "Selecione as opções",
          description: "Por favor, selecione todas as opções do produto antes de comprar.",
          variant: "destructive",
        });
        return;
      }

      buyNowMutation.mutate({ productId: product.id, variantId: selectedVariantId });
      setDialogOpen(false);
      setSelectedOptions({});
      setSelectedVariantId(undefined);
    };

    const activeVariants = variants?.filter(v => v.isActive) || [];
    const hasVariants = activeVariants.length > 0;

    const selectedVariant = selectedVariantId 
      ? activeVariants.find(v => v.id === selectedVariantId)
      : undefined;

    const displayPrice = selectedVariant?.price || product.price;
    const displayInventory = selectedVariant 
      ? selectedVariant.inventory 
      : product.inventory;

    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            className="flex-1" 
            disabled={addToCartMutation.isPending}
            data-testid={`button-add-to-cart-${product.id}`}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {t('shop.addToCart')}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {hasVariants && options && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Selecione as opções:</p>
                {options.map((option) => {
                  const values = allOptionValues?.[option.id] || [];
                  return (
                    <div key={option.id} className="space-y-2">
                      <label className="text-sm font-medium">{option.name}</label>
                      <Select
                        value={selectedOptions[option.name] || ""}
                        onValueChange={(value) => {
                          const newOptions = { ...selectedOptions, [option.name]: value };
                          setSelectedOptions(newOptions);

                          const matchingVariant = activeVariants.find(v => {
                            const variantValues = v.variantValues as any;
                            return options.every(opt => {
                              return variantValues?.[opt.name] === newOptions[opt.name];
                            });
                          });

                          setSelectedVariantId(matchingVariant?.id);
                        }}
                      >
                        <SelectTrigger data-testid={`select-variant-${option.id}`}>
                          <SelectValue placeholder={`Selecione ${option.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {values.map((val) => (
                            <SelectItem key={val.id} value={val.value}>
                              {val.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-primary">R$ {displayPrice}</span>
              </div>
              {displayInventory !== null && displayInventory !== undefined && (
                <div className="text-sm">
                  {displayInventory > 0 ? (
                    <span className="text-green-600 dark:text-green-400">
                      {displayInventory} {t('shop.inStock')}
                    </span>
                  ) : (
                    <span className="text-destructive">{t('shop.outOfStock')}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline"
                className="flex-1" 
                onClick={handleAddToCart}
                disabled={
                  addToCartMutation.isPending ||
                  (displayInventory !== null && displayInventory <= 0) ||
                  (hasVariants && !selectedVariantId)
                }
                data-testid="button-confirm-add-to-cart"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                {addToCartMutation.isPending ? t('common.adding') : t('shop.addToCart')}
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleBuyNow}
                disabled={
                  buyNowMutation.isPending ||
                  (displayInventory !== null && displayInventory <= 0) ||
                  (hasVariants && !selectedVariantId)
                }
                data-testid="button-buy-now"
              >
                {buyNowMutation.isPending ? t('common.processing') : 'Comprar Agora'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const renderProductCard = (product: Product) => {
    const Icon = productTypeIcons[product.type];
    
    return (
      <Card key={product.id} className="hover-elevate flex flex-col" data-testid={`card-shop-product-${product.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-xl flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              <span className="line-clamp-1">{product.name}</span>
            </CardTitle>
          </div>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              {product.type === 'product' && t('marketplace.types.product')}
              {product.type === 'service' && t('marketplace.types.service')}
              {product.type === 'experience' && t('marketplace.types.experience')}
              {product.type === 'real_estate' && t('marketplace.types.realEstate')}
              {product.type === 'vehicle' && t('marketplace.types.vehicle')}
            </Badge>
            {product.category && (
              <Badge variant="secondary" className="text-xs">
                {product.category}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {product.description || t('marketplace.noDescription')}
          </p>
          
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary" data-testid={`text-shop-price-${product.id}`}>
                R$ {product.price}
              </span>
            </div>
            
            {product.inventory !== null && product.inventory !== undefined && (
              <div className="text-sm text-muted-foreground">
                {product.inventory > 0 ? (
                  <span className="text-green-600 dark:text-green-400">
                    {product.inventory} {t('shop.inStock')}
                  </span>
                ) : (
                  <span className="text-destructive">
                    {t('shop.outOfStock')}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <ProductVariantSelector product={product} />
          <Button 
            variant="outline"
            data-testid={`button-view-details-${product.id}`}
          >
            {t('shop.viewDetails')}
          </Button>
        </CardFooter>
      </Card>
    );
  };

  const [, navigate] = useLocation();

  // CLONE MODE: If active clone exists, render it instead of native shop
  if (isLoadingClone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  if (activeClone?.htmlBundle) {
    return (
      <>
        <SEO
          title="Marketplace - EAAS | Browse Products & Services"
          description="Explore our universal marketplace with products, services, tours, experiences, real estate, and vehicles. Powered by AI-driven recommendations and secure checkout."
          keywords="marketplace, online store, products, services, e-commerce, buy online, shop, ai marketplace"
          canonical="https://eaas.com/shop"
          ogTitle="EAAS Marketplace - Everything You Need"
          ogDescription="Universal marketplace platform with AI-powered shopping experience"
        />
        <div 
          className="min-h-screen"
          dangerouslySetInnerHTML={{ __html: activeClone.htmlBundle }}
          data-testid="clone-rendered-html"
        />
        <WhatsAppWidget />
      </>
    );
  }

  // NATIVE SHOP MODE: Render default EAAS marketplace
  return (
    <>
      <SEO
        title="Marketplace - EAAS | Browse Products & Services"
        description="Explore our universal marketplace with products, services, tours, experiences, real estate, and vehicles. Powered by AI-driven recommendations and secure checkout."
        keywords="marketplace, online store, products, services, e-commerce, buy online, shop, ai marketplace"
        canonical="https://eaas.com/shop"
        ogTitle="EAAS Marketplace - Everything You Need"
        ogDescription="Universal marketplace platform with AI-powered shopping experience"
      />
      <div className="min-h-screen bg-background">
      {/* Premium Header */}
      <header className="border-b sticky top-0 bg-background/80 backdrop-blur-lg z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="cursor-pointer" onClick={() => navigate("/")}>
                <EaasLogo size="md" variant="full" />
              </div>
              <Button variant="ghost" onClick={() => navigate("/shop")} data-testid="button-nav-shop">
                <ShoppingCart className="mr-2 h-4 w-4" />
                {t('shop.title')}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {!user && (
                <>
                  <Button 
                    variant="ghost" 
                    onClick={() => navigate("/login")}
                    data-testid="button-shop-login"
                  >
                    Entrar
                  </Button>
                  <Button 
                    variant="default" 
                    onClick={() => navigate("/register/customer")}
                    data-testid="button-shop-register"
                  >
                    Criar Conta
                  </Button>
                </>
              )}
              <ThemeToggle />
              <Button 
                variant="outline" 
                onClick={() => navigate("/cart")}
                className="relative min-h-11"
                data-testid="button-header-cart"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t('cart.title')}
                {cartItemCount > 0 && (
                  <Badge className="ml-2 px-2 py-0.5 text-xs" data-testid="badge-cart-count">
                    {cartItemCount}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Premium Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50/50 via-purple-50/30 to-blue-50/50 dark:from-emerald-950/20 dark:via-purple-950/10 dark:to-blue-950/20 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
              <span className="text-sm font-medium">Marketplace Público</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight" data-testid="text-shop-title">
              <span className="bg-gradient-to-r from-emerald-600 via-purple-600 to-blue-600 bg-clip-text text-transparent dark:from-emerald-500 dark:via-purple-500 dark:to-blue-500">
                {t('shop.title')}
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground">
              {t('shop.subtitle')}
            </p>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Filters Section */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('shop.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-shop-search"
            />
          </div>
          
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full md:w-48" data-testid="select-type-filter">
              <SelectValue placeholder={t('shop.filterByType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('shop.allTypes')}</SelectItem>
              <SelectItem value="product">{t('marketplace.types.product')}</SelectItem>
              <SelectItem value="service">{t('marketplace.types.service')}</SelectItem>
              <SelectItem value="experience">{t('marketplace.types.experience')}</SelectItem>
              <SelectItem value="real_estate">{t('marketplace.types.realEstate')}</SelectItem>
              <SelectItem value="vehicle">{t('marketplace.types.vehicle')}</SelectItem>
            </SelectContent>
          </Select>

          {categories.length > 0 && (
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-category-filter">
                <SelectValue placeholder={t('shop.filterByCategory')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('shop.allCategories')}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category!}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-24 w-full mb-4" />
                  <Skeleton className="h-8 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              {t('shop.productsFound', { count: filteredProducts.length })}
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map(renderProductCard)}
            </div>
          </>
        ) : (
          <Card className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-2xl font-semibold mb-2">
              {searchQuery || selectedType !== "all" || selectedCategory !== "all" 
                ? t('shop.noResultsFound') 
                : t('shop.noProducts')}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              {searchQuery || selectedType !== "all" || selectedCategory !== "all"
                ? t('shop.tryDifferentFilters')
                : t('shop.noProductsDesc')}
            </p>
          </Card>
        )}
      </div>
    </div>
    
    {/* AI Chat Widget */}
    <ChatWidget />
    
    {/* WhatsApp Widget */}
    <WhatsAppWidget />
    </>
  );
}
