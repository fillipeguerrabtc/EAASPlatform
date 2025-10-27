// server/modules/marketing/service.ts
// Marketing Service - Templates, Campaigns, Sends, Events
// SECURITY: Full tenant isolation, Redis graceful degradation, Drizzle ORM only

import { db } from "../../db";
import {
  mkTemplates,
  mkCampaigns,
  mkSends,
  mkEvents,
  contactPreferences
} from "@shared/schema.marketing";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  templateUpsertSchema,
  campaignUpsertSchema,
  campaignScheduleSchema,
  type TemplateUpsert,
  type CampaignUpsert,
  type CampaignSchedule
} from "./validators";
import { SegmentsEngine } from "../crm/segments";
import {
  sendEmail,
  sendWhatsapp,
  sendFacebook,
  sendInstagram,
  renderTemplate,
  generateTrackingId,
  stripHtmlToText,
  rewriteLinksWithTracking,
  addTrackingPixel,
  type SendResult
} from "./providers";
// ========================================
// TYPES
// ========================================

type Ctx = {
  tenantId: string;
  role: string;
  userId: string;
};

type AudienceMember = {
  contactId?: string;
  toAddress: string;
};

// ========================================
// MARKETING SERVICE
// ========================================

export const MarketingService = {
  // ========================================
  // TEMPLATES
  // ========================================

  /**
   * Create or update marketing template
   * SECURITY: Tenant isolation enforced
   */
  async upsertTemplate(ctx: Ctx, input: unknown) {
    const data = templateUpsertSchema.parse(input);

    if (data.id) {
      // UPDATE
      const [updated] = await db
        .update(mkTemplates)
        .set({
          name: data.name,
          channel: data.channel,
          subject: data.subject,
          bodyHandlebars: data.bodyHandlebars,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(mkTemplates.id, data.id),
            eq(mkTemplates.tenantId, ctx.tenantId)
          )
        )
        .returning();

      return { id: data.id, updated: !!updated };
    }

    // INSERT
    const [created] = await db
      .insert(mkTemplates)
      .values({
        tenantId: ctx.tenantId,
        name: data.name,
        channel: data.channel,
        subject: data.subject,
        bodyHandlebars: data.bodyHandlebars
      })
      .returning();

    return { id: created.id, created: true };
  },

  /**
   * List all templates for tenant
   * SECURITY: Tenant isolation enforced
   */
  async listTemplates(ctx: Ctx, filters?: { channel?: string }) {
    const conditions = [eq(mkTemplates.tenantId, ctx.tenantId)];

    if (filters?.channel) {
      conditions.push(eq(mkTemplates.channel, filters.channel as any));
    }

    const rows = await db
      .select()
      .from(mkTemplates)
      .where(and(...conditions))
      .orderBy(desc(mkTemplates.createdAt));

    return { rows };
  },

  /**
   * Get single template
   * SECURITY: Tenant isolation enforced
   */
  async getTemplate(ctx: Ctx, templateId: string) {
    const [template] = await db
      .select()
      .from(mkTemplates)
      .where(
        and(
          eq(mkTemplates.id, templateId),
          eq(mkTemplates.tenantId, ctx.tenantId)
        )
      )
      .limit(1);

    return template || null;
  },

  /**
   * Delete template
   * SECURITY: Tenant isolation enforced, CASCADE handles dependencies
   */
  async deleteTemplate(ctx: Ctx, templateId: string) {
    const [deleted] = await db
      .delete(mkTemplates)
      .where(
        and(
          eq(mkTemplates.id, templateId),
          eq(mkTemplates.tenantId, ctx.tenantId)
        )
      )
      .returning();

    return { deleted: !!deleted };
  },

  // ========================================
  // CAMPAIGNS
  // ========================================

  /**
   * Create or update campaign
   * SECURITY: Tenant isolation enforced
   */
  async upsertCampaign(ctx: Ctx, input: unknown) {
    const data = campaignUpsertSchema.parse(input);

    const payload = {
      name: data.name,
      channel: data.channel,
      templateId: data.templateId,
      segmentId: data.segmentId || null,
      manualAudienceJson: data.manualAudience
        ? JSON.stringify(data.manualAudience)
        : null,
      abVariantBTemplateId: data.abVariantBTemplateId || null,
      abSplitPercent: data.abSplitPercent ?? 0,
      throttlePerMin: data.throttlePerMin ?? 600,
      maxSends: data.maxSends || null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      defaultDataJson: data.defaultData ? JSON.stringify(data.defaultData) : null,
      status: "draft" as const,
      updatedAt: new Date()
    };

    if (data.id) {
      // UPDATE
      const [updated] = await db
        .update(mkCampaigns)
        .set(payload)
        .where(
          and(
            eq(mkCampaigns.id, data.id),
            eq(mkCampaigns.tenantId, ctx.tenantId)
          )
        )
        .returning();

      return { id: data.id, updated: !!updated };
    }

    // INSERT
    const [created] = await db
      .insert(mkCampaigns)
      .values({
        tenantId: ctx.tenantId,
        ...payload
      })
      .returning();

    return { id: created.id, created: true };
  },

  /**
   * List campaigns for tenant
   * SECURITY: Tenant isolation enforced
   */
  async listCampaigns(ctx: Ctx, filters?: { status?: string }) {
    const conditions = [eq(mkCampaigns.tenantId, ctx.tenantId)];

    if (filters?.status) {
      conditions.push(eq(mkCampaigns.status, filters.status as any));
    }

    const rows = await db
      .select()
      .from(mkCampaigns)
      .where(and(...conditions))
      .orderBy(desc(mkCampaigns.createdAt));

    return { rows };
  },

  /**
   * Get single campaign
   * SECURITY: Tenant isolation enforced
   */
  async getCampaign(ctx: Ctx, campaignId: string) {
    const [campaign] = await db
      .select()
      .from(mkCampaigns)
      .where(
        and(
          eq(mkCampaigns.id, campaignId),
          eq(mkCampaigns.tenantId, ctx.tenantId)
        )
      )
      .limit(1);

    return campaign || null;
  },

  /**
   * Schedule campaign execution
   * SECURITY: Tenant isolation enforced, requires Redis
   * GRACEFUL DEGRADATION: Returns disabled flag if Redis unavailable
   */
  async scheduleCampaign(ctx: Ctx, input: unknown) {
    if (!QUEUE_ENABLED || !CampaignQueue) {
      return { 
        scheduled: false, 
        disabled: true,
        error: "Campaign scheduling unavailable - Redis not configured. Please configure Redis to enable asynchronous campaign execution."
      };
    }

    const data = campaignScheduleSchema.parse(input);
    const when = data.at ? new Date(data.at) : new Date();

    // SECURITY: Tenant filter in UPDATE
    await db
      .update(mkCampaigns)
      .set({
        status: "scheduled",
        scheduledAt: when,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(mkCampaigns.id, data.campaignId),
          eq(mkCampaigns.tenantId, ctx.tenantId)
        )
      );

    // Add to queue with delay
    const delay = Math.max(0, when.getTime() - Date.now());
    await CampaignQueue.add(
      "run-campaign",
      { tenantId: ctx.tenantId, campaignId: data.campaignId },
      { delay }
    );

    return { scheduled: true, at: when.toISOString(), disabled: false };
  },

  /**
   * Pause running campaign
   * SECURITY: Tenant isolation enforced
   */
  async pauseCampaign(ctx: Ctx, campaignId: string) {
    const [updated] = await db
      .update(mkCampaigns)
      .set({
        status: "paused",
        updatedAt: new Date()
      })
      .where(
        and(
          eq(mkCampaigns.id, campaignId),
          eq(mkCampaigns.tenantId, ctx.tenantId),
          eq(mkCampaigns.status, "running")
        )
      )
      .returning();

    return { paused: !!updated };
  },

  // ========================================
  // CONTACT PREFERENCES (LGPD/GDPR)
  // ========================================

  /**
   * Update contact marketing preferences
   * SECURITY: Tenant isolation, Drizzle ORM (no raw SQL)
   */
  async updateContactPreferences(
    ctx: Ctx,
    contactId: string,
    prefs: {
      emailOptIn?: boolean;
      whatsappOptIn?: boolean;
      facebookOptIn?: boolean;
      instagramOptIn?: boolean;
      quietHoursStart?: number;
      quietHoursEnd?: number;
    }
  ) {
    // Upsert using Drizzle ORM
    const existing = await db
      .select()
      .from(contactPreferences)
      .where(
        and(
          eq(contactPreferences.tenantId, ctx.tenantId),
          eq(contactPreferences.contactId, contactId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // UPDATE
      await db
        .update(contactPreferences)
        .set({
          ...prefs,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(contactPreferences.tenantId, ctx.tenantId),
            eq(contactPreferences.contactId, contactId)
          )
        );
    } else {
      // INSERT
      await db.insert(contactPreferences).values({
        tenantId: ctx.tenantId,
        contactId,
        emailOptIn: prefs.emailOptIn ?? true,
        whatsappOptIn: prefs.whatsappOptIn ?? true,
        facebookOptIn: prefs.facebookOptIn ?? false,
        instagramOptIn: prefs.instagramOptIn ?? false,
        quietHoursStart: prefs.quietHoursStart ?? 22,
        quietHoursEnd: prefs.quietHoursEnd ?? 8
      });
    }

    return { updated: true };
  },

  /**
   * Get contact preferences
   * SECURITY: Tenant isolation enforced
   */
  async getContactPreferences(ctx: Ctx, contactId: string) {
    const [prefs] = await db
      .select()
      .from(contactPreferences)
      .where(
        and(
          eq(contactPreferences.tenantId, ctx.tenantId),
          eq(contactPreferences.contactId, contactId)
        )
      )
      .limit(1);

    return prefs || null;
  },

  // ========================================
  // METRICS & REPORTING
  // ========================================

  /**
   * Get campaign metrics (sends + events)
   * SECURITY: Tenant isolation enforced
   */
  async getCampaignMetrics(ctx: Ctx, campaignId: string) {
    // Get all sends for campaign
    const sends = await db
      .select()
      .from(mkSends)
      .where(
        and(
          eq(mkSends.tenantId, ctx.tenantId),
          eq(mkSends.campaignId, campaignId)
        )
      )
      .orderBy(desc(mkSends.createdAt));

    // Get all events for these sends
    const sendIds = sends.map((s) => s.id);
    const events =
      sendIds.length > 0
        ? await db
            .select()
            .from(mkEvents)
            .where(
              and(
                eq(mkEvents.tenantId, ctx.tenantId),
                sql`${mkEvents.sendId} = ANY(${sendIds})`
              )
            )
            .orderBy(desc(mkEvents.createdAt))
        : [];

    // Calculate metrics
    const totalSent = sends.filter((s) => s.sentAt).length;
    const totalFailed = sends.filter((s) => s.error).length;
    const totalOpened = new Set(
      events.filter((e) => e.type === "opened").map((e) => e.sendId)
    ).size;
    const totalClicked = new Set(
      events.filter((e) => e.type === "clicked").map((e) => e.sendId)
    ).size;

    return {
      campaignId,
      totalSent,
      totalFailed,
      totalOpened,
      totalClicked,
      openRate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
      clickRate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      sends,
      events
    };
  }
};

// ========================================
// CAMPAIGN WORKER (BullMQ)
// ========================================

type RunCampaignJob = {
  tenantId: string;
  campaignId: string;
};

// Helper: Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: Check opt-in and quiet hours
async function checkCanSend(
  tenantId: string,
  contactId: string | undefined,
  channel: string,
  nowHour: number
): Promise<boolean> {
  if (!contactId) return true; // No preferences for anonymous

  const [prefs] = await db
    .select()
    .from(contactPreferences)
    .where(
      and(
        eq(contactPreferences.tenantId, tenantId),
        eq(contactPreferences.contactId, contactId)
      )
    )
    .limit(1);

  if (!prefs) return true; // No preferences = opt-in by default

  // Check opt-in per channel
  if (channel === "email" && !prefs.emailOptIn) return false;
  if (channel === "whatsapp" && !prefs.whatsappOptIn) return false;
  if (channel === "facebook" && !prefs.facebookOptIn) return false;
  if (channel === "instagram" && !prefs.instagramOptIn) return false;

  // Check quiet hours
  const start = prefs.quietHoursStart ?? 22;
  const end = prefs.quietHoursEnd ?? 8;
  const isQuiet =
    start < end
      ? nowHour >= start && nowHour < end
      : nowHour >= start || nowHour < end;

  if (isQuiet) return false; // Skip during quiet hours

  return true;
}

/**
 * Campaign Worker - Executes campaign sends with throttling and A/B testing
 * SECURITY: Full tenant isolation, error handling, opt-in/quiet hours check
 * GRACEFUL DEGRADATION: Only created if Redis is available
 */
createWorker = () => {
  if (!connection || !QUEUE_ENABLED) {
    console.warn("⚠️  Marketing: Worker creation skipped - Redis unavailable");
    return;
  }

  CampaignWorker = new Worker<RunCampaignJob>(
    "marketing-campaigns",
    async (job: Job<RunCampaignJob>) => {
      const { tenantId, campaignId } = job.data;

      try {
        // Mark campaign as running
        await db
          .update(mkCampaigns)
          .set({
            status: "running",
            startedAt: new Date(),
            updatedAt: new Date()
          })
          .where(
            and(
              eq(mkCampaigns.id, campaignId),
              eq(mkCampaigns.tenantId, tenantId)
            )
          );

        // Load campaign + templates
        const [campaign] = await db
          .select()
          .from(mkCampaigns)
          .where(
            and(
              eq(mkCampaigns.id, campaignId),
              eq(mkCampaigns.tenantId, tenantId)
            )
          )
          .limit(1);

        if (!campaign) {
          console.error(`❌ Campaign ${campaignId} not found`);
          return;
        }

        const [templateA] = await db
          .select()
          .from(mkTemplates)
          .where(
            and(
              eq(mkTemplates.id, campaign.templateId),
              eq(mkTemplates.tenantId, tenantId)
            )
          )
          .limit(1);

        if (!templateA) {
          console.error(`❌ Template ${campaign.templateId} not found`);
          await db
            .update(mkCampaigns)
            .set({ status: "failed", finishedAt: new Date() })
            .where(eq(mkCampaigns.id, campaignId));
          return;
        }

        let templateB: typeof templateA | null = null;
        if (campaign.abVariantBTemplateId) {
          const result = await db
            .select()
            .from(mkTemplates)
            .where(
              and(
                eq(mkTemplates.id, campaign.abVariantBTemplateId),
                eq(mkTemplates.tenantId, tenantId)
              )
            )
            .limit(1);
          
          templateB = result[0] || null;
        }

        // Resolve audience
        let audience: AudienceMember[] = [];

        if (campaign.segmentId) {
          // Use CRM segments engine
          const result = await SegmentsEngine.runSegment(
            tenantId,
            campaign.segmentId,
            { page: 1, pageSize: 100000 }
          );

          if (campaign.channel === "email" && result.entity === "contacts") {
            audience = (result.rows as any[])
              .filter((r) => r.email)
              .map((r) => ({ contactId: r.id, toAddress: r.email }));
          } else if (campaign.channel === "whatsapp" && result.entity === "contacts") {
            audience = (result.rows as any[])
              .filter((r) => r.phone)
              .map((r) => ({ contactId: r.id, toAddress: r.phone }));
          } else {
            // Fallback
            audience = (result.rows as any[]).map((r: any) => ({
              contactId: r.id,
              toAddress: r.email || r.phone || String(r.id)
            }));
          }
        } else if (campaign.manualAudienceJson) {
          audience = JSON.parse(campaign.manualAudienceJson);
        }

        // Apply maxSends limit
        if (campaign.maxSends && audience.length > campaign.maxSends) {
          audience = audience.slice(0, campaign.maxSends);
        }

        // A/B split
        const splitPercent = campaign.abSplitPercent || 0;
        const splitCount = Math.floor((audience.length * splitPercent) / 100);
        const audienceB = splitCount > 0 ? audience.slice(0, splitCount) : [];
        const audienceA = splitCount > 0 ? audience.slice(splitCount) : audience;

        const defaultData = campaign.defaultDataJson
          ? JSON.parse(campaign.defaultDataJson)
          : {};

        // Throttling
        const perMin = Math.max(1, campaign.throttlePerMin || 600);
        const delayMs = Math.floor(60000 / perMin);

        // Helper: Send one message
        const sendOne = async (
          to: string,
          variant: "A" | "B",
          contactId?: string
        ): Promise<void> => {
          const nowHour = new Date().getHours();

          // LGPD/Quiet hours check
          const canSend = await checkCanSend(
            tenantId,
            contactId,
            campaign.channel,
            nowHour
          );

          if (!canSend) {
            console.log(
              `⏭️  Skipping ${to} - opt-out or quiet hours (${campaign.channel})`
            );
            return;
          }

          try {
            const template = variant === "B" && templateB ? templateB : templateA;
            const trackingId = generateTrackingId();

            const rendered = renderTemplate({
              subject: template.subject || "",
              bodyHandlebars: template.bodyHandlebars,
              data: { ...defaultData, contactId, to }
            });

            let html = rendered.body;
            let result: SendResult;

            // Send based on channel
            if (campaign.channel === "email") {
              // Add tracking
              html = rewriteLinksWithTracking(html, trackingId);
              html = addTrackingPixel(html, trackingId);

              // Create send record BEFORE sending
              const [sendRecord] = await db
                .insert(mkSends)
                .values({
                  tenantId,
                  campaignId: campaign.id,
                  contactId: contactId || null,
                  toAddress: to,
                  channel: "email",
                  templateId: template.id,
                  abVariant: variant,
                  trackingId
                })
                .returning();

              // Send email
              result = await sendEmail(to, rendered.subject || "", html);

              // Update send record
              if (result.success) {
                await db
                  .update(mkSends)
                  .set({
                    providerMessageId: result.providerMessageId,
                    sentAt: new Date()
                  })
                  .where(eq(mkSends.id, sendRecord.id));

                // Log delivered event
                await db.insert(mkEvents).values({
                  tenantId,
                  sendId: sendRecord.id,
                  type: "delivered",
                  meta: JSON.stringify({ providerMessageId: result.providerMessageId })
                });
              } else {
                await db
                  .update(mkSends)
                  .set({ error: result.error })
                  .where(eq(mkSends.id, sendRecord.id));
              }
            } else if (campaign.channel === "whatsapp") {
              const text = stripHtmlToText(html);

              const [sendRecord] = await db
                .insert(mkSends)
                .values({
                  tenantId,
                  campaignId: campaign.id,
                  contactId: contactId || null,
                  toAddress: to,
                  channel: "whatsapp",
                  templateId: template.id,
                  abVariant: variant
                })
                .returning();

              result = await sendWhatsapp(to, text);

              if (result.success) {
                await db
                  .update(mkSends)
                  .set({
                    providerMessageId: result.providerMessageId,
                    sentAt: new Date()
                  })
                  .where(eq(mkSends.id, sendRecord.id));

                await db.insert(mkEvents).values({
                  tenantId,
                  sendId: sendRecord.id,
                  type: "delivered",
                  meta: JSON.stringify(result)
                });
              } else {
                await db
                  .update(mkSends)
                  .set({ error: result.error })
                  .where(eq(mkSends.id, sendRecord.id));
              }
            } else if (campaign.channel === "facebook") {
              const text = stripHtmlToText(html);

              const [sendRecord] = await db
                .insert(mkSends)
                .values({
                  tenantId,
                  campaignId: campaign.id,
                  contactId: contactId || null,
                  toAddress: to,
                  channel: "facebook",
                  templateId: template.id,
                  abVariant: variant
                })
                .returning();

              result = await sendFacebook(to, text);

              if (result.success) {
                await db
                  .update(mkSends)
                  .set({
                    providerMessageId: result.providerMessageId,
                    sentAt: new Date()
                  })
                  .where(eq(mkSends.id, sendRecord.id));
              } else {
                await db
                  .update(mkSends)
                  .set({ error: result.error })
                  .where(eq(mkSends.id, sendRecord.id));
              }
            } else if (campaign.channel === "instagram") {
              const text = stripHtmlToText(html);

              const [sendRecord] = await db
                .insert(mkSends)
                .values({
                  tenantId,
                  campaignId: campaign.id,
                  contactId: contactId || null,
                  toAddress: to,
                  channel: "instagram",
                  templateId: template.id,
                  abVariant: variant
                })
                .returning();

              result = await sendInstagram(to, text);

              if (result.success) {
                await db
                  .update(mkSends)
                  .set({
                    providerMessageId: result.providerMessageId,
                    sentAt: new Date()
                  })
                  .where(eq(mkSends.id, sendRecord.id));
              } else {
                await db
                  .update(mkSends)
                  .set({ error: result.error })
                  .where(eq(mkSends.id, sendRecord.id));
              }
            }
          } catch (error: any) {
            console.error(`❌ Error sending to ${to}:`, error.message);
            // Continue with next recipient
          }
        }

        // Execute sends with throttling
        console.log(
          `📧 Starting campaign ${campaignId}: ${audience.length} recipients`
        );

        for (const aud of audienceA) {
          await sendOne(aud.toAddress, "A", aud.contactId);
          await sleep(delayMs);
        }

        for (const aud of audienceB) {
          await sendOne(aud.toAddress, "B", aud.contactId);
          await sleep(delayMs);
        }

        // Mark campaign as finished
        await db
          .update(mkCampaigns)
          .set({
            status: "finished",
            finishedAt: new Date(),
            updatedAt: new Date()
          })
          .where(
            and(
              eq(mkCampaigns.id, campaignId),
              eq(mkCampaigns.tenantId, tenantId)
            )
          );

        console.log(`✅ Campaign ${campaignId} finished`);
      } catch (error: any) {
        console.error(`❌ Campaign ${campaignId} failed:`, error.message);

        // Mark as failed
        await db
          .update(mkCampaigns)
          .set({
            status: "failed",
            finishedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(mkCampaigns.id, campaignId));
      }
    },
    { connection }
  );

  console.log("✅ Marketing: Campaign Worker initialized");
};

// ========================================
// EXPORTS
// ========================================

export { CampaignQueue, CampaignWorker };
