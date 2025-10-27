// shared/schema.ai.core.ts
// AI Multimodal 2.0 - Core schemas (documents, chunks, embeddings, ANN meta, policies, interactions)
// SECURITY: Full tenant isolation, indexes for performance

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  real,
  index
} from "drizzle-orm/pg-core";

/** Documents and chunks (canonical content for RAG) */
export const aiDocuments = pgTable(
  "ai_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    source: varchar("source", { length: 64 }).notNull(), // "url"|"file"|"crm"|"erp"|"brand-scanner"|"manual"|"image"
    uri: text("uri"), // URL, path, external id
    title: text("title"),
    metaJson: text("meta_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (t) => ({
    idxTenant: index("ai_documents_tenant_idx").on(t.tenantId),
    idxUri: index("ai_documents_uri_idx").on(t.uri)
  })
);

export const aiChunks = pgTable(
  "ai_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => aiDocuments.id, { onDelete: "cascade" }),
    modality: varchar("modality", { length: 16 }).notNull(), // "text" | "image"
    pos: integer("pos").notNull(), // order in document
    text: text("text"), // for "text" (optionally image caption)
    imageUri: text("image_uri"), // for "image"
    tokens: integer("tokens").default(0).notNull(),
    metaJson: text("meta_json"),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (t) => ({
    idxDoc: index("ai_chunks_doc_idx").on(t.documentId),
    idxTenant: index("ai_chunks_tenant_idx").on(t.tenantId),
    idxModality: index("ai_chunks_modality_idx").on(t.tenantId, t.modality)
  })
);

/** Embeddings by modality */
export const aiEmbeddingsText = pgTable(
  "ai_embeddings_text",
  {
    chunkId: uuid("chunk_id")
      .primaryKey()
      .notNull()
      .references(() => aiChunks.id, { onDelete: "cascade" }),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    vectorJson: text("vector_json").notNull(),
    dim: integer("dim").notNull(),
    model: varchar("model", { length: 64 }).notNull(), // e.g. "minilm-384-onnx"
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (t) => ({
    idxTenant: index("ai_emb_text_tenant_idx").on(t.tenantId),
    idxModel: index("ai_emb_text_model_idx").on(t.model)
  })
);

export const aiEmbeddingsImage = pgTable(
  "ai_embeddings_image",
  {
    chunkId: uuid("chunk_id")
      .primaryKey()
      .notNull()
      .references(() => aiChunks.id, { onDelete: "cascade" }),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    vectorJson: text("vector_json").notNull(),
    dim: integer("dim").notNull(),
    model: varchar("model", { length: 64 }).notNull(), // e.g. "mobilenet-onnx"
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (t) => ({
    idxTenant: index("ai_emb_img_tenant_idx").on(t.tenantId),
    idxModel: index("ai_emb_img_model_idx").on(t.model)
  })
);

/** ANN index metadata (audit/checkpoints) */
export const aiAnnMeta = pgTable("ai_ann_meta", {
  tenantId: varchar("tenant_id", { length: 64 }).primaryKey(),
  textDim: integer("text_dim").default(0).notNull(),
  imageDim: integer("image_dim").default(0).notNull(),
  sizeText: integer("size_text").default(0).notNull(),
  sizeImage: integer("size_image").default(0).notNull(),
  lastCheckpointAt: timestamp("last_checkpoint_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

/** Policies and Interactions (will be used later) */
export const aiPolicies = pgTable(
  "ai_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(), // "retrieval_weights_v2" | "persuasion_bandit" | ...
    dataJson: text("data_json").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (t) => ({
    idxTenant: index("ai_policies_tenant_idx").on(t.tenantId),
    idxName: index("ai_policies_name_idx").on(t.name)
  })
);

export const aiInteractions = pgTable(
  "ai_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    conversationId: uuid("conversation_id"),
    userId: varchar("user_id", { length: 64 }),
    policyId: uuid("policy_id").references(() => aiPolicies.id, {
      onDelete: "set null"
    }),
    input: text("input").notNull(),
    output: text("output").notNull(),
    featuresJson: text("features_json"),
    reward: real("reward").default(0).notNull(),
    eventJson: text("event_json"),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (t) => ({
    idxTenant: index("ai_interactions_tenant_idx").on(t.tenantId),
    idxConv: index("ai_interactions_conv_idx").on(t.conversationId)
  })
);
