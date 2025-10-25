import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { ArrowLeft, Plus, TrendingDown, Pencil, Trash2, DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { FinancialTransaction } from "@shared/schema";

const formSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  amount: z.string().min(1, "Valor obrigatório"),
  date: z.string().min(1, "Data obrigatória"),
  category: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function FinanceExpenses() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: transactions = [], isLoading } = useQuery<FinancialTransaction[]>({
    queryKey: ["/api/financial-transactions"],
  });

  const expenses = transactions.filter(t => t.type === "expense");
  const totalExpenses = expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      amount: "",
      date: new Date().toISOString().split('T')[0],
      category: "",
      paymentMethod: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/financial-transactions", {
        type: "expense",
        description: data.description,
        amount: data.amount,
        date: data.date,
        category: data.category || null,
        paymentMethod: data.paymentMethod || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial-transactions"] });
      setIsCreateOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      return apiRequest("PATCH", `/api/financial-transactions/${id}`, {
        description: data.description,
        amount: data.amount,
        date: data.date,
        category: data.category || null,
        paymentMethod: data.paymentMethod || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial-transactions"] });
      setEditingId(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/financial-transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/financial-transactions"] });
    },
  });

  const handleSubmit = (data: FormData) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (transaction: FinancialTransaction) => {
    setEditingId(transaction.id);
    form.reset({
      description: transaction.description,
      amount: transaction.amount,
      date: new Date(transaction.date).toISOString().split('T')[0],
      category: transaction.category || "",
      paymentMethod: transaction.paymentMethod || "",
      notes: transaction.notes || "",
    });
    setIsCreateOpen(true);
  };

  const handleDialogClose = () => {
    setIsCreateOpen(false);
    setEditingId(null);
    form.reset();
  };

  return (
    <>
      <SEO
        title="Despesas - Gestão Financeira - EAAS"
        description="Gestão completa de custos operacionais e investimentos. Sistema financeiro empresarial EAAS."
        keywords="despesas, custos, investimentos, pagamentos, financeiro, ERP, EAAS"
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-red-500/5">
        <div className="container mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/finance">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-orange-600 bg-clip-text text-transparent" data-testid="title-expenses">
                  Despesas 📉
                </h1>
                <p className="text-muted-foreground mt-1">
                  Controle de custos e pagamentos
                </p>
              </div>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-create-expense">
                  <Plus className="h-4 w-4" />
                  Nova Despesa
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-create-expense">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
                  <DialogDescription>
                    {editingId ? "Atualize os dados da despesa" : "Adicione uma nova entrada de despesa"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Aluguel do escritório" data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valor (R$)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-amount" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid="input-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categoria</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: Operacional" data-testid="input-category" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Método Pagamento</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-payment-method">
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="cash">Dinheiro</SelectItem>
                                <SelectItem value="credit_card">Cartão Crédito</SelectItem>
                                <SelectItem value="debit_card">Cartão Débito</SelectItem>
                                <SelectItem value="pix">PIX</SelectItem>
                                <SelectItem value="transfer">Transferência</SelectItem>
                                <SelectItem value="check">Cheque</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Informações adicionais..." data-testid="input-notes" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={handleDialogClose} className="flex-1" data-testid="button-cancel">
                        Cancelar
                      </Button>
                      <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                        {editingId ? "Atualizar" : "Criar"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats */}
          <Card className="border-red-500/20 bg-gradient-to-br from-red-50/50 to-background dark:from-red-950/20">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
              <TrendingDown className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400" data-testid="text-total-expenses">
                R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {expenses.length} transações registradas
              </p>
            </CardContent>
          </Card>

          {/* Transactions List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-red-500" />
              Histórico de Despesas
            </h2>

            {isLoading ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-center">Carregando...</p>
                </CardContent>
              </Card>
            ) : expenses.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-center">Nenhuma despesa registrada ainda.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {expenses.map((transaction) => (
                  <Card key={transaction.id} className="hover-elevate" data-testid={`card-expense-${transaction.id}`}>
                    <CardContent className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg" data-testid="text-description">
                              {transaction.description}
                            </h3>
                            {transaction.category && (
                              <Badge variant="secondary" data-testid="badge-category">{transaction.category}</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span data-testid="text-date">
                              📅 {new Date(transaction.date).toLocaleDateString('pt-BR')}
                            </span>
                            {transaction.paymentMethod && (
                              <span data-testid="text-payment-method">💳 {transaction.paymentMethod}</span>
                            )}
                          </div>
                          {transaction.notes && (
                            <p className="text-sm text-muted-foreground mt-2" data-testid="text-notes">
                              {transaction.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-amount">
                              R$ {parseFloat(transaction.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(transaction)}
                              data-testid={`button-edit-${transaction.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(transaction.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${transaction.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
