import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertHrLeaveRequestSchema, type HrLeaveRequest } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function HrLeaveRequestsPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: requests, isLoading } = useQuery<HrLeaveRequest[]>({
    queryKey: ["/api/hr-leave-requests"],
  });

  const { data: employees } = useQuery({
    queryKey: ["/api/users"],
  });

  const form = useForm({
    resolver: zodResolver(insertHrLeaveRequestSchema),
    defaultValues: {
      employeeId: "",
      leaveType: "vacation",
      startDate: "",
      endDate: "",
      reason: "",
      status: "pending",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/hr-leave-requests", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr-leave-requests"] });
      toast({ title: "Solicitação criada com sucesso" });
      setIsCreateOpen(false);
      form.reset();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      apiRequest(`/api/hr-leave-requests/${id}/status`, "PATCH", { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr-leave-requests"] });
      toast({ title: "Status atualizado" });
    },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-leave-requests">Solicitações de Férias</h1>
          <p className="text-muted-foreground">Gerencie solicitações de férias e afastamentos</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-request">
          <Plus className="w-4 h-4" />
          Nova Solicitação
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitações</CardTitle>
          <CardDescription>Todas as solicitações de férias cadastradas</CardDescription>
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
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma solicitação cadastrada
                    </TableCell>
                  </TableRow>
                ) : (
                  requests?.map((request) => (
                    <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                      <TableCell className="font-medium">{request.employeeId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{request.leaveType}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(request.startDate), "dd/MM/yyyy")} - {format(new Date(request.endDate), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={request.status === "approved" ? "default" : request.status === "rejected" ? "destructive" : "secondary"}>
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {request.status === "pending" && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => updateStatusMutation.mutate({ id: request.id, status: "approved" })}
                              data-testid={`button-approve-${request.id}`}
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => updateStatusMutation.mutate({ id: request.id, status: "rejected" })}
                              data-testid={`button-reject-${request.id}`}
                            >
                              <XCircle className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Férias</DialogTitle>
            <DialogDescription>Cadastre uma nova solicitação</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Funcionário*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-employee">
                          <SelectValue placeholder="Selecione o funcionário" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees?.map((emp: any) => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="leaveType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-leave-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="vacation">Férias</SelectItem>
                        <SelectItem value="sick_leave">Atestado Médico</SelectItem>
                        <SelectItem value="personal">Pessoal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Início*</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-start-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Fim*</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-end-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} placeholder="Descreva o motivo" data-testid="input-reason" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-request">Criar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
