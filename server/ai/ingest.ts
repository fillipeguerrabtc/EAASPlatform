// server/ai/ingest.ts
// Multimodal document ingestion with chunking and embedding
// SECURITY: Tenant isolation, safe temp storage, MIME validation

import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { aiDocuments, aiChunks } from "@shared/schema.ai.core";
import { parseFile } from "./parser.full";
import { embedTexts } from "./embeddings.text";
import { embedImages, preprocessImageRGB } from "./embeddings.image";
import { upsertTextEmbedding, upsertImageEmbedding } from "./vector-store";
import { nerLight, upsertEntitiesWithLinks } from "./kg";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import path from "path";
import * as ort from "onnxruntime-node";
import { Jimp } from "jimp";

const TEMP_DIR = path.resolve(process.cwd(), "data", "temp");

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Chunk text into fixed-size segments
 * Default: 512 tokens (~2048 chars)
 */
function chunkText(text: string, maxChars = 2048): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+\s+/);

  let current = "";
  for (const sent of sentences) {
    if ((current + sent).length > maxChars) {
      if (current) chunks.push(current.trim());
      current = sent;
    } else {
      current += (current ? " " : "") + sent;
    }
  }

  if (current) chunks.push(current.trim());

  return chunks.filter(Boolean);
}

/**
 * Ingest a single document (multimodal)
 * SECURITY: Tenant-isolated, validates file before processing
 *
 * @param tenantId - Tenant ID
 * @param filePath - Path to file (HTML/PDF/DOCX/PPTX/CSV/Image)
 * @param sourceUri - Original source URI (URL or file path)
 * @param metadata - Additional metadata (optional)
 * @returns Document ID
 */
export async function ingestDocument(
  tenantId: string,
  filePath: string,
  sourceUri: string,
  metadata: Record<string, any> = {}
): Promise<string> {
  // Parse document
  const parsed = await parseFile(filePath);

  // Create document record
  const docId = uuidv4();
  await db.insert(aiDocuments).values({
    id: docId,
    tenantId,
    source: sourceUri,
    metaJson: JSON.stringify({ ...metadata, ...parsed.metadata })
  });

  // Process text chunks
  if (parsed.text) {
    const textChunks = chunkText(parsed.text);

    for (let i = 0; i < textChunks.length; i++) {
      const chunkId = uuidv4();
      const chunkText = textChunks[i];

      // Save chunk
      await db.insert(aiChunks).values({
        id: chunkId,
        documentId: docId,
        tenantId,
        modality: "text",
        pos: i,
        text: chunkText,
        metaJson: JSON.stringify({ charCount: chunkText.length })
      });

      // Generate embedding (batch of 1)
      const embeddings = await embedTexts([chunkText]);
      await upsertTextEmbedding(tenantId, chunkId, embeddings[0], "minilm");

      // Extract entities and update knowledge graph
      const entities = nerLight(chunkText);
      if (entities.length > 0) {
        await upsertEntitiesWithLinks(tenantId, entities);
      }
    }
  }

  // Process image chunks
  if (parsed.images) {
    for (let i = 0; i < parsed.images.length; i++) {
      const img = parsed.images[i];
      const chunkId = uuidv4();

      // Save chunk
      await db.insert(aiChunks).values({
        id: chunkId,
        documentId: docId,
        tenantId,
        modality: "image",
        pos: i,
        imageUri: img.uri,
        text: img.caption || null,
        metaJson: JSON.stringify({ caption: img.caption })
      });

      // Generate embedding (if image is local file)
      if (fs.existsSync(img.uri)) {
        const image: any = await Jimp.read(img.uri);
        const tensor = preprocessImageRGB(image);
        const embeddings = await embedImages([tensor]);
        await upsertImageEmbedding(tenantId, chunkId, embeddings[0], "mobilenet");
      }
    }
  }

  return docId;
}

/**
 * Ingest raw text (no file parsing)
 * Useful for user messages, API inputs, etc.
 *
 * @param tenantId - Tenant ID
 * @param text - Raw text content
 * @param sourceUri - Source identifier (e.g., "user:123", "api:endpoint")
 * @param metadata - Additional metadata (optional)
 * @returns Document ID
 */
export async function ingestRawText(
  tenantId: string,
  text: string,
  sourceUri: string,
  metadata: Record<string, any> = {}
): Promise<string> {
  // Create document record
  const docId = uuidv4();
  await db.insert(aiDocuments).values({
    id: docId,
    tenantId,
    source: sourceUri,
    metaJson: JSON.stringify(metadata)
  });

  // Process text chunks
  const textChunks = chunkText(text);

  for (let i = 0; i < textChunks.length; i++) {
    const chunkId = uuidv4();
    const chunkText = textChunks[i];

    // Save chunk
    await db.insert(aiChunks).values({
      id: chunkId,
      documentId: docId,
      tenantId,
      modality: "text",
      pos: i,
      text: chunkText,
      metaJson: JSON.stringify({ charCount: chunkText.length })
    });

    // Generate embedding (batch of 1)
    const embeddings = await embedTexts([chunkText]);
    await upsertTextEmbedding(tenantId, chunkId, embeddings[0], "minilm");

    // Extract entities and update knowledge graph
    const entities = nerLight(chunkText);
    if (entities.length > 0) {
      await upsertEntitiesWithLinks(tenantId, entities);
    }
  }

  return docId;
}

/**
 * Ingest image from URI
 *
 * @param tenantId - Tenant ID
 * @param imageUri - Path to image file
 * @param sourceUri - Source identifier
 * @param metadata - Additional metadata (optional)
 * @returns Document ID
 */
export async function ingestImage(
  tenantId: string,
  imageUri: string,
  sourceUri: string,
  metadata: Record<string, any> = {}
): Promise<string> {
  // Create document record
  const docId = uuidv4();
  await db.insert(aiDocuments).values({
    id: docId,
    tenantId,
    source: sourceUri,
    metaJson: JSON.stringify(metadata)
  });

  // Create image chunk
  const chunkId = uuidv4();
  await db.insert(aiChunks).values({
    id: chunkId,
    documentId: docId,
    tenantId,
    modality: "image",
    pos: 0,
    imageUri,
    metaJson: JSON.stringify(metadata)
  });

  // Generate embedding
  if (fs.existsSync(imageUri)) {
    const image: any = await Jimp.read(imageUri);
    const tensor = preprocessImageRGB(image);
    const embeddings = await embedImages([tensor]);
    await upsertImageEmbedding(tenantId, chunkId, embeddings[0], "mobilenet");
  }

  return docId;
}

/**
 * Delete document and all associated chunks/embeddings
 * SECURITY: Tenant-isolated deletion
 */
export async function deleteDocument(tenantId: string, documentId: string) {
  // Cascading delete will remove chunks, embeddings, and entity links
  await db
    .delete(aiDocuments)
    .where(
      and(
        eq(aiDocuments.id, documentId),
        eq(aiDocuments.tenantId, tenantId)
      )
    );
}
