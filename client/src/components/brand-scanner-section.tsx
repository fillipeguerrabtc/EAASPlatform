import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Sparkles, Scan, Copy, Clock, CheckCircle2, XCircle, Loader2, Eye } from 'lucide-react';
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

interface CloneArtifact {
  id: string;
  tenantId: string;
  version: number;
  htmlBundle: string;
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
  const [previewClone, setPreviewClone] = useState<CloneArtifact | null>(null);

  // Query: List jobs
  const { data: jobs = [], refetch: refetchJobs } = useQuery<BrandJob[]>({
    queryKey: [`/api/brand/jobs?tenantId=${tenantId}`],
    enabled: !!tenantId,
  });

  // Query: List theme bundles
  const { data: themes = [], refetch: refetchThemes } = useQuery<ThemeBundle[]>({
    queryKey: [`/api/brand/themes?tenantId=${tenantId}`],
    enabled: !!tenantId,
  });

  // Query: List clone artifacts
  const { data: clones = [], refetch: refetchClones } = useQuery<CloneArtifact[]>({
    queryKey: [`/api/brand/clones?tenantId=${tenantId}`],
    enabled: !!tenantId,
  });

  // Mutation: Create job
  const createJobMutation = useMutation({
    mutationFn: async (data: { url: string; mode: 'extract' | 'clone'; tenantId: string }) => {
      const res = await apiRequest('POST', '/api/brand/jobs', data);
      return await res.json() as { jobId: string; status: string };
    },
    onSuccess: (data) => {
      toast({
        title: 'Scan Iniciado',
        description: `Job criado com sucesso! Processando...`,
      });
      setWebsiteUrl('');
      refetchJobs();
      // Poll for job status
      const interval = setInterval(() => {
        refetchJobs();
        refetchThemes();
        refetchClones();
      }, 3000);
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
      const res = await apiRequest('POST', `/api/brand/themes/${themeId}/activate`, { tenantId });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Tema Ativado',
        description: 'O tema foi aplicado com sucesso!',
      });
      refetchThemes();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation: Activate clone
  const activateCloneMutation = useMutation({
    mutationFn: async (cloneId: string) => {
      const res = await apiRequest('POST', `/api/brand/clones/${cloneId}/activate`, { tenantId });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Clone Ativado',
        description: 'O clone foi ativado e será exibido no /shop!',
      });
      refetchClones();
      setPreviewClone(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleCreateJob = (mode: 'extract' | 'clone') => {
    if (!websiteUrl || !tenantId) {
      toast({
        title: 'URL Obrigatória',
        description: 'Por favor, insira uma URL válida.',
        variant: 'destructive',
      });
      return;
    }

    createJobMutation.mutate({
      url: websiteUrl,
      mode,
      tenantId,
    });
  };

  const handlePreviewTheme = (theme: ThemeBundle) => {
    applyTheme(theme.tokens);
    toast({
      title: 'Preview Ativado',
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
              onClick={() => handleCreateJob('extract')}
              disabled={createJobMutation.isPending || !tenantId}
              className="gap-2"
              data-testid="button-extract-brand"
            >
              <Scan className="h-4 w-4" />
              {createJobMutation.isPending ? 'Criando...' : 'Extrair Identidade'}
            </Button>

            <Button
              onClick={() => handleCreateJob('clone')}
              disabled={createJobMutation.isPending || !tenantId}
              variant="outline"
              className="gap-2"
              data-testid="button-clone-website"
            >
              <Copy className="h-4 w-4" />
              {createJobMutation.isPending ? 'Criando...' : 'Clonar Website'}
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

        {/* Clone Artifacts */}
        {clones.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Clones de Website</Label>
            <div className="space-y-2">
              {clones.map((clone) => (
                <div
                  key={clone.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                  data-testid={`clone-${clone.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">v{clone.version}</Badge>
                      {clone.isActive && (
                        <Badge className="bg-green-500 text-white">Ativo no /shop</Badge>
                      )}
                    </div>
                    <p className="text-sm truncate text-muted-foreground">{clone.sourceUrl}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      HTML Size: {(clone.htmlBundle.length / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewClone(clone)}
                      data-testid={`button-preview-clone-${clone.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    {!clone.isActive && (
                      <Button
                        size="sm"
                        onClick={() => activateCloneMutation.mutate(clone.id)}
                        disabled={activateCloneMutation.isPending}
                        data-testid={`button-activate-clone-${clone.id}`}
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

      {/* Clone Preview Dialog with Secure Iframe */}
      <Dialog open={!!previewClone} onOpenChange={() => setPreviewClone(null)}>
        <DialogContent className="max-w-7xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Preview: Clone v{previewClone?.version}</DialogTitle>
            <DialogDescription>
              Este é o clone do website {previewClone?.sourceUrl}. 
              Use "Ativar" para exibir no /shop ou "Fechar" para cancelar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded-lg border bg-muted">
            {previewClone && (
              <iframe
                srcDoc={previewClone.htmlBundle}
                className="w-full h-full"
                sandbox="allow-same-origin allow-scripts"
                title="Clone Preview"
                data-testid="iframe-clone-preview"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewClone(null)}>
              Fechar
            </Button>
            {previewClone && !previewClone.isActive && (
              <Button 
                onClick={() => activateCloneMutation.mutate(previewClone.id)}
                disabled={activateCloneMutation.isPending}
                data-testid="button-activate-clone-from-preview"
              >
                {activateCloneMutation.isPending ? 'Ativando...' : 'Ativar Clone'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
