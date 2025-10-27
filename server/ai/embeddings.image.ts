// server/ai/embeddings.image.ts
// Image embeddings using ONNX (MobileNet or ViT)
// Supports RGB images with Global Average Pooling

import * as ort from "onnxruntime-node";
import fs from "fs";
import path from "path";

const MODEL_PATH =
  process.env.AI_VISION_MODEL_PATH ||
  path.resolve(process.cwd(), "models", "mobilenet.onnx");
const LABELS_PATH =
  process.env.AI_VISION_LABELS ||
  path.resolve(process.cwd(), "models", "imagenet_labels.json");
const VISION_DIM = Number(process.env.AI_VISION_DIM || 1024);

let session: ort.InferenceSession | null = null;
let labels: string[] | null = null;

/**
 * Ensure vision session is initialized
 */
export async function ensureVisionSession(): Promise<ort.InferenceSession> {
  if (session) return session;
  
  session = await ort.InferenceSession.create(MODEL_PATH, {
    executionProviders: ["cpu"]
  });
  
  try {
    labels = JSON.parse(fs.readFileSync(LABELS_PATH, "utf8"));
  } catch {
    labels = null;
  }
  
  return session;
}

/**
 * Preprocess image RGB uint8 → float32 (NCHW, normalization [0,1])
 * Note: For production, resize/pad to model's expected dimensions (e.g., 224x224)
 */
export function preprocessImageRGB(
  imageData: Uint8ClampedArray,
  width: number,
  height: number
): ort.Tensor {
  const C = 3;
  const W = width;
  const H = height;
  const out = new Float32Array(1 * C * H * W);
  
  // NCHW format
  let idx = 0;
  let o = 0;
  
  // Channel R
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      out[o++] = imageData[idx] / 255;
      idx += 4; // Skip G, B, A
    }
  }
  
  // Channel G
  idx = 1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      out[o++] = imageData[(y * W + x) * 4 + 1] / 255;
    }
  }
  
  // Channel B
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      out[o++] = imageData[(y * W + x) * 4 + 2] / 255;
    }
  }
  
  return new ort.Tensor("float32", out, [1, C, H, W]);
}

/**
 * L2 normalization
 */
function l2(v: number[]): number[] {
  let n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / n);
}

/**
 * Generate image embeddings using ONNX
 * @param batchTensors - Array of preprocessed image tensors
 * @returns Array of embedding vectors
 */
export async function embedImages(batchTensors: ort.Tensor[]): Promise<number[][]> {
  const sess = await ensureVisionSession();
  const vecs: number[][] = [];
  
  for (const tensor of batchTensors) {
    // Run inference (adjust input name based on your ONNX model)
    const out = await sess.run({ input: tensor });
    
    // Strategy: find embedding tensor
    // - "embedding" or "pooled_output" (2D)
    // - or "features" (4D) → apply GAP (global average pooling)
    const key = Object.keys(out)[0];
    const t = out[key];
    
    if (!t) {
      throw new Error("Saída da rede de visão não encontrada.");
    }
    
    const data = t.data as Float32Array;
    
    if (t.dims.length === 2) {
      // (1, D) - direct embedding
      vecs.push(l2(Array.from(data)));
    } else if (t.dims.length === 4) {
      // (1, C, H, W) - apply GAP over H×W
      const [N, C, H, W] = t.dims as number[];
      const pooled = new Array(C).fill(0);
      
      for (let c = 0; c < C; c++) {
        let sum = 0;
        for (let i = 0; i < H * W; i++) {
          sum += data[c * H * W + i];
        }
        pooled[c] = sum / (H * W);
      }
      
      vecs.push(l2(pooled));
    } else {
      throw new Error("Formato de saída de visão não suportado.");
    }
  }
  
  return vecs;
}

/**
 * Get top K labels from logits (for debugging/QA)
 */
export function topLabels(logits: Float32Array, k = 5): string[] {
  if (!labels) return [];
  
  const indexed = Array.from(logits)
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(o => labels![o.i]);
  
  return indexed;
}
