import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { Building2, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

const profileSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  subdomain: z.string().min(1, "Subdomínio é obrigatório"),
  logoUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  faviconUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  primaryColor: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function CompanyProfile() {
  const { toast } = useToast();

  // Fetch the single tenant (first one in the system)
  const { data: tenants, isLoading } = useQuery<any[]>({
    queryKey: ["/api/tenants"],
  });

  const tenant = tenants?.[0]; // Single-tenant: always use first tenant

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: tenant ? {
      name: tenant.name || "",
      subdomain: tenant.subdomain || "",
      logoUrl: tenant.logoUrl || "",
      faviconUrl: tenant.faviconUrl || "",
      primaryColor: tenant.primaryColor || "#10A37F",
    } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      if (!tenant?.id) throw new Error("Tenant not found");
      return await apiRequest("PATCH", `/api/tenants/${tenant.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant-context"] });
      toast({
        title: "Sucesso",
        description: "Perfil da empresa atualizado com sucesso!",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: error.message || "Erro ao atualizar perfil",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Perfil da Empresa</h1>
            <p className="text-muted-foreground">Gerencie informações e identidade visual</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Nenhuma empresa configurada no sistema. Contate o suporte.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-company-profile">Perfil da Empresa</h1>
          <p className="text-muted-foreground">Informações básicas e identidade visual da sua empresa</p>
        </div>
      </div>

      {/* Informações Básicas */}
      <Card data-testid="card-basic-info">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Informações Básicas
          </CardTitle>
          <CardDescription>
            Dados essenciais da empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: Tech Store" 
                        data-testid="input-company-name"
                      />
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
                    <FormLabel>Subdomínio</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ex: techstore" 
                        data-testid="input-subdomain"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Logo</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="url"
                        placeholder="https://exemplo.com/logo.png"
                        data-testid="input-logo-url"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="faviconUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Favicon</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="url"
                        placeholder="https://exemplo.com/favicon.ico"
                        data-testid="input-favicon-url"
                      />
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
                    <FormLabel>Cor Principal</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          {...field} 
                          type="color"
                          value={field.value || "#10A37F"}
                          className="w-20 h-10"
                          data-testid="input-primary-color"
                        />
                      </FormControl>
                      <Input 
                        value={field.value || "#10A37F"}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder="#10A37F"
                        className="flex-1"
                        data-testid="input-primary-color-hex"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                data-testid="button-save-profile"
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

    </div>
  );
}
