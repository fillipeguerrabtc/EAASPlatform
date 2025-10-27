import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertBudgetSchema } from "@shared/schema";
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
import { Progress } from "@/components/ui/progress";
import { DollarSign, Plus, Pencil, Trash2, AlertTriangle, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Budget = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  period: string;
  startDate: string;
  endDate: string;
  plannedAmount: string;
  actualAmount: string;
  alertThreshold: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

const formSchema = insertBudgetSchema.extend({
  startDate: z.string().min(1, "Data inicial é obrigatória"),
  endDate: z.string().min(1, "Data final é obrigatória"),
  plannedAmount: z.string().min(1, "Valor planejado é obrigatório"),
});

type FormValues = z.infer<typeof formSchema>;

export default function BudgetTracking() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "revenue",
      period: "monthly",
      startDate: "",
      endDate: "",
      plannedAmount: "0",
      actualAmount: "0",
      alertThreshold: "80",
    },
  });

  const { data: budgets, isLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      };
      return await apiRequest("POST", "/api/budgets", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Orçamento criado com sucesso" });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar orçamento", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormValues> }) => {
      const payload = {
        ...data,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
      };
      return await apiRequest("PATCH", `/api/budgets/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Orçamento atualizado com sucesso" });
      setEditingBudget(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar orçamento", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/budgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Orçamento deletado com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao deletar orçamento", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    form.reset({
      name: budget.name,
      description: budget.description || "",
      category: budget.category as any,
      period: budget.period as any,
      startDate: format(parseISO(budget.startDate), "yyyy-MM-dd"),
      endDate: format(parseISO(budget.endDate), "yyyy-MM-dd"),
      plannedAmount: budget.plannedAmount,
      actualAmount: budget.actualAmount,
      alertThreshold: budget.alertThreshold,
    });
  };

  const onSubmit = (data: FormValues) => {
    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredBudgets = budgets?.filter((budget) => {
    const matchesCategory = !filterCategory || budget.category === filterCategory;
    const matchesPeriod = !filterPeriod || budget.period === filterPeriod;
    return matchesCategory && matchesPeriod;
  }) || [];

  const calculateVariance = (budget: Budget) => {
    const planned = parseFloat(budget.plannedAmount);
    const actual = parseFloat(budget.actualAmount);
    if (planned === 0) return 0;
    return ((actual - planned) / planned) * 100;
  };

  const calculateUsage = (budget: Budget) => {
    const planned = parseFloat(budget.plannedAmount);
    const actual = parseFloat(budget.actualAmount);
    if (planned === 0) return 0;
    return (actual / planned) * 100;
  };

  const totalPlanned = budgets?.reduce((sum, b) => sum + parseFloat(b.plannedAmount), 0) || 0;
  const totalActual = budgets?.reduce((sum, b) => sum + parseFloat(b.actualAmount), 0) || 0;
  const overBudget = budgets?.filter((b) => parseFloat(b.actualAmount) > parseFloat(b.plannedAmount)).length || 0;
  const atRisk = budgets?.filter((b) => {
    const usage = calculateUsage(b);
    const threshold = parseFloat(b.alertThreshold);
    return usage >= threshold && usage < 100;
  }).length || 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-budget">
            Acompanhamento de Orçamentos
          </h1>
          <p className="text-muted-foreground">Gerencie budgets e monitore variações</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-budget">
          <Plus className="w-4 h-4" />
          Novo Orçamento
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planejado Total</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-planned">
              ${totalPlanned.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Realizado Total</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-actual">
              ${totalActual.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acima do Orçamento</CardTitle>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-over-budget">{overBudget}</div>
            <p className="text-xs text-muted-foreground">Orçamentos excedidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Risco</CardTitle>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-at-risk">{atRisk}</div>
            <p className="text-xs text-muted-foreground">Próximos do limite</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Orçamentos</CardTitle>
              <CardDescription>Lista de todos os orçamentos</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40" data-testid="select-filter-category">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  <SelectItem value="revenue">Receita</SelectItem>
                  <SelectItem value="expenses">Despesas</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="operations">Operações</SelectItem>
                  <SelectItem value="salaries">Salários</SelectItem>
                  <SelectItem value="infrastructure">Infraestrutura</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="w-40" data-testid="select-filter-period">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredBudgets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum orçamento encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Planejado</TableHead>
                  <TableHead>Realizado</TableHead>
                  <TableHead>Uso</TableHead>
                  <TableHead>Variação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBudgets.map((budget) => {
                  const usage = calculateUsage(budget);
                  const variance = calculateVariance(budget);
                  const isOverBudget = usage > 100;
                  const isAtRisk = usage >= parseFloat(budget.alertThreshold) && usage < 100;

                  return (
                    <TableRow key={budget.id} data-testid={`row-budget-${budget.id}`}>
                      <TableCell className="font-medium" data-testid={`cell-name-${budget.id}`}>
                        {budget.name}
                      </TableCell>
                      <TableCell data-testid={`cell-category-${budget.id}`}>
                        <Badge variant="outline">{budget.category}</Badge>
                      </TableCell>
                      <TableCell data-testid={`cell-period-${budget.id}`}>
                        {budget.period === "monthly" ? "Mensal" :
                         budget.period === "quarterly" ? "Trimestral" : "Anual"}
                      </TableCell>
                      <TableCell data-testid={`cell-planned-${budget.id}`}>
                        ${parseFloat(budget.plannedAmount).toFixed(2)}
                      </TableCell>
                      <TableCell data-testid={`cell-actual-${budget.id}`}>
                        ${parseFloat(budget.actualAmount).toFixed(2)}
                      </TableCell>
                      <TableCell data-testid={`cell-usage-${budget.id}`}>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(usage, 100)} className="w-16" />
                          <span className="text-sm">{usage.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`cell-variance-${budget.id}`}>
                        <Badge
                          variant={
                            isOverBudget ? "destructive" :
                            isAtRisk ? "secondary" : "default"
                          }
                        >
                          {variance >= 0 ? "+" : ""}{variance.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(budget)}
                            data-testid={`button-edit-${budget.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Tem certeza que deseja deletar este orçamento?")) {
                                deleteMutation.mutate(budget.id);
                              }
                            }}
                            data-testid={`button-delete-${budget.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen || !!editingBudget} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingBudget(null);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-2xl" data-testid="dialog-budget-form">
          <DialogHeader>
            <DialogTitle>
              {editingBudget ? "Editar Orçamento" : "Novo Orçamento"}
            </DialogTitle>
            <DialogDescription>
              {editingBudget ? "Atualize as informações do orçamento" : "Preencha os dados do novo orçamento"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nome do orçamento" data-testid="input-name" />
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
                        placeholder="Descrição do orçamento"
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="revenue">Receita</SelectItem>
                          <SelectItem value="expenses">Despesas</SelectItem>
                          <SelectItem value="marketing">Marketing</SelectItem>
                          <SelectItem value="operations">Operações</SelectItem>
                          <SelectItem value="salaries">Salários</SelectItem>
                          <SelectItem value="infrastructure">Infraestrutura</SelectItem>
                          <SelectItem value="other">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Período *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-period">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Inicial *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Final *</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-end-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="plannedAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Planejado *</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" step="0.01" data-testid="input-planned-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="alertThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite de Alerta (%)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || "80"}
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          data-testid="input-alert-threshold"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingBudget(null);
                    form.reset();
                  }}
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
                    : editingBudget
                    ? "Atualizar"
                    : "Criar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
