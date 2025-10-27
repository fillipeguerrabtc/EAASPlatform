import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertReportTemplateSchema } from "@shared/schema";
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
  FormDescription,
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
import { FileText, Plus, Pencil, Trash2, BarChart, Filter } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type ReportTemplate = {
  id: string;
  name: string;
  description: string | null;
  reportType: string;
  aggregations: any;
  filters: any;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

const formSchema = insertReportTemplateSchema.extend({
  aggregations: z.string().min(1, "Agregações são obrigatórias"),
  filters: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ReportTemplates() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [filterType, setFilterType] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      reportType: "sales",
      aggregations: JSON.stringify({ fields: [], groupBy: [], metrics: [] }, null, 2),
      filters: JSON.stringify({}, null, 2),
    },
  });

  const { data: templates, isLoading } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/reports/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      try {
        const payload = {
          ...data,
          aggregations: JSON.parse(data.aggregations),
          filters: data.filters ? JSON.parse(data.filters) : null,
        };
        return await apiRequest("POST", "/api/reports/templates", payload);
      } catch (error: any) {
        if (error instanceof SyntaxError) {
          throw new Error("JSON inválido em Agregações ou Filtros");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/templates"] });
      toast({ title: "Template criado com sucesso" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar template", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FormValues> }) => {
      try {
        const payload: any = { ...data };
        if (data.aggregations) {
          payload.aggregations = JSON.parse(data.aggregations);
        }
        if (data.filters) {
          payload.filters = JSON.parse(data.filters);
        }
        return await apiRequest("PATCH", `/api/reports/templates/${id}`, payload);
      } catch (error: any) {
        if (error instanceof SyntaxError) {
          throw new Error("JSON inválido em Agregações ou Filtros");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/templates"] });
      toast({ title: "Template atualizado com sucesso" });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar template", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/reports/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/templates"] });
      toast({ title: "Template deletado com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao deletar template", description: error.message, variant: "destructive" });
    },
  });

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingTemplate(null);
    form.reset();
  };

  const handleEdit = (template: ReportTemplate) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      description: template.description || "",
      reportType: template.reportType as any,
      aggregations: JSON.stringify(template.aggregations, null, 2),
      filters: template.filters ? JSON.stringify(template.filters, null, 2) : "{}",
    });
  };

  const onSubmit = (data: FormValues) => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredTemplates = templates?.filter((template) => {
    if (!filterType) return true;
    return template.reportType === filterType;
  }) || [];

  const totalTemplates = templates?.length || 0;
  const typeGroups: Record<string, number> = {};
  templates?.forEach((t) => {
    typeGroups[t.reportType] = (typeGroups[t.reportType] || 0) + 1;
  });

  const mostUsedType = Object.entries(typeGroups).sort(([, a], [, b]) => b - a)[0];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-templates">
            Report Templates
          </h1>
          <p className="text-muted-foreground">
            Gerencie templates de relatórios personalizados
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-template">
          <Plus className="w-4 h-4" />
          Novo Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-total">{totalTemplates}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipos de Relatório</CardTitle>
            <BarChart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-types">
              {Object.keys(typeGroups).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipo Mais Usado</CardTitle>
            <Filter className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {mostUsedType ? (
              <>
                <div className="text-2xl font-bold" data-testid="kpi-most-used-count">
                  {mostUsedType[1]}
                </div>
                <p className="text-xs text-muted-foreground capitalize" data-testid="kpi-most-used-type">
                  {mostUsedType[0]}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">-</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates Sales</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="kpi-sales">
              {typeGroups["sales"] || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Templates</CardTitle>
              <CardDescription>Lista de todos os report templates</CardDescription>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40" data-testid="select-filter-type">
                <SelectValue placeholder="Filtrar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
                <SelectItem value="inventory">Inventory</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum template encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                    <TableCell className="font-medium" data-testid={`cell-name-${template.id}`}>
                      {template.name}
                    </TableCell>
                    <TableCell data-testid={`cell-type-${template.id}`}>
                      <Badge variant="outline" className="capitalize">
                        {template.reportType}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-description-${template.id}`}>
                      <span className="line-clamp-1">
                        {template.description || "-"}
                      </span>
                    </TableCell>
                    <TableCell data-testid={`cell-created-${template.id}`}>
                      {format(parseISO(template.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(template)}
                          data-testid={`button-edit-${template.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja deletar este template?")) {
                              deleteMutation.mutate(template.id);
                            }
                          }}
                          data-testid={`button-delete-${template.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen || !!editingTemplate} onOpenChange={(open) => {
        if (!open) handleCloseDialog();
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-template-form">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar Template" : "Novo Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate ? "Atualize as configurações do template" : "Crie um novo template de relatório"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Template *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Relatório Mensal de Vendas" data-testid="input-name" />
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
                        placeholder="Descrição do template"
                        rows={2}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reportType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Relatório *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="financial">Financial</SelectItem>
                        <SelectItem value="inventory">Inventory</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="aggregations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agregações (JSON) *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder='{"fields": [], "groupBy": [], "metrics": []}'
                        rows={6}
                        className="font-mono text-sm"
                        data-testid="input-aggregations"
                      />
                    </FormControl>
                    <FormDescription>
                      JSON com fields, groupBy e metrics
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="filters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Filtros (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || "{}"}
                        placeholder='{"dateRange": {}, "status": ""}'
                        rows={4}
                        className="font-mono text-sm"
                        data-testid="input-filters"
                      />
                    </FormControl>
                    <FormDescription>
                      JSON com filtros opcionais (dateRange, status, etc)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
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
                    : editingTemplate
                    ? "Atualizar"
                    : "Criar Template"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
