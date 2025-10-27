// server/ai/routes.ts
// Main AI routes for query, ingest, and document management
// SECURITY: Tenant isolation enforced, isAuthenticated middleware

import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { isAuthenticated } from "../replitAuth";
import { db } from "../db";
import { aiDocuments } from "@shared/schema.ai.core";
import { eq, and, desc } from "drizzle-orm";
import { embedTexts } from "./embeddings.text";
import { knnText, knnImage } from "./vector-store";
import { hybridRerank, DEFAULT_WEIGHTS } from "./hybrid-score";
import { ingestDocument, ingestRawText, ingestImage, deleteDocument } from "./ingest";
import { getTopEntities } from "./kg";

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

    const { query, k = 10, weights } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query text required" });
    }

    // Embed query
    const [queryVec] = await embedTexts([query]);

    // kNN search (retrieve 5x candidates for reranking)
    const candidates = await knnText(tenantId, queryVec, k * 5);

    // TODO: Fetch chunk metadata (createdAt, feedbackScore, graphScore)
    // For now, use simplified candidates
    const simpleCandidates = candidates.map(c => ({
      chunkId: c.chunkId,
      vectorScore: c.score,
      createdAt: new Date(), // TODO: fetch from DB
      graphScore: 0, // TODO: fetch from graph
      feedbackScore: 0 // TODO: fetch from feedback
    }));

    // Hybrid rerank
    const results = hybridRerank(
      simpleCandidates,
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
    const { text, source = "manual" } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text required" });
    }

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
