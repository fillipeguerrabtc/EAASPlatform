import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, CheckCircle, Clock, AlertCircle, TrendingUp, Edit2, Trash2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { performanceReviewStatusEnum } from "@shared/schema";

const formSchema = z.object({
  employeeId: z.string().min(1, "Funcionário é obrigatório"),
  reviewerId: z.string().optional(),
  reviewCycle: z.string().min(1, "Ciclo é obrigatório"),
  status: z.enum(["draft", "in_progress", "completed", "approved"]).default("draft"),
  startDate: z.string().min(1, "Data inicial é obrigatória"),
  dueDate: z.string().min(1, "Data limite é obrigatória"),
  completedDate: z.string().optional(),
  overallScore: z.string().optional(),
  strengths: z.string().optional(),
  areasForImprovement: z.string().optional(),
  goals: z.string().optional(),
  managerComments: z.string().optional(),
  employeeComments: z.string().optional(),
  ratings: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type PerformanceReview = {
  id: string;
  employeeId: string;
  reviewerId: string | null;
  reviewCycle: string;
  status: string;
  startDate: string;
  dueDate: string;
  completedDate: string | null;
  overallScore: string | null;
  strengths: string | null;
  areasForImprovement: string | null;
  goals: string | null;
  managerComments: string | null;
  employeeComments: string | null;
  ratings: any;
  createdAt: string;
  updatedAt: string;
};

type Employee = {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  in_progress: "bg-blue-500",
  completed: "bg-yellow-500",
  approved: "bg-green-500",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  in_progress: "Em Andamento",
  completed: "Concluída",
  approved: "Aprovada",
};

export default function HrPerformanceReviewsPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<PerformanceReview | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCycle, setFilterCycle] = useState<string>("");

  const { data: reviews, isLoading } = useQuery<PerformanceReview[]>({
    queryKey: ["/api/performance-reviews", filterStatus, filterCycle],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus) params.append("status", filterStatus);
      if (filterCycle) params.append("reviewCycle", filterCycle);
      const response = await fetch(`/api/performance-reviews?${params}`);
      if (!response.ok) throw new Error("Failed to fetch reviews");
      return response.json();
    },
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: "",
      reviewerId: "",
      reviewCycle: "",
      status: "draft",
      startDate: "",
      dueDate: "",
      completedDate: "",
      overallScore: "",
      strengths: "",
      areasForImprovement: "",
      goals: "",
      managerComments: "",
      employeeComments: "",
      ratings: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload: any = {
        ...data,
        overallScore: data.overallScore ? parseFloat(data.overallScore) : undefined,
        ratings: data.ratings ? JSON.parse(data.ratings) : undefined,
        reviewerId: data.reviewerId || undefined,
        completedDate: data.completedDate || undefined,
      };
      return await apiRequest("POST", "/api/performance-reviews", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance-reviews"] });
      toast({ title: "Avaliação criada com sucesso" });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar avaliação", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormValues }) => {
      const payload: any = {
        ...data,
        overallScore: data.overallScore ? parseFloat(data.overallScore) : undefined,
        ratings: data.ratings ? JSON.parse(data.ratings) : undefined,
        reviewerId: data.reviewerId || undefined,
        completedDate: data.completedDate || undefined,
      };
      return await apiRequest("PATCH", `/api/performance-reviews/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance-reviews"] });
      toast({ title: "Avaliação atualizada com sucesso" });
      setEditingReview(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar avaliação", description: error.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/performance-reviews/${id}/status`, {
        status,
        completedDate: status === "completed" || status === "approved" ? new Date().toISOString() : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance-reviews"] });
      toast({ title: "Status atualizado" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/performance-reviews/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance-reviews"] });
      toast({ title: "Avaliação deletada com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao deletar avaliação", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (review: PerformanceReview) => {
    setEditingReview(review);
    form.reset({
      employeeId: review.employeeId,
      reviewerId: review.reviewerId || "",
      reviewCycle: review.reviewCycle,
      status: review.status as any,
      startDate: format(new Date(review.startDate), "yyyy-MM-dd"),
      dueDate: format(new Date(review.dueDate), "yyyy-MM-dd"),
      completedDate: review.completedDate ? format(new Date(review.completedDate), "yyyy-MM-dd") : "",
      overallScore: review.overallScore || "",
      strengths: review.strengths || "",
      areasForImprovement: review.areasForImprovement || "",
      goals: review.goals || "",
      managerComments: review.managerComments || "",
      employeeComments: review.employeeComments || "",
      ratings: review.ratings ? JSON.stringify(review.ratings, null, 2) : "",
    });
  };

  const onSubmit = (data: FormValues) => {
    if (editingReview) {
      updateMutation.mutate({ id: editingReview.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleUpdateStatus = (id: string, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const reviewsByCycle = reviews?.reduce((acc, review) => {
    acc[review.reviewCycle] = (acc[review.reviewCycle] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const reviewsByStatus = reviews?.reduce((acc, review) => {
    acc[review.status] = (acc[review.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgScore =
    reviews && reviews.filter((r) => r.overallScore).length > 0
      ? (
          reviews
            .filter((r) => r.overallScore)
            .reduce((sum, r) => sum + parseFloat(r.overallScore!), 0) /
          reviews.filter((r) => r.overallScore).length
        ).toFixed(2)
      : "N/A";

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-performance-reviews">
            Avaliações de Desempenho
          </h1>
          <p className="text-muted-foreground">Gerencie avaliações de desempenho dos colaboradores</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-review">
          <Plus className="w-4 h-4" />
          Nova Avaliação
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-reviews">
              {reviews?.length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontuação Média</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-avg-score">
              {avgScore}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="stat-in-progress">
              {reviewsByStatus?.in_progress || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-approved">
              {reviewsByStatus?.approved || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label>Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger data-testid="select-filter-status">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="approved">Aprovada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <Label>Ciclo</Label>
            <Select value={filterCycle} onValueChange={setFilterCycle}>
              <SelectTrigger data-testid="select-filter-cycle">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {Object.keys(reviewsByCycle || {}).map((cycle) => (
                  <SelectItem key={cycle} value={cycle}>
                    {cycle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setFilterStatus("");
              setFilterCycle("");
            }}
            data-testid="button-clear-filters"
          >
            Limpar Filtros
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Avaliações</CardTitle>
          <CardDescription>Todas as avaliações cadastradas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : reviews && reviews.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pontuação</TableHead>
                  <TableHead>Data Limite</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => {
                  const employee = employees.find((e) => e.id === review.employeeId);
                  return (
                    <TableRow key={review.id} data-testid={`row-review-${review.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{employee?.fullName || "Desconhecido"}</p>
                          <p className="text-sm text-muted-foreground">{employee?.jobTitle || ""}</p>
                        </div>
                      </TableCell>
                      <TableCell>{review.reviewCycle}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[review.status]} data-testid={`badge-status-${review.id}`}>
                          {statusLabels[review.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{review.overallScore || "N/A"}</TableCell>
                      <TableCell>{format(new Date(review.dueDate), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(review)}
                            data-testid={`button-edit-${review.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Tem certeza que deseja deletar esta avaliação?")) {
                                deleteMutation.mutate(review.id);
                              }
                            }}
                            data-testid={`button-delete-${review.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                          {review.status === "draft" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateStatus(review.id, "in_progress")}
                              data-testid={`button-start-${review.id}`}
                            >
                              Iniciar
                            </Button>
                          )}
                          {review.status === "in_progress" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateStatus(review.id, "completed")}
                              data-testid={`button-complete-${review.id}`}
                            >
                              Concluir
                            </Button>
                          )}
                          {review.status === "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateStatus(review.id, "approved")}
                              data-testid={`button-approve-${review.id}`}
                            >
                              Aprovar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma avaliação encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingReview} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingReview(null);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReview ? "Editar Avaliação" : "Nova Avaliação"}</DialogTitle>
            <DialogDescription>
              {editingReview ? "Atualize os dados da avaliação" : "Preencha os dados da nova avaliação"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Funcionário *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-employee">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.fullName} - {emp.jobTitle || "Sem cargo"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reviewCycle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciclo *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: 2025-Q1" data-testid="input-cycle" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Inicial *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Limite *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-due-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="overallScore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pontuação Geral</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 4.5"
                          {...field}
                          data-testid="input-score"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="in_progress">Em Andamento</SelectItem>
                          <SelectItem value="completed">Concluída</SelectItem>
                          <SelectItem value="approved">Aprovada</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="strengths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pontos Fortes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Descreva os pontos fortes do colaborador"
                        className="min-h-20"
                        data-testid="textarea-strengths"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="areasForImprovement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Áreas de Melhoria</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Descreva as áreas que precisam de desenvolvimento"
                        className="min-h-20"
                        data-testid="textarea-improvements"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="goals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Metas Futuras</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Defina metas para o próximo período"
                        className="min-h-20"
                        data-testid="textarea-goals"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="managerComments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comentários do Gestor</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Adicione comentários adicionais"
                        className="min-h-20"
                        data-testid="textarea-manager-comments"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employeeComments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auto-Avaliação do Colaborador</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Comentários do próprio colaborador"
                        className="min-h-20"
                        data-testid="textarea-employee-comments"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ratings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avaliações Detalhadas (JSON)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={'{"technical": 4.5, "communication": 5.0, "leadership": 3.5}'}
                        className="min-h-20 font-mono text-sm"
                        data-testid="textarea-ratings"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingReview(null);
                    form.reset();
                  }}
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
                    : editingReview
                    ? "Atualizar"
                    : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
