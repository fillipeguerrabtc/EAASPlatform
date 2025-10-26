import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Users, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import type { User } from "@shared/schema";

export default function UserApprovals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: pendingUsers, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/user-approvals"],
    enabled: !!user && ['super_admin', 'tenant_admin', 'manager'].includes(user.role),
  });

  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/admin/user-approvals/${userId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-approvals"] });
      toast({
        title: "Usuário aprovado",
        description: "O usuário foi aprovado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar",
        description: error.message || "Não foi possível aprovar o usuário.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      return apiRequest("POST", `/api/admin/user-approvals/${userId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/user-approvals"] });
      setRejectDialogOpen(false);
      setSelectedUser(null);
      setRejectReason("");
      toast({
        title: "Usuário rejeitado",
        description: "O usuário foi rejeitado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao rejeitar",
        description: error.message || "Não foi possível rejeitar o usuário.",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (userId: string) => {
    approveMutation.mutate(userId);
  };

  const handleRejectClick = (user: User) => {
    setSelectedUser(user);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (!selectedUser || !rejectReason.trim()) {
      toast({
        title: "Motivo obrigatório",
        description: "Por favor, informe o motivo da rejeição.",
        variant: "destructive",
      });
      return;
    }
    rejectMutation.mutate({ userId: selectedUser.id, reason: rejectReason });
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user || !['super_admin', 'tenant_admin', 'manager'].includes(user.role)) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Aprovações de Usuários</h1>
        <p className="text-muted-foreground">
          Gerencie as solicitações de cadastro de novos usuários
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Solicitações Pendentes</CardTitle>
          </div>
          <CardDescription>
            Lista de usuários aguardando aprovação
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !pendingUsers || pendingUsers.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-state">
              <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma solicitação pendente</h3>
              <p className="text-sm text-muted-foreground">
                Todas as solicitações foram processadas
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-name">Nome</TableHead>
                    <TableHead data-testid="header-email">Email</TableHead>
                    <TableHead data-testid="header-type">Tipo</TableHead>
                    <TableHead data-testid="header-date">Data Solicitação</TableHead>
                    <TableHead data-testid="header-actions">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((pendingUser) => (
                    <TableRow key={pendingUser.id} data-testid={`row-user-${pendingUser.id}`}>
                      <TableCell data-testid={`text-name-${pendingUser.id}`}>
                        {pendingUser.name}
                      </TableCell>
                      <TableCell data-testid={`text-email-${pendingUser.id}`}>
                        {pendingUser.email}
                      </TableCell>
                      <TableCell data-testid={`text-type-${pendingUser.id}`}>
                        <Badge variant={pendingUser.userType === 'employee' ? 'default' : 'secondary'}>
                          {pendingUser.userType === 'employee' ? 'Funcionário' : 'Cliente'}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-date-${pendingUser.id}`}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatDate(pendingUser.requestedAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(pendingUser.id)}
                            disabled={approveMutation.isPending}
                            data-testid={`button-approve-${pendingUser.id}`}
                            className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectClick(pendingUser)}
                            disabled={rejectMutation.isPending}
                            data-testid={`button-reject-${pendingUser.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent data-testid="dialog-reject">
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição para {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">Motivo da Rejeição</Label>
              <Textarea
                id="reject-reason"
                placeholder="Ex: Dados incompletos, empresa não autorizada, etc."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                data-testid="input-reject-reason"
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setSelectedUser(null);
                setRejectReason("");
              }}
              data-testid="button-cancel-reject"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejeitando..." : "Confirmar Rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
