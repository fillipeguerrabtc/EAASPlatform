// shared/schema.ai.graph.ts
// Knowledge Graph schemas (entities, entity links, chunk-entity associations)
// SECURITY: Full tenant isolation

import {
  pgTable,
  uuid,
  varchar,
  text,
  real,
  timestamp,
  index,
  primaryKey
} from "drizzle-orm/pg-core";
import { aiChunks } from "./schema.ai.core";

export const aiEntities = pgTable(
  "ai_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(), // PERSON|ORG|LOC|PRODUCT|DATE|MISC
    value: varchar("value", { length: 256 }).notNull(),
    pagerank: real("pagerank").default(0).notNull(), // PageRank-like score for graph centrality
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (t) => ({
    idx: index("ai_ent_tenant_val_idx").on(t.tenantId, t.value),
    idxPagerank: index("ai_ent_pagerank_idx").on(t.pagerank)
  })
);

export const aiEntityLinks = pgTable(
  "ai_entity_links",
  {
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    srcId: uuid("src_id")
      .notNull()
      .references(() => aiEntities.id, { onDelete: "cascade" }),
    dstId: uuid("dst_id")
      .notNull()
      .references(() => aiEntities.id, { onDelete: "cascade" }),
    weight: real("weight").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.srcId, t.dstId] })
  })
);

/**
 * ai_chunk_entities: Junction table linking chunks to extracted entities
 * Enables graph-based scoring by tracking which entities appear in which chunks
 * SECURITY: Tenant-isolated, cascading deletes on chunk/entity removal
 */
export const aiChunkEntities = pgTable(
  "ai_chunk_entities",
  {
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => aiChunks.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => aiEntities.id, { onDelete: "cascade" }),
    frequency: real("frequency").default(1).notNull(), // TF (term frequency) in chunk
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.chunkId, t.entityId] }),
    idxChunk: index("ai_chunk_ent_chunk_idx").on(t.chunkId),
    idxEntity: index("ai_chunk_ent_entity_idx").on(t.entityId)
  })
);
