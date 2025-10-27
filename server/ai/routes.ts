// server/ai/routes.ts
// Main AI routes for query, ingest, and document management
// SECURITY: Tenant isolation enforced, isAuthenticated middleware

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { aiDocuments, aiChunks } from "@shared/schema.ai.core";
import { aiEntities } from "@shared/schema.ai.graph";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { embedTexts } from "./embeddings.text";
import { knnText, knnImage } from "./vector-store";
import { hybridRerank, DEFAULT_WEIGHTS, type HybridWeights } from "./hybrid-score";
import { ingestDocument, ingestRawText, ingestImage, deleteDocument } from "./ingest";
import { getTopEntities } from "./kg";

// Zod validation schemas for API inputs
const querySchema = z.object({
  query: z.string().min(1).max(10000),
  k: z.number().int().positive().max(100).optional().default(10),
  weights: z.object({
    alpha: z.number().min(0).max(1),
    beta: z.number().min(0).max(1),
    gamma: z.number().min(0).max(1),
    delta: z.number().min(0).max(1),
    zeta: z.number().min(0).max(1)
  }).optional()
});

const ingestTextSchema = z.object({
  text: z.string().min(1).max(1000000),
  source: z.string().optional().default("manual")
});

const router = Router();

// Configure multer for file uploads
const UPLOAD_DIR = path.resolve(process.cwd(), "data", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      ".html", ".htm", ".pdf", ".docx", ".pptx", ".csv",
      ".png", ".jpg", ".jpeg", ".gif", ".webp"
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${ext}`));
    }
  }
});

// ========================================
// QUERY (Multimodal RAG)
// ========================================

/**
 * POST /api/ai/query
 * Multimodal RAG query with hybrid scoring
 *
 * Body:
 * {
 *   query: string,
 *   k?: number (default: 10),
 *   weights?: HybridWeights (optional)
 * }
 */
router.post("/query", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // For single-tenant, tenantId = userId (simplified)
    const tenantId = userId;

    // Zod validation
    const parseResult = querySchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid request",
        details: parseResult.error.errors
      });
    }

    const { query, k, weights } = parseResult.data;

    // Embed query
    const [queryVec] = await embedTexts([query]);

    // kNN search (retrieve 5x candidates for reranking)
    const candidates = await knnText(tenantId, queryVec, k * 5);

    if (candidates.length === 0) {
      return res.json({ results: [], query, k });
    }

    // Fetch chunk metadata (createdAt) from DB
    const chunkIds = candidates.map(c => c.chunkId);
    const chunks = await db
      .select({
        id: aiChunks.id,
        createdAt: aiChunks.createdAt
      })
      .from(aiChunks)
      .where(
        and(
          inArray(aiChunks.id, chunkIds),
          eq(aiChunks.tenantId, tenantId)
        )
      );

    const chunkMeta = new Map(chunks.map(c => [c.id, c]));

    // NOTE: Feedback and graph scores require future schema extensions:
    // - aiFeedback table in schema.ai.eval.ts for user ratings
    // - ai_chunk_entities junction table to link chunks to extracted entities
    // For now, using defaults (0) to ensure hybrid scoring operates deterministically

    // Build enriched candidates with real temporal metadata
    const EPOCH_FALLBACK = new Date(0); // Deterministic fallback (1970-01-01)
    const enrichedCandidates = candidates.map(c => ({
      chunkId: c.chunkId,
      vectorScore: c.score,
      createdAt: chunkMeta.get(c.chunkId)?.createdAt || EPOCH_FALLBACK,
      graphScore: 0, // TODO: requires ai_chunk_entities junction table
      feedbackScore: 0 // TODO: requires aiFeedback table in schema.ai.eval.ts
    }));

    // Hybrid rerank
    const results = hybridRerank(
      enrichedCandidates,
      new Map(), // TODO: pass vectors for diversity penalty
      k,
      weights || DEFAULT_WEIGHTS
    );

    res.json({
      results,
      query,
      k
    });
  } catch (error: any) {
    console.error("AI query error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// INGEST
// ========================================

/**
 * POST /api/ai/ingest/file
 * Ingest document from file upload
 */
router.post("/ingest/file", isAuthenticated, upload.single("file"), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantId = userId;

    if (!req.file) {
      return res.status(400).json({ error: "File required" });
    }

    const { originalname } = req.file;
    const sourceUri = `file://${originalname}`;

    // Ingest document
    const docId = await ingestDocument(
      tenantId,
      req.file.path,
      sourceUri,
      { uploadedBy: userId, filename: originalname }
    );

    // Clean up temp file
    fs.unlinkSync(req.file.path);

    res.json({
      documentId: docId,
      message: "Document ingested successfully"
    });
  } catch (error: any) {
    console.error("Ingest file error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/ingest/text
 * Ingest raw text
 *
 * Body:
 * {
 *   text: string,
 *   source?: string (default: "manual")
 * }
 */
router.post("/ingest/text", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantId = userId;

    // Zod validation
    const parseResult = ingestTextSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid request",
        details: parseResult.error.errors
      });
    }

    const { text, source } = parseResult.data;

    const docId = await ingestRawText(
      tenantId,
      text,
      source,
      { uploadedBy: userId }
    );

    res.json({
      documentId: docId,
      message: "Text ingested successfully"
    });
  } catch (error: any) {
    console.error("Ingest text error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// DOCUMENT MANAGEMENT
// ========================================

/**
 * GET /api/ai/documents
 * List all documents for tenant
 */
router.get("/documents", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantId = userId;

    const docs = await db
      .select()
      .from(aiDocuments)
      .where(eq(aiDocuments.tenantId, tenantId))
      .orderBy(desc(aiDocuments.createdAt))
      .limit(100);

    res.json({ documents: docs });
  } catch (error: any) {
    console.error("List documents error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ai/documents/:id
 * Get single document details
 */
router.get("/documents/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantId = userId;
    const { id } = req.params;

    const docs = await db
      .select()
      .from(aiDocuments)
      .where(
        and(
          eq(aiDocuments.id, id),
          eq(aiDocuments.tenantId, tenantId)
        )
      );

    if (!docs.length) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ document: docs[0] });
  } catch (error: any) {
    console.error("Get document error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/ai/documents/:id
 * Delete document and all associated chunks/embeddings
 */
router.delete("/documents/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantId = userId;
    const { id } = req.params;

    await deleteDocument(tenantId, id);

    res.json({ message: "Document deleted successfully" });
  } catch (error: any) {
    console.error("Delete document error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// KNOWLEDGE GRAPH
// ========================================

/**
 * GET /api/ai/knowledge/entities
 * Get top entities by PageRank score
 */
router.get("/knowledge/entities", isAuthenticated, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const tenantId = userId;
    const limit = parseInt(req.query.limit as string) || 50;

    const entities = await getTopEntities(tenantId, limit);

    res.json({ entities });
  } catch (error: any) {
    console.error("Get entities error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
