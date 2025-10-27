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
import { aiEntities, aiChunkEntities } from "@shared/schema.ai.graph";
import { aiFeedback } from "@shared/schema.ai.eval";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { embedTexts } from "./embeddings.text";
import { knnText, knnImage, getEmbeddingsByChunkIds } from "./vector-store";
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

    // Weight validation hardening (Architect recommendation #3)
    if (weights) {
      const weightSum = weights.alpha + weights.beta + weights.gamma + weights.delta + weights.zeta;
      if (Math.abs(weightSum - 1.0) > 0.001) { // Allow small floating point errors
        return res.status(400).json({ 
          error: "Invalid weights",
          details: `Weight sum must equal 1.0, got ${weightSum.toFixed(3)}`
        });
      }
    }

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

    // Fetch feedback scores (β weight) - AVG rating per chunk
    const feedbackRows = await db
      .select({
        chunkId: aiFeedback.chunkId,
        avgRating: sql<number>`AVG(${aiFeedback.rating})`.as('avg_rating')
      })
      .from(aiFeedback)
      .where(
        and(
          inArray(aiFeedback.chunkId, chunkIds),
          eq(aiFeedback.tenantId, tenantId)
        )
      )
      .groupBy(aiFeedback.chunkId);

    const feedbackMap = new Map(feedbackRows.map(f => [f.chunkId, f.avgRating || 0]));

    // Fetch graph scores (δ weight) - AVG PageRank of entities in chunk
    const graphRows = await db
      .select({
        chunkId: aiChunkEntities.chunkId,
        avgPageRank: sql<number>`AVG(${aiEntities.pagerank})`.as('avg_pagerank')
      })
      .from(aiChunkEntities)
      .innerJoin(aiEntities, eq(aiChunkEntities.entityId, aiEntities.id))
      .where(
        and(
          inArray(aiChunkEntities.chunkId, chunkIds),
          eq(aiChunkEntities.tenantId, tenantId)
        )
      )
      .groupBy(aiChunkEntities.chunkId);

    const graphMap = new Map(graphRows.map(g => [g.chunkId, g.avgPageRank || 0]));

    // Build enriched candidates with real metadata (α/β/γ/δ weights)
    const EPOCH_FALLBACK = new Date(0); // Deterministic fallback (1970-01-01)
    const enrichedCandidates = candidates.map(c => ({
      chunkId: c.chunkId,
      vectorScore: c.score,
      createdAt: chunkMeta.get(c.chunkId)?.createdAt || EPOCH_FALLBACK,
      graphScore: graphMap.get(c.chunkId) || 0,
      feedbackScore: feedbackMap.get(c.chunkId) || 0
    }));

    // Fetch embeddings for diversity penalty (ζ weight)
    const embeddingsMap = await getEmbeddingsByChunkIds(tenantId, chunkIds, "text");

    // Hybrid rerank with MMR diversity
    const results = hybridRerank(
      enrichedCandidates,
      embeddingsMap, // Enable diversity penalty (ζ weight)
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
