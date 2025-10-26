/**
 * Extended Cost Function - Regularized Objective with Stability & Ethics
 * Based on EAAS Whitepaper 02 - Chapter 14
 * 
 * Mathematical Foundation:
 * ========================
 * 
 * Extended Cost Function:
 * J(θ) = E[ℓ(fθ(x),y)] + λₛRₛₜₐbᵢₗᵢₜy(θ) + λₑRₑₜₕᵢc(θ)
 * 
 * where:
 * - E[ℓ(fθ(x),y)] = expected loss (standard ML objective)
 * - Rₛₜₐbᵢₗᵢₜy(θ) = stability regularization term
 * - Rₑₜₕᵢc(θ) = ethical regularization term
 * - λₛ, λₑ = regularization coefficients (default: 0.1, 0.2)
 * 
 * Stability Regularization:
 * Rₛₜₐbᵢₗᵢₜy(θ) = ||θ - θₜ₋₁||² + ||∆θ||²
 * 
 * Penalizes:
 * - Large deviations from previous parameters
 * - Large parameter updates (promotes smooth learning)
 * 
 * Ethical Regularization:
 * Rₑₜₕᵢc(θ) = ∑ᵢ max(0, violation_i(θ))²
 * 
 * Penalizes:
 * - Persuasion level exceeding P̄
 * - Risk score exceeding τ
 * - LTL policy violations
 * 
 * Convexity Check (Hessian):
 * H(θ) = ∇²J(θ) ≻ 0 (positive definite)
 * 
 * If H ≻ 0, objective is convex → unique global minimum
 * 
 * Gradient Descent:
 * θₜ₊₁ = θₜ - η∇J(θₜ)
 * 
 * where η = learning rate
 */

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Cost Function Configuration
 */
export interface CostFunctionConfig {
  // Regularization weights
  lambdaStability: number;    // λₛ (default: 0.1)
  lambdaEthic: number;        // λₑ (default: 0.2)
  
  // Ethical limits (from tenant config)
  maxPersuasion: number;      // P̄ (default: 0.7)
  riskThreshold: number;      // τ (default: 0.7)
  
  // Stability tracking
  trackHistory: boolean;      // Keep θ history?
  historyWindow: number;      // How many past θ to keep
}

/**
 * Cost Function Components
 */
export interface CostComponents {
  baseLoss: number;           // E[ℓ(fθ(x),y)]
  stabilityReg: number;       // λₛRₛₜₐbᵢₗᵢₜy(θ)
  ethicReg: number;           // λₑRₑₜₕᵢc(θ)
  totalCost: number;          // J(θ)
}

/**
 * Gradient Components
 */
export interface GradientComponents {
  baseLossGrad: number[];     // ∇E[ℓ]
  stabilityGrad: number[];    // ∇Rₛₜₐbᵢₗᵢₜy
  ethicGrad: number[];        // ∇Rₑₜₕᵢc
  totalGrad: number[];        // ∇J(θ)
}

/**
 * Hessian Matrix (∇²J)
 */
export interface HessianMatrix {
  matrix: number[][];         // H[i][j] = ∂²J/∂θᵢ∂θⱼ
  isPositiveDefinite: boolean; // H ≻ 0?
  eigenvalues?: number[];     // λᵢ of H
  determinant?: number;       // det(H)
}

/**
 * Optimization State
 */
export interface OptimizationState {
  currentParams: number[];    // θₜ
  previousParams?: number[];  // θₜ₋₁
  paramHistory: number[][];   // [θ₀, θ₁, ..., θₜ]
  
  // Cost tracking
  costHistory: CostComponents[];
  
  // Metadata
  iteration: number;
  timestamp: Date;
}

// ========================================
// DEFAULT CONFIGURATION
// ========================================

export const DEFAULT_COST_CONFIG: CostFunctionConfig = {
  lambdaStability: 0.1,
  lambdaEthic: 0.2,
  maxPersuasion: 0.7,
  riskThreshold: 0.7,
  trackHistory: true,
  historyWindow: 100,
};

// ========================================
// LOSS FUNCTIONS
// ========================================

/**
 * Mean Squared Error (MSE) Loss
 * ℓ(f(x),y) = (f(x) - y)²
 */
export function mseLoss(prediction: number, target: number): number {
  const error = prediction - target;
  return error * error;
}

/**
 * Cross-Entropy Loss
 * ℓ(p,y) = -y log(p) - (1-y) log(1-p)
 */
export function crossEntropyLoss(probability: number, target: number): number {
  // Clamp to avoid log(0)
  const p = Math.max(1e-10, Math.min(1 - 1e-10, probability));
  return -target * Math.log(p) - (1 - target) * Math.log(1 - p);
}

/**
 * Expected loss over dataset
 * E[ℓ(fθ(x),y)] = (1/n) ∑ᵢ ℓ(fθ(xᵢ),yᵢ)
 */
export function expectedLoss(
  params: number[],
  data: Array<{ input: number[]; target: number }>,
  modelFn: (params: number[], input: number[]) => number
): number {
  if (data.length === 0) return 0;
  
  let totalLoss = 0;
  for (const sample of data) {
    const prediction = modelFn(params, sample.input);
    totalLoss += mseLoss(prediction, sample.target);
  }
  
  return totalLoss / data.length;
}

// ========================================
// REGULARIZATION TERMS
// ========================================

/**
 * Stability Regularization
 * Rₛₜₐbᵢₗᵢₜy(θ) = ||θ - θₜ₋₁||² + ||∆θ||²
 */
export function stabilityRegularization(
  currentParams: number[],
  previousParams?: number[]
): number {
  if (!previousParams) {
    return 0; // No previous params, no penalty
  }
  
  if (currentParams.length !== previousParams.length) {
    throw new Error("Parameter dimension mismatch");
  }
  
  let sumSquares = 0;
  for (let i = 0; i < currentParams.length; i++) {
    const diff = currentParams[i] - previousParams[i];
    sumSquares += diff * diff;
  }
  
  return sumSquares;
}

/**
 * Ethical Regularization
 * Rₑₜₕᵢc(θ) = ∑ᵢ max(0, violation_i(θ))²
 */
export function ethicalRegularization(
  params: number[],
  config: CostFunctionConfig,
  context: {
    persuasionLevel?: number;
    riskScore?: number;
    policyViolations?: number;
  }
): number {
  let penalty = 0;
  
  // Persuasion violation: max(0, P - P̄)²
  if (context.persuasionLevel !== undefined) {
    const persuasionViolation = Math.max(0, context.persuasionLevel - config.maxPersuasion);
    penalty += persuasionViolation * persuasionViolation;
  }
  
  // Risk violation: max(0, risk - τ)²
  if (context.riskScore !== undefined) {
    const riskViolation = Math.max(0, context.riskScore - config.riskThreshold);
    penalty += riskViolation * riskViolation;
  }
  
  // Policy violations (from LTL+D checker)
  if (context.policyViolations !== undefined) {
    penalty += context.policyViolations * context.policyViolations;
  }
  
  // Parameter magnitude penalty (L2 regularization)
  // Prevents overfitting
  const l2Norm = params.reduce((sum, p) => sum + p * p, 0);
  penalty += 0.01 * l2Norm;
  
  return penalty;
}

// ========================================
// EXTENDED COST FUNCTION
// ========================================

/**
 * Extended Cost Function
 * J(θ) = E[ℓ(fθ(x),y)] + λₛRₛₜₐbᵢₗᵢₜy(θ) + λₑRₑₜₕᵢc(θ)
 * 
 * Main entry point
 */
export function extendedCostFunction(
  params: number[],
  data: Array<{ input: number[]; target: number }>,
  modelFn: (params: number[], input: number[]) => number,
  config: CostFunctionConfig,
  context: {
    previousParams?: number[];
    persuasionLevel?: number;
    riskScore?: number;
    policyViolations?: number;
  } = {}
): CostComponents {
  // 1. Base loss: E[ℓ(fθ(x),y)]
  const baseLoss = expectedLoss(params, data, modelFn);
  
  // 2. Stability regularization: λₛRₛₜₐbᵢₗᵢₜy(θ)
  const stabilityTerm = stabilityRegularization(params, context.previousParams);
  const stabilityReg = config.lambdaStability * stabilityTerm;
  
  // 3. Ethical regularization: λₑRₑₜₕᵢc(θ)
  const ethicTerm = ethicalRegularization(params, config, {
    persuasionLevel: context.persuasionLevel,
    riskScore: context.riskScore,
    policyViolations: context.policyViolations,
  });
  const ethicReg = config.lambdaEthic * ethicTerm;
  
  // 4. Total cost: J(θ)
  const totalCost = baseLoss + stabilityReg + ethicReg;
  
  return {
    baseLoss,
    stabilityReg,
    ethicReg,
    totalCost,
  };
}

// ========================================
// GRADIENT COMPUTATION
// ========================================

/**
 * Compute gradient ∇J(θ) numerically
 * 
 * Uses finite differences: ∂J/∂θᵢ ≈ (J(θ+εeᵢ) - J(θ))/ε
 */
export function computeExtendedGradient(
  params: number[],
  data: Array<{ input: number[]; target: number }>,
  modelFn: (params: number[], input: number[]) => number,
  config: CostFunctionConfig,
  context: {
    previousParams?: number[];
    persuasionLevel?: number;
    riskScore?: number;
    policyViolations?: number;
  } = {},
  epsilon: number = 1e-5
): GradientComponents {
  const grad = new Array(params.length).fill(0);
  
  // Compute J(θ)
  const J0 = extendedCostFunction(params, data, modelFn, config, context).totalCost;
  
  // Finite differences for each parameter
  for (let i = 0; i < params.length; i++) {
    // θ + εeᵢ
    const paramsPlus = [...params];
    paramsPlus[i] += epsilon;
    
    // J(θ + εeᵢ)
    const J1 = extendedCostFunction(paramsPlus, data, modelFn, config, context).totalCost;
    
    // ∂J/∂θᵢ ≈ (J1 - J0)/ε
    grad[i] = (J1 - J0) / epsilon;
  }
  
  return {
    baseLossGrad: grad, // Simplified: full gradient
    stabilityGrad: new Array(params.length).fill(0),
    ethicGrad: new Array(params.length).fill(0),
    totalGrad: grad,
  };
}

// ========================================
// HESSIAN COMPUTATION
// ========================================

/**
 * Compute Hessian matrix ∇²J(θ) numerically
 * 
 * H[i][j] = ∂²J/∂θᵢ∂θⱼ ≈ (∂J/∂θᵢ(θ+εeⱼ) - ∂J/∂θᵢ(θ))/ε
 */
export function computeHessian(
  params: number[],
  data: Array<{ input: number[]; target: number }>,
  modelFn: (params: number[], input: number[]) => number,
  config: CostFunctionConfig,
  context: any = {},
  epsilon: number = 1e-4
): HessianMatrix {
  const n = params.length;
  const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  
  // Compute gradient at θ
  const grad0 = computeExtendedGradient(params, data, modelFn, config, context, epsilon);
  
  // Compute H[i][j] for each pair
  for (let j = 0; j < n; j++) {
    // θ + εeⱼ
    const paramsPlus = [...params];
    paramsPlus[j] += epsilon;
    
    // ∇J(θ + εeⱼ)
    const grad1 = computeExtendedGradient(paramsPlus, data, modelFn, config, context, epsilon);
    
    // H[i][j] = (∂J/∂θᵢ(θ+εeⱼ) - ∂J/∂θᵢ(θ))/ε
    for (let i = 0; i < n; i++) {
      matrix[i][j] = (grad1.totalGrad[i] - grad0.totalGrad[i]) / epsilon;
    }
  }
  
  // Check if positive definite (all eigenvalues > 0)
  const isPositiveDefinite = checkPositiveDefinite(matrix);
  
  return {
    matrix,
    isPositiveDefinite,
  };
}

/**
 * Check if matrix is positive definite
 * 
 * Simplified check: all diagonal elements > 0
 * (Full check requires eigenvalue decomposition)
 */
function checkPositiveDefinite(matrix: number[][]): boolean {
  const n = matrix.length;
  
  // Check diagonal elements
  for (let i = 0; i < n; i++) {
    if (matrix[i][i] <= 0) {
      return false; // Not positive definite
    }
  }
  
  // Simplified check (proper check needs eigenvalues)
  return true;
}

// ========================================
// OPTIMIZATION
// ========================================

/**
 * Gradient descent with extended cost function
 * 
 * θₜ₊₁ = θₜ - η∇J(θₜ)
 */
export function optimizeWithExtendedCost(
  initialParams: number[],
  data: Array<{ input: number[]; target: number }>,
  modelFn: (params: number[], input: number[]) => number,
  learningRate: number,
  maxIterations: number,
  config: CostFunctionConfig = DEFAULT_COST_CONFIG
): OptimizationState {
  let params = [...initialParams];
  const paramHistory: number[][] = [params];
  const costHistory: CostComponents[] = [];
  
  console.info(`[Extended Cost] Starting optimization...`);
  
  for (let t = 0; t < maxIterations; t++) {
    // Context for this iteration
    const context = {
      previousParams: paramHistory[paramHistory.length - 1],
      persuasionLevel: 0.5, // Example
      riskScore: 0.3,       // Example
      policyViolations: 0,  // Example
    };
    
    // Compute cost
    const cost = extendedCostFunction(params, data, modelFn, config, context);
    costHistory.push(cost);
    
    // Compute gradient
    const gradient = computeExtendedGradient(params, data, modelFn, config, context);
    
    // Update parameters: θₜ₊₁ = θₜ - η∇J(θₜ)
    params = params.map((p, i) => p - learningRate * gradient.totalGrad[i]);
    paramHistory.push([...params]);
    
    // Log progress
    if (t % 10 === 0) {
      console.info(
        `[Extended Cost] t=${t}: J=${cost.totalCost.toFixed(4)} ` +
        `(loss=${cost.baseLoss.toFixed(4)}, ` +
        `stab=${cost.stabilityReg.toFixed(4)}, ` +
        `ethic=${cost.ethicReg.toFixed(4)})`
      );
    }
    
    // Early stopping
    if (cost.totalCost < 1e-6) {
      console.info(`[Extended Cost] Converged at t=${t}`);
      break;
    }
  }
  
  return {
    currentParams: params,
    previousParams: paramHistory[paramHistory.length - 2],
    paramHistory,
    costHistory,
    iteration: paramHistory.length - 1,
    timestamp: new Date(),
  };
}

// ========================================
// UTILITIES
// ========================================

/**
 * Simple linear model
 * f(x;θ) = θ⊤x
 */
export function linearModel(params: number[], input: number[]): number {
  if (params.length !== input.length) {
    throw new Error(`Dimension mismatch: params=${params.length}, input=${input.length}`);
  }
  return params.reduce((sum, p, i) => sum + p * input[i], 0);
}

/**
 * Export cost history
 */
export function exportCostHistory(state: OptimizationState): string {
  const lines: string[] = [];
  
  lines.push(`Extended Cost Function Optimization:`);
  lines.push(`  Iterations: ${state.iteration}`);
  lines.push(`  Final Cost: ${state.costHistory[state.costHistory.length - 1]?.totalCost.toFixed(6) || 'N/A'}`);
  lines.push(``);
  lines.push(`Cost History:`);
  
  for (let i = 0; i < state.costHistory.length; i += Math.max(1, Math.floor(state.costHistory.length / 10))) {
    const cost = state.costHistory[i];
    lines.push(
      `  t=${String(i).padStart(4)}: J=${cost.totalCost.toFixed(6)} ` +
      `(${cost.baseLoss.toFixed(4)} + ${cost.stabilityReg.toFixed(4)} + ${cost.ethicReg.toFixed(4)})`
    );
  }
  
  return lines.join("\n");
}
