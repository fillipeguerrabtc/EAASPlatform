import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smile, Briefcase, MessageCircle, Code, Check } from "lucide-react";
import { SEO } from "@/components/seo";
import { Badge } from "@/components/ui/badge";

type Tenant = {
  id: string;
  name: string;
  aiPersona: string;
  maxPersuasionLevel: string;
};

const personaOptions = [
  {
    value: 'professional',
    label: 'Profissional',
    icon: Briefcase,
    description: 'Tom formal e corporativo, ideal para ambientes empresariais e B2B',
    example: 'Bom dia. Como posso auxiliá-lo hoje com suas necessidades empresariais?',
    color: 'text-blue-600',
  },
  {
    value: 'friendly',
    label: 'Amigável',
    icon: Smile,
    description: 'Tom caloroso e acolhedor, excelente para atendimento ao cliente e vendas B2C',
    example: 'Oi! Que legal ter você aqui! Como posso te ajudar hoje?',
    color: 'text-green-600',
  },
  {
    value: 'casual',
    label: 'Casual',
    icon: MessageCircle,
    description: 'Tom descontraído e informal, perfeito para públicos jovens e startups',
    example: 'E aí! Tudo certo? Me conta o que você precisa!',
    color: 'text-purple-600',
  },
  {
    value: 'technical',
    label: 'Técnico',
    icon: Code,
    description: 'Tom preciso e detalhado, ideal para suporte técnico e produtos complexos',
    example: 'Olá. Estou apto a fornecer assistência técnica especializada. Qual é sua solicitação?',
    color: 'text-orange-600',
  },
];

export default function AiPersonaPage() {
  const { toast } = useToast();
  const [selectedPersona, setSelectedPersona] = useState<string>('');

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const tenant = tenants?.[0];

  const updatePersonaMutation = useMutation({
    mutationFn: async (persona: string) => {
      if (!tenant) return;
      return apiRequest("PATCH", `/api/tenants/${tenant.id}`, {
        aiPersona: persona,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({
        title: "Persona atualizada!",
        description: "O tom de resposta da IA foi alterado com sucesso.",
      });
      setSelectedPersona('');
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar a persona da IA.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (selectedPersona) {
      updatePersonaMutation.mutate(selectedPersona);
    }
  };

  const currentPersona = tenant?.aiPersona || 'professional';
  const currentOption = personaOptions.find(p => p.value === currentPersona);
  const selectedOption = personaOptions.find(p => p.value === selectedPersona);

  return (
    <>
      <SEO
        title="AI Persona & Tom - EAAS Platform"
        description="Configure a personalidade e tom de voz da sua assistente de IA. Sistema completo de gestão empresarial EAAS."
        keywords="AI, persona, tom de voz, personalização, assistente virtual, EAAS"
      />
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent" data-testid="text-ai-persona-title">
              AI Persona & Tom de Voz
            </h1>
            <p className="text-muted-foreground mt-1">
              Defina como sua assistente de IA se comunica com clientes e equipe
            </p>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Carregando configurações...</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Current Persona */}
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {currentOption && <currentOption.icon className="h-5 w-5" />}
                    Persona Atual
                  </CardTitle>
                  <CardDescription>
                    A IA está configurada com o tom: <strong>{currentOption?.label}</strong>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground mb-2">Exemplo de resposta:</p>
                    <p className="italic">&quot;{currentOption?.example}&quot;</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Check className="h-3 w-3" />
                      Ativa
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Persuasão máxima: {tenant?.maxPersuasionLevel || '0.70'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Change Persona */}
              <Card>
                <CardHeader>
                  <CardTitle>Alterar Persona</CardTitle>
                  <CardDescription>
                    Escolha uma nova personalidade para sua assistente de IA
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                      <SelectTrigger data-testid="select-ai-persona">
                        <SelectValue placeholder="Selecione uma persona" />
                      </SelectTrigger>
                      <SelectContent>
                        {personaOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedOption && (
                      <Card className="bg-muted/50 border-2">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <selectedOption.icon className={`h-5 w-5 ${selectedOption.color} mt-0.5`} />
                            <div className="flex-1 space-y-2">
                              <h4 className="font-semibold">{selectedOption.label}</h4>
                              <p className="text-sm text-muted-foreground">
                                {selectedOption.description}
                              </p>
                              <div className="p-3 bg-background rounded-md border">
                                <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                                <p className="text-sm italic">&quot;{selectedOption.example}&quot;</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={!selectedPersona || selectedPersona === currentPersona || updatePersonaMutation.isPending}
                    className="w-full"
                    data-testid="button-save-persona"
                  >
                    {updatePersonaMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </CardContent>
              </Card>

              {/* All Options Reference */}
              <Card>
                <CardHeader>
                  <CardTitle>Guia de Personas</CardTitle>
                  <CardDescription>
                    Entenda cada opção disponível
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {personaOptions.map((option) => {
                      const Icon = option.icon;
                      const isActive = option.value === currentPersona;
                      return (
                        <Card
                          key={option.value}
                          className={`relative ${isActive ? 'ring-2 ring-primary' : ''}`}
                          data-testid={`persona-card-${option.value}`}
                        >
                          <CardContent className="p-4 space-y-2">
                            {isActive && (
                              <Badge className="absolute top-2 right-2" variant="default">
                                Ativa
                              </Badge>
                            )}
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${option.color}`} />
                              <h4 className="font-semibold">{option.label}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {option.description}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  );
}
