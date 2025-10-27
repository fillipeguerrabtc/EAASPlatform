import { db } from "../db";
import { jobQueue, Job, InsertJob } from "@shared/schema";
import { eq, and, or, lte, isNull, sql } from "drizzle-orm";

/**
 * PostgreSQL-based Job Queue Service
 * Replaces Redis/BullMQ for background job processing
 * 
 * Features:
 * - Priority queue (higher priority = processed first)
 * - Scheduled jobs (scheduledFor timestamp)
 * - Automatic retry with exponential backoff
 * - Atomic operations (prevents duplicate processing)
 * - Tenant isolation
 */

export interface EnqueueOptions {
  priority?: number;
  scheduledFor?: Date;
  maxAttempts?: number;
}

export class JobQueueService {
  /**
   * Enqueue a new job
   */
  static async enqueue(
    tenantId: string,
    type: InsertJob["type"],
    payload: any,
    options: EnqueueOptions = {}
  ): Promise<Job> {
    const [job] = await db.insert(jobQueue).values({
      tenantId,
      type,
      payload,
      priority: options.priority ?? 0,
      scheduledFor: options.scheduledFor,
      maxAttempts: options.maxAttempts ?? 3,
      status: "pending",
    }).returning();

    return job;
  }

  /**
   * Dequeue next job (atomic operation)
   * Uses SELECT FOR UPDATE SKIP LOCKED for concurrency safety
   */
  static async dequeue(tenantId?: string): Promise<Job | null> {
    const now = new Date();

    // Build WHERE clause
    const conditions = [
      eq(jobQueue.status, "pending"),
      or(
        isNull(jobQueue.scheduledFor),
        lte(jobQueue.scheduledFor, now)
      )
    ];

    if (tenantId) {
      conditions.push(eq(jobQueue.tenantId, tenantId));
    }

    // Atomic dequeue with SELECT FOR UPDATE SKIP LOCKED
    const result = await db.transaction(async (tx) => {
      // Find next job (highest priority first, oldest created_at second)
      const [job] = await tx
        .select()
        .from(jobQueue)
        .where(and(...conditions))
        .orderBy(sql`${jobQueue.priority} DESC, ${jobQueue.createdAt} ASC`)
        .limit(1)
        .for("update", { skipLocked: true });

      if (!job) return null;

      // Mark as processing
      const [updated] = await tx
        .update(jobQueue)
        .set({
          status: "processing",
          startedAt: now,
        })
        .where(eq(jobQueue.id, job.id))
        .returning();

      return updated;
    });

    return result;
  }

  /**
   * Mark job as completed
   */
  static async complete(jobId: string, result?: any): Promise<void> {
    await db
      .update(jobQueue)
      .set({
        status: "completed",
        completedAt: new Date(),
        result,
      })
      .where(eq(jobQueue.id, jobId));
  }

  /**
   * Mark job as failed (with retry logic)
   */
  static async fail(jobId: string, error: Error | string): Promise<Job> {
    const errorMessage = typeof error === "string" ? error : error.message;
    const errorStack = typeof error === "string" ? undefined : error.stack;

    // Get current job
    const [job] = await db
      .select()
      .from(jobQueue)
      .where(eq(jobQueue.id, jobId))
      .limit(1);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const newAttempts = job.attempts + 1;
    const shouldRetry = newAttempts < job.maxAttempts;

    if (shouldRetry) {
      // Calculate exponential backoff (2^attempts minutes)
      const backoffMinutes = Math.pow(2, newAttempts);
      const scheduledFor = new Date(Date.now() + backoffMinutes * 60 * 1000);

      const [updated] = await db
        .update(jobQueue)
        .set({
          status: "pending",
          attempts: newAttempts,
          error: errorMessage,
          errorStack,
          scheduledFor, // Retry later
        })
        .where(eq(jobQueue.id, jobId))
        .returning();

      return updated;
    } else {
      // Max attempts reached, mark as failed permanently
      const [updated] = await db
        .update(jobQueue)
        .set({
          status: "failed",
          attempts: newAttempts,
          error: errorMessage,
          errorStack,
          completedAt: new Date(),
        })
        .where(eq(jobQueue.id, jobId))
        .returning();

      return updated;
    }
  }

  /**
   * Cancel a job
   */
  static async cancel(jobId: string): Promise<void> {
    await db
      .update(jobQueue)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(jobQueue.id, jobId));
  }

  /**
   * Get job by ID
   */
  static async getById(jobId: string): Promise<Job | null> {
    const [job] = await db
      .select()
      .from(jobQueue)
      .where(eq(jobQueue.id, jobId))
      .limit(1);

    return job || null;
  }

  /**
   * Get jobs by tenant
   */
  static async getByTenant(
    tenantId: string,
    options: {
      status?: Job["status"];
      type?: Job["type"];
      limit?: number;
    } = {}
  ): Promise<Job[]> {
    const conditions = [eq(jobQueue.tenantId, tenantId)];

    if (options.status) {
      conditions.push(eq(jobQueue.status, options.status));
    }

    if (options.type) {
      conditions.push(eq(jobQueue.type, options.type));
    }

    const query = db
      .select()
      .from(jobQueue)
      .where(and(...conditions))
      .orderBy(sql`${jobQueue.createdAt} DESC`);

    if (options.limit) {
      return query.limit(options.limit);
    }

    return query;
  }

  /**
   * Clean up old completed/failed jobs
   */
  static async cleanup(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(jobQueue)
      .where(
        and(
          or(
            eq(jobQueue.status, "completed"),
            eq(jobQueue.status, "failed"),
            eq(jobQueue.status, "cancelled")
          ),
          lte(jobQueue.completedAt, cutoffDate)
        )
      );

    return result.rowCount ?? 0;
  }

  /**
   * Get queue stats
   */
  static async getStats(tenantId?: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const conditions = tenantId ? [eq(jobQueue.tenantId, tenantId)] : [];

    const [stats] = await db
      .select({
        pending: sql<number>`COUNT(*) FILTER (WHERE ${jobQueue.status} = 'pending')`,
        processing: sql<number>`COUNT(*) FILTER (WHERE ${jobQueue.status} = 'processing')`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${jobQueue.status} = 'completed')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${jobQueue.status} = 'failed')`,
      })
      .from(jobQueue)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      pending: Number(stats.pending ?? 0),
      processing: Number(stats.processing ?? 0),
      completed: Number(stats.completed ?? 0),
      failed: Number(stats.failed ?? 0),
    };
  }
}
