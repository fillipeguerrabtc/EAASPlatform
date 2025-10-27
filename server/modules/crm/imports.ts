// server/modules/crm/imports.ts - CSV import queue with BullMQ
import fs from "fs";
import path from "path";
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { parse } from "csv-parse";
import { db } from "../../db";
import { imports } from "@shared/schema.crm";
import { CRMService } from "./service";
import { logAudit } from "./audit";
import { eq } from "drizzle-orm";

// Redis connection (use REDIS_URL or default to localhost)
const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  }
);

export const ImportsQueue = new Queue("crm-imports", { connection });

export type ImportJobData = {
  tenantId: string;
  entity: "contacts" | "companies";
  filePath: string;
  mapping?: Record<string, string>; // CSV column -> field name
  userId?: string;
};

export async function enqueueImport(data: ImportJobData) {
  return ImportsQueue.add("import-csv", data, {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false,
  });
}

// Worker: processes CSV imports asynchronously
export const ImportsWorker = new Worker<ImportJobData>(
  "crm-imports",
  async (job: Job<ImportJobData>) => {
    const { tenantId, entity, filePath, mapping = {}, userId = "system" } = job.data;

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

        // Apply column mapping
        for (const [csvCol, value] of Object.entries(record)) {
          const mappedField = mapping[csvCol] || csvCol;
          payload[mappedField] = value;
        }

        try {
          if (entity === "contacts") {
            const result = await CRMService.upsertContact(
              { tenantId, userId, role: "admin" },
              payload
            );
            await logAudit({
              tenantId,
              entity: "contact",
              entityId: result.id,
              action: "import",
              after: payload,
              context: { file: filePath },
            });
          } else {
            const result = await CRMService.upsertCompany(
              { tenantId, userId, role: "admin" },
              payload
            );
            await logAudit({
              tenantId,
              entity: "company",
              entityId: result.id,
              action: "import",
              after: payload,
              context: { file: filePath },
            });
          }
          processed++;
        } catch (err: any) {
          errors.push(`Row ${total}: ${err.message}`);
        }

        // Update progress every 10 rows
        if (processed % 10 === 0) {
          await db
            .update(imports)
            .set({ processedRows: processed, totalRows: total })
            .where(eq(imports.id, imp.id));
        }
      }

      // Final update
      await db
        .update(imports)
        .set({
          status: "done",
          processedRows: processed,
          totalRows: total,
          error: errors.length ? errors.join("\n") : null,
        })
        .where(eq(imports.id, imp.id));
    } catch (err: any) {
      await db
        .update(imports)
        .set({
          status: "failed",
          processedRows: processed,
          totalRows: total,
          error: err.message,
        })
        .where(eq(imports.id, imp.id));
      throw err;
    }
  },
  { connection }
);
