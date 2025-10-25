import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Phone, Mail, Calendar, FileText, CheckSquare } from "lucide-react";
import type { Activity, Customer } from "@shared/schema";

const activityIcons = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
  task: CheckSquare,
  other: FileText,
};

export default function CRMActivities() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("note");
  const [customerId, setCustomerId] = useState("");

  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createActivityMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/activities", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          type,
          customerId: customerId || null,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      setIsCreating(false);
      setTitle("");
      setDescription("");
      setType("note");
      setCustomerId("");
      toast({
        title: "Atividade criada",
        description: "Nova atividade adicionada ao timeline",
      });
    },
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-crm-activities">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-activities-title">Atividades</h1>
          <p className="text-muted-foreground">Timeline de todas as interações com clientes</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-activity">
              <Plus className="mr-2 h-4 w-4" />
              Nova Atividade
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-activity">
            <DialogHeader>
              <DialogTitle>Registrar Nova Atividade</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger data-testid="select-activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Ligação</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="meeting">Reunião</SelectItem>
                    <SelectItem value="note">Nota</SelectItem>
                    <SelectItem value="task">Tarefa</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Resumo da atividade"
                  data-testid="input-activity-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes da atividade..."
                  rows={4}
                  data-testid="textarea-activity-description"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer">Cliente (opcional)</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger data-testid="select-customer">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => createActivityMutation.mutate()}
                disabled={!title || createActivityMutation.isPending}
                className="w-full"
                data-testid="button-save-activity"
              >
                Registrar Atividade
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Timeline */}
      <Card data-testid="card-activities-timeline">
        <CardHeader>
          <CardTitle>Timeline de Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : activities && activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity, index) => {
                const Icon = activityIcons[activity.type as keyof typeof activityIcons] || FileText;
                return (
                  <div
                    key={activity.id}
                    className="flex gap-4 pb-4 border-b last:border-0"
                    data-testid={`activity-${index}`}
                  >
                    <div className="p-3 rounded-lg bg-muted h-fit">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium" data-testid={`activity-title-${index}`}>
                            {activity.title}
                          </h4>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`activity-description-${index}`}>
                              {activity.description}
                            </p>
                          )}
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-muted capitalize" data-testid={`activity-type-${index}`}>
                          {activity.type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(activity.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground" data-testid="text-no-activities">
              Nenhuma atividade registrada
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
