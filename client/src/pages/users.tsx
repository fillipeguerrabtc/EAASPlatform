import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, UserCog, Briefcase, Truck, UserPlus, Shield, Mail } from "lucide-react";
import type { User } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function UsersPage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  // Fetch all employees (not customers)
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Usuário removido",
        description: "O usuário foi removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  // Filter employees only (exclude customers)
  const employees = users?.filter(u => u.userType === "employee") || [];
  
  // Categorize by role
  const byRole = {
    funcionarios: employees.filter(u => !["partner", "supplier"].includes(u.role)), // All internal roles except partners/suppliers
    parceiros: employees.filter(u => u.role === "partner"),
    fornecedores: employees.filter(u => u.role === "supplier"),
  };

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      super_admin: { label: "Super Admin", variant: "destructive" },
      tenant_admin: { label: "Admin da Empresa", variant: "destructive" },
      admin: { label: "Admin", variant: "destructive" },
      manager: { label: "Gerente", variant: "default" },
      employee: { label: "Funcionário", variant: "secondary" },
      agent: { label: "Agente", variant: "secondary" },
      support: { label: "Suporte", variant: "outline" },
      salesperson: { label: "Vendedor", variant: "outline" },
      partner: { label: "Parceiro", variant: "default" },
      supplier: { label: "Fornecedor", variant: "default" },
      customer: { label: "Cliente", variant: "outline" },
    };
    const config = roleMap[role] || { label: role, variant: "outline" };
    return <Badge variant={config.variant} data-testid={`badge-role-${role}`}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      approved: { label: "Aprovado", variant: "default" },
      pending_approval: { label: "Pendente", variant: "secondary" },
      rejected: { label: "Rejeitado", variant: "destructive" },
    };
    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant} data-testid={`badge-status-${status}`}>{config.label}</Badge>;
  };

  const UserTable = ({ users: tableUsers }: { users: User[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Função</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tableUsers.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
              Nenhum usuário encontrado
            </TableCell>
          </TableRow>
        ) : (
          tableUsers.map((user) => (
            <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
              <TableCell className="font-medium" data-testid={`text-username-${user.id}`}>{user.name}</TableCell>
              <TableCell data-testid={`text-email-${user.id}`}>{user.email}</TableCell>
              <TableCell>{getRoleBadge(user.role)}</TableCell>
              <TableCell>{getStatusBadge(user.approvalStatus)}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`button-email-${user.id}`}
                    asChild
                  >
                    <a href={`mailto:${user.email}`}>
                      <Mail className="h-4 w-4" />
                    </a>
                  </Button>
                  {user.role !== "super_admin" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteUserMutation.mutate(user.id)}
                      disabled={deleteUserMutation.isPending}
                      data-testid={`button-delete-${user.id}`}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Usuários & Times
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie funcionários, parceiros e fornecedores
          </p>
        </div>
        <div className="flex gap-2">
          <Button data-testid="button-invite-user">
            <UserPlus className="h-4 w-4 mr-2" />
            Convidar Usuário
          </Button>
          <Button variant="outline" data-testid="button-manage-roles" asChild>
            <a href="/rbac">
              <Shield className="h-4 w-4 mr-2" />
              Gerenciar Funções
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-stat-funcionarios">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funcionários</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-count-funcionarios">
              {byRole.funcionarios.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Total de funcionários ativos
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-parceiros">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parceiros</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-count-parceiros">
              {byRole.parceiros.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Parceiros cadastrados
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-fornecedores">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fornecedores</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-count-fornecedores">
              {byRole.fornecedores.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Fornecedores cadastrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Gerenciamento de Usuários</CardTitle>
          <CardDescription>
            Visualize e gerencie todos os usuários da plataforma organizados por categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="funcionarios" data-testid="tabs-users">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="funcionarios" data-testid="tab-funcionarios">
                <UserCog className="h-4 w-4 mr-2" />
                Funcionários ({byRole.funcionarios.length})
              </TabsTrigger>
              <TabsTrigger value="parceiros" data-testid="tab-parceiros">
                <Briefcase className="h-4 w-4 mr-2" />
                Parceiros ({byRole.parceiros.length})
              </TabsTrigger>
              <TabsTrigger value="fornecedores" data-testid="tab-fornecedores">
                <Truck className="h-4 w-4 mr-2" />
                Fornecedores ({byRole.fornecedores.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="funcionarios" data-testid="content-funcionarios">
              <UserTable users={byRole.funcionarios} />
            </TabsContent>

            <TabsContent value="parceiros" data-testid="content-parceiros">
              <UserTable users={byRole.parceiros} />
            </TabsContent>

            <TabsContent value="fornecedores" data-testid="content-fornecedores">
              <UserTable users={byRole.fornecedores} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
