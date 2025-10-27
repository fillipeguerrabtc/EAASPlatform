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

export type MarketingCampaignPayload = {
  tenantId: string;
  campaignId: string;
  userId: string;
};

export async function handleMarketingCampaign(
  payload: MarketingCampaignPayload,
  job: Job
): Promise<{ sent: number; failed: number }> {
  // This will be implemented when we integrate Marketing
  // For now, just a placeholder
  logger.info(
    { campaignId: payload.campaignId },
    "Marketing campaign job (placeholder)"
  );

  return { sent: 0, failed: 0 };
}
