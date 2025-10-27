import { useQuery } from "@tanstack/react-query";
import type { MarketplaceManifest, ThemeTokens } from "@/types/brandScanner";

/**
 * useTokens Hook
 * Loads marketplace theme tokens from manifest.json with memoization
 * 
 * Usage:
 * ```tsx
 * const { tokens, isLoading, error } = useTokens();
 * if (isLoading) return <Spinner />;
 * if (error) return <div>Failed to load theme</div>;
 * return <ThemedComponent tokens={tokens} />;
 * ```
 */
export function useTokens() {
  const query = useQuery<ThemeTokens, Error>({
    queryKey: ["/manifest", "tokens"],
    queryFn: async () => {
      const response = await fetch("/public/marketplace/manifest.json");
      
      if (!response.ok) {
        throw new Error(`Failed to load marketplace manifest: ${response.status}`);
      }
      
      const manifest: MarketplaceManifest = await response.json();
      
      if (!manifest.tokens) {
        throw new Error("Manifest does not contain theme tokens");
      }
      
      return manifest.tokens;
    },
    staleTime: 1000 * 60 * 5, // Consider fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    retry: 2, // Retry twice on failure
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  return {
    tokens: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * useManifest Hook
 * Loads complete marketplace manifest with memoization
 * 
 * Usage:
 * ```tsx
 * const { manifest, isLoading, error } = useManifest();
 * ```
 */
export function useManifest() {
  const query = useQuery<MarketplaceManifest, Error>({
    queryKey: ["/manifest", "full"],
    queryFn: async () => {
      const response = await fetch("/public/marketplace/manifest.json");
      
      if (!response.ok) {
        throw new Error(`Failed to load marketplace manifest: ${response.status}`);
      }
      
      const manifest: MarketplaceManifest = await response.json();
      return manifest;
    },
    staleTime: 1000 * 60 * 5, // Consider fresh for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  });

  return {
    manifest: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
