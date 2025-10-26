import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Mail, Phone, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Customer } from "@shared/schema";
import { SEO } from "@/components/seo";

const formatCurrency = (value: number | null | undefined, locale: string): string => {
  if (!value) return new Intl.NumberFormat(locale, { style: 'currency', currency: locale === 'pt-BR' ? 'BRL' : 'USD' }).format(0);
  return new Intl.NumberFormat(locale, { style: 'currency', currency: locale === 'pt-BR' ? 'BRL' : 'USD' }).format(value);
};

const getLeadScoreBadge = (score: number | null | undefined) => {
  if (!score) return { variant: "secondary" as const, label: "N/A", color: "text-muted-foreground" };
  if (score >= 70) return { variant: "default" as const, label: "High", color: "text-green-600 dark:text-green-400" };
  if (score >= 40) return { variant: "secondary" as const, label: "Medium", color: "text-yellow-600 dark:text-yellow-400" };
  return { variant: "outline" as const, label: "Low", color: "text-red-600 dark:text-red-400" };
};

export default function CRM() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const recalculateScoreMutation = useMutation({
    mutationFn: async (customerId: string) => {
      return await apiRequest(`/api/customers/${customerId}/calculate-score`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Lead score recalculado com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao recalcular score", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <SEO
        title="CRM 360° - EAAS | Complete Customer Relationship Management"
        description="Manage your customer relationships with complete lifecycle tracking, interactions, tags, and lifetime value analytics."
        keywords="crm, customer relationship management, customer lifecycle, customer analytics, sales tracking"
        canonical="https://eaas.com/customers"
        ogTitle="EAAS CRM 360° - Customer Excellence"
        ogDescription="Complete customer relationship management with advanced analytics"
      />
      <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold" data-testid="text-crm-title">
          {t('crm.title')}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t('crm.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('crm.customers')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : customers && customers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('crm.email')}</TableHead>
                  <TableHead>{t('crm.phone')}</TableHead>
                  <TableHead>Lead Score</TableHead>
                  <TableHead>{t('crm.tags')}</TableHead>
                  <TableHead className="text-right">{t('crm.lifetimeValue')}</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      {customer.email ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {customer.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {customer.phone ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {customer.phone}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const scoreBadge = getLeadScoreBadge(customer.leadScore);
                        return (
                          <div className="flex items-center gap-2">
                            <Badge variant={scoreBadge.variant} data-testid={`badge-lead-score-${customer.id}`}>
                              <span className={scoreBadge.color}>
                                {customer.leadScore ? Number(customer.leadScore).toFixed(0) : "—"} {scoreBadge.label}
                              </span>
                            </Badge>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {customer.segment ? (
                        <Badge variant="secondary">{customer.segment}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(customer.lifetimeValue ? Number(customer.lifetimeValue) : null, i18n.language)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => recalculateScoreMutation.mutate(customer.id)}
                        disabled={recalculateScoreMutation.isPending}
                        data-testid={`button-recalculate-score-${customer.id}`}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('crm.noCustomers')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
