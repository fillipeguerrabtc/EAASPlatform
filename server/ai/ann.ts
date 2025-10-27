// server/ai/ann.ts
// ANN HNSW incremental index with automatic checkpointing
// SECURITY: Tenant-isolated indexes, graceful shutdown, singleton cache

import { HierarchicalNSW } from "hnswlib-node";
import fs from "fs";
import path from "path";

type Space = "cosine" | "l2";
type Modality = "text" | "image";

const DIR = path.resolve(process.cwd(), "data", "ann");

// Singleton cache to prevent memory leaks from signal handlers
const indexCache = new Map<string, AnnIndex>();

function ensureDir() {
  if (!fs.existsSync(DIR)) {
    fs.mkdirSync(DIR, { recursive: true });
  }
}

function idxPath(tenantId: string, modality: Modality, dim: number, space: Space) {
  const base = path.join(DIR, `${tenantId}.${modality}.${space}.${dim}`);
  return {
    meta: base + ".meta.json",
    bin: base + ".bin"
  };
}

function cacheKey(tenantId: string, modality: Modality, dim: number, space: Space): string {
  return `${tenantId}:${modality}:${dim}:${space}`;
}

/**
 * ANN HNSW index with checkpoint support
 * SINGLETON: Use getInstance() to prevent memory leaks
 */
export class AnnIndex {
  private idx: HierarchicalNSW | null = null;
  private dim = 0;
  private space: Space = "cosine";
  private modality: Modality = "text";
  private tenantId: string;
  private lastSave = 0;
  private dirty = false;
  private static signalHandlersRegistered = false;

  private constructor(tenantId: string, modality: Modality, dim: number, space: Space = "cosine") {
    this.tenantId = tenantId;
    this.modality = modality;
    this.dim = dim;
    this.space = space;
    ensureDir();
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(tenantId: string, modality: Modality, dim: number, space: Space = "cosine"): AnnIndex {
    const key = cacheKey(tenantId, modality, dim, space);
    
    if (!indexCache.has(key)) {
      indexCache.set(key, new AnnIndex(tenantId, modality, dim, space));
    }
    
    return indexCache.get(key)!;
  }

  /**
   * Load existing index or create new one
   * @param capacity - Initial capacity (can grow)
   */
  loadOrCreate(capacity: number) {
    if (this.idx) return; // Already loaded

    const p = idxPath(this.tenantId, this.modality, this.dim, this.space);
    const idx = new HierarchicalNSW(this.space, this.dim);

    if (fs.existsSync(p.meta) && fs.existsSync(p.bin)) {
      // Load existing index
      idx.readIndex(p.bin);
      this.idx = idx;
      console.log(`✅ Loaded ANN index: ${p.bin}`);
    } else {
      // Create new index
      idx.initIndex(
        capacity,
        Number(process.env.AI_ANN_M || 16),
        Number(process.env.AI_ANN_EF_CONS || 200)
      );
      this.idx = idx;
      this.saveMeta({ size: 0 });
      this.saveNow(); // Create initial .bin file
      console.log(`✅ Created new ANN index: ${p.bin}`);
    }

    // Register shutdown handlers ONCE for all indexes
    if (!AnnIndex.signalHandlersRegistered) {
      AnnIndex.signalHandlersRegistered = true;

      process.on("SIGINT", () => {
        try {
          // Save all cached indexes
          for (const idx of indexCache.values()) {
            idx.saveNow();
          }
        } catch {}
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        try {
          // Save all cached indexes
          for (const idx of indexCache.values()) {
            idx.saveNow();
          }
        } catch {}
        process.exit(0);
      });
    }
  }

  /**
   * Set search ef parameter
   */
  setEf(ef: number) {
    this.idx?.setEf(ef);
  }

  /**
   * Add items to index (incremental)
   * @param items - Array of vectors
   * @param ids - Array of numeric IDs (hash of chunkId)
   */
  add(items: number[][], ids: number[]) {
    if (!this.idx) {
      throw new Error("ANN não inicializado");
    }

    for (let i = 0; i < items.length; i++) {
      this.idx.addPoint(items[i], ids[i]);
    }
    this.dirty = true;
    this.maybeSave();
  }

  /**
   * Search k nearest neighbors
   * @param query - Query vector
   * @param k - Number of neighbors
   * @returns Array of {hid: number, score: number} (score is similarity, not distance)
   */
  search(query: number[], k: number): Array<{ hid: number; score: number }> {
    if (!this.idx) {
      throw new Error("ANN não inicializado");
    }

    this.idx.setEf(Number(process.env.AI_ANN_EF || 64));
    const { neighbors, distances } = this.idx.searchKnn(query, k);

    // For cosine, library returns distance — convert to similarity score (1 - dist)
    return neighbors.map((hid: number, i: number) => ({
      hid,
      score: 1 - distances[i]
    }));
  }

  /**
   * Save if dirty and enough time passed
   */
  private maybeSave() {
    const now = Date.now();
    // Save at most every 2 minutes if dirty
    if (this.dirty && now - this.lastSave > 120000) {
      this.saveNow();
    }
  }

  /**
   * Force save now
   */
  saveNow() {
    if (!this.idx) return;

    const p = idxPath(this.tenantId, this.modality, this.dim, this.space);
    this.idx.writeIndex(p.bin);
    this.saveMeta({ size: this.idx.getCurrentCount() });
    this.lastSave = Date.now();
    this.dirty = false;
  }

  /**
   * Save metadata JSON
   */
  private saveMeta(meta: { size: number }) {
    const p = idxPath(this.tenantId, this.modality, this.dim, this.space);
    fs.writeFileSync(
      p.meta,
      JSON.stringify({
        tenantId: this.tenantId,
        modality: this.modality,
        space: this.space,
        dim: this.dim,
        size: meta.size,
        savedAt: new Date().toISOString()
      })
    );
  }
}
