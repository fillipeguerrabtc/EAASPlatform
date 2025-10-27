// server/modules/marketing/validators.ts
// Zod validators for Marketing Module
// SECURITY: Strong input validation to prevent injection attacks

import { z } from "zod";

// ========================================
// TEMPLATE SCHEMAS
// ========================================

export const templateUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  channel: z.enum(["email", "whatsapp", "facebook", "instagram"]),
  subject: z.string().max(240).optional(),
  bodyHandlebars: z.string().min(1).max(1000000) // 1MB max template size
});

export type TemplateUpsert = z.infer<typeof templateUpsertSchema>;

// ========================================
// CAMPAIGN SCHEMAS
// ========================================

export const campaignUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(160),
  channel: z.enum(["email", "whatsapp", "facebook", "instagram"]),
  templateId: z.string().uuid(),
  segmentId: z.string().uuid().optional(),
  manualAudience: z.array(z.object({
    contactId: z.string().uuid().optional(),
    toAddress: z.string().min(3).max(240)
  })).max(100000).optional(), // max 100k manual recipients
  abVariantBTemplateId: z.string().uuid().optional(),
  abSplitPercent: z.number().int().min(0).max(50).default(0),
  throttlePerMin: z.number().int().min(1).max(5000).default(600),
  maxSends: z.number().int().positive().max(1000000).optional(),
  scheduledAt: z.string().datetime().optional(),
  defaultData: z.record(z.any()).optional()
});

export type CampaignUpsert = z.infer<typeof campaignUpsertSchema>;

export const campaignScheduleSchema = z.object({
  campaignId: z.string().uuid(),
  at: z.string().datetime().optional() // if empty: schedule now
});

export type CampaignSchedule = z.infer<typeof campaignScheduleSchema>;

export const campaignPauseSchema = z.object({
  campaignId: z.string().uuid()
});

export type CampaignPause = z.infer<typeof campaignPauseSchema>;

// ========================================
// CONTACT PREFERENCES SCHEMAS (LGPD/GDPR)
// ========================================

export const contactPreferencesUpdateSchema = z.object({
  contactId: z.string().uuid(),
  emailOptIn: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional(),
  facebookOptIn: z.boolean().optional(),
  instagramOptIn: z.boolean().optional(),
  quietHoursStart: z.number().int().min(0).max(23).optional(),
  quietHoursEnd: z.number().int().min(0).max(23).optional()
});

export type ContactPreferencesUpdate = z.infer<typeof contactPreferencesUpdateSchema>;

// ========================================
// METRICS SCHEMAS
// ========================================

export const metricsQuerySchema = z.object({
  campaignId: z.string().uuid()
});

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
