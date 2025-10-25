import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, Warehouse, TrendingUp, AlertTriangle, Edit, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertWarehouseSchema, insertProductStockSchema, insertStockMovementSchema } from "@shared/schema";
import { z } from "zod";

export default function InventoryPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("warehouses");

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="page-inventory">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Gestão de Estoque</h1>
          <p className="text-muted-foreground">Controle de depósitos, produtos e movimentações</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="tabs-inventory-nav">
          <TabsTrigger value="warehouses" data-testid="tab-warehouses">
            <Warehouse className="h-4 w-4 mr-2" />
            Depósitos
          </TabsTrigger>
          <TabsTrigger value="stock" data-testid="tab-stock">
            <Package className="h-4 w-4 mr-2" />
            Estoque
          </TabsTrigger>
          <TabsTrigger value="movements" data-testid="tab-movements">
            <TrendingUp className="h-4 w-4 mr-2" />
            Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="warehouses" data-testid="content-warehouses">
          <WarehousesTab />
        </TabsContent>

        <TabsContent value="stock" data-testid="content-stock">
          <StockTab />
        </TabsContent>

        <TabsContent value="movements" data-testid="content-movements">
          <MovementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WarehousesTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ["/api/warehouses"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/warehouses", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      setIsCreateOpen(false);
      toast({ title: "Depósito criado com sucesso!" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest(`/api/warehouses/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      setEditingWarehouse(null);
      toast({ title: "Depósito atualizado com sucesso!" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/warehouses/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Depósito excluído com sucesso!" });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertWarehouseSchema.omit({ tenantId: true })),
    defaultValues: {
      name: "",
      location: "",
      address: "",
      isActive: true,
      metadata: {},
    },
  });

  const editForm = useForm({
    resolver: zodResolver(insertWarehouseSchema.omit({ tenantId: true }).partial()),
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  const onEdit = (data: any) => {
    if (editingWarehouse) {
      updateMutation.mutate({ id: editingWarehouse.id, data });
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Depósitos</CardTitle>
          <CardDescription>Gerencie seus depósitos e armazéns</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-warehouse">
              <Plus className="h-4 w-4 mr-2" />
              Novo Depósito
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-warehouse">
            <DialogHeader>
              <DialogTitle>Criar Depósito</DialogTitle>
              <DialogDescription>Adicione um novo depósito ao sistema</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Depósito Central" data-testid="input-warehouse-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localização</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="São Paulo - SP" data-testid="input-warehouse-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço Completo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Rua Exemplo, 123" data-testid="input-warehouse-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-warehouse">
                  {createMutation.isPending ? "Criando..." : "Criar Depósito"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum depósito cadastrado
                </TableCell>
              </TableRow>
            ) : (
              warehouses?.map((warehouse: any) => (
                <TableRow key={warehouse.id} data-testid={`row-warehouse-${warehouse.id}`}>
                  <TableCell className="font-medium" data-testid={`text-warehouse-name-${warehouse.id}`}>
                    {warehouse.name}
                  </TableCell>
                  <TableCell>{warehouse.location || "-"}</TableCell>
                  <TableCell>{warehouse.address || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={warehouse.isActive ? "default" : "secondary"} data-testid={`badge-warehouse-status-${warehouse.id}`}>
                      {warehouse.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(warehouse.id)}
                      data-testid={`button-delete-warehouse-${warehouse.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StockTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>(undefined);

  const { data: warehouses } = useQuery({ queryKey: ["/api/warehouses"] });
  const { data: products } = useQuery({ queryKey: ["/api/products"] });
  const { data: stock, isLoading } = useQuery({
    queryKey: ["/api/product-stock", selectedWarehouse],
    queryFn: () =>
      fetch(`/api/product-stock${selectedWarehouse ? `?warehouseId=${selectedWarehouse}` : ""}`, {
        credentials: "include",
      }).then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/product-stock", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-stock"] });
      setIsCreateOpen(false);
      toast({ title: "Estoque criado com sucesso!" });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertProductStockSchema.omit({ tenantId: true })),
    defaultValues: {
      productId: "",
      warehouseId: "",
      quantity: 0,
      minQuantity: 0,
      maxQuantity: undefined,
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Estoque de Produtos</CardTitle>
          <CardDescription>Controle de quantidade por depósito</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
            <SelectTrigger className="w-48" data-testid="select-warehouse-filter">
              <SelectValue placeholder="Filtrar por depósito" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os depósitos</SelectItem>
              {warehouses?.map((w: any) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-stock">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Estoque
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-stock">
              <DialogHeader>
                <DialogTitle>Adicionar Estoque</DialogTitle>
                <DialogDescription>Registre estoque de um produto em um depósito</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produto</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-stock-product">
                              <SelectValue placeholder="Selecione um produto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products?.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="warehouseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Depósito</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-stock-warehouse">
                              <SelectValue placeholder="Selecione um depósito" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {warehouses?.map((w: any) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="0"
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-stock-quantity"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="minQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estoque Mínimo</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="0"
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-stock-min-quantity"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-stock">
                    {createMutation.isPending ? "Criando..." : "Criar Registro"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Depósito</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Estoque Mínimo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stock?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum estoque registrado
                </TableCell>
              </TableRow>
            ) : (
              stock?.map((item: any) => {
                const product = products?.find((p: any) => p.id === item.productId);
                const warehouse = warehouses?.find((w: any) => w.id === item.warehouseId);
                const isLowStock = item.quantity <= item.minQuantity;

                return (
                  <TableRow key={item.id} data-testid={`row-stock-${item.id}`}>
                    <TableCell className="font-medium">{product?.name || "Produto não encontrado"}</TableCell>
                    <TableCell>{warehouse?.name || "Depósito não encontrado"}</TableCell>
                    <TableCell data-testid={`text-stock-quantity-${item.id}`}>{item.quantity}</TableCell>
                    <TableCell>{item.minQuantity}</TableCell>
                    <TableCell>
                      {isLowStock && (
                        <Badge variant="destructive" data-testid={`badge-stock-low-${item.id}`}>
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Estoque Baixo
                        </Badge>
                      )}
                      {!isLowStock && <Badge variant="default">Normal</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MovementsTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: warehouses } = useQuery({ queryKey: ["/api/warehouses"] });
  const { data: products } = useQuery({ queryKey: ["/api/products"] });
  const { data: movements, isLoading } = useQuery({
    queryKey: ["/api/stock-movements"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/stock-movements", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-stock"] });
      setIsCreateOpen(false);
      toast({ title: "Movimentação registrada com sucesso!" });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertStockMovementSchema.omit({ tenantId: true })),
    defaultValues: {
      productId: "",
      warehouseId: "",
      type: "purchase" as any,
      quantity: 0,
      previousQuantity: 0,
      newQuantity: 0,
      notes: "",
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  const movementTypeLabels: Record<string, string> = {
    purchase: "Compra",
    sale: "Venda",
    adjustment: "Ajuste",
    transfer: "Transferência",
    return: "Devolução",
    loss: "Perda",
    production: "Produção",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Movimentações de Estoque</CardTitle>
          <CardDescription>Histórico de entradas e saídas</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-movement">
              <Plus className="h-4 w-4 mr-2" />
              Nova Movimentação
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-movement">
            <DialogHeader>
              <DialogTitle>Registrar Movimentação</DialogTitle>
              <DialogDescription>Adicione entrada ou saída de estoque</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-movement-type">
                            <SelectValue placeholder="Tipo de movimentação" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="purchase">Compra</SelectItem>
                          <SelectItem value="sale">Venda</SelectItem>
                          <SelectItem value="adjustment">Ajuste</SelectItem>
                          <SelectItem value="transfer">Transferência</SelectItem>
                          <SelectItem value="return">Devolução</SelectItem>
                          <SelectItem value="loss">Perda</SelectItem>
                          <SelectItem value="production">Produção</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produto</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-movement-product">
                            <SelectValue placeholder="Selecione um produto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products?.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depósito</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-movement-warehouse">
                            <SelectValue placeholder="Selecione um depósito" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses?.map((w: any) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="0"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-movement-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="previousQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade Anterior</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="0"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-movement-prev-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nova Quantidade</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="0"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-movement-new-quantity"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Notas sobre a movimentação" data-testid="input-movement-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-movement">
                  {createMutation.isPending ? "Registrando..." : "Registrar Movimentação"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Depósito</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Anterior</TableHead>
              <TableHead>Novo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhuma movimentação registrada
                </TableCell>
              </TableRow>
            ) : (
              movements?.map((movement: any) => {
                const product = products?.find((p: any) => p.id === movement.productId);
                const warehouse = warehouses?.find((w: any) => w.id === movement.warehouseId);

                return (
                  <TableRow key={movement.id} data-testid={`row-movement-${movement.id}`}>
                    <TableCell>{new Date(movement.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge data-testid={`badge-movement-type-${movement.id}`}>
                        {movementTypeLabels[movement.type] || movement.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{product?.name || "Produto não encontrado"}</TableCell>
                    <TableCell>{warehouse?.name || "Depósito não encontrado"}</TableCell>
                    <TableCell data-testid={`text-movement-quantity-${movement.id}`}>{movement.quantity}</TableCell>
                    <TableCell>{movement.previousQuantity}</TableCell>
                    <TableCell>{movement.newQuantity}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
