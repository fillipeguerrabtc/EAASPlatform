// server/modules/crm/imports.ts - CSV import queue (PostgreSQL-based)
import { JobQueueService } from "../../queue/service";

// ===============================================
// TYPES
// ===============================================

export type ImportJobData = {
  tenantId: string;
  entity: "contacts" | "companies";
  filePath: string;
  mapping?: Record<string, string>; // CSV column -> field name
  userId?: string;
};

// ===============================================
// ENQUEUE IMPORT JOB
// ===============================================

export async function enqueueImport(data: ImportJobData) {
  return JobQueueService.enqueue(
    data.tenantId,
    "crm_csv_import",
    data,
    {
      priority: 0,
      maxAttempts: 1, // CSV imports don't retry (file might be corrupted)
    }
  );
}

