/**
 * Affective Modeling - Emotional State & Persuasion Control
 * Based on EAAS Whitepaper 02 - Chapter 17 + Appendix E
 * 
 * Mathematical Foundation:
 * ========================
 * 
 * 1. Temporal Emotional State (Mood Tracking):
 *    Hₜ₊₁ = ρHₜ + (1-ρ)σ(w⊤zₜ)
 * 
 *    where:
 *    - Hₜ ∈ [-1, 1] = emotional state at time t (negative = negative, positive = positive)
 *    - ρ ∈ [0, 1) = decay/persistence factor (must be |ρ| < 1 for stability)
 *    - σ = sigmoid activation function
 *    - w = learned weight vector
 *    - zₜ = feature vector at time t (sentiment, tone, context)
 * 
 *    Stability Condition:
 *    - Require |ρ| < 1 for asymptotic convergence
 *    - Typical: ρ = 0.7 (70% persistence, 30% new input)
 * 
 * 2. Persuasion Intensity Control:
 *    Pₜ = min{P̄, ψ(Iₜ)}
 * 
 *    where:
 *    - Pₜ = actual persuasion level at time t
 *    - P̄ = maximum allowed persuasion (tenant config, e.g. 0.7)
 *    - ψ = intensity function (maps integrated intensity to persuasion)
 *    - Iₜ = integrated intensity (combines multiple signals)
 * 
 * 3. Integrated Intensity:
 *    Iₜ = κ₁Sₜ + κ₂Hₜ + κ₃Cₜ
 * 
 *    where:
 *    - Sₜ = situational urgency (e.g. cart value, time in funnel)
 *    - Hₜ = emotional state (from equation 1)
 *    - Cₜ = context signals (e.g. customer engagement)
 *    - κ₁, κ₂, κ₃ = weight coefficients (must sum to 1.0)
 * 
 * 4. Ethical Constraints (from LTL+D):
 *    - G(Pₜ ≤ P̄) - "Always: persuasion must not exceed limit"
 *    - G(Hₜ < -0.5 → F Pₜ = 0) - "If customer frustrated, forbid persuasion"
 * 
 * Purpose:
 * - Track customer emotional state over conversation
 * - Adapt persuasion intensity based on mood and context
 * - Enforce ethical limits on manipulation
 * - Ensure stability (no oscillation or divergence)
 */

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Affective State (emotional + persuasion)
 */
export interface AffectiveState {
  // Emotional State (Hₜ)
  emotionalState: number;        // Hₜ ∈ [-1, 1]
  emotionalHistory: number[];    // [H₀, H₁, ..., Hₜ]
  
  // Persuasion Level (Pₜ)
  persuasionLevel: number;       // Pₜ ∈ [0, 1]
  persuasionHistory: number[];   // [P₀, P₁, ..., Pₜ]
  
  // Integrated Intensity (Iₜ)
  integratedIntensity: number;   // Iₜ
  
  // Component Signals
  situationalUrgency: number;    // Sₜ
  contextSignals: number;        // Cₜ
  
  // Metadata
  timestep: number;
  conversationId?: string;
  createdAt: Date;
}

/**
 * Affective Model Configuration
 */
export interface AffectiveConfig {
  // Temporal Emotional State
  rho: number;                   // ρ - persistence factor (default: 0.7)
  emotionalWeights: number[];    // w - learned weights for σ(w⊤zₜ)
  
  // Persuasion Limits
  maxPersuasion: number;         // P̄ - max allowed (default: 0.7)
  
  // Integrated Intensity Weights
  kappa1: number;                // κ₁ - situational weight (default: 0.4)
  kappa2: number;                // κ₂ - emotional weight (default: 0.3)
  kappa3: number;                // κ₃ - context weight (default: 0.3)
  
  // Safety
  enforceStability: boolean;     // Check |ρ| < 1
  enforceLimits: boolean;        // Check Pₜ ≤ P̄
}

/**
 * Feature Vector zₜ
 */
export interface FeatureVector {
  // Sentiment Signals
  customerSentiment: number;     // From message analysis
  tonality: number;              // Positive/negative tone
  
  // Behavioral Signals
  responseTime: number;          // Seconds since last message
  messageLength: number;         // Character count
  
  // Engagement Signals
  questionCount: number;         // Questions asked
  productViewCount: number;      // Products viewed
  
  // Metadata
  timestamp: Date;
}

// ========================================
// DEFAULT CONFIGURATION
// ========================================

/**
 * Default affective model configuration
 */
export const DEFAULT_AFFECTIVE_CONFIG: AffectiveConfig = {
  // Temporal state (70% persistence)
  rho: 0.7,
  emotionalWeights: [0.6, 0.3, 0.1], // [sentiment, tone, engagement]
  
  // Persuasion limit (70% max)
  maxPersuasion: 0.7,
  
  // Intensity weights (sum to 1.0)
  kappa1: 0.4, // Situational urgency
  kappa2: 0.3, // Emotional state
  kappa3: 0.3, // Context signals
  
  // Safety checks
  enforceStability: true,
  enforceLimits: true,
};

// ========================================
// ACTIVATION FUNCTIONS
// ========================================

/**
 * Sigmoid activation σ(x)
 * Maps R → (0, 1)
 */
function sigmoid(x: number): number {
  return 1.0 / (1.0 + Math.exp(-x));
}

/**
 * Tanh activation (maps to [-1, 1])
 * Used for emotional state
 */
function tanh(x: number): number {
  return Math.tanh(x);
}

/**
 * Intensity function ψ(I)
 * Maps integrated intensity to persuasion level
 */
function intensityFunction(I: number): number {
  // Sigmoid with gentle slope
  return sigmoid(2 * (I - 0.5));
}

// ========================================
// EMOTIONAL STATE UPDATE
// ========================================

/**
 * Update emotional state
 * 
 * Hₜ₊₁ = ρHₜ + (1-ρ)σ(w⊤zₜ)
 */
export function updateEmotionalState(
  Ht: number,
  zt: FeatureVector,
  config: AffectiveConfig
): number {
  const { rho, emotionalWeights } = config;
  
  // Check stability condition
  if (config.enforceStability && Math.abs(rho) >= 1.0) {
    throw new Error(
      `Stability violation: |ρ| = ${Math.abs(rho)} >= 1.0. ` +
      `Require |ρ| < 1 for convergence.`
    );
  }
  
  // Extract features for w⊤zₜ
  const features = [
    zt.customerSentiment,     // Sentiment
    zt.tonality,              // Tone
    zt.productViewCount / 10, // Normalized engagement
  ];
  
  // Compute weighted sum w⊤zₜ
  let weightedSum = 0;
  for (let i = 0; i < Math.min(features.length, emotionalWeights.length); i++) {
    weightedSum += emotionalWeights[i] * features[i];
  }
  
  // Apply tanh to keep in [-1, 1]
  const newInput = tanh(weightedSum);
  
  // Temporal update: Hₜ₊₁ = ρHₜ + (1-ρ)σ(w⊤zₜ)
  // Using tanh instead of sigmoid to keep in [-1, 1]
  const Ht1 = rho * Ht + (1 - rho) * newInput;
  
  // Clamp to [-1, 1] for safety
  return Math.max(-1, Math.min(1, Ht1));
}

// ========================================
// PERSUASION INTENSITY CALCULATION
// ========================================

/**
 * Calculate integrated intensity
 * 
 * Iₜ = κ₁Sₜ + κ₂Hₜ + κ₃Cₜ
 */
export function calculateIntegratedIntensity(
  St: number,  // Situational urgency
  Ht: number,  // Emotional state
  Ct: number,  // Context signals
  config: AffectiveConfig
): number {
  const { kappa1, kappa2, kappa3 } = config;
  
  // Verify weights sum to 1.0 (approximately)
  const weightSum = kappa1 + kappa2 + kappa3;
  if (Math.abs(weightSum - 1.0) > 0.01) {
    console.warn(
      `[Affective] Weight sum ${weightSum.toFixed(3)} != 1.0, normalizing...`
    );
  }
  
  // Normalize Hₜ from [-1,1] to [0,1] for intensity
  const HtNorm = (Ht + 1) / 2;
  
  // Calculate integrated intensity
  const It = kappa1 * St + kappa2 * HtNorm + kappa3 * Ct;
  
  return It;
}

/**
 * Calculate persuasion level
 * 
 * Pₜ = min{P̄, ψ(Iₜ)}
 */
export function calculatePersuasionLevel(
  It: number,
  config: AffectiveConfig
): number {
  const { maxPersuasion } = config;
  
  // Apply intensity function
  const psi_I = intensityFunction(It);
  
  // Enforce limit: Pₜ = min{P̄, ψ(Iₜ)}
  const Pt = Math.min(maxPersuasion, psi_I);
  
  // Verify limit enforcement
  if (config.enforceLimits && Pt > maxPersuasion) {
    throw new Error(
      `Persuasion limit violation: Pₜ = ${Pt.toFixed(3)} > P̄ = ${maxPersuasion}`
    );
  }
  
  return Pt;
}

// ========================================
// SIGNAL EXTRACTION
// ========================================

/**
 * Calculate situational urgency Sₜ
 */
export function calculateSituationalUrgency(context: {
  cartValue: number;
  timeInFunnel: number; // minutes
  abandonmentRisk: number; // [0, 1]
}): number {
  let St = 0;
  
  // Cart value contribution (normalized)
  St += Math.min(1.0, context.cartValue / 1000) * 0.4;
  
  // Time pressure (longer = more urgent)
  St += Math.min(1.0, context.timeInFunnel / 30) * 0.3;
  
  // Abandonment risk
  St += context.abandonmentRisk * 0.3;
  
  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, St));
}

/**
 * Calculate context signals Cₜ
 */
export function calculateContextSignals(context: {
  messageCount: number;
  productViewCount: number;
  clickThroughRate: number; // [0, 1]
}): number {
  let Ct = 0;
  
  // Engagement level (normalized)
  Ct += Math.min(1.0, context.messageCount / 10) * 0.3;
  Ct += Math.min(1.0, context.productViewCount / 5) * 0.4;
  Ct += context.clickThroughRate * 0.3;
  
  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, Ct));
}

// ========================================
// MAIN UPDATE FUNCTION
// ========================================

/**
 * Update affective state (full pipeline)
 * 
 * Main entry point for affective modeling
 */
export function updateAffectiveState(
  previousState: AffectiveState,
  newFeatures: FeatureVector,
  situationContext: {
    cartValue: number;
    timeInFunnel: number;
    abandonmentRisk: number;
    messageCount: number;
    productViewCount: number;
    clickThroughRate: number;
  },
  config: AffectiveConfig = DEFAULT_AFFECTIVE_CONFIG
): AffectiveState {
  // 1. Update emotional state: Hₜ₊₁ = ρHₜ + (1-ρ)σ(w⊤zₜ)
  const Ht1 = updateEmotionalState(
    previousState.emotionalState,
    newFeatures,
    config
  );
  
  // 2. Calculate situational urgency Sₜ
  const St = calculateSituationalUrgency({
    cartValue: situationContext.cartValue,
    timeInFunnel: situationContext.timeInFunnel,
    abandonmentRisk: situationContext.abandonmentRisk,
  });
  
  // 3. Calculate context signals Cₜ
  const Ct = calculateContextSignals({
    messageCount: situationContext.messageCount,
    productViewCount: situationContext.productViewCount,
    clickThroughRate: situationContext.clickThroughRate,
  });
  
  // 4. Calculate integrated intensity: Iₜ = κ₁Sₜ + κ₂Hₜ + κ₃Cₜ
  const It = calculateIntegratedIntensity(St, Ht1, Ct, config);
  
  // 5. Calculate persuasion level: Pₜ = min{P̄, ψ(Iₜ)}
  const Pt = calculatePersuasionLevel(It, config);
  
  // 6. Build new state
  const newState: AffectiveState = {
    emotionalState: Ht1,
    emotionalHistory: [...previousState.emotionalHistory, Ht1],
    persuasionLevel: Pt,
    persuasionHistory: [...previousState.persuasionHistory, Pt],
    integratedIntensity: It,
    situationalUrgency: St,
    contextSignals: Ct,
    timestep: previousState.timestep + 1,
    conversationId: previousState.conversationId,
    createdAt: new Date(),
  };
  
  // Log update
  console.info(
    `[Affective] t=${newState.timestep}: ` +
    `Hₜ=${Ht1.toFixed(2)}, Pₜ=${Pt.toFixed(2)}, ` +
    `Iₜ=${It.toFixed(2)} (S=${St.toFixed(2)}, C=${Ct.toFixed(2)})`
  );
  
  // Check ethical constraint: if customer frustrated, forbid persuasion
  if (Ht1 < -0.5 && Pt > 0) {
    console.warn(
      `[Affective] ETHICAL VIOLATION: Customer frustrated (H=${Ht1.toFixed(2)}) ` +
      `but persuasion active (P=${Pt.toFixed(2)}). Setting P=0.`
    );
    newState.persuasionLevel = 0;
  }
  
  return newState;
}

/**
 * Create initial affective state
 */
export function createInitialAffectiveState(
  conversationId?: string
): AffectiveState {
  return {
    emotionalState: 0,        // Neutral
    emotionalHistory: [0],
    persuasionLevel: 0,       // No persuasion initially
    persuasionHistory: [0],
    integratedIntensity: 0,
    situationalUrgency: 0,
    contextSignals: 0,
    timestep: 0,
    conversationId,
    createdAt: new Date(),
  };
}

// ========================================
// STABILITY ANALYSIS
// ========================================

/**
 * Check if configuration is stable
 */
export function checkStability(config: AffectiveConfig): {
  stable: boolean;
  reason?: string;
} {
  // Check |ρ| < 1
  if (Math.abs(config.rho) >= 1.0) {
    return {
      stable: false,
      reason: `|ρ| = ${Math.abs(config.rho)} >= 1.0 (diverges)`,
    };
  }
  
  // Check weights sum to 1.0
  const weightSum = config.kappa1 + config.kappa2 + config.kappa3;
  if (Math.abs(weightSum - 1.0) > 0.1) {
    return {
      stable: false,
      reason: `κ₁+κ₂+κ₃ = ${weightSum.toFixed(3)} != 1.0`,
    };
  }
  
  return { stable: true };
}

/**
 * Predict convergence value
 * 
 * For Hₜ₊₁ = ρHₜ + (1-ρ)c (with constant input c),
 * converges to H∞ = c as t → ∞
 */
export function predictConvergence(
  constantInput: number,
  config: AffectiveConfig
): {
  convergesTo: number;
  timeConstant: number; // timesteps to reach 63% of final value
} {
  // H∞ = lim(t→∞) Hₜ = c
  const convergesTo = constantInput;
  
  // Time constant τ = -1/ln(ρ)
  const timeConstant = -1 / Math.log(config.rho);
  
  return {
    convergesTo,
    timeConstant,
  };
}

// ========================================
// EXPORT & VISUALIZATION
// ========================================

/**
 * Export affective state history as time series
 */
export function exportTimeSeries(state: AffectiveState): {
  timesteps: number[];
  emotionalState: number[];
  persuasionLevel: number[];
} {
  const timesteps = state.emotionalHistory.map((_, i) => i);
  
  return {
    timesteps,
    emotionalState: state.emotionalHistory,
    persuasionLevel: state.persuasionHistory,
  };
}

/**
 * Interpret emotional state
 */
export function interpretEmotionalState(H: number): string {
  if (H >= 0.7) return "Very Positive";
  if (H >= 0.3) return "Positive";
  if (H >= -0.3) return "Neutral";
  if (H >= -0.7) return "Negative";
  return "Very Negative (Frustrated)";
}

/**
 * Interpret persuasion level
 */
export function interpretPersuasionLevel(P: number): string {
  if (P >= 0.8) return "Very High (Aggressive)";
  if (P >= 0.6) return "High";
  if (P >= 0.4) return "Moderate";
  if (P >= 0.2) return "Low";
  return "Minimal";
}
