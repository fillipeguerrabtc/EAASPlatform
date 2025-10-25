import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogTrigger,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  DollarSign,
  Package,
  Users,
  MessageSquare,
  Calendar,
  Brain,
  CreditCard,
  Settings,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Types
type Role = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type RolePermission = {
  roleId: string;
  feature: string;
  accessLevel: string;
  createdAt: string;
};

type AccessLevel = "no_access" | "read" | "write" | "admin";
type Feature = "finance" | "products" | "customers" | "conversations" | "calendar" | "ai" | "payments" | "settings";

// Feature metadata
const FEATURES: Record<Feature, { label: string; icon: any; description: string }> = {
  finance: {
    label: "Finanças",
    icon: DollarSign,
    description: "Gestão de receitas, despesas e relatórios"
  },
  products: {
    label: "Produtos",
    icon: Package,
    description: "Marketplace e catálogo de produtos"
  },
  customers: {
    label: "Clientes",
    icon: Users,
    description: "CRM 360° e gestão de clientes"
  },
  conversations: {
    label: "Conversas",
    icon: MessageSquare,
    description: "Omnichat e mensagens"
  },
  calendar: {
    label: "Calendário",
    icon: Calendar,
    description: "Agendamentos e eventos"
  },
  ai: {
    label: "IA",
    icon: Brain,
    description: "Base de conhecimento e IA"
  },
  payments: {
    label: "Pagamentos",
    icon: CreditCard,
    description: "Gestão de pagamentos"
  },
  settings: {
    label: "Configurações",
    icon: Settings,
    description: "Configurações do tenant"
  }
};

const ACCESS_LEVELS: Record<AccessLevel, { label: string; color: string }> = {
  no_access: { label: "Sem Acesso", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  read: { label: "Leitura", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  write: { label: "Escrita", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  admin: { label: "Admin", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" }
};

// Form schema
const roleFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  description: z.string().max(500, "Descrição muito longa").optional(),
});

type RoleFormData = z.infer<typeof roleFormSchema>;

export default function RBAC() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<Role | null>(null);

  // Fetch roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  // Fetch permissions for selected role
  const { data: permissions = [], isLoading: permissionsLoading } = useQuery<RolePermission[]>({
    queryKey: ["/api/roles", selectedRoleForPermissions?.id, "permissions"],
    enabled: !!selectedRoleForPermissions,
  });

  // Form
  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (data: RoleFormData) =>
      apiRequest("/api/roles", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Função criada",
        description: "A função foi criada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar função",
        description: error.message || "Ocorreu um erro ao criar a função.",
      });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RoleFormData> }) =>
      apiRequest(`/api/roles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setEditingRole(null);
      form.reset();
      toast({
        title: "Função atualizada",
        description: "A função foi atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar função",
        description: error.message || "Ocorreu um erro ao atualizar a função.",
      });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/api/roles/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setDeletingRole(null);
      if (selectedRoleForPermissions?.id === deletingRole?.id) {
        setSelectedRoleForPermissions(null);
      }
      toast({
        title: "Função excluída",
        description: "A função foi excluída com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir função",
        description: error.message || "Ocorreu um erro ao excluir a função.",
      });
    },
  });

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ roleId, feature, accessLevel }: { roleId: string; feature: string; accessLevel: string }) =>
      apiRequest(`/api/roles/${roleId}/permissions/${feature}`, {
        method: "PATCH",
        body: JSON.stringify({ accessLevel }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles", selectedRoleForPermissions?.id, "permissions"] });
      toast({
        title: "Permissão atualizada",
        description: "A permissão foi atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar permissão",
        description: error.message || "Ocorreu um erro ao atualizar a permissão.",
      });
    },
  });

  const handleCreateRole = (data: RoleFormData) => {
    createRoleMutation.mutate(data);
  };

  const handleUpdateRole = (data: RoleFormData) => {
    if (!editingRole) return;
    updateRoleMutation.mutate({ id: editingRole.id, data });
  };

  const handleDeleteRole = () => {
    if (!deletingRole) return;
    deleteRoleMutation.mutate(deletingRole.id);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    form.reset({
      name: role.name,
      description: role.description || "",
    });
  };

  const handlePermissionChange = (feature: Feature, accessLevel: AccessLevel) => {
    if (!selectedRoleForPermissions) return;
    updatePermissionMutation.mutate({
      roleId: selectedRoleForPermissions.id,
      feature,
      accessLevel,
    });
  };

  const getPermissionLevel = (feature: Feature): AccessLevel => {
    if (!permissions) return "no_access";
    const permission = permissions.find((p) => p.feature === feature);
    return (permission?.accessLevel as AccessLevel) || "no_access";
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Funções e Permissões
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerencie funções personalizadas e permissões de acesso por recurso
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-role">
              <Plus className="h-4 w-4 mr-2" />
              Nova Função
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-role">
            <DialogHeader>
              <DialogTitle>Criar Nova Função</DialogTitle>
              <DialogDescription>
                Crie uma função personalizada para seu tenant
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateRole)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Ex: Gerente de Vendas"
                          data-testid="input-role-name"
                        />
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
                          placeholder="Descrição opcional da função"
                          data-testid="input-role-description"
                          rows={3}
                        />
                      </FormControl>
                      <FormDescription>
                        Opcional: Descreva as responsabilidades desta função
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createRoleMutation.isPending}
                    data-testid="button-submit-create"
                  >
                    {createRoleMutation.isPending ? "Criando..." : "Criar Função"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Roles List */}
        <Card data-testid="card-roles-list">
          <CardHeader>
            <CardTitle>Funções Disponíveis</CardTitle>
            <CardDescription>
              Selecione uma função para configurar permissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rolesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : roles.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Nenhuma função cadastrada. Crie uma nova função para começar.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow
                      key={role.id}
                      data-testid={`row-role-${role.id}`}
                      className={selectedRoleForPermissions?.id === role.id ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <div className="font-medium">{role.name}</div>
                        {role.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {role.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {role.isDefault ? (
                          <Badge variant="secondary">Padrão</Badge>
                        ) : (
                          <Badge variant="outline">Personalizada</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRoleForPermissions(role)}
                            data-testid={`button-select-role-${role.id}`}
                          >
                            {selectedRoleForPermissions?.id === role.id ? "Selecionada" : "Selecionar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditRole(role)}
                            data-testid={`button-edit-role-${role.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingRole(role)}
                            data-testid={`button-delete-role-${role.id}`}
                            disabled={role.isDefault}
                          >
                            <Trash2 className="h-4 w-4" />
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

        {/* Permission Matrix */}
        <Card data-testid="card-permissions-matrix">
          <CardHeader>
            <CardTitle>
              {selectedRoleForPermissions
                ? `Permissões: ${selectedRoleForPermissions.name}`
                : "Matriz de Permissões"}
            </CardTitle>
            <CardDescription>
              {selectedRoleForPermissions
                ? "Configure o nível de acesso para cada recurso"
                : "Selecione uma função para configurar permissões"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedRoleForPermissions ? (
              <div className="text-center py-12">
                <Shield className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">
                  Selecione uma função na lista ao lado para configurar suas permissões
                </p>
              </div>
            ) : permissionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {(Object.keys(FEATURES) as Feature[]).map((feature) => {
                  const featureData = FEATURES[feature];
                  const Icon = featureData.icon;
                  const currentLevel = getPermissionLevel(feature);

                  return (
                    <div
                      key={feature}
                      className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-card hover-elevate"
                      data-testid={`permission-row-${feature}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                        <div className="p-2 rounded-md bg-muted">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium">{featureData.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {featureData.description}
                          </div>
                        </div>
                      </div>

                      <Select
                        value={currentLevel}
                        onValueChange={(value) =>
                          handlePermissionChange(feature, value as AccessLevel)
                        }
                        disabled={updatePermissionMutation.isPending}
                      >
                        <SelectTrigger
                          className="w-[180px]"
                          data-testid={`select-permission-${feature}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(ACCESS_LEVELS) as AccessLevel[]).map((level) => (
                            <SelectItem
                              key={level}
                              value={level}
                              data-testid={`option-${feature}-${level}`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`px-2 py-1 rounded text-xs font-medium ${ACCESS_LEVELS[level].color}`}
                                >
                                  {ACCESS_LEVELS[level].label}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent data-testid="dialog-edit-role">
          <DialogHeader>
            <DialogTitle>Editar Função</DialogTitle>
            <DialogDescription>
              Atualize as informações da função
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateRole)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ex: Gerente de Vendas"
                        data-testid="input-edit-role-name"
                      />
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
                        placeholder="Descrição opcional da função"
                        data-testid="input-edit-role-description"
                        rows={3}
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
                  onClick={() => setEditingRole(null)}
                  data-testid="button-cancel-edit"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateRoleMutation.isPending}
                  data-testid="button-submit-edit"
                >
                  {updateRoleMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingRole} onOpenChange={(open) => !open && setDeletingRole(null)}>
        <AlertDialogContent data-testid="dialog-delete-role">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Função</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a função "{deletingRole?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRole}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRoleMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
