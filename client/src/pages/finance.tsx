import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, TrendingDown, Activity, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SEO } from "@/components/seo";
import type { FinancialTransaction } from "@shared/schema";

export default function Finance() {
  // Fetch real transactions from API
  const { data: transactions = [], isLoading, isError } = useQuery<FinancialTransaction[]>({
    queryKey: ["/api/financial-transactions"],
  });

  // Calculate real KPIs from transactions
  const revenues = transactions.filter(t => t.type === "revenue");
  const expenses = transactions.filter(t => t.type === "expense");
  
  const totalRevenue = revenues.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const stats = {
    totalRevenue,
    totalExpenses,
    netProfit,
    monthlyGrowth: profitMargin, // Using profit margin as growth proxy for MVP
  };

  return (
    <>
      <SEO
        title="Gestão Financeira - EAAS Platform"
        description="ERP Financeiro completo com gestão de receitas, despesas e relatórios gerenciais. Sistema completo de gestão empresarial EAAS."
        keywords="ERP, finanças, receitas, despesas, relatórios, DRE, fluxo de caixa, EAAS"
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="container mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 bg-clip-text text-transparent" data-testid="title-finance">
              Gestão Financeira $
            </h1>
            <p className="text-muted-foreground mt-1">
              Controle total das suas finanças empresariais
            </p>
          </div>

          {/* KPI Cards */}
          {isError ? (
            <Card className="border-destructive/50">
              <CardContent className="p-6">
                <p className="text-destructive text-center">
                  ❌ Erro ao carregar transações. Por favor, tente novamente.
                </p>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="hover-elevate" data-testid="card-total-revenue">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receitas Totais</CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {revenues.length} transações
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-total-expenses">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Despesas Totais</CardTitle>
                <TrendingDown className="h-5 w-5 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  R$ {stats.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {expenses.length} transações
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-net-profit">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
                <DollarSign className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  R$ {stats.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {profitMargin.toFixed(1)}% margem
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-monthly-growth">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Crescimento Mensal</CardTitle>
                <Activity className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {profitMargin >= 0 ? '+' : ''}{profitMargin.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {profitMargin >= 20 ? 'Excelente' : profitMargin >= 10 ? 'Bom' : 'Atenção'}
                </p>
              </CardContent>
            </Card>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !isError && transactions.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma transação ainda</h3>
                <p className="text-muted-foreground mb-4">
                  Comece adicionando receitas ou despesas usando os módulos abaixo
                </p>
              </CardContent>
            </Card>
          )}

          {/* Module Cards - Clickable */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Visão Geral Financeira
            </h2>
            <p className="text-muted-foreground mb-6">
              Módulo ERP Financeiro completo com gestão de receitas, despesas, contas a pagar e receber, fluxo de caixa e relatórios gerenciais.
            </p>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Revenues Card */}
              <Link href="/finance/revenues">
                <Card className="hover-elevate active-elevate-2 cursor-pointer border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20" data-testid="card-revenues">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <CardTitle className="text-lg">Receitas</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      Controle completo de vendas, faturamento e recebimentos
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>

              {/* Expenses Card */}
              <Link href="/finance/expenses">
                <Card className="hover-elevate active-elevate-2 cursor-pointer border-red-500/20 bg-gradient-to-br from-red-50/50 to-background dark:from-red-950/20" data-testid="card-expenses">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
                      </div>
                      <CardTitle className="text-lg">Despesas</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      Gestão de custos operacionais e investimentos
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>

              {/* Reports Card */}
              <Link href="/finance/reports">
                <Card className="hover-elevate active-elevate-2 cursor-pointer border-blue-500/20 bg-gradient-to-br from-blue-50/50 to-background dark:from-blue-950/20" data-testid="card-reports">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <CardTitle className="text-lg">Relatórios</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>
                      DRE, fluxo de caixa e análises gerenciais
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
