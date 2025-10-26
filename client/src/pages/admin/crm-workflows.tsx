import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Play, Edit, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertCrmWorkflowSchema, type CrmWorkflow, type InsertCrmWorkflow } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { z } from "zod";

const formSchema = insertCrmWorkflowSchema.extend({
  conditions: z.string().optional(),
  actions: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CrmWorkflowsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<CrmWorkflow | null>(null);

  const { data: workflows, isLoading } = useQuery<CrmWorkflow[]>({
    queryKey: ["/api/crm-workflows"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      trigger: "customer_created",
      conditions: "{}",
      actions: "[]",
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload: InsertCrmWorkflow = {
        ...data,
        conditions: data.conditions ? JSON.parse(data.conditions) : {},
        actions: data.actions ? JSON.parse(data.actions) : [],
      };
      return await apiRequest("/api/crm-workflows", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-workflows"] });
      toast({ title: "Workflow criado com sucesso" });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar workflow", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormValues }) => {
      const payload: Partial<InsertCrmWorkflow> = {
        ...data,
        conditions: data.conditions ? JSON.parse(data.conditions) : undefined,
        actions: data.actions ? JSON.parse(data.actions) : undefined,
      };
      return await apiRequest(`/api/crm-workflows/${id}`, "PATCH", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-workflows"] });
      toast({ title: "Workflow atualizado com sucesso" });
      setEditingWorkflow(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar workflow", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/crm-workflows/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-workflows"] });
      toast({ title: "Workflow deletado com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao deletar workflow", description: error.message, variant: "destructive" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/crm-workflows/${id}/execute`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm-workflows"] });
      toast({ title: "Workflow executado com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao executar workflow", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (workflow: CrmWorkflow) => {
    setEditingWorkflow(workflow);
    form.reset({
      name: workflow.name,
      description: workflow.description || "",
      trigger: workflow.trigger,
      conditions: JSON.stringify(workflow.conditions, null, 2),
      actions: JSON.stringify(workflow.actions, null, 2),
      isActive: workflow.isActive,
    });
  };

  const handleSubmit = (data: FormValues) => {
    if (editingWorkflow) {
      updateMutation.mutate({ id: editingWorkflow.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-workflows">CRM Workflows</h1>
          <p className="text-muted-foreground">Automatize ações com base em eventos do CRM</p>
        </div>
        <Button
          onClick={() => {
            form.reset();
            setIsCreateOpen(true);
          }}
          data-testid="button-create-workflow"
        >
          <Plus className="w-4 h-4" />
          Novo Workflow
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflows Cadastrados</CardTitle>
          <CardDescription>Gerencie workflows de automação do CRM</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Execução</TableHead>
                  <TableHead>Execuções</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum workflow cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  workflows?.map((workflow) => (
                    <TableRow key={workflow.id} data-testid={`row-workflow-${workflow.id}`}>
                      <TableCell className="font-medium" data-testid={`text-name-${workflow.id}`}>
                        {workflow.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-trigger-${workflow.id}`}>
                          {workflow.trigger.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={workflow.isActive ? "default" : "secondary"}
                          data-testid={`badge-status-${workflow.id}`}
                        >
                          {workflow.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-last-exec-${workflow.id}`}>
                        {workflow.lastExecutedAt
                          ? format(new Date(workflow.lastExecutedAt), "dd/MM/yyyy HH:mm")
                          : "Nunca"}
                      </TableCell>
                      <TableCell data-testid={`text-exec-count-${workflow.id}`}>
                        {workflow.executionCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => executeMutation.mutate(workflow.id)}
                            disabled={executeMutation.isPending}
                            data-testid={`button-execute-${workflow.id}`}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(workflow)}
                            data-testid={`button-edit-${workflow.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Tem certeza que deseja deletar este workflow?")) {
                                deleteMutation.mutate(workflow.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${workflow.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen || !!editingWorkflow} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingWorkflow(null);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-workflow">
              {editingWorkflow ? "Editar Workflow" : "Novo Workflow"}
            </DialogTitle>
            <DialogDescription>
              Configure o workflow de automação do CRM
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome*</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ex: Enviar email de boas-vindas" data-testid="input-workflow-name" />
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
                      <Textarea {...field} value={field.value || ""} placeholder="Descreva o workflow" data-testid="input-workflow-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="trigger"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Trigger*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-trigger-type">
                          <SelectValue placeholder="Selecione o trigger" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="customer_created">Cliente Criado</SelectItem>
                        <SelectItem value="interaction_created">Interação Criada</SelectItem>
                        <SelectItem value="lead_scored">Lead Pontuado</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="conditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condições (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder='{"minScore": 70}'
                        className="font-mono text-sm"
                        rows={4}
                        data-testid="input-trigger-conditions"
                      />
                    </FormControl>
                    <FormDescription>
                      JSON com condições para executar o workflow
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="actions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ações (JSON Array)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder='[{"type": "send_email", "template": "welcome"}]'
                        className="font-mono text-sm"
                        rows={6}
                        data-testid="input-actions"
                      />
                    </FormControl>
                    <FormDescription>
                      Array JSON com ações a executar
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Workflow Ativo</FormLabel>
                      <FormDescription>
                        Ative ou desative a execução automática
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-is-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingWorkflow(null);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-workflow"
                >
                  {editingWorkflow ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
