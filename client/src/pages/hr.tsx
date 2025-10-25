import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Building2, DollarSign, Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertDepartmentSchema, insertEmployeeSchema, insertPayrollRecordSchema, insertAttendanceRecordSchema } from "@shared/schema";
import { z } from "zod";

export default function HRPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("employees");

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="page-hr">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Gestão de RH</h1>
          <p className="text-muted-foreground">Controle de funcionários, departamentos e folha de pagamento</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="tabs-hr-nav">
          <TabsTrigger value="employees" data-testid="tab-employees">
            <Users className="h-4 w-4 mr-2" />
            Funcionários
          </TabsTrigger>
          <TabsTrigger value="departments" data-testid="tab-departments">
            <Building2 className="h-4 w-4 mr-2" />
            Departamentos
          </TabsTrigger>
          <TabsTrigger value="payroll" data-testid="tab-payroll">
            <DollarSign className="h-4 w-4 mr-2" />
            Folha de Pagamento
          </TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-attendance">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Presença
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" data-testid="content-employees">
          <EmployeesTab />
        </TabsContent>

        <TabsContent value="departments" data-testid="content-departments">
          <DepartmentsTab />
        </TabsContent>

        <TabsContent value="payroll" data-testid="content-payroll">
          <PayrollTab />
        </TabsContent>

        <TabsContent value="attendance" data-testid="content-attendance">
          <AttendanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DepartmentsTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: departments, isLoading } = useQuery({
    queryKey: ["/api/departments"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/departments", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsCreateOpen(false);
      toast({ title: "Departamento criado com sucesso!" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/departments/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Departamento excluído com sucesso!" });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertDepartmentSchema.omit({ tenantId: true })),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Departamentos</CardTitle>
          <CardDescription>Gerencie a estrutura organizacional</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-department">
              <Plus className="h-4 w-4 mr-2" />
              Novo Departamento
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-department">
            <DialogHeader>
              <DialogTitle>Criar Departamento</DialogTitle>
              <DialogDescription>Adicione um novo departamento à empresa</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Vendas" data-testid="input-department-name" />
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
                        <Input {...field} placeholder="Equipe responsável por vendas" data-testid="input-department-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-department">
                  {createMutation.isPending ? "Criando..." : "Criar Departamento"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum departamento cadastrado
                </TableCell>
              </TableRow>
            ) : (
              departments?.map((dept: any) => (
                <TableRow key={dept.id} data-testid={`row-department-${dept.id}`}>
                  <TableCell className="font-medium" data-testid={`text-department-name-${dept.id}`}>
                    {dept.name}
                  </TableCell>
                  <TableCell>{dept.description || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={dept.isActive ? "default" : "secondary"} data-testid={`badge-department-status-${dept.id}`}>
                      {dept.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(dept.id)}
                      data-testid={`button-delete-department-${dept.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EmployeesTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: departments } = useQuery({ queryKey: ["/api/departments"] });
  const { data: employees, isLoading } = useQuery({
    queryKey: ["/api/employees"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/employees", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsCreateOpen(false);
      toast({ title: "Funcionário cadastrado com sucesso!" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/employees/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Funcionário excluído com sucesso!" });
    },
  });

  const form = useForm({
    resolver: zodResolver(
      insertEmployeeSchema.omit({ tenantId: true }).extend({
        hireDate: z.string(),
      })
    ),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      position: "",
      hireDate: new Date().toISOString().split("T")[0],
      employmentType: "full_time" as any,
      status: "active" as any,
      payrollFrequency: "monthly" as any,
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  const employmentTypeLabels: Record<string, string> = {
    full_time: "Tempo Integral",
    part_time: "Meio Período",
    contractor: "Contratado",
    intern: "Estagiário",
    temporary: "Temporário",
  };

  const statusLabels: Record<string, string> = {
    active: "Ativo",
    on_leave: "Afastado",
    terminated: "Desligado",
    suspended: "Suspenso",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Funcionários</CardTitle>
          <CardDescription>Gerencie os funcionários da empresa</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-employee">
              <Plus className="h-4 w-4 mr-2" />
              Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-create-employee">
            <DialogHeader>
              <DialogTitle>Cadastrar Funcionário</DialogTitle>
              <DialogDescription>Adicione um novo funcionário ao sistema</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="João" data-testid="input-employee-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sobrenome</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Silva" data-testid="input-employee-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="joao@empresa.com" data-testid="input-employee-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="(11) 99999-9999" data-testid="input-employee-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Analista de Vendas" data-testid="input-employee-position" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departamento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-employee-department">
                            <SelectValue placeholder="Selecione um departamento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments?.map((d: any) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
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
                  name="hireDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Contratação</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-employee-hiredate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="employmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Emprego</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-employee-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="full_time">Tempo Integral</SelectItem>
                          <SelectItem value="part_time">Meio Período</SelectItem>
                          <SelectItem value="contractor">Contratado</SelectItem>
                          <SelectItem value="intern">Estagiário</SelectItem>
                          <SelectItem value="temporary">Temporário</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-employee">
                  {createMutation.isPending ? "Cadastrando..." : "Cadastrar Funcionário"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum funcionário cadastrado
                </TableCell>
              </TableRow>
            ) : (
              employees?.map((employee: any) => {
                const department = departments?.find((d: any) => d.id === employee.departmentId);
                return (
                  <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                    <TableCell className="font-medium" data-testid={`text-employee-name-${employee.id}`}>
                      {employee.firstName} {employee.lastName}
                    </TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.position || "-"}</TableCell>
                    <TableCell>{department?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{employmentTypeLabels[employee.employmentType] || employee.employmentType}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.status === "active" ? "default" : "secondary"} data-testid={`badge-employee-status-${employee.id}`}>
                        {statusLabels[employee.status] || employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(employee.id)}
                        data-testid={`button-delete-employee-${employee.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PayrollTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: employees } = useQuery({ queryKey: ["/api/employees"] });
  const { data: payrollRecords, isLoading } = useQuery({
    queryKey: ["/api/payroll-records"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/payroll-records", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-records"] });
      setIsCreateOpen(false);
      toast({ title: "Registro de folha criado com sucesso!" });
    },
  });

  const form = useForm({
    resolver: zodResolver(
      insertPayrollRecordSchema.omit({ tenantId: true }).extend({
        periodStart: z.string(),
        periodEnd: z.string(),
        grossPay: z.string(),
        deductions: z.string(),
        netPay: z.string(),
      })
    ),
    defaultValues: {
      employeeId: "",
      periodStart: "",
      periodEnd: "",
      grossPay: "0",
      deductions: "0",
      netPay: "0",
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Folha de Pagamento</CardTitle>
          <CardDescription>Registros de pagamento dos funcionários</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-payroll">
              <Plus className="h-4 w-4 mr-2" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-payroll">
            <DialogHeader>
              <DialogTitle>Criar Registro de Pagamento</DialogTitle>
              <DialogDescription>Adicione um registro de folha de pagamento</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Funcionário</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payroll-employee">
                            <SelectValue placeholder="Selecione um funcionário" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees?.map((e: any) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.firstName} {e.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="periodStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Início do Período</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-payroll-start" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="periodEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fim do Período</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" data-testid="input-payroll-end" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="grossPay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salário Bruto</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0.00" data-testid="input-payroll-gross" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deductions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Deduções</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0.00" data-testid="input-payroll-deductions" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="netPay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salário Líquido</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="0.00" data-testid="input-payroll-net" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-payroll">
                  {createMutation.isPending ? "Criando..." : "Criar Registro"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Salário Bruto</TableHead>
              <TableHead>Deduções</TableHead>
              <TableHead>Salário Líquido</TableHead>
              <TableHead>Data de Pagamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payrollRecords?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum registro de pagamento
                </TableCell>
              </TableRow>
            ) : (
              payrollRecords?.map((record: any) => {
                const employee = employees?.find((e: any) => e.id === record.employeeId);
                return (
                  <TableRow key={record.id} data-testid={`row-payroll-${record.id}`}>
                    <TableCell className="font-medium">
                      {employee ? `${employee.firstName} ${employee.lastName}` : "Funcionário não encontrado"}
                    </TableCell>
                    <TableCell>
                      {new Date(record.periodStart).toLocaleDateString("pt-BR")} -{" "}
                      {new Date(record.periodEnd).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell data-testid={`text-payroll-gross-${record.id}`}>R$ {parseFloat(record.grossPay).toFixed(2)}</TableCell>
                    <TableCell>R$ {parseFloat(record.deductions).toFixed(2)}</TableCell>
                    <TableCell data-testid={`text-payroll-net-${record.id}`}>R$ {parseFloat(record.netPay).toFixed(2)}</TableCell>
                    <TableCell>
                      {record.paymentDate ? new Date(record.paymentDate).toLocaleDateString("pt-BR") : "Não pago"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AttendanceTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: employees } = useQuery({ queryKey: ["/api/employees"] });
  const { data: attendanceRecords, isLoading } = useQuery({
    queryKey: ["/api/attendance-records"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/attendance-records", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-records"] });
      setIsCreateOpen(false);
      toast({ title: "Registro de presença criado com sucesso!" });
    },
  });

  const form = useForm({
    resolver: zodResolver(
      insertAttendanceRecordSchema.omit({ tenantId: true }).extend({
        date: z.string(),
        checkIn: z.string().optional(),
        checkOut: z.string().optional(),
      })
    ),
    defaultValues: {
      employeeId: "",
      date: new Date().toISOString().split("T")[0],
      checkIn: "",
      checkOut: "",
      isAbsent: false,
      isLate: false,
    },
  });

  const onSubmit = (data: any) => {
    createMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Registros de Presença</CardTitle>
          <CardDescription>Controle de ponto dos funcionários</CardDescription>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-attendance">
              <Plus className="h-4 w-4 mr-2" />
              Novo Registro
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-attendance">
            <DialogHeader>
              <DialogTitle>Registrar Presença</DialogTitle>
              <DialogDescription>Adicione um registro de presença</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Funcionário</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-attendance-employee">
                            <SelectValue placeholder="Selecione um funcionário" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees?.map((e: any) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.firstName} {e.lastName}
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
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" data-testid="input-attendance-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="checkIn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Entrada</FormLabel>
                        <FormControl>
                          <Input {...field} type="time" data-testid="input-attendance-checkin" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="checkOut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saída</FormLabel>
                        <FormControl>
                          <Input {...field} type="time" data-testid="input-attendance-checkout" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-attendance">
                  {createMutation.isPending ? "Registrando..." : "Registrar Presença"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead>Horas Trabalhadas</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendanceRecords?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum registro de presença
                </TableCell>
              </TableRow>
            ) : (
              attendanceRecords?.map((record: any) => {
                const employee = employees?.find((e: any) => e.id === record.employeeId);
                return (
                  <TableRow key={record.id} data-testid={`row-attendance-${record.id}`}>
                    <TableCell className="font-medium">
                      {employee ? `${employee.firstName} ${employee.lastName}` : "Funcionário não encontrado"}
                    </TableCell>
                    <TableCell>{new Date(record.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{record.checkIn ? new Date(record.checkIn).toLocaleTimeString("pt-BR") : "-"}</TableCell>
                    <TableCell>{record.checkOut ? new Date(record.checkOut).toLocaleTimeString("pt-BR") : "-"}</TableCell>
                    <TableCell data-testid={`text-attendance-hours-${record.id}`}>
                      {record.hoursWorked ? `${parseFloat(record.hoursWorked).toFixed(2)}h` : "-"}
                    </TableCell>
                    <TableCell>
                      {record.isAbsent && <Badge variant="destructive">Ausente</Badge>}
                      {record.isLate && !record.isAbsent && <Badge variant="secondary">Atrasado</Badge>}
                      {!record.isAbsent && !record.isLate && <Badge variant="default">Presente</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
