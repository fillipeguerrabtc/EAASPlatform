import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";

export default function Finance() {
  const { t } = useTranslation();

  // Mock data for MVP - in production this would fetch from /api/financial-transactions
  const stats = {
    totalRevenue: 45230.50,
    totalExpenses: 32180.25,
    netProfit: 13050.25,
    monthlyGrowth: 12.5,
  };

  // Note: This is MVP with mock data. Production would use:
  // const { data: transactions } = useQuery<FinancialTransaction[]>({
  //   queryKey: ["/api/financial-transactions"],
  // });

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-6 border-b sticky top-0 z-10 backdrop-blur-md bg-background/80">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight flex flex-wrap items-center gap-3">
            <span className="bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              {t('finance.title', 'Gestão Financeira')}
            </span>
            <DollarSign className="h-8 w-8 text-emerald-500" />
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t('finance.subtitle', 'Controle total das suas finanças empresariais')}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* KPI Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="hover-elevate" data-testid="card-total-revenue">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('finance.totalRevenue', 'Receitas Totais')}
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-revenue">
                  R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  +{stats.monthlyGrowth}% este mês
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-total-expenses">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('finance.totalExpenses', 'Despesas Totais')}
                </CardTitle>
                <TrendingDown className="h-5 w-5 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-expenses">
                  R$ {stats.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  71% do faturamento
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-net-profit">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('finance.netProfit', 'Lucro Líquido')}
                </CardTitle>
                <DollarSign className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-profit">
                  R$ {stats.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  29% margem líquida
                </p>
              </CardContent>
            </Card>

            <Card className="hover-elevate" data-testid="card-monthly-growth">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t('finance.monthlyGrowth', 'Crescimento Mensal')}
                </CardTitle>
                <Activity className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid="text-growth">
                  +{stats.monthlyGrowth}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Acima da meta
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                {t('finance.overview', 'Visão Geral Financeira')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {t('finance.description', 'Módulo ERP Financeiro completo com gestão de receitas, despesas, contas a pagar e receber, fluxo de caixa e relatórios gerenciais.')}
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                    ✓ Receitas
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Controle completo de vendas, faturamento e recebimentos
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                    ✓ Despesas
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Gestão de custos operacionais e investimentos
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">
                    ✓ Relatórios
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    DRE, fluxo de caixa e análises gerenciais
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
