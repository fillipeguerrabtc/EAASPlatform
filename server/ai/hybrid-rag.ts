/**
 * Hybrid RAG Scoring System
 * Based on EAAS Whitepaper 02 - Appendix B
 * 
 * Mathematical Foundation:
 * S(x,q) = α·S_vetor(x,q) + β·S_bm25(x,q) + γ·S_grafo(x,q) + δ·S_fresco(x) + ζ·S_autoridade(x)
 * 
 * where α+β+γ+δ+ζ=1 (normalized weights)
 * 
 * Components:
 * 1. Vector Similarity - semantic understanding (cosine similarity)
 * 2. BM25 - lexical matching (term frequency with saturation)
 * 3. Graph - semantic relationships between concepts
 * 4. Freshness - temporal decay (prefers recent content)
 * 5. Authority - source credibility weighting
 */

export interface KnowledgeBaseItem {
  id: number;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  isVerified?: boolean;
  source?: string;
}

export interface ScoredKBItem {
  item: KnowledgeBaseItem;
  score: number;
  breakdown: {
    vector: number;
    bm25: number;
    graph: number;
    freshness: number;
    authority: number;
  };
}

/**
 * Component 1: Vector Similarity (Cosine Similarity)
 * 
 * S_vetor(x,q) = (v_x · v_q) / (||v_x|| ||v_q||)
 * 
 * For now, uses simple word overlap as proxy for semantic similarity
 * TODO: Replace with actual embeddings (OpenAI ada-002 or local BERT)
 */
function vectorSimilarity(query: string, document: string): number {
  const queryTokens = tokenize(query.toLowerCase());
  const docTokens = tokenize(document.toLowerCase());
  
  const querySet = new Set(queryTokens);
  const docSet = new Set(docTokens);
  
  // Jaccard similarity as simple approximation
  const intersection = new Set(Array.from(querySet).filter(x => docSet.has(x)));
  const union = new Set([...Array.from(querySet), ...Array.from(docSet)]);
  
  return intersection.size / Math.max(union.size, 1);
}

/**
 * Component 2: BM25 Scoring
 * 
 * From whitepaper:
 * S_bm25(x,q) = Σ w_t · (f_t,x · (k1+1)) / (f_t,x + k1·(1-b+b·|x|/avgdl))
 * 
 * where:
 * - k1 ≈ 1.2 (saturation parameter)
 * - b ≈ 0.75 (length normalization)
 * - w_t = IDF weight
 */
function bm25Score(
  query: string,
  document: string,
  corpus: KnowledgeBaseItem[],
  avgDocLength: number
): number {
  const k1 = 1.2;
  const b = 0.75;
  
  const queryTokens = tokenize(query.toLowerCase());
  const docTokens = tokenize(document.toLowerCase());
  const docLength = docTokens.length;
  
  let score = 0;
  
  for (const term of queryTokens) {
    // Calculate IDF
    const docsWithTerm = corpus.filter(item => 
      tokenize(item.content.toLowerCase()).includes(term)
    ).length;
    
    const N = corpus.length;
    const idf = Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5));
    
    // Calculate term frequency in document
    const termFreq = docTokens.filter(t => t === term).length;
    
    // BM25 formula
    const numerator = termFreq * (k1 + 1);
    const denominator = termFreq + k1 * (1 - b + b * (docLength / avgDocLength));
    
    score += idf * (numerator / denominator);
  }
  
  // Normalize to [0,1]
  return Math.tanh(score / 5); // tanh provides smooth saturation
}

/**
 * Component 3: Graph Similarity (Simplified PageRank)
 * 
 * From whitepaper:
 * S_grafo(vi) = (1-κ)e_i + κ Σ S_grafo(vj)/deg(vj)
 * 
 * For now, uses category/tag overlap as graph structure
 * TODO: Build actual knowledge graph with entity relationships
 */
function graphScore(query: string, item: KnowledgeBaseItem, corpus: KnowledgeBaseItem[]): number {
  // Simple implementation: score based on category/tag relevance
  let score = 0.5; // Base score
  
  const queryLower = query.toLowerCase();
  
  // Boost if category matches query
  if (item.category && queryLower.includes(item.category.toLowerCase())) {
    score += 0.3;
  }
  
  // Boost if tags match query
  if (item.tags && Array.isArray(item.tags)) {
    const matchingTags = item.tags.filter(tag => 
      queryLower.includes(tag.toLowerCase())
    );
    score += matchingTags.length * 0.1;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Component 4: Freshness Score
 * 
 * From whitepaper:
 * S_fresco(x) = e^(-λt)
 * 
 * where t = days since last update, λ = decay rate
 */
function freshnessScore(updatedAt: Date, decayRate: number = 0.01): number {
  const now = new Date();
  const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  
  return Math.exp(-decayRate * daysSinceUpdate);
}

/**
 * Component 5: Authority Score
 * 
 * From whitepaper:
 * S_autoridade(x) = tanh(η·A(x))
 * 
 * Based on verification status and source credibility
 */
function authorityScore(item: KnowledgeBaseItem): number {
  let score = 0.5; // Base authority
  
  // Boost for verified content
  if (item.isVerified) {
    score += 0.3;
  }
  
  // Boost for official sources
  if (item.source && (item.source.includes('oficial') || item.source.includes('docs'))) {
    score += 0.2;
  }
  
  return Math.tanh(score); // Smooth saturation
}

/**
 * Utility: Tokenize text
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2); // Remove very short tokens
}

/**
 * Master Hybrid RAG Scorer
 * 
 * Combines all components with configurable weights
 */
export interface HybridRAGConfig {
  weights: {
    vector: number;    // α
    bm25: number;      // β  
    graph: number;     // γ
    freshness: number; // δ
    authority: number; // ζ
  };
}

const DEFAULT_CONFIG: HybridRAGConfig = {
  weights: {
    vector: 0.35,    // Semantic understanding most important
    bm25: 0.25,      // Lexical matching second
    graph: 0.15,     // Relationships moderate
    freshness: 0.15, // Recency moderate
    authority: 0.10, // Authority least (for now)
  }
};

/**
 * Search Knowledge Base with Hybrid Scoring
 * 
 * Returns top-k results ranked by hybrid score
 */
export function searchKnowledgeBase(
  query: string,
  corpus: KnowledgeBaseItem[],
  config: HybridRAGConfig = DEFAULT_CONFIG,
  topK: number = 5
): ScoredKBItem[] {
  if (corpus.length === 0) {
    return [];
  }

  // Validate weights sum to 1
  const weightsSum = Object.values(config.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightsSum - 1.0) > 0.01) {
    console.warn(`Hybrid RAG weights sum to ${weightsSum}, normalizing...`);
    const factor = 1.0 / weightsSum;
    Object.keys(config.weights).forEach(key => {
      (config.weights as any)[key] *= factor;
    });
  }

  // Calculate average document length for BM25
  const avgDocLength = corpus.reduce((sum, item) => 
    sum + tokenize(item.content).length, 0
  ) / corpus.length;

  // Score all items
  const scored: ScoredKBItem[] = corpus.map(item => {
    const combinedText = `${item.title} ${item.content}`;
    
    const scores = {
      vector: vectorSimilarity(query, combinedText),
      bm25: bm25Score(query, combinedText, corpus, avgDocLength),
      graph: graphScore(query, item, corpus),
      freshness: freshnessScore(item.updatedAt),
      authority: authorityScore(item),
    };

    // Hybrid score: weighted sum
    const hybridScore = 
      config.weights.vector * scores.vector +
      config.weights.bm25 * scores.bm25 +
      config.weights.graph * scores.graph +
      config.weights.freshness * scores.freshness +
      config.weights.authority * scores.authority;

    return {
      item,
      score: hybridScore,
      breakdown: scores,
    };
  });

  // Sort by score descending and return top-k
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Get Best Match with Threshold
 * 
 * Returns best match only if score exceeds minimum threshold
 * This prevents low-confidence matches from being used
 */
export function getBestMatch(
  query: string,
  corpus: KnowledgeBaseItem[],
  minThreshold: number = 0.3,
  config?: HybridRAGConfig
): ScoredKBItem | null {
  const results = searchKnowledgeBase(query, corpus, config, 1);
  
  if (results.length === 0 || results[0].score < minThreshold) {
    return null;
  }
  
  return results[0];
}
