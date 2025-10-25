import { useQuery } from "@tanstack/react-query";

export interface TenantContext {
  detectedTenant: {
    id: string;
    subdomain: string;
    name: string;
    logoUrl?: string;
    faviconUrl?: string;
  } | null;
  isSuperAdminRoute: boolean;
  isCentralMarketplace: boolean;
}

/**
 * Hook to get tenant context from subdomain detection
 * Works in development (localhost) and production (subdomain.eaas.com)
 */
export function useTenantContext() {
  const { data, isLoading } = useQuery<TenantContext>({
    queryKey: ['/api/tenant-context'],
    staleTime: Infinity, // Tenant context doesn't change during session
  });

  return {
    tenantContext: data,
    isLoading,
    detectedTenant: data?.detectedTenant,
    isSuperAdminRoute: data?.isSuperAdminRoute || false,
    isCentralMarketplace: data?.isCentralMarketplace || false,
  };
}
