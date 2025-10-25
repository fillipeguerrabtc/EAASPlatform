import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign } from "lucide-react";
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Deal, PipelineStage, Customer } from "@shared/schema";

function DealCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-move hover-elevate mb-2"
      data-testid={`deal-card-${deal.id}`}
    >
      <CardContent className="p-3">
        <h4 className="font-medium" data-testid={`deal-title-${deal.id}`}>{deal.title}</h4>
        <div className="flex items-center gap-2 mt-2">
          <DollarSign className="h-4 w-4 text-green-500" />
          <span className="text-sm font-semibold" data-testid={`deal-value-${deal.id}`}>
            R$ {parseFloat(deal.value).toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Probabilidade: {deal.probability}%
        </p>
      </CardContent>
    </Card>
  );
}

export default function CRMPipeline() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealValue, setNewDealValue] = useState("");
  const [newDealCustomerId, setNewDealCustomerId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const { data: deals } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => {
      return await apiRequest(`/api/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ stageId }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Negócio atualizado",
        description: "O estágio foi atualizado com sucesso",
      });
    },
  });

  const createDealMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/deals", {
        method: "POST",
        body: JSON.stringify({
          title: newDealTitle,
          value: newDealValue,
          customerId: newDealCustomerId,
          stageId: selectedStageId,
          probability: 50,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setIsCreating(false);
      setNewDealTitle("");
      setNewDealValue("");
      setNewDealCustomerId("");
      setSelectedStageId("");
      toast({
        title: "Negócio criado",
        description: "Novo negócio adicionado ao pipeline",
      });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const newStageId = over.id as string;

    updateDealMutation.mutate({ dealId, stageId: newStageId });
  };

  const dealsByStage = stages?.reduce((acc, stage) => {
    acc[stage.id] = deals?.filter(d => d.stageId === stage.id) || [];
    return acc;
  }, {} as Record<string, Deal[]>) || {};

  return (
    <div className="p-6 space-y-6" data-testid="page-crm-pipeline">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-pipeline-title">Pipeline de Vendas</h1>
          <p className="text-muted-foreground">Gerencie seus negócios no funil de vendas</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-deal">
              <Plus className="mr-2 h-4 w-4" />
              Novo Negócio
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-deal">
            <DialogHeader>
              <DialogTitle>Criar Novo Negócio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={newDealTitle}
                  onChange={(e) => setNewDealTitle(e.target.value)}
                  placeholder="Nome do negócio"
                  data-testid="input-deal-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Valor</Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  value={newDealValue}
                  onChange={(e) => setNewDealValue(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-deal-value"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer">Cliente</Label>
                <Select value={newDealCustomerId} onValueChange={setNewDealCustomerId}>
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
              <div className="space-y-2">
                <Label htmlFor="stage">Estágio</Label>
                <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger data-testid="select-stage">
                    <SelectValue placeholder="Selecione um estágio" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages?.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => createDealMutation.mutate()}
                disabled={!newDealTitle || !newDealValue || !newDealCustomerId || !selectedStageId || createDealMutation.isPending}
                className="w-full"
                data-testid="button-save-deal"
              >
                Criar Negócio
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stages?.map(stage => (
            <Card key={stage.id} className="flex flex-col" data-testid={`stage-column-${stage.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span data-testid={`stage-name-${stage.id}`}>{stage.name}</span>
                  <span
                    className="text-sm font-normal text-muted-foreground"
                    data-testid={`stage-count-${stage.id}`}
                  >
                    {dealsByStage[stage.id]?.length || 0}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <SortableContext
                  items={dealsByStage[stage.id]?.map(d => d.id) || []}
                  strategy={verticalListSortingStrategy}
                  id={stage.id}
                >
                  {dealsByStage[stage.id]?.map(deal => (
                    <DealCard key={deal.id} deal={deal} />
                  ))}
                </SortableContext>
              </CardContent>
            </Card>
          ))}
        </div>
      </DndContext>
    </div>
  );
}
