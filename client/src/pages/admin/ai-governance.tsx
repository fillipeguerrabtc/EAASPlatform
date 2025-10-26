import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, Shield, AlertTriangle, CheckCircle2, XCircle, BarChart3 } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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

const COLORS = ['#10A37F', '#8B5CF6', '#F59E0B', '#EF4444', '#3B82F6'];

export default function AiGovernance() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("7d");
  
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
            <CardHeader>
              <CardTitle>AI Governance Policies</CardTitle>
              <CardDescription>Configure LTL+D policies and Critics thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Policy management coming soon
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
