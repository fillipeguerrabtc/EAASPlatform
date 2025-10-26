/**
 * Federated Learning with Differential Privacy
 * Based on EAAS Whitepaper 02 - Chapter 15 + Appendix F
 * 
 * Mathematical Foundation:
 * ========================
 * 
 * 1. DP-SGD (Differentially Private Stochastic Gradient Descent):
 *    wₖᵗ⁺¹ = wₖᵗ - η × (1/|B| ∑ clip(∇ℓ(x),C) + N(0,σ²))
 * 
 *    where:
 *    - wₖᵗ = model weights for tenant k at timestep t
 *    - η = learning rate (e.g. 0.01)
 *    - B = mini-batch of training examples
 *    - clip(g,C) = min(1, C/||g||₂) × g (gradient clipping for privacy)
 *    - C = clipping threshold (e.g. 1.0)
 *    - N(0,σ²) = Gaussian noise with std σ (e.g. σ = 0.1)
 * 
 * 2. Secure Aggregation (across tenants):
 *    θ_global ← ∑ₖ (nₖ/N) × θₖ + N(0,σ²_agg)
 * 
 *    where:
 *    - θₖ = local model from tenant k
 *    - nₖ = number of samples from tenant k
 *    - N = total samples across all tenants
 *    - σ²_agg = aggregation noise for privacy
 * 
 * 3. Privacy Guarantee (ε-DP):
 *    Privacy budget: ε = (q × T × C²) / (2σ²N)
 * 
 *    where:
 *    - q = sampling ratio = |B|/n
 *    - T = number of epochs
 *    - ε < 1.0 is considered strong privacy
 *    - ε < 10.0 is acceptable
 * 
 * Purpose:
 * - Learn from multiple tenants without sharing raw data
 * - Preserve privacy via DP-SGD (adds calibrated noise)
 * - Aggregate knowledge while preventing information leakage
 * - Enable collaborative learning in multi-tenant environment
 */

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Model Weights (θ or w)
 */
export interface ModelWeights {
  id: string;
  tenantId: string;
  
  // Weights as vector
  weights: number[];
  
  // Metadata
  version: number;
  trainedSamples: number;
  lastUpdated: Date;
  
  // Privacy tracking
  privacyBudget: number;  // ε consumed
  noiseStd: number;       // σ used
}

/**
 * Training Batch
 */
export interface TrainingBatch {
  samples: Array<{
    input: number[];      // Feature vector
    target: number;       // Target value
  }>;
  
  // Metadata
  tenantId: string;
  timestamp: Date;
}

/**
 * Gradient (∇ℓ)
 */
export interface Gradient {
  values: number[];
  norm: number;         // ||∇ℓ||₂
  clipped: boolean;     // Was gradient clipped?
}

/**
 * DP-SGD Configuration
 */
export interface DPSGDConfig {
  // Learning
  learningRate: number;       // η (default: 0.01)
  batchSize: number;          // |B| (default: 32)
  
  // Privacy
  clippingThreshold: number;  // C (default: 1.0)
  noiseStd: number;           // σ (default: 0.1)
  
  // Privacy Budget
  targetEpsilon: number;      // ε (default: 1.0)
  maxEpochs: number;          // Max training rounds
}

/**
 * Federated Aggregation Config
 */
export interface FederatedConfig {
  // Aggregation
  aggregationNoiseStd: number;  // σ_agg (default: 0.05)
  minTenants: number;           // Minimum participants (default: 3)
  
  // Model
  modelDimension: number;       // Size of weight vector
}

/**
 * Training Result
 */
export interface TrainingResult {
  tenantId: string;
  initialWeights: number[];
  finalWeights: number[];
  
  // Training metrics
  iterations: number;
  loss: number;
  
  // Privacy
  privacySpent: number;  // ε consumed
  noiseAdded: number;    // σ used
  
  // Metadata
  trainTime: number;     // ms
}

/**
 * Aggregation Result
 */
export interface AggregationResult {
  globalWeights: number[];
  
  // Participants
  numTenants: number;
  totalSamples: number;
  tenantContributions: Array<{
    tenantId: string;
    weight: number;  // nₖ/N
  }>;
  
  // Privacy
  aggregationNoise: number;
  
  // Metadata
  aggregationTime: number;
  timestamp: Date;
}

// ========================================
// DEFAULT CONFIGURATION
// ========================================

export const DEFAULT_DPSGD_CONFIG: DPSGDConfig = {
  learningRate: 0.01,
  batchSize: 32,
  clippingThreshold: 1.0,
  noiseStd: 0.1,
  targetEpsilon: 1.0,
  maxEpochs: 100,
};

export const DEFAULT_FEDERATED_CONFIG: FederatedConfig = {
  aggregationNoiseStd: 0.05,
  minTenants: 3,
  modelDimension: 10, // Example: 10-dimensional model
};

// ========================================
// VECTOR OPERATIONS
// ========================================

/**
 * Calculate L2 norm ||v||₂
 */
function l2Norm(v: number[]): number {
  const sumSquares = v.reduce((sum, x) => sum + x * x, 0);
  return Math.sqrt(sumSquares);
}

/**
 * Clip gradient to threshold
 * 
 * clip(g, C) = min(1, C/||g||₂) × g
 */
function clipGradient(gradient: number[], C: number): Gradient {
  const norm = l2Norm(gradient);
  
  if (norm <= C) {
    // No clipping needed
    return {
      values: [...gradient],
      norm,
      clipped: false,
    };
  }
  
  // Clip: scale down to C
  const scale = C / norm;
  const clippedValues = gradient.map(g => g * scale);
  
  return {
    values: clippedValues,
    norm: C,
    clipped: true,
  };
}

/**
 * Add Gaussian noise N(0, σ²) to vector
 */
function addGaussianNoise(v: number[], sigma: number): number[] {
  return v.map(x => x + gaussianRandom(0, sigma));
}

/**
 * Generate Gaussian random number N(μ, σ)
 * Using Box-Muller transform
 */
function gaussianRandom(mu: number = 0, sigma: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mu + sigma * z0;
}

/**
 * Vector addition
 */
function vectorAdd(a: number[], b: number[]): number[] {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} != ${b.length}`);
  }
  return a.map((x, i) => x + b[i]);
}

/**
 * Vector subtraction
 */
function vectorSub(a: number[], b: number[]): number[] {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} != ${b.length}`);
  }
  return a.map((x, i) => x - b[i]);
}

/**
 * Scalar multiplication
 */
function scalarMul(scalar: number, v: number[]): number[] {
  return v.map(x => scalar * x);
}

// ========================================
// LOSS & GRADIENT COMPUTATION
// ========================================

/**
 * Simple loss function (MSE for regression)
 * ℓ(x,y;w) = (f(x;w) - y)²
 */
function computeLoss(
  weights: number[],
  input: number[],
  target: number
): number {
  // Linear model: f(x;w) = w⊤x
  const prediction = dotProduct(weights, input);
  const error = prediction - target;
  return error * error;
}

/**
 * Compute gradient ∇ℓ
 * For MSE: ∇ℓ = 2(w⊤x - y)x
 */
function computeGradient(
  weights: number[],
  input: number[],
  target: number
): number[] {
  // Prediction
  const prediction = dotProduct(weights, input);
  const error = prediction - target;
  
  // Gradient: 2 * error * input
  return input.map(x => 2 * error * x);
}

/**
 * Dot product
 */
function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} != ${b.length}`);
  }
  return a.reduce((sum, x, i) => sum + x * b[i], 0);
}

// ========================================
// DP-SGD ALGORITHM
// ========================================

/**
 * Single DP-SGD update step
 * 
 * wₖᵗ⁺¹ = wₖᵗ - η × (1/|B| ∑ clip(∇ℓ(x),C) + N(0,σ²))
 */
export function dpsgdUpdate(
  weights: number[],
  batch: TrainingBatch,
  config: DPSGDConfig
): {
  newWeights: number[];
  avgGradient: number[];
  noisyGradient: number[];
  clippedCount: number;
} {
  const { learningRate, clippingThreshold, noiseStd } = config;
  
  // 1. Compute gradients for each sample
  const gradients: Gradient[] = [];
  let clippedCount = 0;
  
  for (const sample of batch.samples) {
    // Compute raw gradient
    const rawGradient = computeGradient(weights, sample.input, sample.target);
    
    // Clip gradient
    const clipped = clipGradient(rawGradient, clippingThreshold);
    gradients.push(clipped);
    
    if (clipped.clipped) {
      clippedCount++;
    }
  }
  
  // 2. Average clipped gradients: (1/|B|) ∑ clip(∇ℓ(x),C)
  const avgGradient = gradients
    .reduce(
      (sum, g) => vectorAdd(sum, g.values),
      new Array(weights.length).fill(0)
    )
    .map(x => x / batch.samples.length);
  
  // 3. Add Gaussian noise: N(0,σ²)
  const noisyGradient = addGaussianNoise(avgGradient, noiseStd);
  
  // 4. Update weights: wₖᵗ⁺¹ = wₖᵗ - η × noisyGradient
  const newWeights = vectorSub(weights, scalarMul(learningRate, noisyGradient));
  
  return {
    newWeights,
    avgGradient,
    noisyGradient,
    clippedCount,
  };
}

/**
 * Train model with DP-SGD
 * 
 * Main entry point for private training
 */
export function trainWithDPSGD(
  initialWeights: number[],
  batches: TrainingBatch[],
  config: DPSGDConfig
): TrainingResult {
  const startTime = Date.now();
  
  let weights = [...initialWeights];
  let totalClipped = 0;
  let totalLoss = 0;
  
  // Train for multiple epochs
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // DP-SGD update
    const result = dpsgdUpdate(weights, batch, config);
    weights = result.newWeights;
    totalClipped += result.clippedCount;
    
    // Calculate loss (for monitoring)
    let batchLoss = 0;
    for (const sample of batch.samples) {
      batchLoss += computeLoss(weights, sample.input, sample.target);
    }
    totalLoss += batchLoss / batch.samples.length;
    
    if (i % 10 === 0) {
      console.info(
        `[DP-SGD] Batch ${i}/${batches.length}: ` +
        `loss=${(batchLoss / batch.samples.length).toFixed(4)}, ` +
        `clipped=${result.clippedCount}/${batch.samples.length}`
      );
    }
  }
  
  // Calculate privacy budget consumed
  const samplingRatio = config.batchSize / (batches.length * config.batchSize);
  const epochs = 1; // Single pass through data
  const privacySpent = calculatePrivacyBudget(
    samplingRatio,
    epochs,
    config.clippingThreshold,
    config.noiseStd,
    batches.length * config.batchSize
  );
  
  console.info(
    `[DP-SGD] Training complete: ` +
    `loss=${(totalLoss / batches.length).toFixed(4)}, ` +
    `ε=${privacySpent.toFixed(3)}, ` +
    `time=${Date.now() - startTime}ms`
  );
  
  return {
    tenantId: batches[0]?.tenantId || "unknown",
    initialWeights,
    finalWeights: weights,
    iterations: batches.length,
    loss: totalLoss / batches.length,
    privacySpent,
    noiseAdded: config.noiseStd,
    trainTime: Date.now() - startTime,
  };
}

// ========================================
// PRIVACY BUDGET CALCULATION
// ========================================

/**
 * Calculate privacy budget (ε) consumed
 * 
 * ε = (q × T × C²) / (2σ²N)
 * 
 * where:
 * - q = sampling ratio = |B|/n
 * - T = number of epochs
 * - C = clipping threshold
 * - σ = noise std
 * - N = dataset size
 */
export function calculatePrivacyBudget(
  samplingRatio: number,  // q
  epochs: number,         // T
  clipping: number,       // C
  noisestd: number,      // σ
  datasetSize: number    // N
): number {
  const q = samplingRatio;
  const T = epochs;
  const C = clipping;
  const sigma = noisestd;
  const N = datasetSize;
  
  // ε = (q × T × C²) / (2σ²N)
  const epsilon = (q * T * C * C) / (2 * sigma * sigma * N);
  
  return epsilon;
}

/**
 * Check if privacy budget is acceptable
 */
export function checkPrivacyBudget(epsilon: number): {
  acceptable: boolean;
  category: "strong" | "good" | "acceptable" | "weak" | "poor";
  warning?: string;
} {
  if (epsilon < 0.1) {
    return { acceptable: true, category: "strong" };
  } else if (epsilon < 1.0) {
    return { acceptable: true, category: "good" };
  } else if (epsilon < 5.0) {
    return { acceptable: true, category: "acceptable" };
  } else if (epsilon < 10.0) {
    return {
      acceptable: false,
      category: "weak",
      warning: "Privacy guarantee is weak (ε > 5.0)",
    };
  } else {
    return {
      acceptable: false,
      category: "poor",
      warning: "Privacy guarantee is poor (ε > 10.0), consider increasing noise",
    };
  }
}

// ========================================
// FEDERATED AGGREGATION
// ========================================

/**
 * Aggregate models from multiple tenants
 * 
 * θ_global ← ∑ₖ (nₖ/N) × θₖ + N(0,σ²_agg)
 */
export function aggregateModels(
  tenantModels: Array<{
    tenantId: string;
    weights: number[];
    numSamples: number;
  }>,
  config: FederatedConfig
): AggregationResult {
  const startTime = Date.now();
  
  // Check minimum participants
  if (tenantModels.length < config.minTenants) {
    throw new Error(
      `Insufficient participants: ${tenantModels.length} < ${config.minTenants}`
    );
  }
  
  // Calculate total samples
  const totalSamples = tenantModels.reduce((sum, m) => sum + m.numSamples, 0);
  
  // Weighted average: ∑ₖ (nₖ/N) × θₖ
  let globalWeights = new Array(config.modelDimension).fill(0);
  
  const contributions: AggregationResult["tenantContributions"] = [];
  
  for (const model of tenantModels) {
    const weight = model.numSamples / totalSamples; // nₖ/N
    
    // Add weighted contribution
    const weightedModel = scalarMul(weight, model.weights);
    globalWeights = vectorAdd(globalWeights, weightedModel);
    
    contributions.push({
      tenantId: model.tenantId,
      weight,
    });
    
    console.info(
      `[Federated] ${model.tenantId}: weight=${weight.toFixed(3)} ` +
      `(${model.numSamples}/${totalSamples} samples)`
    );
  }
  
  // Add aggregation noise for privacy: N(0,σ²_agg)
  globalWeights = addGaussianNoise(globalWeights, config.aggregationNoiseStd);
  
  console.info(
    `[Federated] Aggregation complete: ${tenantModels.length} tenants, ` +
    `${totalSamples} samples, σ_agg=${config.aggregationNoiseStd}`
  );
  
  return {
    globalWeights,
    numTenants: tenantModels.length,
    totalSamples,
    tenantContributions: contributions,
    aggregationNoise: config.aggregationNoiseStd,
    aggregationTime: Date.now() - startTime,
    timestamp: new Date(),
  };
}

// ========================================
// UTILITIES
// ========================================

/**
 * Initialize random weights
 */
export function initializeWeights(dimension: number): number[] {
  return Array(dimension)
    .fill(0)
    .map(() => gaussianRandom(0, 0.1)); // Small random initialization
}

/**
 * Create synthetic training batch (for testing)
 */
export function createSyntheticBatch(
  tenantId: string,
  batchSize: number,
  inputDim: number
): TrainingBatch {
  const samples = [];
  
  for (let i = 0; i < batchSize; i++) {
    // Random input
    const input = Array(inputDim)
      .fill(0)
      .map(() => Math.random() * 2 - 1); // [-1, 1]
    
    // Target: simple linear function + noise
    const target = input.reduce((sum, x) => sum + x, 0) + gaussianRandom(0, 0.1);
    
    samples.push({ input, target });
  }
  
  return {
    samples,
    tenantId,
    timestamp: new Date(),
  };
}

/**
 * Export training results
 */
export function exportTrainingResults(result: TrainingResult): string {
  return JSON.stringify({
    tenantId: result.tenantId,
    loss: result.loss,
    privacySpent: result.privacySpent,
    iterations: result.iterations,
    trainTime: result.trainTime,
    privacyCheck: checkPrivacyBudget(result.privacySpent),
  }, null, 2);
}
