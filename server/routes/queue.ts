/**
 * Job Queue API Routes
 * Dashboard endpoints for monitoring and managing jobs
 */

import { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { jobQueue } from "@shared/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

// Middleware to check authentication
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

export function registerQueueRoutes(app: Express) {
  /**
   * List jobs with filters and pagination
   * GET /api/admin/queue/jobs?status=pending&type=crm_csv_import&page=1&limit=50
   */
  app.get("/api/admin/queue/jobs", isAuthenticated, async (req, res, next) => {
    try {
      const { tenantId } = req.user!;
      const {
        status,
        type,
        page = "1",
        limit = "50",
        startDate,
        endDate
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 per page
      const offset = (pageNum - 1) * limitNum;

      // Build filters
      const conditions = [eq(jobQueue.tenantId, tenantId)];
      
      if (status) {
        conditions.push(eq(jobQueue.status, status as any));
      }
      
      if (type) {
        conditions.push(eq(jobQueue.type, type as any));
      }

      if (startDate) {
        conditions.push(gte(jobQueue.createdAt, new Date(startDate as string)));
      }

      if (endDate) {
        conditions.push(lte(jobQueue.createdAt, new Date(endDate as string)));
      }

      // Get jobs
      const jobs = await db
        .select()
        .from(jobQueue)
        .where(and(...conditions))
        .orderBy(desc(jobQueue.createdAt))
        .limit(limitNum)
        .offset(offset);

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobQueue)
        .where(and(...conditions));

      res.json({
        jobs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          pages: Math.ceil(count / limitNum)
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get queue statistics
   * GET /api/admin/queue/stats
   */
  app.get("/api/admin/queue/stats", isAuthenticated, async (req, res, next) => {
    try {
      const { tenantId } = req.user!;

      // Stats by status
      const statusStats = await db
        .select({
          status: jobQueue.status,
          count: sql<number>`count(*)::int`
        })
        .from(jobQueue)
        .where(eq(jobQueue.tenantId, tenantId))
        .groupBy(jobQueue.status);

      // Stats by type
      const typeStats = await db
        .select({
          type: jobQueue.type,
          count: sql<number>`count(*)::int`
        })
        .from(jobQueue)
        .where(eq(jobQueue.tenantId, tenantId))
        .groupBy(jobQueue.type);

      // Recent failures (last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [{ failures }] = await db
        .select({ failures: sql<number>`count(*)::int` })
        .from(jobQueue)
        .where(
          and(
            eq(jobQueue.tenantId, tenantId),
            eq(jobQueue.status, "failed"),
            gte(jobQueue.createdAt, oneDayAgo)
          )
        );

      res.json({
        byStatus: statusStats.reduce((acc, s) => ({ ...acc, [s.status]: s.count }), {}),
        byType: typeStats.reduce((acc, t) => ({ ...acc, [t.type]: t.count }), {}),
        recentFailures: failures
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Get single job details
   * GET /api/admin/queue/jobs/:id
   */
  app.get("/api/admin/queue/jobs/:id", isAuthenticated, async (req, res, next) => {
    try {
      const { tenantId } = req.user!;
      const { id } = req.params;

      const [job] = await db
        .select()
        .from(jobQueue)
        .where(
          and(
            eq(jobQueue.id, id),
            eq(jobQueue.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  /**
   * Retry a failed job
   * POST /api/admin/queue/jobs/:id/retry
   */
  app.post("/api/admin/queue/jobs/:id/retry", isAuthenticated, async (req, res, next) => {
    try {
      const { tenantId } = req.user!;
      const { id } = req.params;

      // Get job
      const [job] = await db
        .select()
        .from(jobQueue)
        .where(
          and(
            eq(jobQueue.id, id),
            eq(jobQueue.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.status !== "failed") {
        return res.status(400).json({ error: "Only failed jobs can be retried" });
      }

      // Reset job to pending
      const [updated] = await db
        .update(jobQueue)
        .set({
          status: "pending",
          attempts: 0,
          error: null,
          processedAt: null
        })
        .where(eq(jobQueue.id, id))
        .returning();

      res.json({ success: true, job: updated });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Cancel a pending job
   * POST /api/admin/queue/jobs/:id/cancel
   */
  app.post("/api/admin/queue/jobs/:id/cancel", isAuthenticated, async (req, res, next) => {
    try {
      const { tenantId } = req.user!;
      const { id } = req.params;

      // Get job
      const [job] = await db
        .select()
        .from(jobQueue)
        .where(
          and(
            eq(jobQueue.id, id),
            eq(jobQueue.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.status !== "pending") {
        return res.status(400).json({ error: "Only pending jobs can be cancelled" });
      }

      // Mark as failed
      const [updated] = await db
        .update(jobQueue)
        .set({
          status: "failed",
          error: "Cancelled by user",
          processedAt: new Date()
        })
        .where(eq(jobQueue.id, id))
        .returning();

      res.json({ success: true, job: updated });
    } catch (error) {
      next(error);
    }
  });
}
