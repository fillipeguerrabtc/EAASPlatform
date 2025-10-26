import puppeteer from 'puppeteer';
import type { ThemeTokens } from '@shared/schema';

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
}

/**
 * Scans a website and extracts comprehensive brand identity with K-Means clustering
 * @param url - Website URL to scan
 * @returns Complete brand analysis including ThemeTokens
 */
export async function scanWebsiteBrand(url: string): Promise<BrandAnalysis> {
  let browser;
  
  try {
    const chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium-browser';
    
    browser = await puppeteer.launch({
      executablePath: chromiumPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Extract comprehensive design tokens with K-Means clustering
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
          ratio: 1.25 as const,
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

    // Take screenshot
    const fullScreenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: false,
    });

    const analysis: BrandAnalysis = {
      colors: brandData.colors,
      tokens: brandData.tokens,
      assets: brandData.assets,
      typography: brandData.typography,
      spacing: brandData.spacing,
      screenshots: {
        full: `data:image/png;base64,${fullScreenshot}`,
      },
    };

    console.log('✅ Brand Scanner 2.0 - Enhanced Extraction Complete:', {
      kMeansClusters: 5,
      themeTokens: !!brandData.tokens,
      colors: brandData.colors,
      fonts: brandData.typography,
    });

    return analysis;
  } catch (error: any) {
    console.error('Brand scanner error:', error);
    throw new Error(`Failed to scan website: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
