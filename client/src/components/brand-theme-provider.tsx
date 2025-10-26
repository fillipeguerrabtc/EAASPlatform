import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@shared/schema";

interface CustomTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
}

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

export function BrandThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const currentTenant = tenants?.[0];

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

  return <>{children}</>;
}
