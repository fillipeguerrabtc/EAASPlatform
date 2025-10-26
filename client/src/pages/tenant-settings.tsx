import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { Upload, Building2, Image as ImageIcon, CheckCircle2, Palette, Sparkles } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Tenant } from "@shared/schema";

const uploadSchema = z.object({
  logoFile: z.instanceof(File).optional(),
  faviconFile: z.instanceof(File).optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface CustomTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
}

export default function TenantSettings() {
  const { toast } = useToast();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  
  // Theme color states
  const [themeColors, setThemeColors] = useState<CustomTheme["colors"]>({
    primary: "#10A37F",
    secondary: "#8B5CF6",
    accent: "#3B82F6",
    background: "#FFFFFF",
    foreground: "#000000",
  });

  // Fetch current tenant (assuming tenant ID is in session)
  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const currentTenant = tenants[0]; // For MVP, assuming first tenant

  // Load existing theme colors when tenant data is available
  useEffect(() => {
    if (currentTenant?.customTheme) {
      const theme = currentTenant.customTheme as CustomTheme;
      if (theme.colors) {
        setThemeColors(theme.colors);
      }
    }
  }, [currentTenant]);

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
  });

  // Mutation to update tenant logo/favicon
  const uploadMutation = useMutation({
    mutationFn: async (data: { logoUrl?: string; faviconUrl?: string }) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      return apiRequest("PATCH", `/api/tenants/${currentTenant.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({
        title: "✅ Configurações Salvas",
        description: "Logo e favicon atualizados com sucesso!",
      });
      setLogoPreview(null);
      setFaviconPreview(null);
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to update theme colors
  const themeMutation = useMutation({
    mutationFn: async (customTheme: CustomTheme) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      return apiRequest("PATCH", `/api/tenants/${currentTenant.id}`, { customTheme });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({
        title: "✅ Tema Salvo",
        description: "Cores do tema atualizadas com sucesso!",
      });
      applyThemeColors();
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to scan brand colors from logo using AI
  const scanBrandColorsMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      return apiRequest("POST", `/api/tenants/${currentTenant.id}/scan-brand-colors`, { logoUrl });
    },
    onSuccess: (data: any) => {
      if (data.colors) {
        setThemeColors(data.colors);
        toast({
          title: "🎨 Cores Extraídas!",
          description: "As cores da marca foram extraídas automaticamente do logo pela IA.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro ao Escanear",
        description: error.message || "Não foi possível extrair cores do logo.",
        variant: "destructive",
      });
    },
  });

  // Mutation to scan complete brand identity from website URL
  const [websiteUrl, setWebsiteUrl] = useState("");
  const scanWebsiteBrandMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!currentTenant?.id) throw new Error("No tenant selected");
      return apiRequest("POST", `/api/tenants/${currentTenant.id}/scan-brand`, { websiteUrl: url });
    },
    onSuccess: (data: any) => {
      const brand = data.brand;
      if (!brand) {
        toast({
          title: "⚠️ Atenção",
          description: "Nenhuma informação de marca foi encontrada no site.",
        });
        return;
      }

      // Update theme colors if available
      if (brand.colors) {
        setThemeColors({
          primary: brand.colors.primary || themeColors.primary,
          secondary: brand.colors.secondary || themeColors.secondary,
          accent: brand.colors.accent || themeColors.accent,
          background: brand.colors.background || themeColors.background,
          foreground: brand.colors.foreground || themeColors.foreground,
        });
      }

      // Update logo and favicon previews
      if (brand.assets?.logo) {
        setLogoPreview(brand.assets.logo);
      }
      if (brand.assets?.favicon) {
        setFaviconPreview(brand.assets.favicon);
      }

      // Build success message
      const extracted = [];
      if (brand.colors) extracted.push('6 cores');
      if (brand.assets?.logo) extracted.push('logo');
      if (brand.assets?.favicon) extracted.push('favicon');
      if (brand.typography) extracted.push('fontes');
      if (brand.spacing) extracted.push('espaçamento');

      toast({
        title: "✨ Identidade Visual Capturada!",
        description: `Extraídos com sucesso: ${extracted.join(', ')}`,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Erro ao Escanear Site",
        description: error.message || "Não foi possível escanear o site. Verifique a URL.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (
    file: File | undefined,
    type: "logo" | "favicon"
  ) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (type === "logo") {
        setLogoPreview(base64String);
      } else {
        setFaviconPreview(base64String);
      }
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async () => {
    const data: { logoUrl?: string; faviconUrl?: string } = {};

    if (logoPreview) {
      data.logoUrl = logoPreview;
    }

    if (faviconPreview) {
      data.faviconUrl = faviconPreview;
    }

    if (Object.keys(data).length === 0) {
      toast({
        title: "⚠️ Atenção",
        description: "Selecione pelo menos um arquivo para fazer upload.",
      });
      return;
    }

    uploadMutation.mutate(data);
  };

  const handleColorChange = (colorKey: keyof CustomTheme["colors"], value: string) => {
    setThemeColors(prev => ({
      ...prev,
      [colorKey]: value,
    }));
  };

  const handleSaveTheme = () => {
    const customTheme: CustomTheme = {
      colors: themeColors,
    };
    themeMutation.mutate(customTheme);
  };

  const handleScanBrandColors = () => {
    // Use the current logo URL or preview
    const logoUrlToScan = logoPreview || currentTenant?.logoUrl;
    
    if (!logoUrlToScan) {
      toast({
        title: "⚠️ Atenção",
        description: "Faça upload de um logo primeiro para escanear as cores.",
      });
      return;
    }

    scanBrandColorsMutation.mutate(logoUrlToScan);
  };

  const handleRestoreDefaults = async () => {
    if (!currentTenant?.id) return;

    // Reset to default EAAS colors in UI
    const defaultColors = {
      primary: "#10A37F",
      secondary: "#8B5CF6",
      accent: "#3B82F6",
      background: "#FFFFFF",
      foreground: "#000000",
    };

    setThemeColors(defaultColors);
    setLogoPreview(null);
    setFaviconPreview(null);

    // Clear custom theme by sending null
    await apiRequest("PATCH", `/api/tenants/${currentTenant.id}`, {
      customTheme: null,
      logoUrl: null,
      faviconUrl: null,
    });

    queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });

    toast({
      title: "🔄 Restaurado!",
      description: "Identidade visual restaurada para o padrão do sistema EAAS.",
    });
  };

  const applyThemeColors = () => {
    // Apply colors dynamically via CSS variables
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', themeColors.primary);
    root.style.setProperty('--theme-secondary', themeColors.secondary);
    root.style.setProperty('--theme-accent', themeColors.accent);
    root.style.setProperty('--theme-background', themeColors.background);
    root.style.setProperty('--theme-foreground', themeColors.foreground);
  };

  // Apply theme colors on mount and when they change
  useEffect(() => {
    applyThemeColors();
  }, [themeColors]);

  return (
    <>
      <SEO
        title="Configurações do Tenant - EAAS"
        description="Configure o logo, favicon e identidade visual da sua empresa"
      />

      <div className="container max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            Configurações da Empresa
          </h1>
          <p className="text-muted-foreground">
            Personalize a identidade visual da sua empresa na plataforma
          </p>
        </div>

        {/* Current Tenant Info */}
        {currentTenant && (
          <Card>
            <CardHeader>
              <CardTitle>Empresa Atual</CardTitle>
              <CardDescription>Informações básicas da empresa</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Nome</Label>
                  <p className="font-medium" data-testid="text-tenant-name">{currentTenant.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Subdomínio</Label>
                  <p className="font-medium" data-testid="text-tenant-subdomain">{currentTenant.subdomain}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Brand Scanner Inteligente */}
        <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-950/20 dark:via-background dark:to-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-500" />
              🤖 Brand Scanner Inteligente
            </CardTitle>
            <CardDescription>
              Copie automaticamente a identidade visual completa do seu site: cores, logo, favicon, fontes e espaçamento - tudo 100% igual!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label htmlFor="website-url" className="text-sm font-medium mb-2 block">
                  URL do Site da Empresa
                </Label>
                <Input
                  id="website-url"
                  type="url"
                  placeholder="https://suaempresa.com.br"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="flex-1"
                  data-testid="input-website-url"
                  disabled={scanWebsiteBrandMutation.isPending}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => websiteUrl && scanWebsiteBrandMutation.mutate(websiteUrl)}
                  disabled={!websiteUrl || scanWebsiteBrandMutation.isPending}
                  className="gap-2 min-w-[140px]"
                  size="default"
                  data-testid="button-scan-website"
                >
                  <Sparkles className="h-4 w-4" />
                  {scanWebsiteBrandMutation.isPending ? "Escaneando..." : "Escanear Site"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Palette className="h-4 w-4 text-purple-500" />
                <span>6 cores automáticas</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ImageIcon className="h-4 w-4 text-purple-500" />
                <span>Logo + Favicon</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span>Fontes e espaçamento</span>
              </div>
            </div>

            {scanWebsiteBrandMutation.isPending && (
              <div className="p-4 bg-white/80 dark:bg-background/80 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Analisando identidade visual...</p>
                    <p className="text-xs text-muted-foreground">Extraindo cores, logo, favicon, fontes e espaçamento do site</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logo Upload */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Logo da Empresa
            </CardTitle>
            <CardDescription>
              Faça upload do logo da sua empresa (formato PNG, JPG ou SVG)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentTenant?.logoUrl && !logoPreview && (
              <div className="flex items-center gap-4 p-4 bg-muted rounded-md">
                <img
                  src={currentTenant.logoUrl}
                  alt="Logo atual"
                  className="h-16 w-auto object-contain"
                  data-testid="img-current-logo"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Logo Atual</p>
                  <p className="text-xs text-muted-foreground">Carregado anteriormente</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            )}

            <div>
              <Label htmlFor="logo-upload">Novo Logo</Label>
              <Input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => handleFileChange(e.target.files?.[0], "logo")}
                data-testid="input-logo-upload"
              />
            </div>

            {logoPreview && (
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm font-medium mb-2">Preview:</p>
                <img
                  src={logoPreview}
                  alt="Preview do logo"
                  className="h-24 w-auto object-contain"
                  data-testid="img-logo-preview"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Favicon Upload */}
        <Card className="border-purple-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-purple-500" />
              Favicon
            </CardTitle>
            <CardDescription>
              Faça upload do favicon (ícone da aba do navegador). Recomendado: 32x32px ou 64x64px
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentTenant?.faviconUrl && !faviconPreview && (
              <div className="flex items-center gap-4 p-4 bg-muted rounded-md">
                <img
                  src={currentTenant.faviconUrl}
                  alt="Favicon atual"
                  className="h-8 w-8 object-contain"
                  data-testid="img-current-favicon"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Favicon Atual</p>
                  <p className="text-xs text-muted-foreground">Carregado anteriormente</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            )}

            <div>
              <Label htmlFor="favicon-upload">Novo Favicon</Label>
              <Input
                id="favicon-upload"
                type="file"
                accept="image/png,image/x-icon,image/svg+xml"
                onChange={(e) => handleFileChange(e.target.files?.[0], "favicon")}
                data-testid="input-favicon-upload"
              />
            </div>

            {faviconPreview && (
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm font-medium mb-2">Preview:</p>
                <img
                  src={faviconPreview}
                  alt="Preview do favicon"
                  className="h-12 w-12 object-contain"
                  data-testid="img-favicon-preview"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Theme Customization */}
        <Card className="border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-blue-500" />
              Customização de Cores
            </CardTitle>
            <CardDescription>
              Personalize as cores do tema da sua empresa. As mudanças serão aplicadas em toda a plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* AI Brand Scanner */}
            {(currentTenant?.logoUrl || logoPreview) && (
              <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      <h4 className="font-semibold text-sm">Extração Automática de Cores por IA</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Use inteligência artificial para extrair automaticamente as cores da sua marca do logo enviado.
                    </p>
                    <Button
                      onClick={handleScanBrandColors}
                      disabled={scanBrandColorsMutation.isPending}
                      size="sm"
                      variant="default"
                      className="gap-2"
                      data-testid="button-scan-brand-colors"
                    >
                      <Sparkles className="h-4 w-4" />
                      {scanBrandColorsMutation.isPending ? "Analisando Logo..." : "Escanear Cores do Logo"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {/* Color Pickers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Primary Color */}
              <div className="space-y-2">
                <Label htmlFor="color-primary" className="text-sm font-medium">
                  Cor Primária
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="color-primary"
                    type="color"
                    value={themeColors.primary}
                    onChange={(e) => handleColorChange("primary", e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                    data-testid="input-color-primary"
                  />
                  <Input
                    type="text"
                    value={themeColors.primary}
                    onChange={(e) => handleColorChange("primary", e.target.value)}
                    className="flex-1 font-mono text-sm"
                    placeholder="#10A37F"
                    data-testid="input-text-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  CTAs, links, estados ativos
                </p>
              </div>

              {/* Secondary Color */}
              <div className="space-y-2">
                <Label htmlFor="color-secondary" className="text-sm font-medium">
                  Cor Secundária
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="color-secondary"
                    type="color"
                    value={themeColors.secondary}
                    onChange={(e) => handleColorChange("secondary", e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                    data-testid="input-color-secondary"
                  />
                  <Input
                    type="text"
                    value={themeColors.secondary}
                    onChange={(e) => handleColorChange("secondary", e.target.value)}
                    className="flex-1 font-mono text-sm"
                    placeholder="#8B5CF6"
                    data-testid="input-text-secondary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Destaques, elementos secundários
                </p>
              </div>

              {/* Accent Color */}
              <div className="space-y-2">
                <Label htmlFor="color-accent" className="text-sm font-medium">
                  Cor de Destaque
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="color-accent"
                    type="color"
                    value={themeColors.accent}
                    onChange={(e) => handleColorChange("accent", e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                    data-testid="input-color-accent"
                  />
                  <Input
                    type="text"
                    value={themeColors.accent}
                    onChange={(e) => handleColorChange("accent", e.target.value)}
                    className="flex-1 font-mono text-sm"
                    placeholder="#3B82F6"
                    data-testid="input-text-accent"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Informações, ações secundárias
                </p>
              </div>

              {/* Background Color */}
              <div className="space-y-2">
                <Label htmlFor="color-background" className="text-sm font-medium">
                  Cor de Fundo
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="color-background"
                    type="color"
                    value={themeColors.background}
                    onChange={(e) => handleColorChange("background", e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                    data-testid="input-color-background"
                  />
                  <Input
                    type="text"
                    value={themeColors.background}
                    onChange={(e) => handleColorChange("background", e.target.value)}
                    className="flex-1 font-mono text-sm"
                    placeholder="#FFFFFF"
                    data-testid="input-text-background"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Fundo principal da aplicação
                </p>
              </div>

              {/* Foreground Color */}
              <div className="space-y-2">
                <Label htmlFor="color-foreground" className="text-sm font-medium">
                  Cor do Texto
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="color-foreground"
                    type="color"
                    value={themeColors.foreground}
                    onChange={(e) => handleColorChange("foreground", e.target.value)}
                    className="w-20 h-10 p-1 cursor-pointer"
                    data-testid="input-color-foreground"
                  />
                  <Input
                    type="text"
                    value={themeColors.foreground}
                    onChange={(e) => handleColorChange("foreground", e.target.value)}
                    className="flex-1 font-mono text-sm"
                    placeholder="#000000"
                    data-testid="input-text-foreground"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Cor principal do texto
                </p>
              </div>
            </div>

            {/* Color Preview */}
            <div className="p-6 rounded-lg border-2 border-dashed space-y-4">
              <p className="text-sm font-medium mb-4">Preview do Tema:</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-2">
                  <div
                    className="h-16 rounded-md border-2"
                    style={{ backgroundColor: themeColors.primary }}
                    data-testid="preview-primary"
                  />
                  <p className="text-xs text-center font-medium">Primária</p>
                </div>
                <div className="space-y-2">
                  <div
                    className="h-16 rounded-md border-2"
                    style={{ backgroundColor: themeColors.secondary }}
                    data-testid="preview-secondary"
                  />
                  <p className="text-xs text-center font-medium">Secundária</p>
                </div>
                <div className="space-y-2">
                  <div
                    className="h-16 rounded-md border-2"
                    style={{ backgroundColor: themeColors.accent }}
                    data-testid="preview-accent"
                  />
                  <p className="text-xs text-center font-medium">Destaque</p>
                </div>
                <div className="space-y-2">
                  <div
                    className="h-16 rounded-md border-2"
                    style={{ backgroundColor: themeColors.background }}
                    data-testid="preview-background"
                  />
                  <p className="text-xs text-center font-medium">Fundo</p>
                </div>
                <div className="space-y-2">
                  <div
                    className="h-16 rounded-md border-2"
                    style={{ backgroundColor: themeColors.foreground }}
                    data-testid="preview-foreground"
                  />
                  <p className="text-xs text-center font-medium">Texto</p>
                </div>
              </div>
            </div>

            {/* Theme Save Button */}
            <div className="flex justify-end gap-3 flex-wrap">
              <Button
                onClick={handleRestoreDefaults}
                disabled={themeMutation.isPending || uploadMutation.isPending}
                variant="outline"
                data-testid="button-restore-defaults"
                className="gap-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restaurar Padrão
              </Button>
              <Button
                onClick={handleSaveTheme}
                disabled={themeMutation.isPending}
                data-testid="button-save-theme"
                className="gap-2"
              >
                <Palette className="h-4 w-4" />
                {themeMutation.isPending ? "Salvando Tema..." : "Salvar Tema"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setLogoPreview(null);
              setFaviconPreview(null);
              form.reset();
            }}
            disabled={uploadMutation.isPending}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={uploadMutation.isPending || (!logoPreview && !faviconPreview)}
            data-testid="button-save-branding"
          >
            {uploadMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </>
  );
}
