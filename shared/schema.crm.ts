// shared/schema.crm.ts - CRM Enterprise Module Schema
// Single-Tenant Architecture - All tables include tenantId
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, pgEnum, index, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ========================================
// ENUMS
// ========================================

export const crmActivityTypeEnum = pgEnum("crm_activity_type", [
  "note",
  "call", 
  "meeting",
  "task",
  "email",
  "whatsapp",
  "facebook",
  "instagram",
  "web"
]);

export const crmDealStageEnum = pgEnum("crm_deal_stage", [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost"
]);

// ========================================
// COMPANIES (B2B Organizations)
// ========================================

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  domain: varchar("domain", { length: 200 }),
  taxId: varchar("tax_id", { length: 64 }),
  phone: varchar("phone", { length: 64 }),
  country: varchar("country", { length: 64 }),
  state: varchar("state", { length: 64 }),
  city: varchar("city", { length: 128 }),
  address: varchar("address", { length: 256 }),
  zip: varchar("zip", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  idxTenant: index("companies_tenant_idx").on(table.tenantId),
  idxDomain: index("companies_domain_idx").on(table.domain),
  idxName: index("companies_name_idx").on(table.name)
}));

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// ========================================
// CONTACTS (Individuals)
// ========================================

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }),
  firstName: varchar("first_name", { length: 120 }).notNull(),
  lastName: varchar("last_name", { length: 120 }),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 64 }),
  tags: text("tags"), // CSV format: "vip,potential,warm"
  source: varchar("source", { length: 64 }), // web, import, whatsapp, facebook, etc.
  isOptIn: boolean("is_opt_in").default(true).notNull(), // LGPD/GDPR consent
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  idxTenant: index("contacts_tenant_idx").on(table.tenantId),
  idxEmail: index("contacts_email_idx").on(table.email),
  idxPhone: index("contacts_phone_idx").on(table.phone),
  idxCompany: index("contacts_company_idx").on(table.companyId)
}));

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// ========================================
// PIPELINES & STAGES
// ========================================

export const pipelines = pgTable("pipelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  idxTenant: index("pipelines_tenant_idx").on(table.tenantId)
}));

export const insertPipelineSchema = createInsertSchema(pipelines).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
export type InsertPipeline = z.infer<typeof insertPipelineSchema>;
export type Pipeline = typeof pipelines.$inferSelect;

export const pipelineStages = pgTable("pipeline_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  pipelineId: varchar("pipeline_id").references(() => pipelines.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  position: integer("position").notNull(), // 1..N
  stageType: crmDealStageEnum("stage_type").default("lead").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  idxTenant: index("pipeline_stages_tenant_idx").on(table.tenantId),
  idxPipeline: index("pipeline_stages_pipeline_idx").on(table.pipelineId)
}));

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;
export type PipelineStage = typeof pipelineStages.$inferSelect;

// ========================================
// DEALS (Sales Opportunities)
// ========================================

export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  pipelineId: varchar("pipeline_id").references(() => pipelines.id, { onDelete: "set null" }),
  stageId: varchar("stage_id").references(() => pipelineStages.id, { onDelete: "set null" }),
  valueCents: integer("value_cents").default(0).notNull(),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  probability: integer("probability").default(0).notNull(), // 0..100
  expectedClose: timestamp("expected_close"),
  lostReason: varchar("lost_reason", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  idxTenant: index("deals_tenant_idx").on(table.tenantId),
  idxStage: index("deals_stage_idx").on(table.stageId),
  idxContact: index("deals_contact_idx").on(table.contactId),
  idxCompany: index("deals_company_idx").on(table.companyId)
}));

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

// ========================================
// ACTIVITIES (Interactions & Tasks)
// ========================================

export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  type: crmActivityTypeEnum("type").notNull(),
  subject: varchar("subject", { length: 200 }),
  content: text("content"),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  dealId: varchar("deal_id").references(() => deals.id, { onDelete: "set null" }),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  idxTenant: index("activities_tenant_idx").on(table.tenantId),
  idxDeal: index("activities_deal_idx").on(table.dealId),
  idxContact: index("activities_contact_idx").on(table.contactId),
  idxDue: index("activities_due_idx").on(table.dueAt)
}));

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

// ========================================
// SEGMENTS (Dynamic Lists)
// ========================================

export const segments = pgTable("segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  entity: varchar("entity", { length: 32 }).notNull(), // "contacts" | "companies" | "deals"
  queryJson: text("query_json").notNull(), // JSON: {rules:[{field,op,value}], logic:"AND"|"OR"}
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  idxTenant: index("segments_tenant_idx").on(table.tenantId),
  idxEntity: index("segments_entity_idx").on(table.entity)
}));

export const insertSegmentSchema = createInsertSchema(segments).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
export type InsertSegment = z.infer<typeof insertSegmentSchema>;
export type Segment = typeof segments.$inferSelect;

// ========================================
// IMPORTS (CSV/Excel Imports History)
// ========================================

export const imports = pgTable("imports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  entity: varchar("entity", { length: 32 }).notNull(), // "contacts" | "companies"
  filename: varchar("filename", { length: 256 }).notNull(),
  totalRows: integer("total_rows").default(0).notNull(),
  processedRows: integer("processed_rows").default(0).notNull(),
  status: varchar("status", { length: 32 }).default("pending").notNull(), // pending|processing|done|failed
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  idxTenant: index("imports_tenant_idx").on(table.tenantId),
  idxStatus: index("imports_status_idx").on(table.status)
}));

export const insertImportSchema = createInsertSchema(imports).omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true
});
export type InsertImport = z.infer<typeof insertImportSchema>;
export type Import = typeof imports.$inferSelect;

// ========================================
// AUDIT LOG (Change History)
// ========================================

export const crmAudit = pgTable("crm_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  entity: varchar("entity", { length: 32 }).notNull(), // "contact" | "company" | "deal" | "activity"
  entityId: varchar("entity_id").notNull(),
  action: varchar("action", { length: 32 }).notNull(), // "create" | "update" | "delete" | "import" | "message"
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  context: text("context"), // JSON: {userId, source, ip, webhookId, etc}
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  idxTenant: index("crm_audit_tenant_idx").on(table.tenantId),
  idxEntity: index("crm_audit_entity_idx").on(table.entity, table.entityId),
  idxAction: index("crm_audit_action_idx").on(table.action)
}));

export type CrmAudit = typeof crmAudit.$inferSelect;

// ========================================
// CONTACT TAGS (Normalized Pivot Table)
// ========================================

export const contactTags = pgTable("contact_tags", {
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "cascade" }).notNull(),
  tag: varchar("tag", { length: 64 }).notNull(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.contactId, table.tag] }),
  idxTenant: index("contact_tags_tenant_idx").on(table.tenantId)
}));

export type ContactTag = typeof contactTags.$inferSelect;
