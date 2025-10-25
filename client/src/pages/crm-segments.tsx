import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Tag } from "lucide-react";
import type { CustomerSegment } from "@shared/schema";

export default function CRMSegments() {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [filters, setFilters] = useState({});

  const { data: segments, isLoading } = useQuery<CustomerSegment[]>({
    queryKey: ["/api/customer-segments"],
  });

  const createSegmentMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/customer-segments", {
        method: "POST",
        body: JSON.stringify({
          name,
          filters,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-segments"] });
      setIsCreating(false);
      setName("");
      setFilters({});
      toast({
        title: "Segmento criado",
        description: "Novo segmento adicionado com sucesso",
      });
    },
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/customer-segments/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer-segments"] });
      toast({
        title: "Segmento deletado",
        description: "Segmento removido com sucesso",
      });
    },
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-crm-segments">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-segments-title">Segmentos de Clientes</h1>
          <p className="text-muted-foreground">Organize seus clientes em grupos personalizados</p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-segment">
              <Plus className="mr-2 h-4 w-4" />
              Novo Segmento
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-segment">
            <DialogHeader>
              <DialogTitle>Criar Novo Segmento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Segmento</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Clientes VIP"
                  data-testid="input-segment-name"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Filtros dinâmicos serão adicionados em breve
              </div>
              <Button
                onClick={() => createSegmentMutation.mutate()}
                disabled={!name || createSegmentMutation.isPending}
                className="w-full"
                data-testid="button-save-segment"
              >
                Criar Segmento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Segments List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Carregando...
            </CardContent>
          </Card>
        ) : segments && segments.length > 0 ? (
          segments.map((segment, index) => (
            <Card key={segment.id} data-testid={`segment-card-${index}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  <span data-testid={`segment-name-${index}`}>{segment.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Criado em: {new Date(segment.createdAt).toLocaleDateString("pt-BR")}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteSegmentMutation.mutate(segment.id)}
                  disabled={deleteSegmentMutation.isPending}
                  data-testid={`button-delete-segment-${index}`}
                >
                  Deletar
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="p-12 text-center text-muted-foreground" data-testid="text-no-segments">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhum segmento criado ainda</p>
              <p className="text-sm mt-2">Crie seu primeiro segmento para organizar seus clientes</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
