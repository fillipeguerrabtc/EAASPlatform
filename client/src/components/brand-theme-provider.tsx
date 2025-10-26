import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import type { Tenant, ThemeTokens } from '@shared/schema';

interface CustomTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
}

interface BrandThemeContextType {
  activeTheme: ThemeTokens | null;
  applyTheme: (tokens: ThemeTokens) => void;
  clearTheme: () => void;
}

const BrandThemeContext = createContext<BrandThemeContextType | undefined>(undefined);

export function useBrandTheme() {
  const context = useContext(BrandThemeContext);
  if (!context) {
    throw new Error('useBrandTheme must be used within BrandThemeProvider');
  }
  return context;
}

/**
 * BrandThemeProvider - Dynamically applies theme tokens as CSS variables
 * Backward compatible with old tenant.customTheme format
 * NEW: Supports full ThemeTokens from Brand Scanner 2.0
 */
export function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeTheme, setActiveTheme] = useState<ThemeTokens | null>(null);

  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const currentTenant = tenants?.[0];

  // NEW: Query active theme bundle from Brand Scanner 2.0
  const { data: activeThemeBundle } = useQuery<{ id: string; tokens: ThemeTokens } | null>({
    queryKey: ['/api/brand/themes/active', currentTenant?.id],
    enabled: !!currentTenant?.id,
  });

  const applyTheme = (tokens: ThemeTokens) => {
    setActiveTheme(tokens);

    const root = document.documentElement;

    // Apply color tokens as CSS variables
    if (tokens.color) {
      Object.entries(tokens.color).forEach(([key, value]) => {
        root.style.setProperty(`--brand-${key}`, value);
      });
      
      // Also set as Tailwind-compatible HSL variables
      if (tokens.color.primary) {
        const hsl = hexToHSL(tokens.color.primary);
        root.style.setProperty('--primary', hsl);
        root.style.setProperty('--sidebar-primary', hsl);
        root.style.setProperty('--ring', hsl);
      }
      if (tokens.color.secondary) {
        const hsl = hexToHSL(tokens.color.secondary);
        root.style.setProperty('--secondary', hsl);
      }
      if (tokens.color.accent) {
        const hsl = hexToHSL(tokens.color.accent);
        root.style.setProperty('--accent', hsl);
      }
    }

    // Apply font tokens
    if (tokens.font) {
      if (tokens.font.body) {
        root.style.setProperty('--font-body', tokens.font.body.family);
      }
      if (tokens.font.heading) {
        root.style.setProperty('--font-heading', tokens.font.heading.family);
      }
      if (tokens.font.scale) {
        root.style.setProperty('--font-size-base', `${tokens.font.scale.basePx}px`);
      }
    }

    // Apply radius tokens
    if (tokens.radius) {
      root.style.setProperty('--radius', `${tokens.radius.md}px`);
      root.style.setProperty('--radius-sm', `${tokens.radius.sm}px`);
      root.style.setProperty('--radius-md', `${tokens.radius.md}px`);
      root.style.setProperty('--radius-lg', `${tokens.radius.lg}px`);
      if (tokens.radius.xl) {
        root.style.setProperty('--radius-xl', `${tokens.radius.xl}px`);
      }
    }

    // Apply spacing tokens
    if (tokens.spacing) {
      root.style.setProperty('--spacing-base', `${tokens.spacing.base}px`);
    }

    // Apply shadow tokens
    if (tokens.shadow) {
      root.style.setProperty('--shadow-sm', tokens.shadow.sm);
      root.style.setProperty('--shadow-md', tokens.shadow.md);
      root.style.setProperty('--shadow-lg', tokens.shadow.lg);
    }

    // Apply border tokens
    if (tokens.border) {
      root.style.setProperty('--border-width', `${tokens.border.width}px`);
      root.style.setProperty('--border-style', tokens.border.style);
    }

    console.log('✅ Brand theme applied (ThemeTokens):', tokens);
  };

  const clearTheme = () => {
    setActiveTheme(null);

    const root = document.documentElement;
    
    // Remove all brand-specific CSS variables
    const allVars = [
      '--brand-primary', '--brand-secondary', '--brand-accent',
      '--brand-bg', '--brand-fg', '--brand-neutral', '--brand-link',
      '--brand-success', '--brand-warning', '--brand-danger',
      '--brand-surface', '--brand-subtle',
      '--font-body', '--font-heading', '--font-size-base',
      '--radius', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl',
      '--spacing-base',
      '--shadow-sm', '--shadow-md', '--shadow-lg',
      '--border-width', '--border-style',
    ];

    allVars.forEach(varName => {
      root.style.removeProperty(varName);
    });

    // Remove old style tag
    const existingStyle = document.getElementById('brand-theme-override');
    if (existingStyle) {
      existingStyle.remove();
    }

    console.log('✅ Brand theme cleared');
  };

  // Apply active theme bundle automatically on load
  useEffect(() => {
    if (activeThemeBundle?.tokens) {
      applyTheme(activeThemeBundle.tokens);
      console.log('✅ Active theme bundle auto-applied on load');
    }
  }, [activeThemeBundle]);

  useEffect(() => {
    // Always cleanup existing brand theme first
    const existingStyle = document.getElementById('brand-theme-override');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Reset favicon to default
    let favicon = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = '/favicon.svg';

    // Reset title to default
    document.title = 'EAAS - Everything As A Service';

    // If no tenant, stop here (cleanup done)
    if (!currentTenant) return;

    // OLD FORMAT: Support legacy tenant.customTheme
    const theme = currentTenant.customTheme as CustomTheme | null;

    if (theme?.colors) {
      const primaryHSL = hexToHSL(theme.colors.primary);
      const secondaryHSL = hexToHSL(theme.colors.secondary);
      const accentHSL = hexToHSL(theme.colors.accent);
      const backgroundHSL = hexToHSL(theme.colors.background);
      const foregroundHSL = hexToHSL(theme.colors.foreground);

      // Create dynamic style tag that applies to both light and dark modes
      const styleTag = document.createElement('style');
      styleTag.id = 'brand-theme-override';
      
      let cssRules = `
        :root, .dark {
          ${primaryHSL ? `
            --primary: ${primaryHSL};
            --sidebar-primary: ${primaryHSL};
            --sidebar-ring: ${primaryHSL};
            --ring: ${primaryHSL};
            --chart-1: ${primaryHSL};
            --primary-foreground: 0 0% 100%;
          ` : ''}
          ${secondaryHSL ? `
            --secondary: ${secondaryHSL};
          ` : ''}
          ${accentHSL ? `
            --accent: ${accentHSL};
            --chart-2: ${accentHSL};
            --accent-foreground: 0 0% 100%;
          ` : ''}
        }

        :root:not(.dark) {
          ${backgroundHSL ? `
            --background: ${backgroundHSL};
            --card: ${backgroundHSL};
          ` : ''}
          ${foregroundHSL ? `
            --foreground: ${foregroundHSL};
            --card-foreground: ${foregroundHSL};
          ` : ''}
        }
      `;

      styleTag.textContent = cssRules;
      document.head.appendChild(styleTag);
    }

    // Override favicon if tenant has one
    if (currentTenant.faviconUrl) {
      favicon.href = currentTenant.faviconUrl;
    }

    // Override title if tenant has a name
    if (currentTenant.name) {
      document.title = `${currentTenant.name} - EAAS`;
    }
  }, [currentTenant]);

  return (
    <BrandThemeContext.Provider value={{ activeTheme, applyTheme, clearTheme }}>
      {children}
    </BrandThemeContext.Provider>
  );
}

/**
 * Convert HEX to HSL format for Tailwind compatibility
 */
function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lRounded = Math.round(l * 100);

  return `${h} ${s}% ${lRounded}%`;
}
