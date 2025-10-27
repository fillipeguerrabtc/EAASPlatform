// shared/schema.ai.graph.ts
// Knowledge Graph schemas (entities, entity links)
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

export const aiEntities = pgTable(
  "ai_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(), // PERSON|ORG|LOC|PRODUCT|DATE|MISC
    value: varchar("value", { length: 256 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (t) => ({
    idx: index("ai_ent_tenant_val_idx").on(t.tenantId, t.value)
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
