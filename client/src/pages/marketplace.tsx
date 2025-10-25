import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Package } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type Product } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";

const productFormSchema = insertProductSchema.extend({
  price: z.string().min(1, "Price is required"),
  inventory: z.string().optional(),
}).omit({ tenantId: true });

type ProductFormData = z.infer<typeof productFormSchema>;

export default function Marketplace() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      type: "product",
      category: "",
      inventory: "",
      isActive: true,
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const payload = {
        ...data,
        price: data.price,
        inventory: data.inventory ? parseInt(data.inventory) : null,
      };
      return apiRequest("POST", "/api/products", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setOpen(false);
      form.reset();
      toast({
        title: t('common.success'),
        description: t('marketplace.createSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('marketplace.createError'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProductFormData) => {
    createProductMutation.mutate(data);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold" data-testid="text-marketplace-title">
            {t('marketplace.title')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('marketplace.subtitle')}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-product">
              <Plus className="mr-2 h-4 w-4" /> {t('marketplace.addProduct')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('marketplace.addProduct')}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('marketplace.productNamePlaceholder')} data-testid="input-product-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.description')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('marketplace.descriptionPlaceholder')} data-testid="input-product-description" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('marketplace.type')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-product-type">
                              <SelectValue placeholder={t('marketplace.selectType')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="product">{t('marketplace.types.product')}</SelectItem>
                            <SelectItem value="service">{t('marketplace.types.service')}</SelectItem>
                            <SelectItem value="experience">{t('marketplace.types.experience')}</SelectItem>
                            <SelectItem value="real_estate">{t('marketplace.types.realEstate')}</SelectItem>
                            <SelectItem value="vehicle">{t('marketplace.types.vehicle')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('marketplace.category')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('marketplace.categoryPlaceholder')} data-testid="input-product-category" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('marketplace.price')}</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" data-testid="input-product-price" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="inventory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('marketplace.inventory')}</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder={t('marketplace.stockPlaceholder')} data-testid="input-product-inventory" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-product">
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={createProductMutation.isPending} data-testid="button-submit-product">
                    {createProductMutation.isPending ? t('common.creating') : t('marketplace.addProduct')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="hover-elevate" data-testid={`card-product-${product.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {product.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description || t('marketplace.noDescription')}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-2xl font-bold" data-testid={`text-price-${product.id}`}>
                    R$ {product.price}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {product.type === 'product' && t('marketplace.types.product')}
                    {product.type === 'service' && t('marketplace.types.service')}
                    {product.type === 'experience' && t('marketplace.types.experience')}
                    {product.type === 'real_estate' && t('marketplace.types.realEstate')}
                    {product.type === 'vehicle' && t('marketplace.types.vehicle')}
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full" data-testid={`button-view-product-${product.id}`}>
                  {t('marketplace.viewDetails')}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('marketplace.noProducts')}</h3>
          <p className="text-muted-foreground mb-4">
            {t('marketplace.getStarted')}
          </p>
          <Button onClick={() => setOpen(true)} data-testid="button-create-first-product">
            <Plus className="mr-2 h-4 w-4" /> {t('marketplace.addProduct')}
          </Button>
        </Card>
      )}
    </div>
  );
}
