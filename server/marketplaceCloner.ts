// server/marketplaceCloner.ts
// Clona marca scaneada para o Marketplace
// Publica assets para CDN local e cria manifest
// Implementação com path normalization conforme Architect

import fs from "fs";
import fsp from "fs/promises";
import path from "path";

type CloneAsset = {
  localPath: string;
  originalUrl: string;
  type: "image" | "video" | "svg" | "other";
  hash: string;
  bytes: number;
};

type PageBlueprint = {
  url: string;
  route: string;
  layout: Array<{ 
    kind: "hero" | "section" | "gallery" | "footer" | "nav" | "content"; 
    notes?: string 
  }>;
};

type Tokens = any;

export type CloneManifest = {
  siteUrl: string;
  tokens: Tokens;
  assets: CloneAsset[];
  pages: PageBlueprint[];
  notes: string[];
};

/**
 * Ensure directory exists
 */
function ensureDir(p: string): void { 
  fs.mkdirSync(p, { recursive: true }); 
}

/**
 * Get safe file extension from MIME type
 */
function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogg',
  };
  
  const normalized = mimeType.split(';')[0].toLowerCase();
  return mimeMap[normalized] || 'bin';
}

/**
 * Publish assets to CDN (local storage/public/assets)
 * Copies files with hash-based filenames for deduplication
 * @param assets Array of clone assets
 * @returns Array of published assets with public URLs
 */
export async function publishAssetsToCdn(assets: CloneAsset[]): Promise<Array<{
  url: string;
  hash: string;
  type: string;
  bytes: number;
  originalUrl: string;
}>> {
  const storageDir = process.env.STORAGE_DIR || "./.storage";
  const cdnDir = path.join(storageDir, "public", "assets");
  ensureDir(cdnDir);

  const published: Array<{ 
    url: string; 
    hash: string; 
    type: string; 
    bytes: number; 
    originalUrl: string 
  }> = [];

  for (const asset of assets) {
    try {
      // Normalize local path to prevent traversal
      const normalizedLocalPath = path.normalize(asset.localPath);
      
      // Security: ensure local path is within storage dir using path.relative
      // This prevents bypass attacks like /.storage-other/ that would pass startsWith check
      const realLocalPath = fs.realpathSync(normalizedLocalPath);
      const realStorageDir = fs.realpathSync(storageDir);
      const relativePath = path.relative(realStorageDir, realLocalPath);
      
      // Check if path escapes storage dir (starts with .. or is absolute)
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        console.warn(`⚠️ Skipping asset outside storage dir: ${asset.localPath}`);
        continue;
      }
      
      // Determine file extension
      let ext = path.extname(normalizedLocalPath).slice(1); // Remove leading dot
      
      if (!ext) {
        // Try to get extension from MIME type
        ext = getExtensionFromMime(asset.type === "svg" ? "image/svg+xml" : 
                                    asset.type === "image" ? "image/png" : 
                                    asset.type === "video" ? "video/mp4" : "bin");
      }
      
      const filename = `${asset.hash}.${ext}`;
      const destPath = path.join(cdnDir, filename);
      
      // Security: verify destination is within CDN dir using path.relative
      const realDestPath = path.resolve(destPath);
      const realCdnDir = path.resolve(cdnDir);
      const relativeDestPath = path.relative(realCdnDir, realDestPath);
      
      // Check if destination escapes CDN dir
      if (relativeDestPath.startsWith('..') || path.isAbsolute(relativeDestPath)) {
        console.warn(`⚠️ Skipping asset with invalid destination: ${filename}`);
        continue;
      }
      
      // Copy file (skip if already exists - dedupe)
      if (!fs.existsSync(destPath)) {
        await fsp.copyFile(normalizedLocalPath, destPath);
        console.log(`✓ Published asset: ${filename}`);
      } else {
        console.log(`✓ Asset already exists (dedupe): ${filename}`);
      }
      
      published.push({
        url: `/public/assets/${filename}`,
        hash: asset.hash,
        type: asset.type,
        bytes: asset.bytes,
        originalUrl: asset.originalUrl
      });
      
    } catch (error: any) {
      console.error(`Failed to publish asset ${asset.hash}:`, error.message);
      // Continue with other assets
    }
  }
  
  console.log(`✓ Published ${published.length}/${assets.length} assets to CDN`);
  
  return published;
}

/**
 * Write marketplace manifest to public directory
 * @param input Clone manifest with all data
 * @param publishedAssets Array of published assets
 * @returns Object with manifest URL
 */
export async function writeMarketplaceManifest(
  input: CloneManifest,
  publishedAssets: Array<{ url: string; hash: string }>
): Promise<{ manifestUrl: string }> {
  const storageDir = process.env.STORAGE_DIR || "./.storage";
  const marketDir = path.join(storageDir, "public", "marketplace");
  ensureDir(marketDir);

  // Create skinny manifest for frontend
  const manifest = {
    siteUrl: input.siteUrl,
    tokens: input.tokens,
    pages: input.pages,
    assets: publishedAssets,
    generatedAt: new Date().toISOString(),
  };

  const manifestPath = path.join(marketDir, "manifest.json");
  
  // Write atomically (temp + rename)
  const tempPath = `${manifestPath}.tmp`;
  await fsp.writeFile(tempPath, JSON.stringify(manifest, null, 2), "utf-8");
  await fsp.rename(tempPath, manifestPath);
  
  console.log(`✓ Marketplace manifest written: ${manifestPath}`);

  return { manifestUrl: `/public/marketplace/manifest.json` };
}
