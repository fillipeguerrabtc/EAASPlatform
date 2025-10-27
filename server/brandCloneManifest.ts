// server/brandCloneManifest.ts
// Gera um manifesto JSON com tudo necessário para reproduzir o site no Marketplace:
// - tokens de design
// - assets (arquivos locais baixados)
// - mapa de páginas (rotas internas descobertas)
// - instruções básicas de layout (slots/sections) – heurística inicial
// Implementação com path.normalize conforme Architect

import path from "path";
import type { DesignTokens } from "./brandScannerTheme";

export type CloneAsset = {
  localPath: string;    // caminho em disco do asset baixado
  originalUrl: string;
  type: "image" | "video" | "svg" | "other";
  hash: string;
  bytes: number;
};

export type PageBlueprint = {
  url: string;
  route: string;        // rota relativa no Marketplace (heurística simples)
  layout: Array<{
    kind: "hero" | "section" | "gallery" | "footer" | "nav" | "content";
    notes?: string;
  }>;
};

export type CloneManifest = {
  siteUrl: string;
  tokens: DesignTokens;
  assets: CloneAsset[];
  pages: PageBlueprint[];
  notes: string[];
};

/**
 * Sanitiza e normaliza uma rota para prevenir path traversal
 * @param rawPath Caminho raw
 * @returns Caminho sanitizado
 */
function sanitizeRoute(rawPath: string): string {
  // Remove query params and hash
  let clean = rawPath.split('?')[0].split('#')[0];
  
  // Normalize and prevent traversal
  clean = path.normalize(clean);
  
  // Ensure it starts with /
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  
  // Remove any .. sequences that survived normalization
  clean = clean.replace(/\.\./g, '');
  
  // Limit length
  if (clean.length > 200) {
    clean = clean.substring(0, 200);
  }
  
  return clean;
}

/**
 * Constrói o manifesto de clonagem completo
 * @param args Argumentos com siteUrl, tokens, media, pages
 * @returns Manifesto completo
 */
export function buildCloneManifest(args: {
  siteUrl: string;
  tokens: DesignTokens;
  media: Array<{ path: string; url: string; bytes: number; mime: string; hash: string }>;
  pages: string[];
}): CloneManifest {
  // Map media to clone assets
  const assets: CloneAsset[] = args.media.map(m => {
    let type: CloneAsset["type"] = "other";
    
    if (m.mime.startsWith("image/")) {
      type = m.mime.includes("svg") ? "svg" : "image";
    } else if (m.mime.startsWith("video/")) {
      type = "video";
    }
    
    // Normalize local path to prevent traversal
    const normalizedPath = path.normalize(m.path);
    
    return { 
      localPath: normalizedPath, 
      originalUrl: m.url, 
      type, 
      hash: m.hash, 
      bytes: m.bytes 
    };
  });

  // Map pages to blueprints
  const pages = args.pages.map((p, i) => {
    let route = "/";
    
    try {
      if (i === 0) {
        route = "/";
      } else {
        const url = new URL(p);
        route = sanitizeRoute(url.pathname || `/p${i}`);
      }
    } catch {
      // Invalid URL, use fallback
      route = sanitizeRoute(`/p${i}`);
    }
    
    // Layout heurístico inicial (pode evoluir com parsing do DOM em etapa posterior)
    const layout = [
      { kind: "nav" as const },
      { kind: "hero" as const, notes: "Converter primeira dobra (above-the-fold) para hero" },
      { kind: "section" as const, notes: "Blocos de conteúdo sequenciais" },
      { kind: "gallery" as const, notes: "Se foram detectadas muitas imagens" },
      { kind: "footer" as const }
    ];
    
    return { url: p, route, layout };
  });

  const notes = [
    "Este manifesto foi gerado automaticamente. Revise tokens e rotas antes de publicar.",
    "Assets já estão deduplicados por hash; upload para CDN do Marketplace é recomendado.",
    "Integrações de checkout serão habilitadas no passo de publicação (Stripe sandbox)."
  ];

  return { 
    siteUrl: args.siteUrl, 
    tokens: args.tokens, 
    assets, 
    pages, 
    notes 
  };
}
