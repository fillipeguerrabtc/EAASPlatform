/**
 * Brand Scanner Types
 * Shared types for marketplace cloning and theme tokens
 */

// ========================================
// THEME TOKENS
// ========================================

export interface ColorToken {
  hex: string;
  hsl: string;
  name: string;
  usage?: string;
}

export interface TypographyToken {
  family: string;
  weights: number[];
  fallback: string;
  usage?: string;
}

export interface ThemeTokens {
  // Colors
  primary: ColorToken;
  secondary: ColorToken;
  accent: ColorToken;
  background: ColorToken;
  foreground: ColorToken;
  muted: ColorToken;
  mutedForeground: ColorToken;
  card: ColorToken;
  cardForeground: ColorToken;
  popover: ColorToken;
  popoverForeground: ColorToken;
  border: ColorToken;
  input: ColorToken;
  ring: ColorToken;
  
  // Typography
  fontPrimary: TypographyToken;
  fontSecondary: TypographyToken;
  fontMono: TypographyToken;
  
  // Spacing & Layout
  borderRadius: string;
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  
  // Metadata
  sourceUrl: string;
  generatedAt: string;
}

// ========================================
// CLONE MANIFEST
// ========================================

export type AssetType = 'image' | 'video' | 'svg' | 'other';

export interface CloneAsset {
  localPath: string;
  originalUrl: string;
  type: AssetType;
  hash: string;
  bytes: number;
}

export type LayoutKind = 'hero' | 'section' | 'gallery' | 'footer' | 'nav' | 'content';

export interface LayoutHint {
  kind: LayoutKind;
  notes?: string;
}

export interface PageBlueprint {
  url: string;
  route: string;
  layout: LayoutHint[];
}

export interface CloneManifest {
  siteUrl: string;
  tokens: ThemeTokens;
  assets: CloneAsset[];
  pages: PageBlueprint[];
  notes: string[];
}

// ========================================
// MARKETPLACE DATA
// ========================================

export interface PublishedAsset {
  cdnUrl: string;
  originalUrl: string;
  type: AssetType;
  hash: string;
  bytes: number;
}

export interface MarketplaceManifest {
  siteUrl: string;
  tokens: ThemeTokens;
  assets: PublishedAsset[];
  pages: PageBlueprint[];
  notes: string[];
  publishedAt: string;
}

// ========================================
// BRAND ANALYSIS (from backend)
// ========================================

export interface AdvancedPalette {
  colors: Array<{
    hex: string;
    lab: { L: number; a: number; b: number };
    frequency: number;
  }>;
}

export interface AdvancedTypography {
  families: Array<{
    family: string;
    weights: number[];
    sources: string[];
  }>;
}

export interface BrandAnalysisResponse {
  id: string;
  url: string;
  screenshotUrl?: string;
  colors: string[];
  fonts: string[];
  status: 'completed' | 'failed' | 'pending';
  errorMessage?: string;
  
  // Advanced fields (optional - may be undefined if enrichment fails)
  advancedPalette?: AdvancedPalette;
  advancedTypography?: AdvancedTypography;
  cloneManifest?: CloneManifest;
  
  createdAt: string;
  completedAt?: string;
}
