import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, FileText, TrendingUp, TrendingDown, DollarSign, PieChart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/seo";
import type { FinancialTransaction } from "@shared/schema";

export default function FinanceReports() {
  const { data: transactions = [], isLoading } = useQuery<FinancialTransaction[]>({
    queryKey: ["/api/financial-transactions"],
  });

  const revenues = transactions.filter(t => t.type === "revenue");
  const expenses = transactions.filter(t => t.type === "expense");

  const totalRevenue = revenues.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpenses = expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Group by category
  const revenueByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};

  revenues.forEach(t => {
    const cat = t.category || "Outros";
    revenueByCategory[cat] = (revenueByCategory[cat] || 0) + parseFloat(t.amount);
  });

  expenses.forEach(t => {
    const cat = t.category || "Outros";
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + parseFloat(t.amount);
  });

  const revenueCategories = Object.entries(revenueByCategory).sort((a, b) => b[1] - a[1]);
  const expenseCategories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <SEO
        title="Relatórios Financeiros - EAAS"
        description="DRE, fluxo de caixa e análises gerenciais. Sistema de relatórios financeiros empresariais EAAS."
        keywords="DRE, fluxo de caixa, relatórios financeiros, análise gerencial, ERP, EAAS"
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-blue-500/5">
        <div className="container mx-auto px-4 py-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Link href="/finance">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent" data-testid="title-reports">
                Relatórios Financeiros 📊
              </h1>
              <p className="text-muted-foreground mt-1">
                DRE, fluxo de caixa e análises gerenciais
              </p>
            </div>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground text-center">Carregando relatórios...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* DRE - Demonstração do Resultado do Exercício */}
              <Card className="border-blue-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    DRE - Demonstração do Resultado
                  </CardTitle>
                  <CardDescription>
                    Resultado financeiro consolidado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20" data-testid="row-total-revenue">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                        <span className="font-medium">Receitas Totais</span>
                      </div>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-red-50/50 dark:bg-red-950/20" data-testid="row-total-expenses">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-red-500" />
                        <span className="font-medium">Despesas Totais</span>
                      </div>
                      <span className="text-lg font-bold text-red-600 dark:text-red-400">
                        R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="h-px bg-border my-4" />

                    <div className={`flex items-center justify-between p-4 rounded-lg ${netProfit >= 0 ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'bg-red-50/50 dark:bg-red-950/20'}`} data-testid="row-net-profit">
                      <div className="flex items-center gap-2">
                        <DollarSign className={`h-5 w-5 ${netProfit >= 0 ? 'text-blue-500' : 'text-red-500'}`} />
                        <span className="font-bold">Lucro Líquido</span>
                      </div>
                      <span className={`text-xl font-bold ${netProfit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                        R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-purple-50/50 dark:bg-purple-950/20" data-testid="row-profit-margin">
                      <div className="flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">Margem de Lucro</span>
                      </div>
                      <Badge variant={profitMargin >= 20 ? "default" : "secondary"} className="text-lg px-3 py-1">
                        {profitMargin.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    Receitas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueCategories.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhuma receita registrada</p>
                  ) : (
                    <div className="space-y-3">
                      {revenueCategories.map(([category, amount]) => {
                        const percentage = (amount / totalRevenue) * 100;
                        return (
                          <div key={category} className="space-y-2" data-testid={`revenue-category-${category}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{category}</span>
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary">{percentage.toFixed(1)}%</Badge>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-green-600"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expenses by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    Despesas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {expenseCategories.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhuma despesa registrada</p>
                  ) : (
                    <div className="space-y-3">
                      {expenseCategories.map(([category, amount]) => {
                        const percentage = (amount / totalExpenses) * 100;
                        return (
                          <div key={category} className="space-y-2" data-testid={`expense-category-${category}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{category}</span>
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary">{percentage.toFixed(1)}%</Badge>
                                <span className="font-bold text-red-600 dark:text-red-400">
                                  R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-red-500 to-orange-600"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary Card */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    Resumo Executivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total de Transações:</span>
                    <span className="font-semibold">{transactions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transações de Receita:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{revenues.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transações de Despesa:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">{expenses.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Categorias de Receita:</span>
                    <span className="font-semibold">{revenueCategories.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Categorias de Despesa:</span>
                    <span className="font-semibold">{expenseCategories.length}</span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
