import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

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
  assets?: BrandAssets;
  typography?: BrandTypography;
  spacing?: BrandSpacing;
  screenshots?: {
    full?: string;
    hero?: string;
  };
}

/**
 * Scans a website and extracts comprehensive brand identity
 * @param url - Website URL to scan
 * @returns Complete brand analysis including colors, logos, fonts, spacing
 */
export async function scanWebsiteBrand(url: string): Promise<BrandAnalysis> {
  let browser;
  
  try {
    // Launch Puppeteer with Chromium
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath('/opt/nix/store'),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to the website
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Extract comprehensive brand data
    const brandData = await page.evaluate(() => {
      const result: any = {
        colors: {},
        assets: {},
        typography: {},
        spacing: {},
      };

      // 1. EXTRACT COLORS from computed styles
      const elementsToAnalyze = [
        document.body,
        document.querySelector('header'),
        document.querySelector('nav'),
        document.querySelector('.hero, [class*="hero"]'),
        document.querySelector('button, [class*="button"], [class*="btn"]'),
        document.querySelector('a[href]'),
      ].filter(Boolean) as Element[];

      const colorCounts: Record<string, number> = {};
      const bgColorCounts: Record<string, number> = {};

      elementsToAnalyze.forEach(el => {
        const computed = window.getComputedStyle(el);
        const color = computed.color;
        const bgColor = computed.backgroundColor;
        
        if (color && color !== 'rgba(0, 0, 0, 0)') {
          colorCounts[color] = (colorCounts[color] || 0) + 1;
        }
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
          bgColorCounts[bgColor] = (bgColorCounts[bgColor] || 0) + 1;
        }
      });

      // Get most common colors
      const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
      const sortedBgColors = Object.entries(bgColorCounts).sort((a, b) => b[1] - a[1]);

      result.colors.foreground = sortedColors[0]?.[0] || '#000000';
      result.colors.primary = sortedColors[1]?.[0] || sortedBgColors[0]?.[0] || '#3B82F6';
      result.colors.secondary = sortedBgColors[1]?.[0] || '#6366F1';
      result.colors.background = sortedBgColors[0]?.[0] || '#FFFFFF';
      result.colors.accent = sortedColors[2]?.[0] || '#8B5CF6';
      result.colors.muted = sortedBgColors[2]?.[0] || '#F3F4F6';

      // 2. EXTRACT LOGO
      const logoSelectors = [
        'img[alt*="logo" i]',
        'img[class*="logo" i]',
        'img[id*="logo" i]',
        '.logo img',
        'header img:first-of-type',
        'nav img:first-of-type',
        '[class*="brand"] img',
      ];

      for (const selector of logoSelectors) {
        const logo = document.querySelector(selector) as HTMLImageElement;
        if (logo && logo.src) {
          result.assets.logo = logo.src;
          break;
        }
      }

      // 3. EXTRACT FAVICON
      const faviconLink = document.querySelector('link[rel*="icon"]') as HTMLLinkElement;
      if (faviconLink) {
        result.assets.favicon = faviconLink.href;
      }

      // 4. EXTRACT TYPOGRAPHY
      const bodyStyles = window.getComputedStyle(document.body);
      const headingElement = document.querySelector('h1, h2, h3');
      const headingStyles = headingElement ? window.getComputedStyle(headingElement) : null;

      result.typography.primaryFont = bodyStyles.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      result.typography.headingFont = headingStyles?.fontFamily.split(',')[0].replace(/['"]/g, '').trim() || result.typography.primaryFont;

      // 5. EXTRACT SPACING & BORDERS
      const buttonElement = document.querySelector('button, [class*="button"], [class*="btn"]');
      if (buttonElement) {
        const buttonStyles = window.getComputedStyle(buttonElement);
        result.spacing.borderRadius = buttonStyles.borderRadius;
        result.spacing.baseSpacing = buttonStyles.padding;
      }

      return result;
    });

    // 6. Take screenshots
    const fullScreenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: false,
    });

    const analysis: BrandAnalysis = {
      colors: brandData.colors,
      assets: brandData.assets,
      typography: brandData.typography,
      spacing: brandData.spacing,
      screenshots: {
        full: `data:image/png;base64,${fullScreenshot}`,
      },
    };

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

/**
 * Convert RGB/RGBA color to HEX
 */
function rgbToHex(rgb: string): string {
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
  if (!match) return rgb;
  
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}
