// server/brandScannerTheme.ts
// Extrai paleta dominante via CIELAB+KMeans a partir de screenshots e HTML.
// Também coleta tipografia (font-face, font-family) e gera tokens de design.
// Implementação com @napi-rs/canvas optional e bounds checks conforme Architect.

import fs from "fs";
import path from "path";
import { rgbToHex, rgbToLab, kmeansLAB, labToRgb, type RGB } from "./color";

export type TypographyInfo = {
  fontFamilies: string[];
  fontFaces: string[];  // URLs ou nomes detectados
  baseSizePx?: number;
};

export type DesignTokens = {
  colors: {
    primary?: string; 
    secondary?: string; 
    accent?: string;
    surface?: string; 
    background?: string; 
    text?: string;
    palette: string[];
  };
  typography: TypographyInfo;
  spacing: { base: number; scale: number[] };    // ex: base8 + escala de 0..7
  radius: { sm: number; md: number; lg: number; pill: number };
  elevation: { sm: string; md: string; lg: string }; // box-shadow tokens
};

/**
 * Extrai paleta dominante de uma imagem PNG usando K-Means em espaço LAB
 * Usa @napi-rs/canvas se disponível, caso contrário retorna palette vazia
 * @param pngPath Caminho do arquivo PNG
 * @param k Número de cores dominantes (default: 6)
 * @returns Array de cores em formato hexadecimal
 */
export async function extractPaletteFromPng(pngPath: string, k = 6): Promise<string[]> {
  if (!fs.existsSync(pngPath)) return [];
  
  try {
    // Try to load @napi-rs/canvas (optional dependency)
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    
    const img = await loadImage(pngPath);
    
    // Downsample agressivo para acelerar (sem perder dominância)
    // Max 480px width mantém performance razoável
    const W = Math.min(img.width, 480);
    const H = Math.round((img.height * W) / img.width);
    
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;

    const labs: RGB[] = [];
    
    // Extract RGB pixels (skip fully transparent)
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 10) continue; // Skip nearly transparent pixels
      
      const rgb: RGB = { 
        r: data[i], 
        g: data[i + 1], 
        b: data[i + 2] 
      };
      labs.push(rgb);
    }
    
    if (labs.length === 0) return [];
    
    // Convert to LAB space for perceptual clustering
    const labPoints = labs.map(rgb => rgbToLab(rgb));
    
    // K-Means clustering (maxIter=18 for performance)
    const centers = kmeansLAB(labPoints, k, 18);
    
    // Sort by L (lightness) para consistência
    centers.sort((a, b) => a.L - b.L);
    
    // Convert back to hex
    const hexes = centers.map(l => rgbToHex(labToRgb(l)));
    
    // Remove duplicatas
    return [...new Set(hexes)];
    
  } catch (error) {
    // @napi-rs/canvas not available or error loading image
    console.warn(`Failed to extract palette from ${pngPath}:`, error);
    return [];
  }
}

/**
 * Extrai informações de tipografia do HTML
 * Com bounds checks e validação conforme Architect
 * @param html Conteúdo HTML
 * @returns Informações de tipografia
 */
export function extractTypographyFromHtml(html: string): TypographyInfo {
  const families = new Set<string>();
  const faces = new Set<string>();
  
  // Limit HTML size to prevent DoS
  const maxHtmlLength = 5 * 1024 * 1024; // 5MB
  const safeHtml = html.length > maxHtmlLength 
    ? html.substring(0, maxHtmlLength) 
    : html;

  // Extract font-family declarations
  const ffRegex = /font-family:\s*([^;}{]+)[;}{]/gi;
  const ffMatches = Array.from(safeHtml.matchAll(ffRegex));
  
  let fontFamilyCount = 0;
  const maxFontFamilies = 50; // Limit to prevent abuse
  
  for (const match of ffMatches) {
    if (fontFamilyCount++ >= maxFontFamilies) break;
    
    const declaration = match[1];
    if (!declaration) continue;
    
    // Parse comma-separated families
    const parts = declaration.split(",");
    for (const part of parts) {
      const trimmed = part.trim().replace(/['"]/g, "");
      if (trimmed && trimmed.length < 100) { // Sanity check
        families.add(trimmed);
      }
    }
  }

  // Extract @font-face src URLs
  const srcRegex = /src:\s*url\(([^)]+)\)/gi;
  const srcMatches = Array.from(safeHtml.matchAll(srcRegex));
  
  let fontFaceCount = 0;
  const maxFontFaces = 20; // Limit to prevent abuse
  
  for (const match of srcMatches) {
    if (fontFaceCount++ >= maxFontFaces) break;
    
    const urlPart = match[1];
    if (!urlPart) continue;
    
    const cleaned = urlPart.replace(/['"]/g, "").trim();
    
    // SECURITY: Only allow HTTPS URLs or data URIs
    if (cleaned.startsWith("https://") || cleaned.startsWith("data:")) {
      if (cleaned.length < 500) { // Sanity check
        faces.add(cleaned);
      }
    }
  }

  // Extract base font size from html{font-size:...}
  let base = 16; // Default
  const baseSizeRegex = /html\s*\{\s*font-size:\s*([\d.]+)px\s*;?\s*\}/i;
  const baseSizeMatch = safeHtml.match(baseSizeRegex);
  
  if (baseSizeMatch?.[1]) {
    const parsed = parseFloat(baseSizeMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0 && parsed < 100) {
      base = parsed;
    }
  }

  return { 
    fontFamilies: Array.from(families), 
    fontFaces: Array.from(faces), 
    baseSizePx: base 
  };
}

/**
 * Constrói tokens de design a partir de paleta e tipografia
 * @param palette Array de cores em hex
 * @param typo Informações de tipografia
 * @returns Tokens de design completos
 */
export function buildDesignTokens(palette: string[], typo: TypographyInfo): DesignTokens {
  // Heurística: paleta já vem ordenada por luminância (escuro -> claro)
  const sorted = palette.slice();
  
  // Assign semantic colors
  const text = sorted[0] || "#111111";
  const background = sorted[sorted.length - 1] || "#ffffff";
  
  // Pick intermediate colors for primary/secondary/accent
  const primary = sorted[Math.floor(sorted.length * 0.6)] || sorted[1] || "#10A37F";
  const secondary = sorted[Math.floor(sorted.length * 0.4)] || sorted[2] || "#6c757d";
  const accent = sorted[Math.floor(sorted.length * 0.8)] || sorted[3] || "#8B5CF6";
  
  // Surface usually same as background
  const surface = background;

  // Spacing tokens (base 8 system)
  const spacingBase = 8;
  const scale = [0, 1, 2, 3, 4, 5, 6, 7].map(n => n * spacingBase);
  
  // Border radius tokens
  const radius = { 
    sm: 4, 
    md: 8, 
    lg: 16, 
    pill: 999 
  };
  
  // Elevation tokens (box-shadow)
  const elevation = {
    sm: "0 1px 2px rgba(0,0,0,.08)",
    md: "0 4px 12px rgba(0,0,0,.12)",
    lg: "0 12px 28px rgba(0,0,0,.16)"
  };

  return {
    colors: {
      primary,
      secondary,
      accent,
      surface,
      background,
      text,
      palette: sorted
    },
    typography: typo,
    spacing: { base: spacingBase, scale },
    radius,
    elevation
  };
}
