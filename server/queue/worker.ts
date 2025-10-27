import { JobQueueService } from "./service";
import { Job } from "@shared/schema";
import pino from "pino";

const logger = pino();

/**
 * Job Handler Function Type
 * Receives job payload and returns result
 */
export type JobHandler<T = any, R = any> = (payload: T, job: Job) => Promise<R>;

/**
 * PostgreSQL-based Job Queue Worker
 * Replaces Redis/BullMQ worker
 * 
 * Features:
 * - Polling-based (checks for new jobs every N seconds)
 * - Type-based job routing (each job type has a handler)
 * - Graceful shutdown
 * - Error handling with automatic retry
 */

export class JobQueueWorker {
  private handlers: Map<string, JobHandler> = new Map();
  private intervalId?: NodeJS.Timeout;
  private isProcessing = false;
  private isShuttingDown = false;

  constructor(
    private pollIntervalMs: number = 5000, // Check for jobs every 5 seconds
    private tenantId?: string // Optional: process jobs for specific tenant only
  ) {}

  /**
   * Register a job handler
   */
  register<T = any, R = any>(type: string, handler: JobHandler<T, R>): void {
    this.handlers.set(type, handler);
    logger.info({ type }, "Job handler registered");
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.intervalId) {
      logger.warn("Worker already running");
      return;
    }

    logger.info(
      { 
        pollIntervalMs: this.pollIntervalMs,
        tenantId: this.tenantId || "all",
        handlers: Array.from(this.handlers.keys())
      },
      "✅ Job Queue Worker started"
    );

    // Start polling
    this.intervalId = setInterval(() => {
      this.processNextJob().catch((err) => {
        logger.error({ err }, "Worker error during polling");
      });
    }, this.pollIntervalMs);

    // Process first job immediately
    this.processNextJob().catch((err) => {
      logger.error({ err }, "Worker error during initial job");
    });
  }

  /**
   * Stop the worker (graceful shutdown)
   */
  async stop(): Promise<void> {
    if (!this.intervalId) {
      logger.warn("Worker not running");
      return;
    }

    this.isShuttingDown = true;
    logger.info("Stopping Job Queue Worker...");

    // Stop polling
    clearInterval(this.intervalId);
    this.intervalId = undefined;

    // Wait for current job to finish (max 30s)
    const maxWaitMs = 30000;
    const startTime = Date.now();

    while (this.isProcessing && Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.isProcessing) {
      logger.warn("Worker stopped with job still processing");
    } else {
      logger.info("✅ Job Queue Worker stopped gracefully");
    }

    this.isShuttingDown = false;
  }

  /**
   * Process next available job
   */
  private async processNextJob(): Promise<void> {
    if (this.isProcessing || this.isShuttingDown) {
      return;
    }

    this.isProcessing = true;

    try {
      // Dequeue next job (atomic operation)
      const job = await JobQueueService.dequeue(this.tenantId);

      if (!job) {
        // No jobs available
        this.isProcessing = false;
        return;
      }

      logger.info(
        {
          jobId: job.id,
          type: job.type,
          tenantId: job.tenantId,
          attempts: job.attempts,
        },
        "Processing job"
      );

      // Get handler for this job type
      const handler = this.handlers.get(job.type);

      if (!handler) {
        const error = `No handler registered for job type: ${job.type}`;
        logger.error({ jobId: job.id, type: job.type }, error);
        await JobQueueService.fail(job.id, error);
        this.isProcessing = false;
        return;
      }

      try {
        // Execute handler
        const result = await handler(job.payload, job);

        // Mark as completed
        await JobQueueService.complete(job.id, result);

        logger.info(
          {
            jobId: job.id,
            type: job.type,
            tenantId: job.tenantId,
          },
          "✅ Job completed"
        );
      } catch (error: any) {
        logger.error(
          {
            jobId: job.id,
            type: job.type,
            tenantId: job.tenantId,
            error: error.message,
            attempts: job.attempts + 1,
            maxAttempts: job.maxAttempts,
          },
          "❌ Job failed"
        );

        // Mark as failed (with retry logic)
        const updatedJob = await JobQueueService.fail(job.id, error);

        if (updatedJob.status === "pending") {
          logger.info(
            {
              jobId: job.id,
              scheduledFor: updatedJob.scheduledFor,
              attempts: updatedJob.attempts,
            },
            "Job will retry"
          );
        } else {
          logger.error(
            {
              jobId: job.id,
              attempts: updatedJob.attempts,
            },
            "Job permanently failed (max attempts reached)"
          );
        }
      }
    } catch (error: any) {
      logger.error({ error: error.message }, "Worker error");
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get worker stats
   */
  getStats(): {
    isRunning: boolean;
    isProcessing: boolean;
    pollIntervalMs: number;
    handlersCount: number;
  } {
    return {
      isRunning: !!this.intervalId,
      isProcessing: this.isProcessing,
      pollIntervalMs: this.pollIntervalMs,
      handlersCount: this.handlers.size,
    };
  }
}

/**
 * Global worker instance (singleton)
 * Will be started in server/index.ts
 */
export const globalWorker = new JobQueueWorker(
  parseInt(process.env.JOB_POLL_INTERVAL_MS || "5000", 10)
);

// Graceful shutdown handlers
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down worker...");
  await globalWorker.stop();
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down worker...");
  await globalWorker.stop();
});
