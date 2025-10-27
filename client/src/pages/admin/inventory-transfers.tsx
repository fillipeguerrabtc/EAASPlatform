import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, ArrowRightLeft, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Transfer = {
  id: string;
  type: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  notes: string | null;
  userId: string | null;
  referenceId: string | null;
  relatedWarehouseId: string | null;
  metadata: any;
  createdAt: string;
};

const formSchema = z.object({
  productId: z.string().min(1, "Produto é obrigatório"),
  fromWarehouseId: z.string().min(1, "Warehouse origem é obrigatório"),
  toWarehouseId: z.string().min(1, "Warehouse destino é obrigatório"),
  quantity: z.number().int().positive("Quantidade deve ser positiva"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function InventoryTransfers() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productId: "",
      fromWarehouseId: "",
      toWarehouseId: "",
      quantity: 1,
      notes: "",
    },
  });

  const { data: transfers, isLoading } = useQuery<Transfer[]>({
    queryKey: ["/api/inventory/transfers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return await apiRequest("POST", "/api/inventory/transfers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/transfers"] });
      toast({ title: "Transferência criada com sucesso" });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar transferência", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  const filteredTransfers = transfers?.filter((transfer) => {
    const matchesSearch =
      !searchQuery ||
      transfer.productId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transfer.warehouseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transfer.relatedWarehouseId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transfer.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const totalTransfers = transfers?.length || 0;
  const totalQuantity = transfers?.reduce((sum, t) => sum + (t.quantity || 0), 0) || 0;
  const pendingTransfers = transfers?.filter((t) => !t.metadata?.completed).length || 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-transfers">
            Transferências de Estoque
          </h1>
          <p className="text-muted-foreground">Gerencie movimentações entre warehouses</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-transfer">
          <Plus className="w-4 h-4" />
          Nova Transferência
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Transferências</CardTitle>
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-total-transfers">{totalTransfers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quantidade Total</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-total-quantity">{totalQuantity}</div>
            <p className="text-xs text-muted-foreground">Unidades transferidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-pending">{pendingTransfers}</div>
            <p className="text-xs text-muted-foreground">Aguardando conclusão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-completed">{totalTransfers - pendingTransfers}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Transferências</CardTitle>
              <CardDescription>Lista de todas as transferências de estoque</CardDescription>
            </div>
            <Input
              placeholder="Buscar transferências..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
              data-testid="input-search"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredTransfers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma transferência encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto ID</TableHead>
                  <TableHead>De (Warehouse)</TableHead>
                  <TableHead>Para (Warehouse)</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((transfer) => (
                  <TableRow key={transfer.id} data-testid={`row-transfer-${transfer.id}`}>
                    <TableCell className="font-medium" data-testid={`cell-product-${transfer.id}`}>
                      {transfer.productId}
                    </TableCell>
                    <TableCell data-testid={`cell-from-${transfer.id}`}>
                      {transfer.warehouseId}
                    </TableCell>
                    <TableCell data-testid={`cell-to-${transfer.id}`}>
                      {transfer.relatedWarehouseId || "-"}
                    </TableCell>
                    <TableCell data-testid={`cell-quantity-${transfer.id}`}>
                      {transfer.quantity > 0 ? `+${transfer.quantity}` : transfer.quantity}
                    </TableCell>
                    <TableCell data-testid={`cell-status-${transfer.id}`}>
                      <Badge variant={transfer.metadata?.completed ? "default" : "secondary"}>
                        {transfer.metadata?.completed ? "Completa" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-date-${transfer.id}`}>
                      {format(parseISO(transfer.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-2xl" data-testid="dialog-transfer-form">
          <DialogHeader>
            <DialogTitle>Nova Transferência</DialogTitle>
            <DialogDescription>
              Crie uma nova transferência de estoque entre warehouses
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID do Produto *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="UUID do produto" data-testid="input-product-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fromWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warehouse Origem *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="UUID do warehouse" data-testid="input-from-warehouse" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="toWarehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warehouse Destino *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="UUID do warehouse" data-testid="input-to-warehouse" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-quantity"
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
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Observações sobre a transferência"
                        rows={3}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-submit"
                >
                  {createMutation.isPending ? "Criando..." : "Criar Transferência"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
