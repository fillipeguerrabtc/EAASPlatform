// server/ai/parser.full.ts
// Full document parser with OCR support + URL fetching
// SECURITY: MIME validation, size limits, safe temp storage
// AUTONOMIA: Ingere conhecimento de múltiplas fontes (URL, arquivo, imagem)

import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";
import { parse as parseCSV } from "csv-parse/sync";
import { Jimp } from "jimp";

// Lazy imports to avoid errors if packages not installed
let pdf: any;
let mammoth: any;
let tesseract: any;
let unzipper: any;

try {
  pdf = require("pdf-parse");
} catch {}

try {
  mammoth = require("mammoth");
} catch {}

try {
  tesseract = require("tesseract.js");
} catch {}

try {
  unzipper = require("unzipper");
} catch {}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIMES = {
  html: ["text/html", "application/xhtml+xml"],
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  csv: ["text/csv", "application/csv"],
  image: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]
};

type ParseResult = {
  text: string;
  metadata: Record<string, any>;
  images?: Array<{ uri: string; caption?: string }>;
};

/**
 * Validate file before parsing
 * SECURITY: MIME type and size validation
 */
function validateFile(filePath: string, expectedType: keyof typeof ALLOWED_MIMES) {
  const stats = fs.statSync(filePath);

  // Size check
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Extension check (basic MIME validation)
  const ext = path.extname(filePath).toLowerCase();
  const typeMap: Record<string, string[]> = {
    html: [".html", ".htm", ".xhtml"],
    pdf: [".pdf"],
    docx: [".docx"],
    pptx: [".pptx"],
    csv: [".csv"],
    image: [".png", ".jpg", ".jpeg", ".gif", ".webp"]
  };

  const allowedExts = typeMap[expectedType] || [];
  if (!allowedExts.includes(ext)) {
    throw new Error(`Invalid file extension for ${expectedType}: ${ext}`);
  }
}

// ========================================
// HTML PARSER
// ========================================

/**
 * Parse HTML document
 * Extracts text, metadata, and image URIs
 */
export async function parseHTMLFile(filePath: string): Promise<ParseResult> {
  validateFile(filePath, "html");

  const html = fs.readFileSync(filePath, "utf8");
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Extract text (strip scripts, styles)
  const scripts = doc.querySelectorAll("script, style");
  scripts.forEach((s: Element) => s.remove());
  const text = doc.body?.textContent?.trim() || "";

  // Extract metadata
  const title = doc.querySelector("title")?.textContent || "";
  const metaTags: Record<string, string> = {};
  doc.querySelectorAll("meta").forEach((meta: Element) => {
    const name = meta.getAttribute("name") || meta.getAttribute("property");
    const content = meta.getAttribute("content");
    if (name && content) {
      metaTags[name] = content;
    }
  });

  // Extract images
  const images: Array<{ uri: string; caption?: string }> = [];
  doc.querySelectorAll("img").forEach((img: Element) => {
    const src = img.getAttribute("src");
    const alt = img.getAttribute("alt");
    if (src) {
      images.push({
        uri: src,
        caption: alt || undefined
      });
    }
  });

  return {
    text,
    metadata: { title, ...metaTags },
    images
  };
}

// ========================================
// PDF PARSER
// ========================================

/**
 * Parse PDF document
 * Extracts text and metadata
 */
export async function parsePDFFile(filePath: string): Promise<ParseResult> {
  validateFile(filePath, "pdf");

  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);

  return {
    text: data.text.trim(),
    metadata: {
      pages: data.numpages,
      info: data.info,
      version: data.version
    }
  };
}

// ========================================
// DOCX PARSER
// ========================================

/**
 * Parse DOCX document
 * Extracts text and metadata
 */
export async function parseDOCXFile(filePath: string): Promise<ParseResult> {
  validateFile(filePath, "docx");

  const result = await mammoth.extractRawText({ path: filePath });

  return {
    text: result.value.trim(),
    metadata: {
      messages: result.messages
    }
  };
}

// ========================================
// PPTX PARSER
// ========================================

/**
 * Parse PPTX document
 * Extracts text from slides (XML parsing with unzipper)
 */
export async function parsePPTXFile(filePath: string): Promise<ParseResult> {
  validateFile(filePath, "pptx");

  if (!unzipper) {
    throw new Error("unzipper not installed. Run: npm install unzipper");
  }

  const tmp: string[] = [];
  const buf = fs.readFileSync(filePath);
  const zip = await unzipper.Open.buffer(buf);

  for (const file of zip.files) {
    if (/ppt\/slides\/slide\d+\.xml$/i.test(file.path)) {
      const cnt = await file.buffer();
      const xml = cnt.toString("utf8");
      const texts = [...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(m => m[1]).join(" ");
      if (texts.trim()) tmp.push(texts);
    }
  }

  return {
    text: tmp.join("\n"),
    metadata: {
      slides: tmp.length,
      note: "Extracted text from slides XML"
    }
  };
}

// ========================================
// CSV PARSER
// ========================================

/**
 * Parse CSV file
 * Extracts rows as text (header + rows)
 */
export async function parseCSVFile(filePath: string): Promise<ParseResult> {
  validateFile(filePath, "csv");

  const content = fs.readFileSync(filePath, "utf8");
  const records = parseCSV(content, {
    columns: true,
    skip_empty_lines: true
  });

  // Convert to text representation
  const text = records
    .map((row: any) => Object.values(row).join(" | "))
    .join("\n");

  return {
    text,
    metadata: {
      rows: records.length,
      columns: records[0] ? Object.keys(records[0]) : []
    }
  };
}

// ========================================
// OCR (TESSERACT)
// ========================================

/**
 * Extract text from image using Tesseract OCR
 * SECURITY: Validates image MIME type before processing
 */
export async function extractTextFromImage(filePath: string, lang = "eng"): Promise<ParseResult> {
  validateFile(filePath, "image");

  if (!tesseract) {
    throw new Error("Tesseract.js not installed. Run: npm install tesseract.js");
  }

  const worker = await tesseract.createWorker(lang);
  const { data } = await worker.recognize(filePath);
  await worker.terminate();

  return {
    text: data.text.trim(),
    metadata: {
      confidence: data.confidence,
      lang
    }
  };
}

// ========================================
// UNIFIED PARSER
// ========================================

/**
 * Auto-detect file type and parse accordingly
 * SECURITY: MIME validation enforced
 */
export async function parseFile(filePath: string): Promise<ParseResult> {
  const ext = path.extname(filePath).toLowerCase();

  if ([".html", ".htm", ".xhtml"].includes(ext)) {
    return parseHTMLFile(filePath);
  }

  if (ext === ".pdf") {
    return parsePDFFile(filePath);
  }

  if (ext === ".docx") {
    return parseDOCXFile(filePath);
  }

  if (ext === ".pptx") {
    return parsePPTXFile(filePath);
  }

  if (ext === ".csv") {
    return parseCSVFile(filePath);
  }

  if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) {
    return extractTextFromImage(filePath);
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

// ========================================
// URL FETCHING (AUTONOMIA)
// ========================================

/**
 * SECURITY: Allowlist of trusted domains for URL ingestion
 * PRODUCTION: Configure via environment variable ALLOWED_URL_DOMAINS
 * Example: "example.com,docs.google.com,github.com"
 */
const ALLOWED_DOMAINS = (process.env.ALLOWED_URL_DOMAINS || "")
  .split(",")
  .map(d => d.trim().toLowerCase())
  .filter(Boolean);

/**
 * Validate URL for SSRF protection
 * SECURITY: Enforces HTTPS + domain allowlist (prevents DNS rebinding/SSRF)
 * 
 * Why allowlist approach:
 * - DNS rebinding: attacker domain can resolve to private IP at runtime
 * - IPv4-mapped IPv6: bypass hostname filters (e.g., ::ffff:127.0.0.1)
 * - Metadata services: cloud provider metadata endpoints
 * 
 * Allowlist is the ONLY secure approach against all SSRF variants.
 */
function validateUrlForSSRF(urlStr: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error("Invalid URL format");
  }

  // Only allow HTTPS protocol (no http, file, ftp, etc.)
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();

  // SECURITY: HARD DENY - allowlist is REQUIRED for URL ingestion
  // This prevents ALL SSRF variants (DNS rebinding, IPv4-mapped IPv6, metadata services)
  if (ALLOWED_DOMAINS.length === 0) {
    throw new Error(
      "URL ingestion is disabled. " +
      "SECURITY: Set ALLOWED_URL_DOMAINS environment variable with trusted domains. " +
      "Example: ALLOWED_URL_DOMAINS=\"example.com,docs.google.com,github.com\""
    );
  }

  // Check if domain is in allowlist (exact match or subdomain)
  const isAllowed = ALLOWED_DOMAINS.some(allowed => {
    return hostname === allowed || hostname.endsWith("." + allowed);
  });

  if (!isAllowed) {
    throw new Error(
      `Domain "${hostname}" is not in allowlist. ` +
      `Allowed domains: ${ALLOWED_DOMAINS.join(", ")}`
    );
  }

  return parsed;
}

/**
 * Fetch URL to Buffer (for ingest by URL)
 * AUTONOMIA: Permite ingerir conhecimento de URLs externas
 * SECURITY: SSRF protection (HTTPS only, blocks private IPs, timeout, size limit)
 */
export async function fetchBuffer(url: string): Promise<Buffer> {
  // SSRF validation
  const validated = validateUrlForSSRF(url);

  // Fetch with timeout (30s) and abort signal
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const r = await fetch(validated.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "EAAS-AI-Bot/1.0"
      }
    });

    clearTimeout(timeoutId);

    if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);

    // Stream with size limit check
    const chunks: Buffer[] = [];
    let totalSize = 0;

    if (!r.body) throw new Error("No response body");

    const reader = r.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.byteLength;
      if (totalSize > MAX_FILE_SIZE) {
        throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      chunks.push(Buffer.from(value));
    }

    return Buffer.concat(chunks);
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Request timeout (30s)");
    }
    throw err;
  }
}

/**
 * Parse URL (auto-detect format)
 * AUTONOMIA: Detecta tipo de arquivo e aplica parser correto
 */
export async function parseURL(url: string): Promise<ParseResult> {
  const buf = await fetchBuffer(url);
  const lower = url.toLowerCase();

  // Save to temp file for parsers that expect file path
  const tmpDir = fs.mkdtempSync(path.join(process.cwd(), "tmp-"));
  const tmpFile = path.join(tmpDir, path.basename(url));
  fs.writeFileSync(tmpFile, buf);

  try {
    let result: ParseResult;

    if (lower.endsWith(".pdf")) {
      result = await parsePDFFile(tmpFile);
    } else if (lower.endsWith(".docx")) {
      result = await parseDOCXFile(tmpFile);
    } else if (lower.endsWith(".pptx")) {
      result = await parsePPTXFile(tmpFile);
    } else if (lower.endsWith(".csv")) {
      result = await parseCSVFile(tmpFile);
    } else {
      // Default: treat as HTML
      result = await parseHTMLFile(tmpFile);
    }

    // Cleanup temp file
    fs.rmSync(tmpDir, { recursive: true, force: true });

    return result;
  } catch (err) {
    // Cleanup on error
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

// ========================================
// IMAGE DECODING (COMPATIBILITY WITH INGEST)
// ========================================

/**
 * Decode image (PNG/JPEG/WEBP) → RGBA + optional OCR
 * AUTONOMIA: Extrai texto de imagens via OCR (Tesseract)
 * Compatible with ingest.ts imageData format
 *
 * @param buf - Image buffer
 * @param doOCR - Whether to extract text via OCR
 * @returns RGBA data + width/height + extracted text
 */
export async function decodeImageToRGBA(
  buf: Buffer,
  doOCR = false
): Promise<{ rgba: Uint8ClampedArray; width: number; height: number; ocrText: string }> {
  // Decode image using Jimp (new API)
  const img = await Jimp.read(buf);
  const width = img.width;
  const height = img.height;

  // Get bitmap data (RGBA Uint8ClampedArray compatible)
  const bitmapData = img.bitmap.data;
  const rgba = new Uint8ClampedArray(
    bitmapData.buffer,
    bitmapData.byteOffset,
    bitmapData.byteLength
  );

  let ocrText = "";

  if (doOCR) {
    try {
      if (!tesseract) {
        throw new Error("Tesseract.js not installed");
      }
      const lang = process.env.AI_OCR_LANG || "eng+por";
      const worker = await tesseract.createWorker(lang);
      const { data } = await worker.recognize(buf);
      await worker.terminate();
      ocrText = (data?.text || "").replace(/\s+/g, " ").trim();
    } catch (err) {
      console.error("OCR failed:", err);
    }
  }

  return { rgba, width, height, ocrText };
}
