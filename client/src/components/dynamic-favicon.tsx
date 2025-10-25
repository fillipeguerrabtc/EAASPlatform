import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Tenant } from "@shared/schema";

export function DynamicFavicon() {
  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const currentTenant = tenants[0]; // For MVP, using first tenant

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
