// server/modules/crm/imports.ts - CSV import queue with BullMQ (Optional Redis)
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

// ===============================================
// REDIS CONNECTION (Optional - graceful degradation)
// ===============================================
let connection: IORedis | null = null;
let isRedisAvailable = false;

try {
  connection = new IORedis(
    process.env.REDIS_URL || "redis://localhost:6379",
    {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false, // Fail fast if Redis is down
      lazyConnect: true,
      retryStrategy: () => null, // Don't retry - fail immediately
    }
  );

  connection.on("ready", () => {
    isRedisAvailable = true;
    console.log("✅ Redis connected - CSV imports queue enabled");
  });

  connection.on("error", (err) => {
    isRedisAvailable = false;
    // Suppress noisy connection errors
    if (err.message.includes("ECONNREFUSED")) {
      console.warn("⚠️  Redis unavailable - CSV imports disabled (run: redis-server)");
    } else {
      console.warn("⚠️  Redis error:", err.message);
    }
  });

  // Attempt connection (non-blocking)
  connection.connect().catch(() => {
    isRedisAvailable = false;
  });
} catch (err: any) {
  console.warn("⚠️  Redis initialization failed - CSV imports disabled");
  isRedisAvailable = false;
}

// ===============================================
// QUEUE & WORKER (only created if Redis is available)
// ===============================================
export let ImportsQueue: Queue | null = null;
export let ImportsWorker: Worker | null = null;

// Initialize queue/worker only if Redis is available
setTimeout(() => {
  if (isRedisAvailable && connection) {
    ImportsQueue = new Queue("crm-imports", { connection });
    ImportsWorker = new Worker<ImportJobData>(
      "crm-imports",
      processImportJob,
      { connection }
    );
    console.log("✅ CRM Imports Worker started (BullMQ)");
  } else {
    console.warn("⚠️  CRM Imports Worker disabled - Redis not available");
  }
}, 2000); // Wait 2s for Redis connection

export type ImportJobData = {
  tenantId: string;
  entity: "contacts" | "companies";
  filePath: string;
  mapping?: Record<string, string>; // CSV column -> field name
  userId?: string;
};

export async function enqueueImport(data: ImportJobData) {
  if (!ImportsQueue) {
    throw new Error("CSV imports unavailable - Redis not connected");
  }
  return ImportsQueue.add("import-csv", data, {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false,
  });
}

// ===============================================
// WORKER PROCESSOR
// ===============================================
async function processImportJob(job: Job<ImportJobData>) {
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

      // Apply column mapping (WHITELIST validation)
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
          await CRMService.createContact(
            { tenantId, role: "admin", userId },
            payload
          );
        } else {
          await CRMService.createCompany(
            { tenantId, role: "admin", userId },
            payload
          );
        }
        processed++;
      } catch (err: any) {
        errors.push(`Row ${total}: ${err.message}`);
      }
    }

    // Update import record (success)
    await db
      .update(imports)
      .set({
        status: "completed",
        totalRows: total,
        processedRows: processed,
        errors: errors.length > 0 ? errors : undefined,
      })
      .where(eq(imports.id, imp.id));

    await logAudit({
      tenantId,
      entity: "import",
      entityId: imp.id,
      action: "import",
      after: { total, processed, errors: errors.length },
      context: { entity, filename: path.basename(filePath) },
    });

    return { total, processed, errors };
  } catch (err: any) {
    // Update import record (failure)
    await db
      .update(imports)
      .set({
        status: "failed",
        totalRows: total,
        processedRows: processed,
        errors: [err.message],
      })
      .where(eq(imports.id, imp.id));

    throw err;
  } finally {
    // Cleanup file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}
