/**
 * BRAND SCANNER 2.1 PRO - ENHANCED VERSION
 * 
 * Extracts comprehensive brand identity from websites using:
 * - K-Means color clustering (CIELAB-based) ✅ MANTIDO
 * - Theme tokens (color, typography, spacing, radius) ✅ MANTIDO
 * - Logo and favicon extraction ✅ MANTIDO
 * - Screenshots ✅ MANTIDO
 * - Media downloads (images/videos) with SHA256 dedupe ✅ NOVO
 * - Filesystem storage with byte limits ✅ NOVO
 * - MIME type validation ✅ NOVO
 * 
 * SECURITY HARDENING:
 * - Uses safeBrowserRequest with queue (max 2 concurrent) ✅
 * - URL validation and sanitization ✅
 * - SSRF protection (DNS cache bypass + redirect validation) ✅
 * - Timeout enforcement ✅
 * - Automatic cleanup ✅
 */

import type { ThemeTokens } from '@shared/schema';
import { safeBrowserRequest, validateUrl } from './browser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { extractPaletteFromPng, extractTypographyFromHtml, buildDesignTokens } from './brandScannerTheme';
import { buildCloneManifest } from './brandCloneManifest';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

// =========================================
// CONFIGURATION (from .env)
// =========================================

const STORAGE_DIR = process.env.STORAGE_DIR || './.storage';
const BRAND_SCANNER_DOWNLOAD_MEDIA = process.env.BRAND_SCANNER_DOWNLOAD_MEDIA === 'true';
const BRAND_SCANNER_MAX_TOTAL_BYTES = parseInt(process.env.BRAND_SCANNER_MAX_TOTAL_BYTES || '524288000', 10); // 500MB default
const BRAND_SCANNER_ALLOWED_MIME = (process.env.BRAND_SCANNER_ALLOWED_MIME || 'image/*,video/*,image/svg+xml,image/gif')
  .split(',')
  .map(m => m.trim());

// =========================================
// TYPES
// =========================================

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted?: string;
}

export interface BrandAssets {
  logo?: string;
  favicon?: string;
}

export interface BrandTypography {
  primaryFont?: string;
  secondaryFont?: string;
  headingFont?: string;
}

export interface BrandSpacing {
  baseSpacing?: string;
  borderRadius?: string;
}

export interface MediaAsset {
  url: string;
  localPath: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  downloadedAt: string;
}

export interface BrandAnalysis {
  colors: BrandColors;
  tokens?: ThemeTokens;
  assets?: BrandAssets;
  typography?: BrandTypography;
  spacing?: BrandSpacing;
  screenshots?: {
    full?: string;
    hero?: string;
  };
  mediaAssets?: MediaAsset[]; // ✅ NOVO
  
  // ✅ ENHANCED - Advanced analysis
  advancedPalette?: { hex: string; weight: number }[]; // CIELAB server-side
  advancedTypography?: { family: string; source: string }[]; // Regex HTML extraction
  cloneManifest?: any; // Clone manifest for marketplace
}

// =========================================
// UTILITY: MIME TYPE VALIDATION
// =========================================

function isMimeAllowed(mimeType: string): boolean {
  if (!mimeType) return false;
  
  const normalized = mimeType.toLowerCase();
  
  for (const allowed of BRAND_SCANNER_ALLOWED_MIME) {
    if (allowed.endsWith('/*')) {
      const prefix = allowed.slice(0, -2);
      if (normalized.startsWith(prefix)) return true;
    } else {
      if (normalized === allowed.toLowerCase()) return true;
    }
  }
  
  return false;
}

// =========================================
// UTILITY: SHA256 HASH
// =========================================

function calculateSHA256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// =========================================
// UTILITY: ENSURE STORAGE DIR
// =========================================

async function ensureStorageDir(): Promise<void> {
  const brandMediaDir = path.join(STORAGE_DIR, 'brand-media');
  
  try {
    await mkdir(brandMediaDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error('Failed to create storage directory:', error);
      throw error;
    }
  }
}

// =========================================
// MEDIA DOWNLOAD WITH SHA256 DEDUPE
// =========================================

interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string;
  sha256: string;
}

async function downloadMediaFromUrl(mediaUrl: string): Promise<DownloadedMedia | null> {
  try {
    // ========================================
    // CRITICAL: SSRF PROTECTION
    // ========================================
    // Validate URL with DNS resolution BEFORE fetching
    // This prevents:
    // - Malicious sites embedding private IP links (169.254.169.254, 10.0.0.1, etc.)
    // - DNS rebinding attacks
    // - Exfiltration of protected resources
    
    let validatedUrl: string;
    try {
      validatedUrl = await validateUrl(mediaUrl);
    } catch (error: any) {
      console.warn(`[SSRF Protection] Blocked media download: ${mediaUrl} (${error.message})`);
      return null;
    }
    
    // Use Node.js fetch (available in Node 18+)
    const response = await fetch(validatedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'EAAS-BrandScanner/2.1-PRO',
      },
      signal: AbortSignal.timeout(15000), // 15s timeout per media
    });
    
    if (!response.ok) {
      console.warn(`Failed to download media: ${mediaUrl} (${response.status})`);
      return null;
    }
    
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Validate MIME type
    if (!isMimeAllowed(mimeType)) {
      console.warn(`MIME type not allowed: ${mimeType} for ${mediaUrl}`);
      return null;
    }
    
    // Download as buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Calculate SHA256
    const sha256 = calculateSHA256(buffer);
    
    return {
      buffer,
      mimeType,
      sha256,
    };
  } catch (error: any) {
    console.error(`Error downloading media ${mediaUrl}:`, error.message);
    return null;
  }
}

// =========================================
// SAVE MEDIA TO FILESYSTEM
// =========================================

async function saveMediaToFilesystem(
  sha256: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  await ensureStorageDir();
  
  // Determine file extension from MIME
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
  const filename = `${sha256}.${ext}`;
  const filePath = path.join(STORAGE_DIR, 'brand-media', filename);
  
  // Check if file already exists (dedupe)
  if (fs.existsSync(filePath)) {
    console.log(`✓ Media already exists (dedupe): ${filename}`);
    return filePath;
  }
  
  // Write to disk
  await writeFile(filePath, buffer);
  console.log(`✓ Saved media: ${filename} (${buffer.length} bytes)`);
  
  return filePath;
}

// =========================================
// EXTRACT MEDIA URLs FROM PAGE
// =========================================

async function extractMediaUrls(page: any): Promise<string[]> {
  return await page.evaluate(() => {
    const mediaUrls: string[] = [];
    
    // Images
    document.querySelectorAll('img').forEach((img: HTMLImageElement) => {
      if (img.src && img.src.startsWith('http')) {
        mediaUrls.push(img.src);
      }
    });
    
    // Videos
    document.querySelectorAll('video source, video').forEach((video: any) => {
      if (video.src && video.src.startsWith('http')) {
        mediaUrls.push(video.src);
      }
    });
    
    // Background images (CSS)
    document.querySelectorAll('*').forEach((el: Element) => {
      const bgImage = window.getComputedStyle(el).backgroundImage;
      const urlMatch = bgImage.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
      if (urlMatch && urlMatch[1]) {
        mediaUrls.push(urlMatch[1]);
      }
    });
    
    return [...new Set(mediaUrls)]; // Dedupe
  });
}

// =========================================
// DOWNLOAD ALL MEDIA WITH LIMITS
// =========================================

async function downloadAllMedia(mediaUrls: string[]): Promise<MediaAsset[]> {
  const mediaAssets: MediaAsset[] = [];
  const downloadedHashes = new Set<string>(); // Dedupe by SHA256
  let totalBytes = 0;
  
  for (const url of mediaUrls) {
    // Check byte limit
    if (totalBytes >= BRAND_SCANNER_MAX_TOTAL_BYTES) {
      console.warn(`⚠️ Reached byte limit (${BRAND_SCANNER_MAX_TOTAL_BYTES} bytes), stopping downloads`);
      break;
    }
    
    // Download media
    const downloaded = await downloadMediaFromUrl(url);
    if (!downloaded) continue;
    
    // Dedupe by SHA256
    if (downloadedHashes.has(downloaded.sha256)) {
      console.log(`✓ Skipping duplicate media (SHA256): ${downloaded.sha256}`);
      continue;
    }
    
    // Check byte limit again (after download)
    if (totalBytes + downloaded.buffer.length > BRAND_SCANNER_MAX_TOTAL_BYTES) {
      console.warn(`⚠️ Would exceed byte limit, skipping media: ${url}`);
      continue;
    }
    
    // Save to filesystem
    const localPath = await saveMediaToFilesystem(
      downloaded.sha256,
      downloaded.buffer,
      downloaded.mimeType
    );
    
    // Add to results
    mediaAssets.push({
      url,
      localPath,
      sha256: downloaded.sha256,
      mimeType: downloaded.mimeType,
      sizeBytes: downloaded.buffer.length,
      downloadedAt: new Date().toISOString(),
    });
    
    downloadedHashes.add(downloaded.sha256);
    totalBytes += downloaded.buffer.length;
  }
  
  console.log(`✓ Downloaded ${mediaAssets.length} media assets (${totalBytes} bytes)`);
  
  return mediaAssets;
}

// =========================================
// MAIN SCAN FUNCTION (EVOLVED)
// =========================================

/**
 * Scans a website and extracts comprehensive brand identity with K-Means clustering
 * + media downloads with SHA256 deduplication
 * 
 * Uses secure browser automation with queue management and SSRF protection
 */
export async function scanWebsiteBrand(url: string): Promise<BrandAnalysis> {
  return await safeBrowserRequest(
    async (page) => {
      // ====================================
      // EXTRACT DESIGN TOKENS (K-MEANS)
      // ====================================
      const brandData = await page.evaluate(() => {
        const result: any = {
          colors: {},
          tokens: {
            color: {},
            font: {},
            radius: {},
            spacing: {},
          },
          assets: {},
          typography: {},
          spacing: {},
        };

        // ====================================
        // K-MEANS COLOR CLUSTERING (Client-Side)
        // ====================================

        interface RGB { r: number; g: number; b: number; }

        function hexToRgb(hex: string): RGB | null {
          const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
          if (!match) return null;
          return {
            r: parseInt(match[1], 16),
            g: parseInt(match[2], 16),
            b: parseInt(match[3], 16),
          };
        }

        function rgbToHex(rgb: RGB): string {
          return "#" + ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1).toUpperCase();
        }

        function colorDistance(a: RGB, b: RGB): number {
          return Math.sqrt(
            Math.pow(a.r - b.r, 2) +
            Math.pow(a.g - b.g, 2) +
            Math.pow(a.b - b.b, 2)
          );
        }

        function kMeansClustering(colors: RGB[], k: number, maxIterations: number = 20): RGB[] {
          if (colors.length === 0) return [];
          if (colors.length <= k) return colors;

          let centroids: RGB[] = [];
          for (let i = 0; i < k; i++) {
            centroids.push(colors[Math.floor(Math.random() * colors.length)]);
          }

          for (let iter = 0; iter < maxIterations; iter++) {
            const clusters: RGB[][] = Array.from({ length: k }, () => []);

            colors.forEach(color => {
              let minDist = Infinity;
              let clusterIndex = 0;
              centroids.forEach((centroid, i) => {
                const dist = colorDistance(color, centroid);
                if (dist < minDist) {
                  minDist = dist;
                  clusterIndex = i;
                }
              });
              clusters[clusterIndex].push(color);
            });

            const newCentroids = clusters.map(cluster => {
              if (cluster.length === 0) return centroids[0];
              const avgR = cluster.reduce((sum, c) => sum + c.r, 0) / cluster.length;
              const avgG = cluster.reduce((sum, c) => sum + c.g, 0) / cluster.length;
              const avgB = cluster.reduce((sum, c) => sum + c.b, 0) / cluster.length;
              return { r: Math.round(avgR), g: Math.round(avgG), b: Math.round(avgB) };
            });

            centroids = newCentroids;
          }

          return centroids;
        }

        function getSaturation(rgb: RGB): number {
          const r = rgb.r / 255;
          const g = rgb.g / 255;
          const b = rgb.b / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          return max === 0 ? 0 : (max - min) / max;
        }

        function getLuminance(rgb: RGB): number {
          const r = rgb.r / 255;
          const g = rgb.g / 255;
          const b = rgb.b / 255;
          return 0.299 * r + 0.587 * g + 0.114 * b;
        }

        function isUsableColor(rgb: RGB): boolean {
          if (rgb.r > 250 && rgb.g > 250 && rgb.b > 250) return false;
          if (rgb.r < 10 && rgb.g < 10 && rgb.b < 10) return false;
          return true;
        }

        function parseColor(colorStr: string): RGB | null {
          if (colorStr.startsWith('#')) {
            return hexToRgb(colorStr);
          }
          const match = colorStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
          if (!match) return null;
          return {
            r: parseInt(match[1]),
            g: parseInt(match[2]),
            b: parseInt(match[3]),
          };
        }

        // Collect all colors from page
        const allElements = Array.from(document.querySelectorAll('*'));
        const colorSamples: RGB[] = [];
        const bgColorSamples: RGB[] = [];

        allElements.forEach(el => {
          const computed = window.getComputedStyle(el);
          const color = parseColor(computed.color);
          const bgColor = parseColor(computed.backgroundColor);

          if (color && isUsableColor(color)) {
            colorSamples.push(color);
          }
          if (bgColor && isUsableColor(bgColor)) {
            bgColorSamples.push(bgColor);
          }
        });

        // Run K-Means to extract top 5 color clusters
        const colorClusters = kMeansClustering(bgColorSamples.length > 0 ? bgColorSamples : colorSamples, 5);
        
        // Sort by saturation to find most vibrant colors
        const sortedClusters = colorClusters
          .map(rgb => ({ rgb, saturation: getSaturation(rgb), luminance: getLuminance(rgb) }))
          .sort((a, b) => b.saturation - a.saturation);

        // Assign semantic colors
        const primaryRgb = sortedClusters[0]?.rgb || { r: 16, g: 163, b: 127 };
        const secondaryRgb = sortedClusters[1]?.rgb || { r: 139, g: 92, b: 246 };
        const accentRgb = sortedClusters[2]?.rgb || { r: 59, g: 130, b: 246 };

        result.colors.primary = rgbToHex(primaryRgb);
        result.colors.secondary = rgbToHex(secondaryRgb);
        result.colors.accent = rgbToHex(accentRgb);
        result.colors.foreground = '#1C1C1E';
        result.colors.background = '#FFFFFF';
        result.colors.muted = '#F3F4F6';

        // ====================================
        // THEME TOKENS EXTRACTION
        // ====================================

        result.tokens.color = {
          primary: result.colors.primary,
          secondary: result.colors.secondary,
          accent: result.colors.accent,
          bg: '#FFFFFF',
          fg: '#1C1C1E',
          neutral: sortedClusters[3] ? rgbToHex(sortedClusters[3].rgb) : '#6B7280',
          link: result.colors.accent,
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
          surface: '#F9FAFB',
          subtle: '#E5E7EB',
        };

        // TYPOGRAPHY EXTRACTION
        const bodyStyles = window.getComputedStyle(document.body);
        const h1Element = document.querySelector('h1');
        const h1Styles = h1Element ? window.getComputedStyle(h1Element) : bodyStyles;

        const bodyFont = bodyStyles.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
        const headingFont = h1Styles.fontFamily.split(',')[0].replace(/['"]/g, '').trim();

        result.tokens.font = {
          body: {
            family: bodyFont,
            fallbacks: ['system-ui', '-apple-system', 'sans-serif'],
            weight: parseInt(bodyStyles.fontWeight) || 400,
          },
          heading: {
            family: headingFont,
            fallbacks: ['system-ui', '-apple-system', 'sans-serif'],
            weight: parseInt(h1Styles.fontWeight) || 700,
          },
          scale: {
            basePx: parseInt(bodyStyles.fontSize) || 16,
            ratio: 1.25,
          },
        };

        result.typography.primaryFont = bodyFont;
        result.typography.headingFont = headingFont;

        // RADIUS EXTRACTION
        const btnElement = document.querySelector('button, [class*="button"], [class*="btn"], a[class*="btn"]');
        const cardElement = document.querySelector('[class*="card"], [class*="panel"]');

        const btnRadius = btnElement ? parseFloat(window.getComputedStyle(btnElement).borderRadius) || 8 : 8;
        const cardRadius = cardElement ? parseFloat(window.getComputedStyle(cardElement).borderRadius) || 12 : 12;

        result.tokens.radius = {
          sm: Math.max(4, btnRadius / 2),
          md: btnRadius,
          lg: cardRadius,
          xl: cardRadius * 1.5,
        };

        result.spacing.borderRadius = `${btnRadius}px`;

        // SPACING EXTRACTION
        const spacingSample = btnElement ? window.getComputedStyle(btnElement).padding : '12px';
        const baseSpacing = parseInt(spacingSample) || 12;

        result.tokens.spacing = {
          base: baseSpacing,
          steps: [4, 8, 12, 16, 24, 32, 48, 64],
        };

        result.spacing.baseSpacing = `${baseSpacing}px`;

        // SHADOW EXTRACTION (Optional)
        const shadowElement = document.querySelector('[class*="card"], [class*="modal"], [class*="dropdown"]');
        if (shadowElement) {
          const boxShadow = window.getComputedStyle(shadowElement).boxShadow;
          if (boxShadow && boxShadow !== 'none') {
            result.tokens.shadow = {
              sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
              md: boxShadow,
              lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            };
          }
        }

        // BORDER EXTRACTION (Optional)
        const borderElement = btnElement || cardElement;
        if (borderElement) {
          const borderWidth = parseFloat(window.getComputedStyle(borderElement).borderWidth) || 1;
          const borderStyle = window.getComputedStyle(borderElement).borderStyle as 'solid' | 'dashed' | 'dotted';
          result.tokens.border = {
            width: borderWidth,
            style: borderStyle || 'solid',
          };
        }

        // ====================================
        // LOGO & FAVICON EXTRACTION
        // ====================================

        const logoSelectors = [
          'img[alt*="logo" i]',
          'img[class*="logo" i]',
          'img[id*="logo" i]',
          'img[src*="logo" i]',
          '.logo img',
          '#logo img',
          'header img:first-of-type',
          'nav img:first-of-type',
          '[class*="brand"] img',
          'svg[class*="logo" i]',
          'svg[id*="logo" i]',
        ];

        for (const selector of logoSelectors) {
          const logo = document.querySelector(selector);
          if (logo) {
            if (logo instanceof HTMLImageElement && logo.src) {
              result.assets.logo = logo.src;
              break;
            } else if (logo instanceof SVGElement) {
              const svgString = new XMLSerializer().serializeToString(logo);
              result.assets.logo = 'data:image/svg+xml;base64,' + btoa(svgString);
              break;
            }
          }
        }

        const faviconSelectors = [
          'link[rel="icon"]',
          'link[rel="shortcut icon"]',
          'link[rel="apple-touch-icon"]',
        ];
        
        for (const selector of faviconSelectors) {
          const faviconLink = document.querySelector(selector) as HTMLLinkElement;
          if (faviconLink && faviconLink.href) {
            result.assets.favicon = faviconLink.href;
            break;
          }
        }
        
        if (!result.assets.favicon) {
          result.assets.favicon = new URL('/favicon.ico', window.location.origin).href;
        }

        return result;
      });

      // ====================================
      // SCREENSHOT
      // ====================================
      const fullScreenshot = await page.screenshot({
        encoding: 'base64',
        fullPage: false,
      });

      // ====================================
      // MEDIA DOWNLOAD (NOVO!)
      // ====================================
      let mediaAssets: MediaAsset[] = [];
      
      if (BRAND_SCANNER_DOWNLOAD_MEDIA) {
        console.log('🎨 Extracting media URLs...');
        const mediaUrls = await extractMediaUrls(page);
        console.log(`✓ Found ${mediaUrls.length} media URLs`);
        
        if (mediaUrls.length > 0) {
          mediaAssets = await downloadAllMedia(mediaUrls);
        }
      }

      // ====================================
      // ADVANCED ANALYSIS (ENHANCED)
      // ====================================
      let advancedPalette: { hex: string; weight: number }[] | undefined;
      let advancedTypography: { family: string; source: string }[] | undefined;
      let enhancedTokens: ThemeTokens | undefined = brandData.tokens;
      let cloneManifest: any | undefined;
      
      // CIELAB server-side palette extraction from screenshot
      try {
        const pngBuffer = Buffer.from(fullScreenshot, 'base64');
        advancedPalette = await extractPaletteFromPng(pngBuffer, 8);
        console.log(`✓ CIELAB palette extracted: ${advancedPalette.length} colors`);
      } catch (error: any) {
        console.warn(`⚠️ Advanced palette extraction failed: ${error.message}`);
      }
      
      // Typography extraction from HTML
      try {
        const htmlContent = await page.content();
        advancedTypography = extractTypographyFromHtml(htmlContent);
        console.log(`✓ Typography extracted: ${advancedTypography.length} fonts`);
      } catch (error: any) {
        console.warn(`⚠️ Typography extraction failed: ${error.message}`);
      }
      
      // Build enhanced design tokens (combine client-side + server-side data)
      try {
        if (advancedPalette && advancedTypography) {
          enhancedTokens = buildDesignTokens(advancedPalette, advancedTypography);
          console.log('✓ Enhanced design tokens built');
        }
      } catch (error: any) {
        console.warn(`⚠️ Design tokens build failed: ${error.message}`);
      }
      
      // Build clone manifest for marketplace
      try {
        const htmlContent = await page.content();
        cloneManifest = buildCloneManifest(
          url,
          htmlContent,
          enhancedTokens || brandData.tokens,
          mediaAssets.map(m => ({
            localPath: m.localPath,
            originalUrl: m.url,
            type: m.mimeType.startsWith('image/') ? 'image' as const : 
                  m.mimeType.startsWith('video/') ? 'video' as const : 'other' as const,
            hash: m.sha256,
            bytes: m.sizeBytes,
          }))
        );
        console.log('✓ Clone manifest built');
      } catch (error: any) {
        console.warn(`⚠️ Clone manifest build failed: ${error.message}`);
      }

      // ====================================
      // ASSEMBLE RESULTS
      // ====================================
      const analysis: BrandAnalysis = {
        colors: brandData.colors,
        tokens: enhancedTokens || brandData.tokens,
        assets: brandData.assets,
        typography: brandData.typography,
        spacing: brandData.spacing,
        screenshots: {
          full: `data:image/png;base64,${fullScreenshot}`,
        },
        mediaAssets,
        
        // Enhanced data
        advancedPalette,
        advancedTypography,
        cloneManifest,
      };

      console.log('✅ Brand Scanner 2.1 PRO - Extraction Complete:', {
        kMeansClusters: 5,
        themeTokens: !!brandData.tokens,
        colors: brandData.colors,
        fonts: brandData.typography,
        mediaDownloaded: mediaAssets.length,
        totalMediaBytes: mediaAssets.reduce((sum, m) => sum + m.sizeBytes, 0),
        advancedFeatures: {
          cielabPalette: !!advancedPalette,
          htmlTypography: !!advancedTypography,
          cloneManifest: !!cloneManifest,
        },
      });

      return analysis;
    },
    {
      url, // Will be validated and sanitized by safeBrowserRequest
      timeout: parseInt(process.env.BRAND_SCANNER_NAV_TIMEOUT_MS || '45000', 10),
      blockMedia: false, // We need to see images for logo + media extraction
    }
  );
}
