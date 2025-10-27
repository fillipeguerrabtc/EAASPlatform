// server/adminThemeApplier.ts
// Aplica tokens de design no Admin Dashboard
// Gera CSS variables e theme.json com transactional writes conforme Architect

import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";

type Tokens = {
  colors: {
    primary?: string; 
    secondary?: string; 
    accent?: string;
    surface?: string; 
    background?: string; 
    text?: string;
    palette?: string[];
  };
  typography: { fontFamilies: string[]; baseSizePx?: number };
  spacing: { base: number; scale: number[] };
  radius: { sm: number; md: number; lg: number; pill: number };
  elevation: { sm: string; md: string; lg: string };
};

/**
 * Ensure directory exists
 */
function ensureDir(p: string): void { 
  fs.mkdirSync(p, { recursive: true }); 
}

/**
 * Generate CSS variable name with eaas prefix
 */
function cssVarName(name: string): string {
  return `--eaas-${name}`;
}

/**
 * Convert tokens to CSS variables
 */
function tokensToCssVars(t: Tokens): string {
  const lines: string[] = [];
  const push = (k: string, v: string | number | undefined) => {
    if (v == null) return;
    lines.push(`  ${cssVarName(k)}: ${v};`);
  };

  // Colors
  push("color-primary", t.colors.primary || "#10A37F");
  push("color-secondary", t.colors.secondary || "#6c757d");
  push("color-accent", t.colors.accent || "#8B5CF6");
  push("color-surface", t.colors.surface || "#ffffff");
  push("color-background", t.colors.background || "#f8f9fa");
  push("color-text", t.colors.text || "#212529");

  // Typography
  push("font-base-size", `${t.typography.baseSizePx || 16}px`);
  
  const fontStack = (t.typography.fontFamilies && t.typography.fontFamilies.length)
    ? t.typography.fontFamilies.map(f => `"${f}"`).join(", ") + ', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"'
    : 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  
  push("font-stack", fontStack);

  // Spacing
  push("space-0", `${t.spacing.scale[0] || 0}px`);
  for (let i = 1; i < t.spacing.scale.length; i++) {
    push(`space-${i}`, `${t.spacing.scale[i]}px`);
  }

  // Radius
  push("radius-sm", `${t.radius.sm}px`);
  push("radius-md", `${t.radius.md}px`);
  push("radius-lg", `${t.radius.lg}px`);
  push("radius-pill", `${t.radius.pill}px`);

  // Elevation (shadows)
  push("shadow-sm", t.elevation.sm);
  push("shadow-md", t.elevation.md);
  push("shadow-lg", t.elevation.lg);

  return `:root {\n${lines.join("\n")}\n}\n`;
}

/**
 * Atomic file write using temp file + rename
 * Prevents partial writes if process crashes
 */
async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp.${crypto.randomBytes(8).toString('hex')}`;
  
  try {
    // Write to temp file
    await fsp.writeFile(tempPath, content, "utf-8");
    
    // Atomic rename
    await fsp.rename(tempPath, filePath);
  } catch (error) {
    // Cleanup temp file on error
    try {
      await fsp.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Apply admin theme tokens
 * Generates CSS variables and theme.json with transactional writes
 * @param tokens Design tokens
 * @returns URLs to generated files
 */
export async function applyAdminTheme(tokens: Tokens): Promise<{
  themeJson: string;
  themeCss: string;
}> {
  const storageDir = process.env.STORAGE_DIR || "./.storage";
  const themeDir = path.join(storageDir, "theme");
  ensureDir(themeDir);

  // 1) Persist JSON (for Admin panel)
  const themeJsonPath = path.join(themeDir, "theme.json");
  await atomicWriteFile(themeJsonPath, JSON.stringify(tokens, null, 2));

  // 2) Generate CSS variables
  const css = tokensToCssVars(tokens);
  const cssPath = path.join(themeDir, "generated.css");
  await atomicWriteFile(cssPath, css);

  // 3) Copy to public directory for frontend serving
  const publicDir = path.join(storageDir, "public", "theme");
  ensureDir(publicDir);
  
  const publicJsonPath = path.join(publicDir, "theme.json");
  const publicCssPath = path.join(publicDir, "generated.css");
  
  await atomicWriteFile(publicJsonPath, JSON.stringify(tokens, null, 2));
  await atomicWriteFile(publicCssPath, css);

  return {
    themeJson: `/public/theme/theme.json`,
    themeCss: `/public/theme/generated.css`
  };
}
