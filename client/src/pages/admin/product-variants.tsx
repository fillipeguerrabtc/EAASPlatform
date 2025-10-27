import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  insertProductVariantOptionSchema, 
  insertProductVariantValueSchema,
  insertProductVariantSchema 
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Plus, 
  Pencil, 
  Trash2, 
  Tag, 
  FileText,
  Palette
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  price: string;
  imageUrl: string | null;
};

type VariantOption = {
  id: string;
  productId: string;
  name: string;
  displayOrder: number;
};

type VariantValue = {
  id: string;
  optionId: string;
  value: string;
  displayOrder: number;
};

type ProductVariant = {
  id: string;
  productId: string;
  sku: string;
  variantValues: any;
  price: string | null;
  inventory: number;
  images: string[] | null;
  isActive: boolean;
};

const optionFormSchema = insertProductVariantOptionSchema.omit({ productId: true });
const valueFormSchema = insertProductVariantValueSchema.omit({ optionId: true });
const variantFormSchema = insertProductVariantSchema.omit({ productId: true }).extend({
  price: z.string().optional(),
});

type OptionFormValues = z.infer<typeof optionFormSchema>;
type ValueFormValues = z.infer<typeof valueFormSchema>;
type VariantFormValues = z.infer<typeof variantFormSchema>;

export default function ProductVariants() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [isValueDialogOpen, setIsValueDialogOpen] = useState(false);
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<VariantOption | null>(null);
  const [editingValue, setEditingValue] = useState<VariantValue | null>(null);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [selectedOptionForValue, setSelectedOptionForValue] = useState<string | null>(null);

  const optionForm = useForm<OptionFormValues>({
    resolver: zodResolver(optionFormSchema),
    defaultValues: {
      name: "",
      displayOrder: 0,
    },
  });

  const valueForm = useForm<ValueFormValues>({
    resolver: zodResolver(valueFormSchema),
    defaultValues: {
      value: "",
      displayOrder: 0,
    },
  });

  const variantForm = useForm<VariantFormValues>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: {
      sku: "",
      variantValues: {},
      price: "",
      inventory: 0,
      images: [],
      isActive: true,
    },
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: options } = useQuery<VariantOption[]>({
    queryKey: ["/api/products", selectedProduct, "variant-options"],
    enabled: !!selectedProduct,
  });

  // Load all values for all options to build variant combinations
  const allOptionValues = useQuery<Record<string, VariantValue[]>>({
    queryKey: ["/api/products", selectedProduct, "all-option-values"],
    queryFn: async () => {
      if (!options || options.length === 0) return {};
      
      const valuesMap: Record<string, VariantValue[]> = {};
      
      for (const option of options) {
        const response = await fetch(`/api/variant-options/${option.id}/values`);
        if (response.ok) {
          const values = await response.json();
          valuesMap[option.id] = values;
        } else {
          valuesMap[option.id] = [];
        }
      }
      
      return valuesMap;
    },
    enabled: !!options && options.length > 0,
  });

  const { data: variants } = useQuery<ProductVariant[]>({
    queryKey: ["/api/products", selectedProduct, "variants"],
    enabled: !!selectedProduct,
  });

  const createOptionMutation = useMutation({
    mutationFn: async (data: OptionFormValues) => {
      return await apiRequest("POST", `/api/products/${selectedProduct}/variant-options`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", selectedProduct, "variant-options"] });
      toast({ title: "Opção criada com sucesso" });
      handleCloseOptionDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar opção", description: error.message, variant: "destructive" });
    },
  });

  const updateOptionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<OptionFormValues> }) => {
      return await apiRequest("PATCH", `/api/variant-options/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", selectedProduct, "variant-options"] });
      toast({ title: "Opção atualizada com sucesso" });
      handleCloseOptionDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar opção", description: error.message, variant: "destructive" });
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/variant-options/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", selectedProduct, "variant-options"] });
      toast({ title: "Opção excluída com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir opção", description: error.message, variant: "destructive" });
    },
  });

  const createValueMutation = useMutation({
    mutationFn: async ({ optionId, data }: { optionId: string; data: ValueFormValues }) => {
      return await apiRequest("POST", `/api/variant-options/${optionId}/values`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/variant-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/variant-options", variables.optionId, "values"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products", selectedProduct, "all-option-values"] });
      toast({ title: "Valor criado com sucesso" });
      handleCloseValueDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar valor", description: error.message, variant: "destructive" });
    },
  });

  const updateValueMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ValueFormValues> }) => {
      return await apiRequest("PATCH", `/api/variant-values/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variant-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products", selectedProduct, "all-option-values"] });
      toast({ title: "Valor atualizado com sucesso" });
      handleCloseValueDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar valor", description: error.message, variant: "destructive" });
    },
  });

  const deleteValueMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/variant-values/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/variant-options"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products", selectedProduct, "all-option-values"] });
      toast({ title: "Valor excluído com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir valor", description: error.message, variant: "destructive" });
    },
  });

  const createVariantMutation = useMutation({
    mutationFn: async (data: VariantFormValues) => {
      return await apiRequest("POST", `/api/products/${selectedProduct}/variants`, {
        ...data,
        price: data.price || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", selectedProduct, "variants"] });
      toast({ title: "Variante criada com sucesso" });
      handleCloseVariantDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar variante", description: error.message, variant: "destructive" });
    },
  });

  const updateVariantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<VariantFormValues> }) => {
      return await apiRequest("PATCH", `/api/variants/${id}`, {
        ...data,
        price: data.price || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", selectedProduct, "variants"] });
      toast({ title: "Variante atualizada com sucesso" });
      handleCloseVariantDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar variante", description: error.message, variant: "destructive" });
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/variants/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", selectedProduct, "variants"] });
      toast({ title: "Variante excluída com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir variante", description: error.message, variant: "destructive" });
    },
  });

  const handleCloseOptionDialog = () => {
    setIsOptionDialogOpen(false);
    setEditingOption(null);
    optionForm.reset();
  };

  const handleCloseValueDialog = () => {
    setIsValueDialogOpen(false);
    setEditingValue(null);
    setSelectedOptionForValue(null);
    valueForm.reset();
  };

  const handleCloseVariantDialog = () => {
    setIsVariantDialogOpen(false);
    setEditingVariant(null);
    variantForm.reset();
  };

  const handleOpenOptionDialog = (option?: VariantOption) => {
    if (option) {
      setEditingOption(option);
      optionForm.reset({
        name: option.name,
        displayOrder: option.displayOrder,
      });
    } else {
      setEditingOption(null);
      optionForm.reset();
    }
    setIsOptionDialogOpen(true);
  };

  const handleOpenValueDialog = (optionId: string, value?: VariantValue) => {
    setSelectedOptionForValue(optionId);
    if (value) {
      setEditingValue(value);
      valueForm.reset({
        value: value.value,
        displayOrder: value.displayOrder,
      });
    } else {
      setEditingValue(null);
      valueForm.reset();
    }
    setIsValueDialogOpen(true);
  };

  const handleOpenVariantDialog = (variant?: ProductVariant) => {
    if (variant) {
      setEditingVariant(variant);
      variantForm.reset({
        sku: variant.sku,
        variantValues: variant.variantValues,
        price: variant.price || "",
        inventory: variant.inventory,
        images: variant.images || [],
        isActive: variant.isActive,
      });
    } else {
      setEditingVariant(null);
      variantForm.reset();
    }
    setIsVariantDialogOpen(true);
  };

  const onSubmitOption = async (data: OptionFormValues) => {
    if (editingOption) {
      await updateOptionMutation.mutateAsync({ id: editingOption.id, data });
    } else {
      await createOptionMutation.mutateAsync(data);
    }
  };

  const onSubmitValue = async (data: ValueFormValues) => {
    if (!selectedOptionForValue) return;
    
    if (editingValue) {
      await updateValueMutation.mutateAsync({ id: editingValue.id, data });
    } else {
      await createValueMutation.mutateAsync({ optionId: selectedOptionForValue, data });
    }
  };

  const onSubmitVariant = async (data: VariantFormValues) => {
    if (editingVariant) {
      await updateVariantMutation.mutateAsync({ id: editingVariant.id, data });
    } else {
      await createVariantMutation.mutateAsync(data);
    }
  };

  if (productsLoading) {
    return <div className="p-8 text-muted-foreground" data-testid="text-loading">Carregando produtos...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-title">Variantes de Produtos</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-subtitle">
            Gerencie opções e SKUs de variantes para cada produto
          </p>
        </div>
      </div>

      {!selectedProduct ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Selecione um Produto
            </CardTitle>
            <CardDescription>
              Escolha um produto para gerenciar suas variantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products?.map((product) => (
                <Card
                  key={product.id}
                  className="hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => setSelectedProduct(product.id)}
                  data-testid={`card-product-${product.id}`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <CardDescription>
                      Preço base: R$ {parseFloat(product.price).toFixed(2)}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setSelectedProduct(null)}
              data-testid="button-back"
            >
              ← Voltar aos Produtos
            </Button>
            <h2 className="text-xl font-semibold" data-testid="text-selected-product">
              {products?.find((p) => p.id === selectedProduct)?.name}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Opções de Variantes
                  </CardTitle>
                  <CardDescription>
                    Defina atributos como Cor, Tamanho, Material
                  </CardDescription>
                </div>
                <Button
                  onClick={() => handleOpenOptionDialog()}
                  size="sm"
                  data-testid="button-create-option"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Nova Opção
                </Button>
              </CardHeader>
              <CardContent>
                {options && options.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {options.map((option) => (
                      <OptionAccordionItem
                        key={option.id}
                        option={option}
                        onEdit={handleOpenOptionDialog}
                        onDelete={(id) => deleteOptionMutation.mutate(id)}
                        onCreateValue={handleOpenValueDialog}
                        onEditValue={handleOpenValueDialog}
                        onDeleteValue={(id) => deleteValueMutation.mutate(id)}
                      />
                    ))}
                  </Accordion>
                ) : (
                  <p className="text-muted-foreground text-center py-8" data-testid="text-no-options">
                    Nenhuma opção criada. Crie opções para começar.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    Variantes (SKUs)
                  </CardTitle>
                  <CardDescription>
                    Combinações de opções com preço e estoque
                  </CardDescription>
                </div>
                <Button
                  onClick={() => handleOpenVariantDialog()}
                  size="sm"
                  disabled={!options || options.length === 0}
                  data-testid="button-create-variant"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Nova Variante
                </Button>
              </CardHeader>
              <CardContent>
                {variants && variants.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Combinação</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Estoque</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variants.map((variant) => (
                        <TableRow key={variant.id} data-testid={`row-variant-${variant.id}`}>
                          <TableCell className="font-mono text-sm">{variant.sku}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {variant.variantValues && typeof variant.variantValues === 'object' 
                                ? Object.entries(variant.variantValues as Record<string, string>).map(([key, value]) => (
                                    <Badge key={key} variant="outline" className="text-xs">
                                      {key}: {value}
                                    </Badge>
                                  ))
                                : "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {variant.price ? `R$ ${parseFloat(variant.price).toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell>{variant.inventory} un.</TableCell>
                          <TableCell>
                            <Badge variant={variant.isActive ? "default" : "secondary"}>
                              {variant.isActive ? "Ativa" : "Inativa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenVariantDialog(variant)}
                              data-testid={`button-edit-variant-${variant.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteVariantMutation.mutate(variant.id)}
                              data-testid={`button-delete-variant-${variant.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8" data-testid="text-no-variants">
                    {options && options.length > 0
                      ? "Nenhuma variante criada. Crie variantes combinando as opções."
                      : "Crie opções primeiro para poder criar variantes."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={isOptionDialogOpen} onOpenChange={setIsOptionDialogOpen}>
        <DialogContent data-testid="dialog-option">
          <DialogHeader>
            <DialogTitle>
              {editingOption ? "Editar Opção" : "Nova Opção"}
            </DialogTitle>
            <DialogDescription>
              Defina um atributo como Cor, Tamanho ou Material
            </DialogDescription>
          </DialogHeader>
          <Form {...optionForm}>
            <form onSubmit={optionForm.handleSubmit(onSubmitOption)} className="space-y-4">
              <FormField
                control={optionForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Opção</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Cor, Tamanho, Material" data-testid="input-option-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={optionForm.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem de Exibição</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-option-display-order" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseOptionDialog}
                  data-testid="button-cancel-option"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createOptionMutation.isPending || updateOptionMutation.isPending}
                  data-testid="button-submit-option"
                >
                  {editingOption ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isValueDialogOpen} onOpenChange={setIsValueDialogOpen}>
        <DialogContent data-testid="dialog-value">
          <DialogHeader>
            <DialogTitle>
              {editingValue ? "Editar Valor" : "Novo Valor"}
            </DialogTitle>
            <DialogDescription>
              Defina um valor para esta opção
            </DialogDescription>
          </DialogHeader>
          <Form {...valueForm}>
            <form onSubmit={valueForm.handleSubmit(onSubmitValue)} className="space-y-4">
              <FormField
                control={valueForm.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Vermelho, P, M, G, Algodão" data-testid="input-value-value" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={valueForm.control}
                name="displayOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem de Exibição</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-value-display-order" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseValueDialog}
                  data-testid="button-cancel-value"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createValueMutation.isPending || updateValueMutation.isPending}
                  data-testid="button-submit-value"
                >
                  {editingValue ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
        <DialogContent data-testid="dialog-variant">
          <DialogHeader>
            <DialogTitle>
              {editingVariant ? "Editar Variante" : "Nova Variante"}
            </DialogTitle>
            <DialogDescription>
              Crie um SKU combinando os valores das opções
            </DialogDescription>
          </DialogHeader>
          <Form {...variantForm}>
            <form onSubmit={variantForm.handleSubmit(onSubmitVariant)} className="space-y-4">
              {options && options.length > 0 && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Selecione os valores para cada opção:</p>
                  {options.map((option) => {
                    const values = allOptionValues.data?.[option.id] || [];
                    return (
                      <div key={option.id} className="space-y-2">
                        <label className="text-sm font-medium">{option.name}</label>
                        <Select
                          value={
                            (variantForm.watch("variantValues") as any)?.[option.name] || ""
                          }
                          onValueChange={(value) => {
                            const currentValues = variantForm.getValues("variantValues");
                            const valuesObj = (typeof currentValues === 'object' && currentValues !== null) 
                              ? currentValues as Record<string, any>
                              : {};
                            variantForm.setValue("variantValues", {
                              ...valuesObj,
                              [option.name]: value,
                            });
                          }}
                        >
                          <SelectTrigger data-testid={`select-variant-option-${option.id}`}>
                            <SelectValue placeholder={`Selecione ${option.name}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {values.length > 0 ? (
                              values.map((val) => (
                                <SelectItem key={val.id} value={val.value}>
                                  {val.value}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no-values" disabled>
                                Nenhum valor cadastrado
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
              <FormField
                control={variantForm.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU (Código Único)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="PROD-RED-M" data-testid="input-variant-sku" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={variantForm.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço (opcional - herda do produto)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="99.90"
                        data-testid="input-variant-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={variantForm.control}
                name="inventory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estoque</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number"
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-variant-inventory" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseVariantDialog}
                  data-testid="button-cancel-variant"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createVariantMutation.isPending || updateVariantMutation.isPending}
                  data-testid="button-submit-variant"
                >
                  {editingVariant ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type OptionAccordionItemProps = {
  option: VariantOption;
  onEdit: (option: VariantOption) => void;
  onDelete: (id: string) => void;
  onCreateValue: (optionId: string) => void;
  onEditValue: (optionId: string, value: VariantValue) => void;
  onDeleteValue: (id: string) => void;
};

function OptionAccordionItem({
  option,
  onEdit,
  onDelete,
  onCreateValue,
  onEditValue,
  onDeleteValue,
}: OptionAccordionItemProps) {
  const { data: values } = useQuery<VariantValue[]>({
    queryKey: ["/api/variant-options", option.id, "values"],
  });

  return (
    <AccordionItem value={option.id} data-testid={`accordion-option-${option.id}`}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="font-medium">{option.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(option);
              }}
              data-testid={`button-edit-option-${option.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(option.id);
              }}
              data-testid={`button-delete-option-${option.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Valores:</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCreateValue(option.id)}
              data-testid={`button-create-value-${option.id}`}
            >
              <Plus className="w-3 h-3 mr-1" />
              Adicionar Valor
            </Button>
          </div>
          {values && values.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {values.map((value) => (
                <Badge
                  key={value.id}
                  variant="secondary"
                  className="flex items-center gap-2"
                  data-testid={`badge-value-${value.id}`}
                >
                  {value.value}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditValue(option.id, value)}
                      className="hover:text-primary"
                      data-testid={`button-edit-value-${value.id}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDeleteValue(value.id)}
                      className="hover:text-destructive"
                      data-testid={`button-delete-value-${value.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid={`text-no-values-${option.id}`}>
              Nenhum valor cadastrado
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
