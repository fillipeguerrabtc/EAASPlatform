import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ArrowUpRight, CheckCircle2, XCircle, Clock, RotateCcw } from "lucide-react";
import type { Payment } from "@shared/schema";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

export default function Payments() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'pt-BR' ? ptBR : enUS;

  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "processing":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "failed":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "refunded":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle2 className="h-4 w-4" />;
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "processing":
        return <ArrowUpRight className="h-4 w-4" />;
      case "failed":
        return <XCircle className="h-4 w-4" />;
      case "refunded":
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "succeeded":
        return t('payments.completed');
      case "pending":
        return t('payments.pending');
      case "processing":
        return t('payments.processing');
      case "failed":
        return t('payments.failed');
      case "refunded":
        return t('payments.refunded');
      default:
        return status;
    }
  };

  const totalAmount = payments?.reduce((sum, payment) => {
    if (payment.status === 'succeeded') {
      return sum + parseFloat(payment.amount as string);
    }
    return sum;
  }, 0) || 0;

  const totalCount = payments?.filter(p => p.status === 'succeeded').length || 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold" data-testid="text-payments-title">
          {t('payments.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('payments.subtitle')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('payments.totalRevenue')}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">
              R$ {totalAmount.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalCount} {t('payments.successfulPayments')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('payments.recentPayments')}
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-recent-count">
              {payments?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('payments.allTime')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('payments.paymentHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/6" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          ) : payments && payments.length > 0 ? (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center gap-4 p-4 border rounded-md hover-elevate"
                  data-testid={`payment-item-${payment.id}`}
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" data-testid={`payment-amount-${payment.id}`}>
                        R$ {parseFloat(payment.amount as string).toFixed(2)}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`${getStatusColor(payment.status)} flex items-center gap-1`}
                        data-testid={`payment-status-${payment.id}`}
                      >
                        {getStatusIcon(payment.status)}
                        {getStatusText(payment.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{payment.currency.toUpperCase()}</span>
                      <span>•</span>
                      <span data-testid={`payment-date-${payment.id}`}>
                        {format(new Date(payment.createdAt), "PPp", { locale })}
                      </span>
                      {payment.stripePaymentIntentId && (
                        <>
                          <span>•</span>
                          <span className="text-xs font-mono">
                            {payment.stripePaymentIntentId.slice(0, 20)}...
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('payments.noPayments')}</h3>
              <p className="text-muted-foreground">
                {t('payments.noPaymentsDesc')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
