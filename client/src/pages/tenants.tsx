import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Building2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTenantSchema, type Tenant } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const tenantFormSchema = insertTenantSchema;

type TenantFormData = typeof tenantFormSchema._type;

export default function Tenants() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      name: "",
      subdomain: "",
      primaryColor: "#10A37F",
      status: "active",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TenantFormData) => {
      return apiRequest("POST", "/api/tenants", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setOpen(false);
      form.reset();
      toast({
        title: t('common.success'),
        description: t('tenants.createSuccess'),
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('tenants.createError'),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TenantFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold" data-testid="text-tenants-title">
            {t('tenants.title')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t('tenants.subtitle')}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-tenant">
              <Plus className="mr-2 h-4 w-4" /> {t('tenants.create')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('tenants.create')}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tenants.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" data-testid="input-tenant-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subdomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tenants.subdomain')}</FormLabel>
                      <FormControl>
                        <Input placeholder="acme" data-testid="input-tenant-subdomain" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('tenants.primaryColor')}</FormLabel>
                      <FormControl>
                        <Input type="color" data-testid="input-tenant-color" {...field} value={field.value || "#10A37F"} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-tenant">
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-tenant">
                    {createMutation.isPending ? t('common.creating') : t('tenants.create')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tenants && tenants.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <Card key={tenant.id} className="hover-elevate" data-testid={`card-tenant-${tenant.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {tenant.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t('tenants.subdomain')}:</span>
                    <code className="bg-muted px-2 py-0.5 rounded text-xs">
                      {tenant.subdomain}.eaas.com
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t('common.status')}:</span>
                    <span className="capitalize">
                      {tenant.status === 'active' ? t('common.active') : t('common.inactive')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{t('tenants.primaryColor')}:</span>
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: tenant.primaryColor || "#10A37F" }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{t('tenants.noTenants')}</h3>
          <p className="text-muted-foreground mb-4">
            {t('tenants.getStarted')}
          </p>
          <Button onClick={() => setOpen(true)} data-testid="button-create-first-tenant">
            <Plus className="mr-2 h-4 w-4" /> {t('tenants.create')}
          </Button>
        </Card>
      )}
    </div>
  );
}
