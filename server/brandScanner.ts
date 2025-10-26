import puppeteer from 'puppeteer';

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
    // Launch Puppeteer with system Chromium installed via Nix
    // In Replit, Chromium is available at a specific Nix store path
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

      // Helper: Convert RGB/RGBA to HEX (function declaration for browser compatibility)
      function rgbToHex(rgb: string): string {
        if (rgb.startsWith('#')) return rgb;
        const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
        if (!match) return rgb;
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
      }

      // Helper: Calculate color saturation to find vibrant colors
      function getSaturation(hex: string): number {
        const rgb = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (!rgb) return 0;
        const r = parseInt(rgb[1], 16) / 255;
        const g = parseInt(rgb[2], 16) / 255;
        const b = parseInt(rgb[3], 16) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return max === 0 ? 0 : (max - min) / max;
      }

      // Helper: Check if color is too light or too dark (ignore pure white/black)
      function isUsableColor(hex: string): boolean {
        const rgb = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (!rgb) return false;
        const r = parseInt(rgb[1], 16);
        const g = parseInt(rgb[2], 16);
        const b = parseInt(rgb[3], 16);
        
        // Ignore pure white/off-white
        if (r > 250 && g > 250 && b > 250) return false;
        // Ignore pure black/off-black
        if (r < 10 && g < 10 && b < 10) return false;
        
        return true;
      }

      // 1. EXTRACT COLORS from ALL elements on page
      const allElements = Array.from(document.querySelectorAll('*'));
      const colorMap = new Map<string, { count: number; saturation: number }>();
      const bgColorMap = new Map<string, { count: number; saturation: number }>();

      allElements.forEach(el => {
        const computed = window.getComputedStyle(el);
        const color = rgbToHex(computed.color);
        const bgColor = rgbToHex(computed.backgroundColor);
        
        if (isUsableColor(color)) {
          const existing = colorMap.get(color) || { count: 0, saturation: getSaturation(color) };
          colorMap.set(color, { ...existing, count: existing.count + 1 });
        }
        
        if (isUsableColor(bgColor)) {
          const existing = bgColorMap.get(bgColor) || { count: 0, saturation: getSaturation(bgColor) };
          bgColorMap.set(bgColor, { ...existing, count: existing.count + 1 });
        }
      });

      // Sort by saturation * count to favor vibrant, common colors
      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => (b[1].saturation * b[1].count) - (a[1].saturation * a[1].count))
        .map(([color]) => color);

      const sortedBgColors = Array.from(bgColorMap.entries())
        .sort((a, b) => (b[1].saturation * b[1].count) - (a[1].saturation * a[1].count))
        .map(([color]) => color);

      // Assign colors intelligently
      result.colors.primary = sortedBgColors[0] || sortedColors[0] || '#10A37F';
      result.colors.secondary = sortedBgColors[1] || sortedColors[1] || '#8B5CF6';
      result.colors.accent = sortedBgColors[2] || sortedColors[2] || '#3B82F6';
      result.colors.foreground = sortedColors[0] || '#1C1C1E';
      result.colors.background = '#FFFFFF';
      result.colors.muted = sortedBgColors[3] || '#F3F4F6';

      // 2. EXTRACT LOGO - Try multiple strategies
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
        'a[class*="logo"] img',
        'a[class*="brand"] img',
        // SVG logos
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
            // For SVG, try to get parent link or convert to data URI
            const svgString = new XMLSerializer().serializeToString(logo);
            result.assets.logo = 'data:image/svg+xml;base64,' + btoa(svgString);
            break;
          }
        }
      }

      // 3. EXTRACT FAVICON
      const faviconSelectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
        'link[rel*="icon"]',
      ];
      
      for (const selector of faviconSelectors) {
        const faviconLink = document.querySelector(selector) as HTMLLinkElement;
        if (faviconLink && faviconLink.href) {
          result.assets.favicon = faviconLink.href;
          break;
        }
      }
      
      // Fallback to default favicon location
      if (!result.assets.favicon) {
        result.assets.favicon = new URL('/favicon.ico', window.location.origin).href;
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

    // Debug logging
    console.log('✅ Brand Scanner - Extraction Complete:', {
      colorsFound: Object.keys(brandData.colors).length,
      logoFound: !!brandData.assets.logo,
      faviconFound: !!brandData.assets.favicon,
      colors: brandData.colors,
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

/**
 * Convert RGB/RGBA color to HEX
 */
function rgbToHex(rgb: string): string {
  // If already hex, return as-is
  if (rgb.startsWith('#')) return rgb;
  
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
  if (!match) return rgb;
  
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Calculate luminance to distinguish bright vs dark colors
 */
function getLuminance(hex: string): number {
  const rgb = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!rgb) return 0;
  
  const r = parseInt(rgb[1], 16) / 255;
  const g = parseInt(rgb[2], 16) / 255;
  const b = parseInt(rgb[3], 16) / 255;
  
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
