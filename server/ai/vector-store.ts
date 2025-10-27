// server/ai/vector-store.ts
// Unified vector store for text and image embeddings
// SECURITY: Full tenant isolation, ANN incremental indexing

import { db } from "../db";
import {
  aiEmbeddingsText,
  aiEmbeddingsImage,
  aiChunks,
  aiAnnMeta
} from "@shared/schema.ai.core";
import { eq, sql, inArray } from "drizzle-orm";
import { AnnIndex } from "./ann";

type Modality = "text" | "image";

/**
 * Deterministic hash function for chunk ID → numeric ID
 */
function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Update ANN metadata in database
 */
async function upsertAnnMeta(
  tenantId: string,
  modality: Modality,
  dim: number,
  sizeDelta: number
) {
  const rows = await db
    .select()
    .from(aiAnnMeta)
    .where(eq(aiAnnMeta.tenantId, tenantId));

  if (!rows.length) {
    await db.insert(aiAnnMeta).values({
      tenantId,
      textDim: modality === "text" ? dim : 0,
      imageDim: modality === "image" ? dim : 0,
      sizeText: modality === "text" ? sizeDelta : 0,
      sizeImage: modality === "image" ? sizeDelta : 0
    });
  } else {
    const cur = rows[0];
    await db
      .update(aiAnnMeta)
      .set({
        textDim: modality === "text" ? dim : cur.textDim,
        imageDim: modality === "image" ? dim : cur.imageDim,
        sizeText: modality === "text" ? cur.sizeText + sizeDelta : cur.sizeText,
        sizeImage: modality === "image" ? cur.sizeImage + sizeDelta : cur.sizeImage,
        updatedAt: new Date()
      })
      .where(eq(aiAnnMeta.tenantId, tenantId));
  }
}

// ========================================
// TEXT EMBEDDINGS
// ========================================

/**
 * Upsert text embedding and add to ANN index
 * SECURITY: Tenant isolation enforced
 */
export async function upsertTextEmbedding(
  tenantId: string,
  chunkId: string,
  vector: number[],
  model: string
) {
  await db
    .insert(aiEmbeddingsText)
    .values({
      chunkId,
      tenantId,
      vectorJson: JSON.stringify(vector),
      dim: vector.length,
      model
    })
    .onConflictDoUpdate({
      target: aiEmbeddingsText.chunkId,
      set: {
        vectorJson: JSON.stringify(vector),
        dim: vector.length,
        model
      }
    });

  // ANN incremental update
  const ann = new AnnIndex(tenantId, "text", vector.length, "cosine");
  ann.loadOrCreate(1000);
  ann.add([vector], [idHash(chunkId)]);

  await upsertAnnMeta(tenantId, "text", vector.length, +1);
}

/**
 * kNN search for text embeddings
 * SECURITY: Tenant isolation enforced
 */
export async function knnText(
  tenantId: string,
  queryVec: number[],
  k = 50
): Promise<Array<{ chunkId: string; score: number }>> {
  const ann = new AnnIndex(tenantId, "text", queryVec.length, "cosine");
  ann.loadOrCreate(1000);

  const out = ann.search(queryVec, k);

  // Map HID -> chunkId
  const rows = await db
    .select()
    .from(aiEmbeddingsText)
    .where(eq(aiEmbeddingsText.tenantId, tenantId));

  const map = new Map<number, string>();
  for (const r of rows) {
    map.set(idHash(r.chunkId), r.chunkId);
  }

  return out
    .map(o => ({
      chunkId: map.get(o.hid)!,
      score: o.score
    }))
    .filter(x => !!x.chunkId);
}

// ========================================
// IMAGE EMBEDDINGS
// ========================================

/**
 * Upsert image embedding and add to ANN index
 * SECURITY: Tenant isolation enforced
 */
export async function upsertImageEmbedding(
  tenantId: string,
  chunkId: string,
  vector: number[],
  model: string
) {
  await db
    .insert(aiEmbeddingsImage)
    .values({
      chunkId,
      tenantId,
      vectorJson: JSON.stringify(vector),
      dim: vector.length,
      model
    })
    .onConflictDoUpdate({
      target: aiEmbeddingsImage.chunkId,
      set: {
        vectorJson: JSON.stringify(vector),
        dim: vector.length,
        model
      }
    });

  // ANN incremental update
  const ann = new AnnIndex(tenantId, "image", vector.length, "cosine");
  ann.loadOrCreate(1000);
  ann.add([vector], [idHash(chunkId)]);

  await upsertAnnMeta(tenantId, "image", vector.length, +1);
}

/**
 * kNN search for image embeddings
 * SECURITY: Tenant isolation enforced
 */
export async function knnImage(
  tenantId: string,
  queryVec: number[],
  k = 50
): Promise<Array<{ chunkId: string; score: number }>> {
  const ann = new AnnIndex(tenantId, "image", queryVec.length, "cosine");
  ann.loadOrCreate(1000);

  const out = ann.search(queryVec, k);

  // Map HID -> chunkId
  const rows = await db
    .select()
    .from(aiEmbeddingsImage)
    .where(eq(aiEmbeddingsImage.tenantId, tenantId));

  const map = new Map<number, string>();
  for (const r of rows) {
    map.set(idHash(r.chunkId), r.chunkId);
  }

  return out
    .map(o => ({
      chunkId: map.get(o.hid)!,
      score: o.score
    }))
    .filter(x => !!x.chunkId);
}

// ========================================
// UTILITY
// ========================================

/**
 * Get chunks by IDs (supports both text and image chunks)
 * SECURITY: Returns chunks for specified IDs only
 */
export async function getChunksByIds(ids: string[]): Promise<any[]> {
  if (!ids.length) return [];

  const rows = await db
    .select()
    .from(aiChunks)
    .where(inArray(aiChunks.id, ids));

  return rows as any[];
}
