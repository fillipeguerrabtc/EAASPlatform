import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@shared/schema";

export function DynamicFavicon() {
  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  // Single-tenant: use first tenant if available
  const currentTenant = tenants && tenants.length > 0 ? tenants[0] : null;

  useEffect(() => {
    if (!currentTenant?.faviconUrl) return;

    // Remove existing favicon links
    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach((link) => link.remove());

    // Add new favicon
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = currentTenant.faviconUrl;
    document.head.appendChild(link);

    // Cleanup function
    return () => {
      const currentFavicon = document.querySelector(`link[href="${currentTenant.faviconUrl}"]`);
      if (currentFavicon) {
        currentFavicon.remove();
      }
    };
  }, [currentTenant?.faviconUrl]);

  return null; // This component doesn't render anything
}
