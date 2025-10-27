// server/ai/kg.ts
// Knowledge Graph - NER (Named Entity Recognition) + PageRank-like scoring + Chunk-Entity associations
// SECURITY: Full tenant isolation

import { db } from "../db";
import { aiEntities, aiEntityLinks, aiChunkEntities } from "@shared/schema.ai.graph";
import { eq, and, sql } from "drizzle-orm";

// ========================================
// SIMPLE NER (Named Entity Recognition)
// ========================================

type Entity = {
  type: string;
  value: string;
};

/**
 * Lightweight NER - extracts potential entities from text
 * This is a simple rule-based approach. For production, consider using a proper NER model.
 */
export function nerLight(text: string): Entity[] {
  const entities: Entity[] = [];
  
  // Remove punctuation and normalize
  const normalized = text
    .normalize("NFKC")
    .replace(/[^\w\s]/g, " ")
    .trim();
  
  const words = normalized.split(/\s+/);
  
  // Simple patterns for entity extraction
  // 1. Capitalized words (potential PERSON/ORG/LOC)
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Skip short words and common words
    if (word.length <= 2) continue;
    
    // Capitalized word (potential entity)
    if (/^[A-ZÀ-Ü]/.test(word)) {
      // Check if it's a multi-word entity (e.g., "New York")
      let entityValue = word;
      let j = i + 1;
      
      while (j < words.length && /^[A-ZÀ-Ü]/.test(words[j])) {
        entityValue += " " + words[j];
        j++;
      }
      
      // Determine type based on heuristics
      let type = "MISC";
      
      // Simple heuristics (can be improved with dictionaries)
      if (entityValue.match(/\b(Company|Corp|Inc|Ltd|Group|Bank|Agency)\b/i)) {
        type = "ORG";
      } else if (entityValue.match(/\b(City|Country|Street|Avenue|Road)\b/i)) {
        type = "LOC";
      } else if (entityValue.split(" ").length <= 3 && entityValue.length > 3) {
        type = "PERSON";
      }
      
      entities.push({ type, value: entityValue });
      i = j - 1; // Skip processed words
    }
  }
  
  // 2. Product mentions (e.g., "tour", "package", "service")
  const productKeywords = ["tour", "package", "service", "product", "experience"];
  for (const keyword of productKeywords) {
    const regex = new RegExp(`\\b(${keyword}s?)\\b`, "gi");
    const matches = normalized.match(regex);
    if (matches) {
      matches.forEach(match => {
        entities.push({ type: "PRODUCT", value: match.toLowerCase() });
      });
    }
  }
  
  // 3. Date/time mentions (simple patterns)
  const datePatterns = [
    /\b(today|tomorrow|yesterday)\b/gi,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g
  ];
  
  for (const pattern of datePatterns) {
    const matches = normalized.match(pattern);
    if (matches) {
      matches.forEach(match => {
        entities.push({ type: "DATE", value: match.toLowerCase() });
      });
    }
  }
  
  // Deduplicate
  const seen = new Set<string>();
  return entities.filter(e => {
    const key = `${e.type}:${e.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ========================================
// ENTITY PERSISTENCE
// ========================================

/**
 * Upsert entities and create links between them
 * SECURITY: Full tenant isolation
 */
export async function upsertEntitiesWithLinks(
  tenantId: string,
  entities: Entity[]
): Promise<void> {
  if (entities.length === 0) return;
  
  // Upsert entities (get or create)
  const entityIds = new Map<string, string>();
  
  for (const entity of entities) {
    const existing = await db
      .select()
      .from(aiEntities)
      .where(
        and(
          eq(aiEntities.tenantId, tenantId),
          eq(aiEntities.value, entity.value)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      entityIds.set(entity.value, existing[0].id);
    } else {
      const [inserted] = await db
        .insert(aiEntities)
        .values({
          tenantId,
          type: entity.type,
          value: entity.value
        })
        .returning();
      
      entityIds.set(entity.value, inserted.id);
    }
  }
  
  // Create links between co-occurring entities
  const entityValues = Array.from(entityIds.keys());
  
  for (let i = 0; i < entityValues.length; i++) {
    for (let j = i + 1; j < entityValues.length; j++) {
      const srcId = entityIds.get(entityValues[i])!;
      const dstId = entityIds.get(entityValues[j])!;
      
      // Upsert link (increment weight if exists)
      await db
        .insert(aiEntityLinks)
        .values({
          tenantId,
          srcId,
          dstId,
          weight: 1,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [
            aiEntityLinks.tenantId,
            aiEntityLinks.srcId,
            aiEntityLinks.dstId
          ],
          set: {
            weight: sql`${aiEntityLinks.weight} + 1`,
            updatedAt: new Date()
          }
        });
      
      // Also create reverse link (undirected graph)
      await db
        .insert(aiEntityLinks)
        .values({
          tenantId,
          srcId: dstId,
          dstId: srcId,
          weight: 1,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [
            aiEntityLinks.tenantId,
            aiEntityLinks.srcId,
            aiEntityLinks.dstId
          ],
          set: {
            weight: sql`${aiEntityLinks.weight} + 1`,
            updatedAt: new Date()
          }
        });
    }
  }
}

/**
 * Link chunk to extracted entities (populate ai_chunk_entities junction table)
 * Enables graph-based scoring (δ weight) in hybrid RAG
 * SECURITY: Full tenant isolation
 * 
 * @param tenantId - Tenant ID
 * @param chunkId - Chunk ID
 * @param entities - Extracted entities from chunk text
 */
export async function linkChunkToEntities(
  tenantId: string,
  chunkId: string,
  entities: Entity[]
): Promise<void> {
  if (entities.length === 0) return;

  // First, ensure entities exist (upsert)
  const entityIds = new Map<string, string>();

  for (const entity of entities) {
    const existing = await db
      .select()
      .from(aiEntities)
      .where(
        and(
          eq(aiEntities.tenantId, tenantId),
          eq(aiEntities.value, entity.value)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      entityIds.set(entity.value, existing[0].id);
    } else {
      const [inserted] = await db
        .insert(aiEntities)
        .values({
          tenantId,
          type: entity.type,
          value: entity.value
        })
        .returning();

      entityIds.set(entity.value, inserted.id);
    }
  }

  // Count entity frequency in chunk (simple: count occurrences)
  const entityFreq = new Map<string, number>();
  for (const entity of entities) {
    entityFreq.set(entity.value, (entityFreq.get(entity.value) || 0) + 1);
  }

  // Upsert chunk-entity associations
  for (const [entityValue, freq] of Array.from(entityFreq.entries())) {
    const entityId = entityIds.get(entityValue);
    if (!entityId) continue;

    await db
      .insert(aiChunkEntities)
      .values({
        tenantId,
        chunkId,
        entityId,
        frequency: freq
      })
      .onConflictDoUpdate({
        target: [
          aiChunkEntities.tenantId,
          aiChunkEntities.chunkId,
          aiChunkEntities.entityId
        ],
        set: {
          frequency: freq,
          createdAt: new Date()
        }
      });
  }
}

// ========================================
// PAGERANK-LIKE SCORING
// ========================================

/**
 * Compute PageRank-like scores for given entities
 * Returns map of entity value -> aggregated weight score
 * 
 * Simple approach: sum of link weights for each entity
 * More sophisticated: could implement actual PageRank algorithm
 */
export async function prLikeScore(
  tenantId: string,
  entityValues: string[]
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  
  if (entityValues.length === 0) return scores;
  
  // Get entity IDs for given values
  const entities = await db
    .select()
    .from(aiEntities)
    .where(eq(aiEntities.tenantId, tenantId));
  
  const valueToId = new Map<string, string>();
  for (const e of entities) {
    valueToId.set(e.value, e.id);
  }
  
  // For each query entity, sum up link weights
  for (const value of entityValues) {
    const entityId = valueToId.get(value);
    if (!entityId) {
      scores.set(value, 0);
      continue;
    }
    
    // Get all links where this entity is source
    const links = await db
      .select()
      .from(aiEntityLinks)
      .where(
        and(
          eq(aiEntityLinks.tenantId, tenantId),
          eq(aiEntityLinks.srcId, entityId)
        )
      );
    
    const totalWeight = links.reduce((sum, link) => sum + link.weight, 0);
    scores.set(value, totalWeight);
  }
  
  return scores;
}

/**
 * Get top N entities by total link weight (graph centrality proxy)
 */
export async function getTopEntities(
  tenantId: string,
  limit: number = 50
): Promise<Array<{ id: string; type: string; value: string; score: number }>> {
  // Aggregate link weights per entity
  const query = await db.execute(sql`
    SELECT 
      e.id,
      e.type,
      e.value,
      COALESCE(SUM(l.weight), 0) as score
    FROM ai_entities e
    LEFT JOIN ai_entity_links l ON l.src_id = e.id AND l.tenant_id = e.tenant_id
    WHERE e.tenant_id = ${tenantId}
    GROUP BY e.id, e.type, e.value
    ORDER BY score DESC
    LIMIT ${limit}
  `) as unknown;
  
  return query as any[];
}
