// server/ai/hybrid-score.ts
// Hybrid RAG scoring system with 5 weighted components (α/β/γ/δ/ζ)
// Based on EAAS Whitepaper 02 mathematics

/**
 * Hybrid scoring weights (sum = 1.0)
 * α = vector similarity (cosine)
 * β = graph centrality (PageRank)
 * γ = temporal recency
 * δ = user feedback (likes/dislikes)
 * ζ = semantic diversity penalty
 */
export type HybridWeights = {
  alpha: number;   // Vector similarity weight (default: 0.40)
  beta: number;    // Graph centrality weight (default: 0.25)
  gamma: number;   // Temporal recency weight (default: 0.15)
  delta: number;   // User feedback weight (default: 0.15)
  zeta: number;    // Diversity penalty weight (default: 0.05)
};

export const DEFAULT_WEIGHTS: HybridWeights = {
  alpha: 0.40,
  beta: 0.25,
  gamma: 0.15,
  delta: 0.15,
  zeta: 0.05
};

/**
 * Candidate chunk with raw scores
 */
export type Candidate = {
  chunkId: string;
  vectorScore: number;      // Cosine similarity [0, 1]
  graphScore?: number;      // PageRank centrality [0, 1]
  createdAt: Date;          // Timestamp
  feedbackScore?: number;   // Normalized user feedback [0, 1]
};

/**
 * Scored result with final hybrid score
 */
export type ScoredResult = {
  chunkId: string;
  finalScore: number;       // Weighted hybrid score [0, 1]
  breakdown: {
    vector: number;
    graph: number;
    temporal: number;
    feedback: number;
    diversity: number;
  };
};

// ========================================
// COMPONENT SCORES
// ========================================

/**
 * α - Vector similarity score
 * Already normalized [0, 1] from cosine similarity
 */
function vectorScore(candidate: Candidate): number {
  return candidate.vectorScore;
}

/**
 * β - Graph centrality score
 * PageRank score normalized [0, 1]
 */
function graphScore(candidate: Candidate): number {
  return candidate.graphScore || 0;
}

/**
 * γ - Temporal recency score
 * Exponential decay: score = exp(-λ * age_days)
 * λ = 0.01 (half-life ~69 days)
 */
function temporalScore(candidate: Candidate): number {
  const now = new Date();
  const ageDays = (now.getTime() - candidate.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const lambda = Number(process.env.AI_TEMPORAL_LAMBDA || 0.01);
  return Math.exp(-lambda * ageDays);
}

/**
 * δ - User feedback score
 * Normalized from likes/dislikes [0, 1]
 */
function feedbackScore(candidate: Candidate): number {
  return candidate.feedbackScore || 0;
}

/**
 * ζ - Semantic diversity penalty
 * Reduces score if candidate is too similar to already selected results
 * MMR-style diversity: penalty = max(similarity to selected results)
 */
function diversityPenalty(
  candidate: Candidate,
  selected: Candidate[],
  vectors: Map<string, number[]>
): number {
  if (!selected.length) return 0;

  const candidateVec = vectors.get(candidate.chunkId);
  if (!candidateVec) return 0;

  let maxSim = 0;
  for (const sel of selected) {
    const selVec = vectors.get(sel.chunkId);
    if (!selVec) continue;

    const sim = cosineSimilarity(candidateVec, selVec);
    maxSim = Math.max(maxSim, sim);
  }

  return maxSim;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

// ========================================
// HYBRID SCORING
// ========================================

/**
 * Validate weights sum to 1.0 (with tolerance)
 */
function validateWeights(weights: HybridWeights) {
  const sum = weights.alpha + weights.beta + weights.gamma + weights.delta + weights.zeta;
  const tolerance = 0.01;

  if (Math.abs(sum - 1.0) > tolerance) {
    throw new Error(`Weights must sum to 1.0 (got ${sum.toFixed(3)})`);
  }
}

/**
 * Compute hybrid score for a single candidate
 * Score = α*vector + β*graph + γ*temporal + δ*feedback - ζ*diversity
 */
function computeScore(
  candidate: Candidate,
  weights: HybridWeights,
  selected: Candidate[],
  vectors: Map<string, number[]>
): ScoredResult {
  const v = vectorScore(candidate);
  const g = graphScore(candidate);
  const t = temporalScore(candidate);
  const f = feedbackScore(candidate);
  const d = diversityPenalty(candidate, selected, vectors);

  const finalScore =
    weights.alpha * v +
    weights.beta * g +
    weights.gamma * t +
    weights.delta * f -
    weights.zeta * d;

  return {
    chunkId: candidate.chunkId,
    finalScore: Math.max(0, Math.min(1, finalScore)), // Clamp [0, 1]
    breakdown: {
      vector: v,
      graph: g,
      temporal: t,
      feedback: f,
      diversity: d
    }
  };
}

/**
 * Re-rank candidates using hybrid scoring
 * Uses greedy MMR-style selection with diversity penalty
 *
 * @param candidates - Initial candidates from ANN kNN search
 * @param vectors - Map of chunkId -> embedding vector (for diversity)
 * @param k - Number of final results to return
 * @param weights - Hybrid scoring weights (optional, uses defaults)
 * @returns Top k scored results, sorted by finalScore descending
 */
export function hybridRerank(
  candidates: Candidate[],
  vectors: Map<string, number[]>,
  k: number,
  weights: HybridWeights = DEFAULT_WEIGHTS
): ScoredResult[] {
  validateWeights(weights);

  const results: ScoredResult[] = [];
  const remaining = [...candidates];
  const selected: Candidate[] = [];

  // Greedy selection: pick best candidate, update selected, repeat
  for (let i = 0; i < k && remaining.length > 0; i++) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    let bestResult: ScoredResult | null = null;

    // Score all remaining candidates
    for (let j = 0; j < remaining.length; j++) {
      const scored = computeScore(remaining[j], weights, selected, vectors);
      if (scored.finalScore > bestScore) {
        bestScore = scored.finalScore;
        bestIdx = j;
        bestResult = scored;
      }
    }

    if (!bestResult) break;

    // Move best candidate from remaining to selected
    results.push(bestResult);
    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return results;
}

/**
 * Simple hybrid scoring (no diversity penalty)
 * Use when diversity is not important or vectors not available
 */
export function hybridScoreSimple(
  candidates: Candidate[],
  weights: HybridWeights = DEFAULT_WEIGHTS
): ScoredResult[] {
  validateWeights(weights);

  return candidates.map(c => computeScore(c, weights, [], new Map()));
}
