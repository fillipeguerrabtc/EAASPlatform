// shared/schema.marketing.ts
// Marketing Module - Templates, Campaigns, Sends, Events, LGPD Preferences
// SECURITY: Full tenant isolation, foreign keys CASCADE, composite PK for preferences

import {
  pgTable, varchar, text, integer, boolean, timestamp, index, pgEnum, primaryKey, uuid
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ========================================
// ENUMS
// ========================================

export const mkChannelEnum = pgEnum("mk_channel", [
  "email",
  "whatsapp",
  "facebook",
  "instagram"
]);

export const mkStatusEnum = pgEnum("mk_status", [
  "draft",
  "scheduled",
  "running",
  "paused",
  "finished",
  "failed"
]);

// ========================================
// TEMPLATES - Email/WhatsApp/Social Media Templates
// ========================================

export const mkTemplates = pgTable("mk_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  channel: mkChannelEnum("channel").notNull(),
  subject: varchar("subject", { length: 240 }), // for email
  bodyHandlebars: text("body_hbs").notNull(), // Handlebars template body
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => ({
  idxTenant: index("mk_tpl_tenant_idx").on(t.tenantId),
  idxChannel: index("mk_tpl_chan_idx").on(t.channel),
}));

// ========================================
// CAMPAIGNS - Marketing Campaigns with A/B Testing
// ========================================

export const mkCampaigns = pgTable("mk_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  channel: mkChannelEnum("channel").notNull(),
  
  // Template reference
  templateId: varchar("template_id").notNull()
    .references(() => mkTemplates.id, { onDelete: "cascade" }),
  
  // Segmentation (uses CRM segments engine)
  segmentId: varchar("segment_id"), // references CRM segments
  manualAudienceJson: text("manual_audience_json"), // fallback: [{contactId, email/phone}]
  
  // A/B Testing
  abVariantBTemplateId: varchar("ab_b_tpl_id")
    .references(() => mkTemplates.id, { onDelete: "set null" }),
  abSplitPercent: integer("ab_split_percent").default(0).notNull(), // 0-50 (% goes to B)
  
  // Throttling and limits
  throttlePerMin: integer("throttle_per_min").default(600).notNull(),
  maxSends: integer("max_sends"),
  
  // Scheduling
  status: mkStatusEnum("status").default("draft").notNull(),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  
  // Dynamic content (default Handlebars data)
  defaultDataJson: text("default_data_json"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => ({
  idxTenant: index("mk_cpg_tenant_idx").on(t.tenantId),
  idxStatus: index("mk_cpg_status_idx").on(t.status),
  idxScheduled: index("mk_cpg_sched_idx").on(t.scheduledAt),
}));

// ========================================
// SENDS - Individual Send Records (tracking)
// ========================================

export const mkSends = pgTable("mk_sends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  
  // Campaign and template references
  campaignId: varchar("campaign_id").notNull()
    .references(() => mkCampaigns.id, { onDelete: "cascade" }),
  templateId: varchar("template_id").notNull()
    .references(() => mkTemplates.id, { onDelete: "cascade" }),
  
  // Recipient
  contactId: varchar("contact_id"), // references CRM contacts
  toAddress: varchar("to_address", { length: 240 }), // email or phone
  channel: mkChannelEnum("channel").notNull(),
  
  // A/B variant
  abVariant: varchar("ab_variant", { length: 1 }).default("A").notNull(), // "A" or "B"
  
  // Provider response
  providerMessageId: varchar("provider_msg_id", { length: 240 }),
  
  // Send state
  sentAt: timestamp("sent_at"),
  error: text("error"),
  
  // Tracking ID (crypto-secure random)
  trackingId: varchar("tracking_id", { length: 64 }).unique(), // for pixel/click tracking
  
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (t) => ({
  idxTenant: index("mk_sends_tenant_idx").on(t.tenantId),
  idxCampaign: index("mk_sends_cpg_idx").on(t.campaignId),
  idxTracking: index("mk_sends_track_idx").on(t.trackingId),
}));

// ========================================
// EVENTS - Tracking Events (opened, clicked, etc.)
// ========================================

export const mkEvents = pgTable("mk_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  
  // Send reference
  sendId: varchar("send_id").notNull()
    .references(() => mkSends.id, { onDelete: "cascade" }),
  
  // Event type: delivered|opened|clicked|replied|bounced|failed
  type: varchar("type", { length: 24 }).notNull(),
  
  // Metadata (JSON)
  meta: text("meta"),
  
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (t) => ({
  idxTenant: index("mk_evt_tenant_idx").on(t.tenantId),
  idxSend: index("mk_evt_send_idx").on(t.sendId),
  idxType: index("mk_evt_type_idx").on(t.type),
}));

// ========================================
// CONTACT PREFERENCES - LGPD/GDPR Opt-in and Quiet Hours
// ========================================

export const contactPreferences = pgTable("contact_preferences", {
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  contactId: varchar("contact_id").notNull(), // references CRM contacts
  
  // Opt-in per channel
  emailOptIn: boolean("email_optin").default(true).notNull(),
  whatsappOptIn: boolean("whatsapp_optin").default(true).notNull(),
  facebookOptIn: boolean("facebook_optin").default(false).notNull(),
  instagramOptIn: boolean("instagram_optin").default(false).notNull(),
  
  // Quiet hours (24h format)
  quietHoursStart: integer("quiet_start").default(22), // 22h (10 PM)
  quietHoursEnd: integer("quiet_end").default(8),      // 08h (8 AM)
  
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (t) => ({
  pk: primaryKey({ columns: [t.tenantId, t.contactId] }),
  idx: index("contact_prefs_idx").on(t.tenantId, t.contactId)
}));
