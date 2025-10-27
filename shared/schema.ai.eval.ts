// shared/schema.ai.eval.ts
// AI Evaluation metrics (daily aggregated metrics for nDCG, MRR, CTR, CR)
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
  primaryKey
} from "drizzle-orm/pg-core";

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
