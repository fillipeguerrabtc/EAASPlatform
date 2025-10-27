/**
 * Job Queue Handlers
 * Handlers for different job types (CRM imports, Marketing campaigns, etc.)
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse";
import { db } from "../db";
import { imports } from "@shared/schema.crm";
import { CRMService } from "../modules/crm/service";
import { logAudit } from "../modules/crm/audit";
import { eq } from "drizzle-orm";
import { Job } from "@shared/schema";
import pino from "pino";

const logger = pino();

// ========================================
// CRM CSV IMPORT HANDLER
// ========================================

export type CRMImportPayload = {
  tenantId: string;
  entity: "contacts" | "companies";
  filePath: string;
  mapping?: Record<string, string>; // CSV column -> field name
  userId?: string;
};

export async function handleCRMImport(
  payload: CRMImportPayload,
  job: Job
): Promise<{ processed: number; total: number; errors: string[] }> {
  const { tenantId, entity, filePath, mapping = {}, userId = "system" } = payload;

  // Create import record
  const [imp] = await db
    .insert(imports)
    .values({
      tenantId,
      entity,
      filename: path.basename(filePath),
      status: "processing",
      totalRows: 0,
      processedRows: 0,
    })
    .returning();

  let processed = 0;
  let total = 0;
  const errors: string[] = [];

  try {
    const stream = fs.createReadStream(filePath);
    const parser = stream.pipe(
      parse({ columns: true, skip_empty_lines: true, bom: true })
    );

    for await (const record of parser) {
      total++;
      const payload: any = {};

      // WHITELIST validation - only allow safe fields
      const allowedFields = new Set([
        "firstName",
        "lastName",
        "email",
        "phone",
        "companyName",
        "title",
        "source",
        "tags",
      ]);

      for (const [csvCol, value] of Object.entries(record)) {
        const mappedField = mapping[csvCol] || csvCol;

        // Only allow whitelisted fields
        if (allowedFields.has(mappedField)) {
          payload[mappedField] = value;
        }
      }

      try {
        if (entity === "contacts") {
          await CRMService.upsertContact(
            { tenantId, role: "admin", userId },
            payload
          );
        } else if (entity === "companies") {
          await CRMService.upsertCompany(
            { tenantId, role: "admin", userId },
            payload
          );
        }
        processed++;
      } catch (err: any) {
        errors.push(`Row ${total}: ${err.message}`);
        logger.warn({ row: total, error: err.message }, "Import row failed");
      }

      // Update progress every 100 rows
      if (total % 100 === 0) {
        await db
          .update(imports)
          .set({ totalRows: total, processedRows: processed })
          .where(eq(imports.id, imp.id));
      }
    }

    // Final update
    await db
      .update(imports)
      .set({
        status: "completed",
        totalRows: total,
        processedRows: processed,
        error: errors.length > 0 ? errors.join("\n") : null,
        updatedAt: new Date(),
      })
      .where(eq(imports.id, imp.id));

    // Clean up file
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      logger.warn({ filePath }, "Failed to delete import file");
    }

    return { processed, total, errors };
  } catch (error: any) {
    // Mark import as failed
    await db
      .update(imports)
      .set({
        status: "failed",
        totalRows: total,
        processedRows: processed,
        error: error.message,
        updatedAt: new Date(),
      })
      .where(eq(imports.id, imp.id));

    // Clean up file
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      logger.warn({ filePath }, "Failed to delete import file after error");
    }

    throw error;
  }
}

// ========================================
// MARKETING CAMPAIGN HANDLER
// ========================================

import { 
  mkCampaigns, 
  mkTemplates, 
  mkSends, 
  mkEvents, 
  contactPreferences 
} from "@shared/schema.marketing";

type RunCampaignJob = {
  tenantId: string;
  campaignId: string;
};

type AudienceMember = {
  contactId?: string;
  toAddress: string;
};

type SendResult = {
  success: boolean;
  providerMessageId?: string;
  error?: string;
};

// Helper: Sleep for throttling
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

export async function handleMarketingCampaign(job: Job): Promise<any> {
  const { tenantId, campaignId } = job.payload as RunCampaignJob;
  logger.info({ jobId: job.id, campaignId }, "Marketing campaign job started");

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
      logger.error({ campaignId }, "Campaign not found");
      return { success: false, error: "Campaign not found" };
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
      logger.error({ templateId: campaign.templateId }, "Template not found");
      await db
        .update(mkCampaigns)
        .set({ status: "failed", finishedAt: new Date() })
        .where(eq(mkCampaigns.id, campaignId));
      return { success: false, error: "Template not found" };
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
      const { SegmentsEngine } = await import("../modules/crm/segments");
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

    // Load marketing providers
    const {
      sendEmail,
      sendWhatsapp,
      sendFacebook,
      sendInstagram,
      renderTemplate,
      generateTrackingId,
      stripHtmlToText,
      rewriteLinksWithTracking,
      addTrackingPixel
    } = await import("../modules/marketing/providers");

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
        logger.info({ to, channel: campaign.channel }, "Skipping - opt-out or quiet hours");
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
        logger.error({ to, error: error.message }, "Error sending to recipient");
        // Continue with next recipient
      }
    };

    // Execute sends with throttling
    logger.info({ campaignId, recipients: audience.length }, "Starting campaign execution");

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

    logger.info({ campaignId }, "Campaign finished successfully");
    return { success: true, sent: audience.length };
  } catch (error: any) {
    logger.error({ campaignId, error: error.message }, "Campaign failed");

    // Mark as failed
    await db
      .update(mkCampaigns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(mkCampaigns.id, campaignId));

    throw error;
  }
}
