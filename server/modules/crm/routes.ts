// server/modules/crm/routes.ts - CRM REST API routes
import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { CRMService } from "./service";
import { SegmentsEngine } from "./segments";
import { enqueueImport } from "./imports";
import { db } from "../../db";
import { imports, segments } from "@shared/schema.crm";
import { eq, sql } from "drizzle-orm";
import { segmentCreateSchema } from "./validators";

// Storage for uploads
const storageDir = process.env.STORAGE_DIR || "./.storage";
const uploadsDir = path.join(storageDir, "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

// Helper to get user context from request
function getCtx(req: Request) {
  return {
    tenantId: (req as any).tenantId || process.env.PRIMARY_TENANT_ID!,
    userId: (req as any).userId || "system",
    role: (req as any).role || "admin",
  };
}

export function registerCrmRoutes(app: Express) {
  // ============================================
  // COMPANIES
  // ============================================

  app.post("/api/crm/companies", async (req, res) => {
    try {
      const result = await CRMService.upsertCompany(getCtx(req), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/companies", async (req, res) => {
    try {
      const result = await CRMService.listCompanies(getCtx(req), req.query);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/companies/:id", async (req, res) => {
    try {
      const result = await CRMService.getCompany(getCtx(req), req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.delete("/api/crm/companies/:id", async (req, res) => {
    try {
      const result = await CRMService.deleteCompany(getCtx(req), req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ============================================
  // CONTACTS
  // ============================================

  app.post("/api/crm/contacts", async (req, res) => {
    try {
      const result = await CRMService.upsertContact(getCtx(req), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/contacts", async (req, res) => {
    try {
      const result = await CRMService.listContacts(getCtx(req), req.query);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/contacts/:id", async (req, res) => {
    try {
      const result = await CRMService.getContact(getCtx(req), req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.delete("/api/crm/contacts/:id", async (req, res) => {
    try {
      const result = await CRMService.deleteContact(getCtx(req), req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ============================================
  // PIPELINES
  // ============================================

  app.get("/api/crm/pipelines", async (req, res) => {
    try {
      const result = await CRMService.listPipelines(getCtx(req));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/pipelines/:id/stages", async (req, res) => {
    try {
      const result = await CRMService.listPipelineStages(
        getCtx(req),
        req.params.id
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/crm/pipelines/init", async (req, res) => {
    try {
      const result = await CRMService.ensureDefaultPipeline(getCtx(req));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ============================================
  // DEALS
  // ============================================

  app.post("/api/crm/deals", async (req, res) => {
    try {
      const result = await CRMService.upsertDeal(getCtx(req), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/deals", async (req, res) => {
    try {
      const result = await CRMService.listDeals(getCtx(req), req.query);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/deals/:id", async (req, res) => {
    try {
      const result = await CRMService.getDeal(getCtx(req), req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.patch("/api/crm/deals/:id/stage", async (req, res) => {
    try {
      const result = await CRMService.updateDealStage(
        getCtx(req),
        req.params.id,
        req.body.stageId
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/crm/deals/:id", async (req, res) => {
    try {
      const result = await CRMService.deleteDeal(getCtx(req), req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ============================================
  // ACTIVITIES
  // ============================================

  app.post("/api/crm/activities", async (req, res) => {
    try {
      const result = await CRMService.createActivity(getCtx(req), req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/activities", async (req, res) => {
    try {
      const result = await CRMService.listActivities(getCtx(req), req.query);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/activities/:id", async (req, res) => {
    try {
      const result = await CRMService.getActivity(getCtx(req), req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.patch("/api/crm/activities/:id/complete", async (req, res) => {
    try {
      const result = await CRMService.completeActivity(
        getCtx(req),
        req.params.id
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/crm/activities/:id", async (req, res) => {
    try {
      const result = await CRMService.deleteActivity(getCtx(req), req.params.id);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ============================================
  // ACTIVITY FEED (Dashboard)
  // ============================================

  app.get("/api/crm/activities/feed", async (req, res) => {
    try {
      const ctx = getCtx(req);
      const rows = await db.execute(
        sql`SELECT * FROM activities WHERE tenant_id = ${ctx.tenantId} ORDER BY created_at DESC LIMIT 50`
      );
      res.json({ rows: rows.rows });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ============================================
  // SEGMENTS
  // ============================================

  app.post("/api/crm/segments", async (req, res) => {
    try {
      const ctx = getCtx(req);
      const data = segmentCreateSchema.parse(req.body);
      const [segment] = await db
        .insert(segments)
        .values({ ...data, tenantId: ctx.tenantId })
        .returning();
      res.json(segment);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/segments", async (req, res) => {
    try {
      const ctx = getCtx(req);
      const rows = await db
        .select()
        .from(segments)
        .where(eq(segments.tenantId, ctx.tenantId));
      res.json({ rows });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/crm/segments/:id/run", async (req, res) => {
    try {
      const ctx = getCtx(req);
      const { page = 1, pageSize = 50 } = req.query;
      const result = await SegmentsEngine.runSegment(ctx.tenantId, req.params.id, {
        page: Number(page),
        pageSize: Number(pageSize),
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ============================================
  // IMPORTS (CSV)
  // ============================================

  app.post(
    "/api/crm/imports/upload",
    upload.single("file"),
    async (req, res) => {
      try {
        const ctx = getCtx(req);
        const { entity = "contacts", mapping } = req.body;

        if (!req.file) {
          return res.status(400).json({ error: "File required (multipart/form-data 'file')" });
        }

        const job = await enqueueImport({
          tenantId: ctx.tenantId,
          entity: entity === "companies" ? "companies" : "contacts",
          filePath: req.file.path,
          mapping: mapping ? JSON.parse(mapping) : undefined,
          userId: ctx.userId,
        });

        res.json({ queued: true, jobId: job.id });
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  app.get("/api/crm/imports", async (req, res) => {
    try {
      const ctx = getCtx(req);
      const rows = await db
        .select()
        .from(imports)
        .where(eq(imports.tenantId, ctx.tenantId))
        .limit(50);
      res.json({ rows });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ============================================
  // STATS (Dashboard)
  // ============================================

  app.get("/api/crm/stats/deals-by-stage", async (req, res) => {
    try {
      const ctx = getCtx(req);
      const result = await db.execute(
        sql`SELECT stage_id, count(*)::int as total, sum(value_cents)::bigint as value_cents
         FROM deals
         WHERE tenant_id = ${ctx.tenantId}
         GROUP BY stage_id`
      );
      res.json({ rows: result.rows });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
}
