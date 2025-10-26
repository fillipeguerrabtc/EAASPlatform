import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Sparkles, Scan, Copy, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { ThemeTokens } from '@shared/schema';
import { useBrandTheme } from './brand-theme-provider';

interface BrandJob {
  id: string;
  tenantId: string;
  url: string;
  mode: 'extract' | 'clone';
  status: 'queued' | 'running' | 'done' | 'failed';
  results?: any;
  errorMessage?: string;
  durationMs?: number;
  createdAt: string;
}

interface ThemeBundle {
  id: string;
  tenantId: string;
  version: number;
  tokens: ThemeTokens;
  sourceUrl: string;
  isActive: boolean;
  createdAt: string;
}

interface BrandScannerSectionProps {
  tenantId?: string;
}

export function BrandScannerSection({ tenantId }: BrandScannerSectionProps) {
  const { toast } = useToast();
  const { applyTheme } = useBrandTheme();
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [selectedMode, setSelectedMode] = useState<'extract' | 'clone'>('extract');

  // Query: List jobs
  const { data: jobs = [], refetch: refetchJobs } = useQuery<BrandJob[]>({
    queryKey: ['/api/brand/jobs', tenantId],
    enabled: !!tenantId,
  });

  // Query: List theme bundles
  const { data: themes = [], refetch: refetchThemes } = useQuery<ThemeBundle[]>({
    queryKey: ['/api/brand/themes', tenantId],
    enabled: !!tenantId,
  });

  // Mutation: Create job
  const createJobMutation = useMutation({
    mutationFn: async (data: { url: string; mode: 'extract' | 'clone'; tenantId: string }) => {
      return apiRequest('POST', '/api/brand/jobs', data) as unknown as { jobId: string; status: string };
    },
    onSuccess: (data) => {
      toast({
        title: '✅ Job Criado',
        description: `Job ${data.jobId} iniciado. Status: ${data.status}`,
      });
      setWebsiteUrl('');
      refetchJobs();
      // Poll for job status
      const interval = setInterval(() => {
        refetchJobs();
        refetchThemes();
      }, 2000);
      setTimeout(() => clearInterval(interval), 60000); // Stop after 60s
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation: Activate theme
  const activateThemeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      return apiRequest('POST', `/api/brand/themes/${themeId}/activate`, { tenantId });
    },
    onSuccess: () => {
      toast({
        title: '✅ Tema Ativado',
        description: 'O tema foi aplicado com sucesso!',
      });
      refetchThemes();
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreateJob = () => {
    if (!websiteUrl || !tenantId) {
      toast({
        title: '⚠️ URL Obrigatória',
        description: 'Por favor, insira uma URL válida.',
        variant: 'destructive',
      });
      return;
    }

    createJobMutation.mutate({
      url: websiteUrl,
      mode: selectedMode,
      tenantId,
    });
  };

  const handlePreviewTheme = (theme: ThemeBundle) => {
    applyTheme(theme.tokens);
    toast({
      title: '👁️ Preview Ativado',
      description: 'Visualize as mudanças. Clique em "Ativar" para salvar.',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Na Fila</Badge>;
      case 'running':
        return <Badge variant="default" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Rodando</Badge>;
      case 'done':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" />Concluído</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className="border-purple-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          Brand Scanner 2.0
        </CardTitle>
        <CardDescription>
          Extraia automaticamente a identidade visual completa de qualquer website ou clone o site inteiro para usar como seu marketplace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* URL Input + Mode Selection */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="website-url">URL do Website</Label>
            <Input
              id="website-url"
              type="url"
              placeholder="https://exemplo.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              data-testid="input-website-url"
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => {
                setSelectedMode('extract');
                handleCreateJob();
              }}
              disabled={createJobMutation.isPending || !tenantId}
              className="gap-2"
              data-testid="button-extract-brand"
            >
              <Scan className="h-4 w-4" />
              {createJobMutation.isPending && selectedMode === 'extract' ? 'Extraindo...' : 'Extrair Identidade'}
            </Button>

            <Button
              onClick={() => {
                setSelectedMode('clone');
                handleCreateJob();
              }}
              disabled={createJobMutation.isPending || !tenantId}
              variant="outline"
              className="gap-2"
              data-testid="button-clone-website"
            >
              <Copy className="h-4 w-4" />
              {createJobMutation.isPending && selectedMode === 'clone' ? 'Clonando...' : 'Clonar Website'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            <strong>Extract:</strong> Captura cores, fontes, spacing, logos, e gera um tema aplicável.
            <br />
            <strong>Clone:</strong> Cria snapshot estático do website para usar como marketplace.
          </p>
        </div>

        {/* Jobs History */}
        {jobs.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Jobs Recentes</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                  data-testid={`job-${job.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {job.mode === 'extract' ? '🎨 Extract' : '📄 Clone'}
                      </Badge>
                      {getStatusBadge(job.status)}
                    </div>
                    <p className="text-sm truncate text-muted-foreground">{job.url}</p>
                    {job.durationMs && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Duração: {(job.durationMs / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Theme Bundles */}
        {themes.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Temas Extraídos</Label>
            <div className="space-y-2">
              {themes.map((theme) => (
                <div
                  key={theme.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                  data-testid={`theme-${theme.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">v{theme.version}</Badge>
                      {theme.isActive && (
                        <Badge className="bg-green-500 text-white">Ativo</Badge>
                      )}
                    </div>
                    <p className="text-sm truncate text-muted-foreground">{theme.sourceUrl}</p>
                    <div className="flex gap-1 mt-2">
                      {theme.tokens.color.primary && (
                        <div
                          className="h-6 w-6 rounded border"
                          style={{ backgroundColor: theme.tokens.color.primary }}
                          title={theme.tokens.color.primary}
                        />
                      )}
                      {theme.tokens.color.secondary && (
                        <div
                          className="h-6 w-6 rounded border"
                          style={{ backgroundColor: theme.tokens.color.secondary }}
                          title={theme.tokens.color.secondary}
                        />
                      )}
                      {theme.tokens.color.accent && (
                        <div
                          className="h-6 w-6 rounded border"
                          style={{ backgroundColor: theme.tokens.color.accent }}
                          title={theme.tokens.color.accent}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePreviewTheme(theme)}
                      data-testid={`button-preview-theme-${theme.id}`}
                    >
                      Preview
                    </Button>
                    {!theme.isActive && (
                      <Button
                        size="sm"
                        onClick={() => activateThemeMutation.mutate(theme.id)}
                        disabled={activateThemeMutation.isPending}
                        data-testid={`button-activate-theme-${theme.id}`}
                      >
                        Ativar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
