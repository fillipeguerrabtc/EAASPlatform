// shared/schema.ai.eval.ts
// AI Evaluation metrics (daily aggregated + user feedback per chunk)
// SECURITY: Full tenant isolation

import {
  pgTable,
  uuid,
  varchar,
  date,
  real,
  integer,
  timestamp,
  index,
  primaryKey,
  text
} from "drizzle-orm/pg-core";
import { aiChunks } from "./schema.ai.core";

export const aiEvalDaily = pgTable(
  "ai_eval_daily",
  {
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    day: date("day").notNull(),
    ndcgAt5: real("ndcg_at_5").default(0).notNull(), // Normalized Discounted Cumulative Gain @5
    mrr: real("mrr").default(0).notNull(), // Mean Reciprocal Rank
    ctr: real("ctr").default(0).notNull(), // Click-Through Rate
    cr: real("cr").default(0).notNull(), // Conversion Rate
    totalQueries: integer("total_queries").default(0).notNull(),
    totalClicks: integer("total_clicks").default(0).notNull(),
    totalConversions: integer("total_conversions").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.day] }),
    idxDay: index("ai_eval_daily_day_idx").on(t.day)
  })
);

/**
 * ai_feedback: User feedback on AI responses (thumbs up/down, ratings, comments)
 * Enables β (feedback score) weight in hybrid RAG scoring
 * SECURITY: Tenant-isolated, cascading delete on chunk removal
 */
export const aiFeedback = pgTable(
  "ai_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => aiChunks.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 }).notNull(), // User who gave feedback
    rating: real("rating").notNull(), // -1 (thumbs down), 0 (neutral), 1 (thumbs up), or 0-5 star rating
    comment: text("comment"), // Optional text feedback
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (t) => ({
    idxChunk: index("ai_feedback_chunk_idx").on(t.chunkId),
    idxUser: index("ai_feedback_user_idx").on(t.userId),
    idxTenant: index("ai_feedback_tenant_idx").on(t.tenantId)
  })
);
