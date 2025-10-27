import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertProductBundleSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Package, Plus, Pencil, Trash2, ShoppingBag, Percent } from "lucide-react";

type ProductBundle = {
  id: string;
  name: string;
  description: string | null;
  bundlePrice: string;
  discount: string;
  isActive: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
};

type Product = {
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
};

type BundleItem = {
  productId: string;
  quantity: number;
};

const formSchema = insertProductBundleSchema.extend({
  bundlePrice: z.string().min(1, "Preço do bundle é obrigatório"),
  discount: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ProductBundles() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<ProductBundle | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<BundleItem[]>([]);
  const [filterActive, setFilterActive] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      bundlePrice: "0",
      discount: "0",
      isActive: true,
    },
  });

  const { data: bundles, isLoading } = useQuery<ProductBundle[]>({
    queryKey: ["/api/product-bundles"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { bundle: FormValues; items: BundleItem[] }) => {
      return await apiRequest("POST", "/api/product-bundles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-bundles"] });
      toast({ title: "Bundle criado com sucesso" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar bundle", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormValues> }) => {
      return await apiRequest("PATCH", `/api/product-bundles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-bundles"] });
      toast({ title: "Bundle atualizado com sucesso" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar bundle", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/product-bundles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-bundles"] });
      toast({ title: "Bundle deletado com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao deletar bundle", description: error.message, variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingBundle(null);
    setSelectedProducts([]);
    form.reset();
  };

  const handleEdit = (bundle: ProductBundle) => {
    setEditingBundle(bundle);
    form.reset({
      name: bundle.name,
      description: bundle.description || "",
      bundlePrice: bundle.bundlePrice,
      discount: bundle.discount,
      isActive: bundle.isActive,
    });
  };

  const handleAddProduct = (productId: string) => {
    if (selectedProducts.find((p) => p.productId === productId)) {
      toast({ title: "Produto já adicionado ao bundle", variant: "destructive" });
      return;
    }
    setSelectedProducts([...selectedProducts, { productId, quantity: 1 }]);
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(selectedProducts.filter((p) => p.productId !== productId));
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.productId === productId ? { ...p, quantity: Math.max(1, quantity) } : p
      )
    );
  };

  const onSubmit = (data: FormValues) => {
    if (editingBundle) {
      updateMutation.mutate({ id: editingBundle.id, data });
    } else {
      if (selectedProducts.length === 0) {
        toast({ title: "Adicione pelo menos 1 produto ao bundle", variant: "destructive" });
        return;
      }
      createMutation.mutate({ bundle: data, items: selectedProducts });
    }
  };

  const filteredBundles = bundles?.filter((bundle) => {
    if (filterActive === "active") return bundle.isActive;
    if (filterActive === "inactive") return !bundle.isActive;
    return true;
  }) || [];

  const totalBundles = bundles?.length || 0;
  const activeBundles = bundles?.filter((b) => b.isActive).length || 0;
  const avgDiscount = bundles?.length
    ? bundles.reduce((sum, b) => sum + parseFloat(b.discount), 0) / bundles.length
    : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-bundles">
            Product Bundles
          </h1>
          <p className="text-muted-foreground">
            Gerencie pacotes de produtos com descontos
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-bundle">
          <Plus className="w-4 h-4" />
          Novo Bundle
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Bundles</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-total">{totalBundles}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bundles Ativos</CardTitle>
            <ShoppingBag className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-active">{activeBundles}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Desconto Médio</CardTitle>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-avg-discount">
              {avgDiscount.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inativos</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-inactive">
              {totalBundles - activeBundles}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Bundles</CardTitle>
              <CardDescription>Lista de todos os product bundles</CardDescription>
            </div>
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger className="w-40" data-testid="select-filter-active">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredBundles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum bundle encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBundles.map((bundle) => (
                  <TableRow key={bundle.id} data-testid={`row-bundle-${bundle.id}`}>
                    <TableCell className="font-medium" data-testid={`cell-name-${bundle.id}`}>
                      {bundle.name}
                    </TableCell>
                    <TableCell data-testid={`cell-price-${bundle.id}`}>
                      ${parseFloat(bundle.bundlePrice).toFixed(2)}
                    </TableCell>
                    <TableCell data-testid={`cell-discount-${bundle.id}`}>
                      {parseFloat(bundle.discount).toFixed(1)}%
                    </TableCell>
                    <TableCell data-testid={`cell-status-${bundle.id}`}>
                      <Badge variant={bundle.isActive ? "default" : "secondary"}>
                        {bundle.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(bundle)}
                          data-testid={`button-edit-${bundle.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja deletar este bundle?")) {
                              deleteMutation.mutate(bundle.id);
                            }
                          }}
                          data-testid={`button-delete-${bundle.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen || !!editingBundle} onOpenChange={(open) => {
        if (!open) handleCloseDialog();
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-bundle-form">
          <DialogHeader>
            <DialogTitle>
              {editingBundle ? "Editar Bundle" : "Novo Bundle"}
            </DialogTitle>
            <DialogDescription>
              {editingBundle ? "Atualize as informações do bundle" : "Crie um novo pacote de produtos"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Bundle *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Kit Iniciante" data-testid="input-name" />
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
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Descrição do bundle"
                        rows={2}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bundlePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preço do Bundle *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          data-testid="input-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Desconto (%)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || "0"}
                          type="number"
                          step="0.1"
                          placeholder="0"
                          data-testid="input-discount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Bundle Ativo</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Bundles ativos aparecem na loja
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!editingBundle && (
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Produtos no Bundle</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Adicione pelo menos 1 produto
                    </p>
                  </div>

                  <Select onValueChange={handleAddProduct}>
                    <SelectTrigger data-testid="select-add-product">
                      <SelectValue placeholder="Selecione um produto para adicionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - ${parseFloat(product.price).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedProducts.length > 0 && (
                    <div className="space-y-2">
                      {selectedProducts.map((item) => {
                        const product = products?.find((p) => p.id === item.productId);
                        return (
                          <div
                            key={item.productId}
                            className="flex items-center gap-4 p-3 border rounded"
                            data-testid={`bundle-item-${item.productId}`}
                          >
                            <div className="flex-1">
                              <p className="font-medium">{product?.name || "Produto"}</p>
                              <p className="text-sm text-muted-foreground">
                                ${product?.price || "0.00"}
                              </p>
                            </div>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateQuantity(item.productId, parseInt(e.target.value))
                              }
                              className="w-20"
                              data-testid={`input-quantity-${item.productId}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveProduct(item.productId)}
                              data-testid={`button-remove-${item.productId}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Salvando..."
                    : editingBundle
                    ? "Atualizar"
                    : "Criar Bundle"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
