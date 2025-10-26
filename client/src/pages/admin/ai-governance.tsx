import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, Shield, AlertTriangle, CheckCircle2, XCircle, BarChart3, Plus, Pencil, Trash2, Power, PowerOff } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AiTrace {
  id: string;
  tenantId: string;
  customerId?: string;
  messageContent: string;
  aiResponse: string;
  responseSource: string;
  factualScore: string;
  numericScore: string;
  ethicalScore: string;
  riskScore: string;
  overallConfidence: string;
  passed: boolean;
  shouldEscalateToHuman: boolean;
  finalRecommendation: string;
  createdAt: Date;
}

interface MetricsSummary {
  avgFactualScore: number;
  avgNumericScore: number;
  avgEthicalScore: number;
  avgRiskScore: number;
  avgOverallConfidence: number;
  totalTraces: number;
  escalationRate: number;
  passRate: number;
  topViolations: Array<{ violation: string; count: number }>;
  tracesBySource: Array<{ source: string; count: number }>;
}

interface AiGovernancePolicy {
  id: string;
  tenantId: string;
  policyName: string;
  policyType: string;
  ltlFormula: string | null;
  maxPersuasionLevel: string | null;
  riskThreshold: string | null;
  enforcementMode: string;
  isActive: boolean;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

const policyFormSchema = z.object({
  policyName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  policyType: z.enum(["ltl", "ethical", "risk", "persuasion"]),
  ltlFormula: z.string().optional(),
  maxPersuasionLevel: z.string().optional(),
  riskThreshold: z.string().optional(),
  enforcementMode: z.enum(["enforce", "warn", "log"]).default("enforce"),
  isActive: z.boolean().default(true),
});

const COLORS = ['#10A37F', '#8B5CF6', '#F59E0B', '#EF4444', '#3B82F6'];

export default function AiGovernance() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("7d");
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<AiGovernancePolicy | null>(null);
  const { toast } = useToast();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90));
  
  const { data: traces, isLoading: tracesLoading } = useQuery<AiTrace[]>({
    queryKey: ["/api/ai/governance/traces", timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: "100",
        startDate: startDate.toISOString(),
      });
      const response = await fetch(`/api/ai/governance/traces?${params}`);
      if (!response.ok) throw new Error("Failed to fetch traces");
      return response.json();
    },
  });
  
  const { data: metrics, isLoading: metricsLoading } = useQuery<MetricsSummary>({
    queryKey: ["/api/ai/governance/metrics/summary", timeRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
      });
      const response = await fetch(`/api/ai/governance/metrics/summary?${params}`);
      if (!response.ok) throw new Error("Failed to fetch metrics");
      return response.json();
    },
  });
  
  const { data: policies = [], isLoading: policiesLoading } = useQuery<AiGovernancePolicy[]>({
    queryKey: ["/api/ai/governance/policies"],
  });
  
  const policyForm = useForm<z.infer<typeof policyFormSchema>>({
    resolver: zodResolver(policyFormSchema),
    defaultValues: {
      policyName: "",
      policyType: "ethical",
      enforcementMode: "enforce",
      isActive: true,
    },
  });
  
  const createPolicyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof policyFormSchema>) => {
      return apiRequest("POST", "/api/ai/governance/policies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/governance/policies"] });
      setPolicyDialogOpen(false);
      setEditingPolicy(null);
      policyForm.reset();
      toast({
        title: "Política criada",
        description: "A política foi criada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar política",
        description: error.message || "Não foi possível criar a política.",
        variant: "destructive",
      });
    },
  });
  
  const updatePolicyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof policyFormSchema> }) => {
      return apiRequest("PUT", `/api/ai/governance/policies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/governance/policies"] });
      setPolicyDialogOpen(false);
      setEditingPolicy(null);
      policyForm.reset();
      toast({
        title: "Política atualizada",
        description: "A política foi atualizada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar política",
        description: error.message || "Não foi possível atualizar a política.",
        variant: "destructive",
      });
    },
  });
  
  const deletePolicyMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/ai/governance/policies/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/governance/policies"] });
      toast({
        title: "Política deletada",
        description: "A política foi removida com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao deletar política",
        description: error.message || "Não foi possível deletar a política.",
        variant: "destructive",
      });
    },
  });
  
  const handleEditPolicy = (policy: AiGovernancePolicy) => {
    setEditingPolicy(policy);
    policyForm.reset({
      policyName: policy.policyName,
      policyType: policy.policyType as any,
      ltlFormula: policy.ltlFormula || "",
      maxPersuasionLevel: policy.maxPersuasionLevel || "",
      riskThreshold: policy.riskThreshold || "",
      enforcementMode: policy.enforcementMode as any,
      isActive: policy.isActive,
    });
    setPolicyDialogOpen(true);
  };
  
  const handleSubmitPolicy = (data: z.infer<typeof policyFormSchema>) => {
    if (editingPolicy) {
      updatePolicyMutation.mutate({ id: editingPolicy.id, data });
    } else {
      createPolicyMutation.mutate(data);
    }
  };
  
  const criticsChartData = metrics ? [
    { name: "Factual", score: metrics.avgFactualScore },
    { name: "Numeric", score: metrics.avgNumericScore },
    { name: "Ethical", score: metrics.avgEthicalScore },
    { name: "Risk", score: metrics.avgRiskScore },
    { name: "Overall", score: metrics.avgOverallConfidence },
  ] : [];
  
  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Brain className="h-8 w-8 text-primary" />
            AI Governance
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor AI decisions, Critics system performance, and compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={timeRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("7d")}
            data-testid="button-filter-7d"
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("30d")}
            data-testid="button-filter-30d"
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("90d")}
            data-testid="button-filter-90d"
          >
            90 Days
          </Button>
        </div>
      </div>
      
      {metricsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : metrics ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-total-traces">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Traces</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-traces">{metrics.totalTraces}</div>
              <p className="text-xs text-muted-foreground">AI decisions tracked</p>
            </CardContent>
          </Card>
          
          <Card data-testid="card-pass-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-pass-rate">
                {metrics.passRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Critics approved</p>
            </CardContent>
          </Card>
          
          <Card data-testid="card-escalation-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Escalation Rate</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-escalation-rate">
                {metrics.escalationRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Required human review</p>
            </CardContent>
          </Card>
          
          <Card data-testid="card-avg-confidence">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary" data-testid="text-avg-confidence">
                {metrics.avgOverallConfidence.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Overall score</p>
            </CardContent>
          </Card>
        </div>
      ) : null}
      
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics" data-testid="tab-metrics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="traces" data-testid="tab-traces">
            <BarChart3 className="h-4 w-4 mr-2" />
            Traces
          </TabsTrigger>
          <TabsTrigger value="policies" data-testid="tab-policies">
            <Shield className="h-4 w-4 mr-2" />
            Policies
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Critics Performance</CardTitle>
                <CardDescription>Average scores by critic type</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={criticsChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 1]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="#10A37F" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Traces by Source</CardTitle>
                <CardDescription>Distribution of AI response sources</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : metrics && metrics.tracesBySource.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={metrics.tracesBySource}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.source}: ${entry.count}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {metrics.tracesBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Top Violations</CardTitle>
              <CardDescription>Most common issues detected by Critics</CardDescription>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : metrics && metrics.topViolations.length > 0 ? (
                <div className="space-y-2">
                  {metrics.topViolations.map((violation, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-md hover-elevate border"
                      data-testid={`violation-${i}`}
                    >
                      <span className="text-sm">{violation.violation}</span>
                      <Badge variant="secondary">{violation.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No violations detected
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="traces" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent AI Traces</CardTitle>
              <CardDescription>Latest decisions made by AI system with Critics validation</CardDescription>
            </CardHeader>
            <CardContent>
              {tracesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : traces && traces.length > 0 ? (
                <div className="space-y-4">
                  {traces.map((trace) => (
                    <div
                      key={trace.id}
                      className="border rounded-lg p-4 hover-elevate space-y-3"
                      data-testid={`trace-${trace.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={trace.passed ? "default" : "destructive"}>
                              {trace.passed ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                              {trace.passed ? "Passed" : "Failed"}
                            </Badge>
                            <Badge variant="outline">{trace.responseSource}</Badge>
                            {trace.shouldEscalateToHuman && (
                              <Badge variant="outline" className="border-orange-500 text-orange-600">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Escalated
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm">
                            <strong>Message:</strong> {trace.messageContent.slice(0, 100)}
                            {trace.messageContent.length > 100 && "..."}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <strong>Response:</strong> {trace.aiResponse.slice(0, 150)}
                            {trace.aiResponse.length > 150 && "..."}
                          </div>
                        </div>
                        <div className="text-right space-y-1 min-w-[120px]">
                          <div className="text-xs text-muted-foreground">
                            {new Date(trace.createdAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs font-mono">
                            Overall: {parseFloat(trace.overallConfidence).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>F: {parseFloat(trace.factualScore).toFixed(2)}</div>
                            <div>N: {parseFloat(trace.numericScore).toFixed(2)}</div>
                            <div>E: {parseFloat(trace.ethicalScore).toFixed(2)}</div>
                            <div>R: {parseFloat(trace.riskScore).toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                      {trace.finalRecommendation && (
                        <div className="text-xs bg-muted p-2 rounded">
                          <strong>Recommendation:</strong> {trace.finalRecommendation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No traces available for selected period
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <div>
                <CardTitle>AI Governance Policies</CardTitle>
                <CardDescription>Configure LTL+D policies and Critics thresholds</CardDescription>
              </div>
              <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => {
                      setEditingPolicy(null);
                      policyForm.reset();
                    }}
                    data-testid="button-create-policy"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Política
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingPolicy ? "Editar Política" : "Nova Política"}
                    </DialogTitle>
                    <DialogDescription>
                      Configure políticas de governança baseadas em LTL+D para o sistema Critics
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...policyForm}>
                    <form onSubmit={policyForm.handleSubmit(handleSubmitPolicy)} className="space-y-4">
                      <FormField
                        control={policyForm.control}
                        name="policyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome da Política</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Limite de Persuasão Máximo" {...field} data-testid="input-policy-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={policyForm.control}
                        name="policyType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Política</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-policy-type">
                                  <SelectValue placeholder="Selecione o tipo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ltl">LTL (Linear Temporal Logic)</SelectItem>
                                <SelectItem value="ethical">Ética</SelectItem>
                                <SelectItem value="risk">Risco</SelectItem>
                                <SelectItem value="persuasion">Persuasão</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Tipo de validação aplicada pelo Critics
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={policyForm.control}
                        name="ltlFormula"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fórmula LTL+D (Opcional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Ex: G(request_refund -> F[0,24h] process_refund)" 
                                {...field} 
                                data-testid="input-ltl-formula"
                              />
                            </FormControl>
                            <FormDescription>
                              Fórmula temporal para validação automática
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={policyForm.control}
                          name="maxPersuasionLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Max Persuasão (0.00-1.00)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  min="0" 
                                  max="1" 
                                  placeholder="0.70" 
                                  {...field} 
                                  data-testid="input-max-persuasion"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={policyForm.control}
                          name="riskThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Limite de Risco (0.00-1.00)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  min="0" 
                                  max="1" 
                                  placeholder="0.80" 
                                  {...field} 
                                  data-testid="input-risk-threshold"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={policyForm.control}
                        name="enforcementMode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Modo de Enforcement</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-enforcement-mode">
                                  <SelectValue placeholder="Selecione o modo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="enforce">Enforce (Bloquear)</SelectItem>
                                <SelectItem value="warn">Warn (Avisar)</SelectItem>
                                <SelectItem value="log">Log (Apenas registrar)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Como o sistema deve reagir a violações
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={policyForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                              <FormLabel>Política Ativa</FormLabel>
                              <FormDescription>
                                Ativar/desativar esta política
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-is-active"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setPolicyDialogOpen(false)}
                          data-testid="button-cancel-policy"
                        >
                          Cancelar
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createPolicyMutation.isPending || updatePolicyMutation.isPending}
                          data-testid="button-submit-policy"
                        >
                          {createPolicyMutation.isPending || updatePolicyMutation.isPending ? "Salvando..." : "Salvar Política"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {policiesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : policies.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Enforcement</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policies.map((policy) => (
                      <TableRow key={policy.id} data-testid={`policy-row-${policy.id}`}>
                        <TableCell className="font-medium">{policy.policyName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" data-testid={`badge-type-${policy.id}`}>
                            {policy.policyType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={policy.enforcementMode === "enforce" ? "default" : "secondary"}
                            data-testid={`badge-enforcement-${policy.id}`}
                          >
                            {policy.enforcementMode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {policy.isActive ? (
                            <Badge variant="default" className="bg-green-600" data-testid={`badge-active-${policy.id}`}>
                              <Power className="h-3 w-3 mr-1" />
                              Ativa
                            </Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`badge-inactive-${policy.id}`}>
                              <PowerOff className="h-3 w-3 mr-1" />
                              Inativa
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditPolicy(policy)}
                              data-testid={`button-edit-${policy.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deletePolicyMutation.mutate(policy.id)}
                              disabled={deletePolicyMutation.isPending}
                              data-testid={`button-delete-${policy.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Nenhuma política configurada</p>
                  <p className="text-sm mb-4">
                    Crie políticas LTL+D para governar o comportamento da IA
                  </p>
                  <Button 
                    onClick={() => {
                      setEditingPolicy(null);
                      policyForm.reset();
                      setPolicyDialogOpen(true);
                    }}
                    data-testid="button-create-first-policy"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Política
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
