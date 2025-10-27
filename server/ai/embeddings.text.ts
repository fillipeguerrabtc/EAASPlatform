// server/ai/embeddings.text.ts
// Text embeddings using ONNX (WordPiece tokenization + mean pooling)
// Model: sentence-transformers/all-MiniLM-L6-v2 or similar

import * as ort from "onnxruntime-node";
import fs from "fs";
import path from "path";

const MODEL_PATH = process.env.AI_EMB_MODEL_PATH || path.resolve(process.cwd(), "models", "minilm.onnx");
const VOCAB_PATH = process.env.AI_EMB_VOCAB_PATH || path.resolve(process.cwd(), "models", "vocab.txt");
const MAX_LEN = Number(process.env.AI_EMB_MAX_LEN || 128);

let session: ort.InferenceSession | null = null;
let vocab: Map<string, number> | null = null;

const CLS = "[CLS]";
const SEP = "[SEP]";
const PAD = "[PAD]";
const UNK = "[UNK]";

/**
 * Load vocab from vocab.txt file
 */
async function loadVocab(): Promise<Map<string, number>> {
  if (vocab) return vocab;
  
  const lines = fs.readFileSync(VOCAB_PATH, "utf8").split(/\r?\n/).filter(Boolean);
  const m = new Map<string, number>();
  
  lines.forEach((tok, idx) => m.set(tok, idx));
  
  // Validate required special tokens
  for (const t of [CLS, SEP, PAD, UNK]) {
    if (!m.has(t)) {
      throw new Error(`vocab.txt inválido — faltou ${t}`);
    }
  }
  
  vocab = m;
  return m;
}

/**
 * Basic tokenization (normalization + lowercasing)
 */
function basicTokenize(text: string): string[] {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\s.,-_]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * WordPiece tokenization
 */
function wordpiece(tokens: string[], vocab: Map<string, number>): number[] {
  const ids: number[] = [];
  const unkId = vocab.get(UNK)!;
  
  for (const token of tokens) {
    if (vocab.has(token)) {
      ids.push(vocab.get(token)!);
      continue;
    }
    
    // Try to split into subword pieces
    const chars = Array.from(token);
    let start = 0;
    const sub: number[] = [];
    
    while (start < chars.length) {
      let end = chars.length;
      let found: number | null = null;
      
      while (start < end) {
        let piece = chars.slice(start, end).join("");
        if (start > 0) piece = "##" + piece;
        
        const id = vocab.get(piece);
        if (id !== undefined) {
          found = id;
          break;
        }
        
        end--;
      }
      
      if (found === null) {
        // Could not tokenize - use UNK
        sub.length = 0;
        break;
      }
      
      sub.push(found);
      start = end;
    }
    
    ids.push(...(sub.length ? sub : [unkId]));
  }
  
  return ids;
}

/**
 * Pad or truncate sequence to max length
 */
function padTrunc(arr: number[], max: number, padId: number): number[] {
  if (arr.length > max) return arr.slice(0, max);
  if (arr.length < max) return arr.concat(Array(max - arr.length).fill(padId));
  return arr;
}

/**
 * Ensure ONNX session is initialized
 */
export async function ensureTextSession(): Promise<ort.InferenceSession> {
  if (session) return session;
  
  session = await ort.InferenceSession.create(MODEL_PATH, {
    executionProviders: ["cpu"]
  });
  
  await loadVocab();
  
  return session;
}

/**
 * Mean pooling over last_hidden_state with attention mask
 */
function meanPool(
  lastHidden: Float32Array,
  T: number,
  D: number,
  attn: number[]
): number[] {
  const out = new Float32Array(D);
  let denom = 0;
  
  for (let t = 0; t < T; t++) {
    if (!attn[t]) continue;
    denom++;
    
    const base = t * D;
    for (let d = 0; d < D; d++) {
      out[d] += lastHidden[base + d];
    }
  }
  
  if (denom === 0) denom = 1;
  
  for (let d = 0; d < D; d++) {
    out[d] /= denom;
  }
  
  // L2 normalization
  let n = 0;
  for (let d = 0; d < D; d++) {
    n += out[d] * out[d];
  }
  n = Math.sqrt(n) || 1;
  
  for (let d = 0; d < D; d++) {
    out[d] /= n;
  }
  
  return Array.from(out);
}

/**
 * Generate text embeddings using ONNX
 * @param texts - Array of texts to embed
 * @returns Array of embedding vectors (one per text)
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const sess = await ensureTextSession();
  const v = await loadVocab();
  
  const padId = v.get(PAD)!;
  const clsId = v.get(CLS)!;
  const sepId = v.get(SEP)!;
  
  const B = texts.length;
  const inputIds = new BigInt64Array(B * MAX_LEN);
  const attnMask = new BigInt64Array(B * MAX_LEN);
  const tokenTypeIds = new BigInt64Array(B * MAX_LEN); // All zeros for MiniLM
  
  for (let b = 0; b < B; b++) {
    const toks = wordpiece(basicTokenize(texts[b] || ""), v);
    const seq = [clsId, ...toks, sepId];
    const arr = padTrunc(seq, MAX_LEN, padId);
    
    for (let i = 0; i < MAX_LEN; i++) {
      const id = arr[i];
      inputIds[b * MAX_LEN + i] = BigInt(id);
      attnMask[b * MAX_LEN + i] = BigInt(id === padId ? 0 : 1);
      tokenTypeIds[b * MAX_LEN + i] = BigInt(0); // Segment A (no segment B)
    }
  }
  
  const out = await sess.run({
    input_ids: new ort.Tensor("int64", inputIds, [B, MAX_LEN]),
    attention_mask: new ort.Tensor("int64", attnMask, [B, MAX_LEN]),
    token_type_ids: new ort.Tensor("int64", tokenTypeIds, [B, MAX_LEN])
  });
  
  // Try last_hidden_state first (most common)
  if (out["last_hidden_state"]) {
    const t = out["last_hidden_state"] as ort.Tensor;
    const [BB, T, D] = t.dims as number[];
    const data = t.data as Float32Array;
    
    const vecs: number[][] = [];
    for (let b = 0; b < BB; b++) {
      const base = b * T * D;
      const attn = Array.from(attnMask.slice(b * MAX_LEN, b * MAX_LEN + MAX_LEN)).map(Number);
      vecs.push(meanPool(data.subarray(base, base + T * D), T, D, attn));
    }
    
    return vecs;
  }
  
  // Fallback: pooled_output (if model outputs it directly)
  if (out["pooled_output"]) {
    const t = out["pooled_output"] as ort.Tensor;
    const [BB, D] = t.dims as number[];
    const data = t.data as Float32Array;
    
    const vecs: number[][] = [];
    for (let b = 0; b < BB; b++) {
      const v = Array.from(data.subarray(b * D, (b + 1) * D));
      let n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      vecs.push(v.map(x => x / n));
    }
    
    return vecs;
  }
  
  throw new Error("Saídas do encoder ONNX não reconhecidas.");
}
