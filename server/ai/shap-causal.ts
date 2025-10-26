/**
 * SHAP Causal Reasoning - Shapley Additive Explanations
 * Based on EAAS Whitepaper 02 - Chapter 13
 * 
 * Mathematical Foundation:
 * ========================
 * 
 * Shapley Values (from cooperative game theory):
 * φᵢ = ∑_{S⊆N\{i}} [ (|N|! / (|S|! (|N|-|S|-1)!)) × (v(S∪{i}) - v(S)) ]
 * 
 * where:
 * - N = set of all features (players)
 * - S = subset of features (coalition)
 * - v(S) = value function (model prediction using features in S)
 * - φᵢ = contribution of feature i (Shapley value)
 * 
 * Properties:
 * 1. Efficiency: ∑ᵢ φᵢ = v(N) - v(∅)
 * 2. Symmetry: If i, j contribute equally, φᵢ = φⱼ
 * 3. Dummy: If i never contributes, φᵢ = 0
 * 4. Additivity: φᵢ(v+w) = φᵢ(v) + φᵢ(w)
 * 
 * Causal DAG (Directed Acyclic Graph):
 * - Nodes = variables/features
 * - Edges = causal relationships
 * - Interventions: do(X=x) sets X to x, breaking incoming edges
 * 
 * Example Causal Chain for E-commerce AI:
 * 
 *   CustomerIntent → QueryText → KBMatch
 *         ↓              ↓           ↓
 *   CartValue ←──── AIResponse ←─── Citation
 *         ↓              ↓
 *   RiskScore ←──── Persuasion
 *         ↓              ↓
 *   Escalation ←──── Success
 * 
 * SHAP Attribution:
 * - Break down final outcome into feature contributions
 * - Example: "This sale happened 40% due to KB match, 30% due to low risk, 20% due to cart value, 10% other"
 */

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Feature (variable in causal model)
 */
export interface Feature {
  name: string;
  value: any;
  type: "numerical" | "categorical" | "boolean";
  
  // Causal relationships
  parents: string[];  // Features that cause this one
  children: string[]; // Features caused by this one
}

/**
 * Causal DAG
 */
export interface CausalDAG {
  nodes: Map<string, Feature>;
  edges: Array<{ from: string; to: string }>;
}

/**
 * Shapley Value Attribution
 */
export interface ShapleyAttribution {
  feature: string;
  value: number;        // φᵢ (Shapley value)
  percentage: number;   // φᵢ / ∑φⱼ (normalized)
  rank: number;         // Importance ranking
}

/**
 * SHAP Explanation
 */
export interface SHAPExplanation {
  outcome: any;                        // What we're explaining (e.g. sale success)
  baseValue: number;                   // v(∅) - baseline without any features
  prediction: number;                  // v(N) - prediction with all features
  
  attributions: ShapleyAttribution[];  // φᵢ for each feature
  
  // Verification
  efficiency: boolean;                 // ∑φᵢ = v(N) - v(∅)
  efficiencyError: number;             // How much efficiency property is violated
  
  // Metadata
  computationTime: number;             // ms
  numCoalitions: number;               // Number of coalitions evaluated
}

/**
 * Value Function v(S)
 * Takes subset of features, returns prediction
 */
export type ValueFunction = (features: Map<string, any>) => number;

// ========================================
// SHAPLEY VALUE CALCULATION
// ========================================

/**
 * Calculate factorial n!
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

/**
 * Calculate binomial coefficient C(n, k)
 */
function binomial(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  return factorial(n) / (factorial(k) * factorial(n - k));
}

/**
 * Generate all subsets of size k from set
 */
function* generateSubsets<T>(set: T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  
  if (set.length === 0) return;
  
  const [first, ...rest] = set;
  
  // Subsets that include first element
  for (const subset of Array.from(generateSubsets(rest, k - 1))) {
    yield [first, ...subset];
  }
  
  // Subsets that don't include first element
  for (const subset of Array.from(generateSubsets(rest, k))) {
    yield subset;
  }
}

/**
 * Generate all possible subsets (powerset)
 */
function* generateAllSubsets<T>(set: T[]): Generator<T[]> {
  for (let k = 0; k <= set.length; k++) {
    for (const subset of Array.from(generateSubsets(set, k))) {
      yield subset;
    }
  }
}

/**
 * Calculate Shapley value for feature i
 * 
 * φᵢ = ∑_{S⊆N\{i}} [ (|N|! / (|S|! (|N|-|S|-1)!)) × (v(S∪{i}) - v(S)) ]
 */
export function calculateShapleyValue(
  featureName: string,
  allFeatures: Map<string, any>,
  valueFn: ValueFunction
): number {
  const N = Array.from(allFeatures.keys());
  const n = N.length;
  
  // Remove feature i from set
  const Ni = N.filter(f => f !== featureName);
  
  let shapleyValue = 0;
  
  // Iterate over all subsets S ⊆ N\{i}
  for (const S of Array.from(generateAllSubsets(Ni))) {
    const s = S.length;
    
    // Calculate weight: |N|! / (|S|! (|N|-|S|-1)!)
    const weight = factorial(n) / (factorial(s) * factorial(n - s - 1));
    
    // Create feature maps
    const featuresS = new Map<string, any>();
    const featuresSi = new Map<string, any>();
    
    for (const f of S) {
      featuresS.set(f, allFeatures.get(f));
      featuresSi.set(f, allFeatures.get(f));
    }
    
    // Add feature i to S∪{i}
    featuresSi.set(featureName, allFeatures.get(featureName));
    
    // Calculate marginal contribution: v(S∪{i}) - v(S)
    const vSi = valueFn(featuresSi);
    const vS = valueFn(featuresS);
    const marginalContribution = vSi - vS;
    
    // Add weighted contribution
    shapleyValue += weight * marginalContribution;
  }
  
  // Normalize by n! (total permutations)
  shapleyValue = shapleyValue / factorial(n);
  
  return shapleyValue;
}

/**
 * Calculate SHAP explanation for all features
 * 
 * Main entry point for SHAP analysis
 */
export function calculateSHAP(
  features: Map<string, any>,
  valueFn: ValueFunction,
  options: {
    baselineFeatures?: Map<string, any>;
  } = {}
): SHAPExplanation {
  const startTime = Date.now();
  
  // Calculate baseline v(∅)
  const baselineFeatures = options.baselineFeatures || new Map();
  const baseValue = valueFn(baselineFeatures);
  
  // Calculate prediction v(N)
  const prediction = valueFn(features);
  
  // Calculate Shapley value for each feature
  const attributions: ShapleyAttribution[] = [];
  const featureNames = Array.from(features.keys());
  
  for (const featureName of featureNames) {
    const shapleyValue = calculateShapleyValue(featureName, features, valueFn);
    
    attributions.push({
      feature: featureName,
      value: shapleyValue,
      percentage: 0, // Will be filled later
      rank: 0,       // Will be filled later
    });
  }
  
  // Calculate percentages
  const totalAbsValue = attributions.reduce((sum, a) => sum + Math.abs(a.value), 0);
  for (const attr of attributions) {
    attr.percentage = totalAbsValue > 0 ? (Math.abs(attr.value) / totalAbsValue) * 100 : 0;
  }
  
  // Rank by absolute importance
  const sorted = [...attributions].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].rank = i + 1;
  }
  
  // Verify efficiency property: ∑φᵢ = v(N) - v(∅)
  const sumShapley = attributions.reduce((sum, a) => sum + a.value, 0);
  const expectedSum = prediction - baseValue;
  const efficiencyError = Math.abs(sumShapley - expectedSum);
  const efficiency = efficiencyError < 0.001; // Allow small numerical error
  
  if (!efficiency) {
    console.warn(
      `[SHAP] Efficiency property violated: ∑φᵢ=${sumShapley.toFixed(3)}, ` +
      `expected=${expectedSum.toFixed(3)}, error=${efficiencyError.toFixed(3)}`
    );
  }
  
  // Count number of coalitions evaluated
  const n = features.size;
  const numCoalitions = Math.pow(2, n); // 2^n possible coalitions
  
  return {
    outcome: prediction,
    baseValue,
    prediction,
    attributions: sorted, // Return sorted by importance
    efficiency,
    efficiencyError,
    computationTime: Date.now() - startTime,
    numCoalitions,
  };
}

// ========================================
// VALUE FUNCTIONS (MODELS)
// ========================================

/**
 * E-commerce Success Value Function
 * 
 * Predicts probability of sale success based on features
 */
export function ecommerceSaleValueFunction(features: Map<string, any>): number {
  let value = 0;
  
  // Base conversion rate
  value += 0.1;
  
  // KB Match increases conversion
  if (features.has("hasKBMatch") && features.get("hasKBMatch")) {
    value += 0.3;
  }
  
  // Cart value (diminishing returns)
  if (features.has("cartValue")) {
    const cartValue = features.get("cartValue") || 0;
    value += Math.min(0.4, cartValue / 1000); // Cap at 0.4
  }
  
  // Risk score reduces conversion
  if (features.has("riskScore")) {
    const riskScore = features.get("riskScore") || 0;
    value -= riskScore * 0.3; // High risk = lower conversion
  }
  
  // Persuasion level (within limits)
  if (features.has("persuasionLevel")) {
    const persuasion = features.get("persuasionLevel") || 0;
    if (persuasion <= 0.7) {
      value += persuasion * 0.2; // Positive if within limits
    } else {
      value -= 0.1; // Penalty for over-persuasion
    }
  }
  
  // Customer sentiment
  if (features.has("customerSentiment")) {
    const sentiment = features.get("customerSentiment") || 0;
    value += sentiment * 0.2; // Positive sentiment helps
  }
  
  // Citation increases trust
  if (features.has("hasCitation") && features.get("hasCitation")) {
    value += 0.1;
  }
  
  // Escalation is a failure
  if (features.has("isEscalated") && features.get("isEscalated")) {
    value -= 0.5;
  }
  
  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, value));
}

/**
 * Customer Satisfaction Value Function
 */
export function customerSatisfactionValueFunction(features: Map<string, any>): number {
  let value = 0.5; // Neutral baseline
  
  // Response quality
  if (features.has("hasKBMatch") && features.get("hasKBMatch")) {
    value += 0.2;
  }
  
  if (features.has("hasCitation") && features.get("hasCitation")) {
    value += 0.1;
  }
  
  // Persuasion level (too high = annoying)
  if (features.has("persuasionLevel")) {
    const persuasion = features.get("persuasionLevel") || 0;
    if (persuasion <= 0.5) {
      value += 0.05;
    } else if (persuasion > 0.7) {
      value -= 0.2; // Pushy sales = dissatisfaction
    }
  }
  
  // Sentiment
  if (features.has("customerSentiment")) {
    value += features.get("customerSentiment") * 0.3;
  }
  
  // Escalation (neutral, customer got help)
  if (features.has("isEscalated") && features.get("isEscalated")) {
    value += 0.1;
  }
  
  return Math.max(0, Math.min(1, value));
}

// ========================================
// CAUSAL DAG CONSTRUCTION
// ========================================

/**
 * Build default causal DAG for e-commerce AI
 */
export function buildEcommerceDAG(): CausalDAG {
  const nodes = new Map<string, Feature>();
  
  // Root causes
  nodes.set("customerIntent", {
    name: "customerIntent",
    value: null,
    type: "categorical",
    parents: [],
    children: ["queryText", "cartValue"],
  });
  
  // Query processing
  nodes.set("queryText", {
    name: "queryText",
    value: null,
    type: "categorical",
    parents: ["customerIntent"],
    children: ["hasKBMatch"],
  });
  
  nodes.set("hasKBMatch", {
    name: "hasKBMatch",
    value: null,
    type: "boolean",
    parents: ["queryText"],
    children: ["aiResponse", "hasCitation"],
  });
  
  nodes.set("hasCitation", {
    name: "hasCitation",
    value: null,
    type: "boolean",
    parents: ["hasKBMatch"],
    children: ["aiResponse"],
  });
  
  // Cart and risk
  nodes.set("cartValue", {
    name: "cartValue",
    value: null,
    type: "numerical",
    parents: ["customerIntent", "aiResponse"],
    children: ["riskScore"],
  });
  
  nodes.set("riskScore", {
    name: "riskScore",
    value: null,
    type: "numerical",
    parents: ["cartValue", "persuasionLevel"],
    children: ["isEscalated"],
  });
  
  // AI response
  nodes.set("aiResponse", {
    name: "aiResponse",
    value: null,
    type: "categorical",
    parents: ["hasKBMatch", "hasCitation"],
    children: ["cartValue", "persuasionLevel", "customerSentiment"],
  });
  
  nodes.set("persuasionLevel", {
    name: "persuasionLevel",
    value: null,
    type: "numerical",
    parents: ["aiResponse"],
    children: ["riskScore", "customerSentiment"],
  });
  
  // Outcomes
  nodes.set("customerSentiment", {
    name: "customerSentiment",
    value: null,
    type: "numerical",
    parents: ["aiResponse", "persuasionLevel"],
    children: ["saleSuccess"],
  });
  
  nodes.set("isEscalated", {
    name: "isEscalated",
    value: null,
    type: "boolean",
    parents: ["riskScore"],
    children: ["saleSuccess"],
  });
  
  nodes.set("saleSuccess", {
    name: "saleSuccess",
    value: null,
    type: "boolean",
    parents: ["customerSentiment", "isEscalated", "cartValue"],
    children: [],
  });
  
  // Build edges
  const edges: CausalDAG["edges"] = [];
  for (const node of Array.from(nodes.values())) {
    for (const child of node.children) {
      edges.push({ from: node.name, to: child });
    }
  }
  
  return { nodes, edges };
}

/**
 * Perform causal intervention do(X=x)
 * 
 * Sets variable X to value x and breaks incoming causal edges
 */
export function doIntervention(
  dag: CausalDAG,
  variable: string,
  value: any
): CausalDAG {
  const newNodes = new Map(dag.nodes);
  const node = newNodes.get(variable);
  
  if (!node) {
    throw new Error(`Variable ${variable} not found in DAG`);
  }
  
  // Set value
  node.value = value;
  
  // Break incoming edges (remove parents)
  node.parents = [];
  
  // Update children to remove this as parent
  for (const childName of node.children) {
    const child = newNodes.get(childName);
    if (child) {
      child.parents = child.parents.filter(p => p !== variable);
    }
  }
  
  return {
    nodes: newNodes,
    edges: dag.edges.filter(e => e.to !== variable),
  };
}

// ========================================
// EXPORT & VISUALIZATION
// ========================================

/**
 * Format SHAP explanation as human-readable text
 */
export function formatSHAPExplanation(explanation: SHAPExplanation): string {
  const lines: string[] = [];
  
  lines.push(`SHAP Explanation:`);
  lines.push(`  Prediction: ${explanation.prediction.toFixed(3)}`);
  lines.push(`  Baseline: ${explanation.baseValue.toFixed(3)}`);
  lines.push(`  Difference: ${(explanation.prediction - explanation.baseValue).toFixed(3)}`);
  lines.push(``);
  lines.push(`Feature Contributions (Shapley values):`);
  
  for (const attr of explanation.attributions) {
    const sign = attr.value >= 0 ? "+" : "";
    const bar = "█".repeat(Math.floor(attr.percentage / 2));
    
    lines.push(
      `  ${attr.rank}. ${attr.feature.padEnd(20)} ${sign}${attr.value.toFixed(3)} ` +
      `(${attr.percentage.toFixed(1)}%) ${bar}`
    );
  }
  
  lines.push(``);
  lines.push(`Efficiency Check: ${explanation.efficiency ? "✓ PASSED" : "✗ FAILED"}`);
  if (!explanation.efficiency) {
    lines.push(`  Error: ${explanation.efficiencyError.toFixed(6)}`);
  }
  
  lines.push(`Computation: ${explanation.numCoalitions} coalitions, ${explanation.computationTime}ms`);
  
  return lines.join("\n");
}

/**
 * Export top-k most important features
 */
export function getTopKFeatures(
  explanation: SHAPExplanation,
  k: number = 3
): ShapleyAttribution[] {
  return explanation.attributions.slice(0, k);
}
