import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { Customer } from "@shared/schema";
import { SEO } from "@/components/seo";

const formatCurrency = (value: number | null | undefined, locale: string): string => {
  if (!value) return new Intl.NumberFormat(locale, { style: 'currency', currency: locale === 'pt-BR' ? 'BRL' : 'USD' }).format(0);
  return new Intl.NumberFormat(locale, { style: 'currency', currency: locale === 'pt-BR' ? 'BRL' : 'USD' }).format(value);
};

export default function CRM() {
  const { t, i18n } = useTranslation();
  
  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
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
                  <TableHead>{t('crm.tags')}</TableHead>
                  <TableHead className="text-right">{t('crm.lifetimeValue')}</TableHead>
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
                      {customer.segment ? (
                        <Badge variant="secondary">{customer.segment}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(customer.lifetimeValue, i18n.language)}
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
