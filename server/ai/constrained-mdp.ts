/**
 * Constrained MDP (CMDP) - Ethical Decision Making Under Constraints
 * Based on EAAS Whitepaper 02 - Chapter 14
 * 
 * Mathematical Foundation:
 * ========================
 * 
 * Constrained Markov Decision Process:
 * 
 * Primal Problem:
 *   maximize E[∑ₜ γᵗrₜ]                (maximize expected discounted reward)
 *   subject to E[∑ₜ γᵗcₖₜ] ≤ dₖ      (k ethical constraints)
 * 
 * where:
 * - γ ∈ [0, 1) = discount factor (default: 0.99)
 * - rₜ = reward at time t
 * - cₖₜ = cost of constraint k at time t
 * - dₖ = budget/limit for constraint k
 * 
 * Example Constraints:
 * - c₁(s,a) = persuasion level (limit: d₁ = 0.7)
 * - c₂(s,a) = risk score (limit: d₂ = 0.7)
 * - c₃(s,a) = policy violations (limit: d₃ = 0)
 * 
 * Lagrangian Formulation:
 * L(π, λ) = E[∑ₜ γᵗrₜ] - ∑ₖ λₖ(E[∑ₜ γᵗcₖₜ] - dₖ)
 * 
 * where:
 * - λₖ ≥ 0 = Lagrange multipliers (dual variables)
 * - π = policy (mapping states to actions)
 * 
 * Primal-Dual Algorithm:
 * 1. Update policy: πₜ₊₁ = argmax_π L(π, λₜ)
 * 2. Update duals: λₖₜ₊₁ = max(0, λₖₜ + αₖ(E[cₖ] - dₖ))
 * 
 * KKT Conditions (optimality):
 * 1. Stationarity: ∇_π L = 0
 * 2. Primal feasibility: E[cₖ] ≤ dₖ
 * 3. Dual feasibility: λₖ ≥ 0
 * 4. Complementary slackness: λₖ(E[cₖ] - dₖ) = 0
 */

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * CMDP State
 */
export interface CMDPState {
  id: string;
  features: Record<string, any>;
  
  // Metadata
  timestamp: Date;
}

/**
 * CMDP Action
 */
export interface CMDPAction {
  id: string;
  type: string;
  params: Record<string, any>;
}

/**
 * Reward Function r(s,a,s')
 */
export type RewardFunction = (s: CMDPState, a: CMDPAction, sPrime: CMDPState) => number;

/**
 * Cost Function cₖ(s,a,s')
 */
export type CostFunction = (s: CMDPState, a: CMDPAction, sPrime: CMDPState) => number;

/**
 * Constraint Definition
 */
export interface Constraint {
  id: string;
  name: string;
  costFn: CostFunction;
  budget: number;        // dₖ
  
  // Tracking
  currentCost: number;   // E[cₖ]
  violation: number;     // max(0, E[cₖ] - dₖ)
}

/**
 * Policy π(a|s)
 */
export interface Policy {
  selectAction(state: CMDPState): CMDPAction;
  actionProbabilities(state: CMDPState): Map<string, number>;
}

/**
 * Lagrange Multipliers
 */
export interface LagrangeMultipliers {
  values: Map<string, number>;  // λₖ for each constraint k
  learningRates: Map<string, number>;  // αₖ
}

/**
 * CMDP Configuration
 */
export interface CMDPConfig {
  gamma: number;                  // γ - discount factor (default: 0.99)
  maxIterations: number;          // Max policy iterations
  convergenceThreshold: number;   // When to stop (default: 1e-4)
  
  // Dual learning
  dualLearningRate: number;       // α - step size for λ updates (default: 0.1)
  dualClipMax: number;            // Max value for λₖ (default: 10.0)
}

/**
 * CMDP Solution
 */
export interface CMDPSolution {
  policy: Policy;
  lagrangeMultipliers: LagrangeMultipliers;
  
  // Metrics
  expectedReward: number;         // E[∑γᵗrₜ]
  constraintCosts: Map<string, number>;  // E[cₖ] for each k
  constraintViolations: Map<string, number>;  // max(0, E[cₖ] - dₖ)
  
  // KKT check
  satisfiesKKT: boolean;
  
  // Convergence
  iterations: number;
  converged: boolean;
  timestamp: Date;
}

// ========================================
// DEFAULT CONFIGURATION
// ========================================

export const DEFAULT_CMDP_CONFIG: CMDPConfig = {
  gamma: 0.99,
  maxIterations: 1000,
  convergenceThreshold: 1e-4,
  dualLearningRate: 0.1,
  dualClipMax: 10.0,
};

// ========================================
// EXAMPLE REWARD/COST FUNCTIONS
// ========================================

/**
 * E-commerce reward function
 * Reward for successful sale
 */
export function ecommerceReward(
  s: CMDPState,
  a: CMDPAction,
  sPrime: CMDPState
): number {
  let reward = 0;
  
  // Sale completed
  if (a.type === "checkout" && sPrime.features.orderCompleted) {
    reward += 100; // High reward for sale
  }
  
  // Product added to cart
  if (a.type === "add_to_cart") {
    reward += 10;
  }
  
  // Answer question
  if (a.type === "answer_question") {
    reward += 5;
  }
  
  // Penalty for escalation (AI failed)
  if (a.type === "escalate_human") {
    reward -= 20;
  }
  
  return reward;
}

/**
 * Persuasion cost function c₁(s,a,s')
 * Cost = persuasion level
 */
export function persuasionCost(
  s: CMDPState,
  a: CMDPAction,
  sPrime: CMDPState
): number {
  return sPrime.features.persuasionLevel || 0;
}

/**
 * Risk cost function c₂(s,a,s')
 * Cost = risk score
 */
export function riskCost(
  s: CMDPState,
  a: CMDPAction,
  sPrime: CMDPState
): number {
  return sPrime.features.riskScore || 0;
}

/**
 * Policy violation cost function c₃(s,a,s')
 * Cost = number of violations
 */
export function policyViolationCost(
  s: CMDPState,
  a: CMDPAction,
  sPrime: CMDPState
): number {
  return sPrime.features.policyViolations || 0;
}

// ========================================
// POLICY IMPLEMENTATIONS
// ========================================

/**
 * Greedy Policy
 * Always selects best action (no exploration)
 */
export class GreedyPolicy implements Policy {
  private actionValues: Map<string, Map<string, number>>;
  
  constructor() {
    this.actionValues = new Map();
  }
  
  selectAction(state: CMDPState): CMDPAction {
    // Simple heuristic: choose based on state features
    if (state.features.cartValue > 500) {
      return { id: "checkout", type: "checkout", params: {} };
    } else if (state.features.hasQuestion) {
      return { id: "answer", type: "answer_question", params: {} };
    } else {
      return { id: "search", type: "search_products", params: {} };
    }
  }
  
  actionProbabilities(state: CMDPState): Map<string, number> {
    const action = this.selectAction(state);
    const probs = new Map<string, number>();
    probs.set(action.id, 1.0);
    return probs;
  }
}

/**
 * Epsilon-Greedy Policy
 * Explores with probability ε
 */
export class EpsilonGreedyPolicy implements Policy {
  private epsilon: number;
  private greedyPolicy: Policy;
  private allActions: CMDPAction[];
  
  constructor(epsilon: number = 0.1, allActions: CMDPAction[]) {
    this.epsilon = epsilon;
    this.greedyPolicy = new GreedyPolicy();
    this.allActions = allActions;
  }
  
  selectAction(state: CMDPState): CMDPAction {
    // Explore with probability ε
    if (Math.random() < this.epsilon) {
      const randomIndex = Math.floor(Math.random() * this.allActions.length);
      return this.allActions[randomIndex];
    }
    
    // Exploit
    return this.greedyPolicy.selectAction(state);
  }
  
  actionProbabilities(state: CMDPState): Map<string, number> {
    const probs = new Map<string, number>();
    const greedyAction = this.greedyPolicy.selectAction(state);
    
    for (const action of this.allActions) {
      if (action.id === greedyAction.id) {
        probs.set(action.id, 1 - this.epsilon + this.epsilon / this.allActions.length);
      } else {
        probs.set(action.id, this.epsilon / this.allActions.length);
      }
    }
    
    return probs;
  }
}

// ========================================
// LAGRANGIAN OPTIMIZATION
// ========================================

/**
 * Evaluate Lagrangian
 * L(π, λ) = E[∑γᵗrₜ] - ∑λₖ(E[cₖ] - dₖ)
 */
export function evaluateLagrangian(
  expectedReward: number,
  constraintCosts: Map<string, number>,
  lagrangeMultipliers: LagrangeMultipliers,
  constraints: Constraint[]
): number {
  let lagrangian = expectedReward;
  
  for (const constraint of constraints) {
    const cost = constraintCosts.get(constraint.id) || 0;
    const lambda = lagrangeMultipliers.values.get(constraint.id) || 0;
    const budget = constraint.budget;
    
    // Subtract penalty: λₖ(E[cₖ] - dₖ)
    lagrangian -= lambda * (cost - budget);
  }
  
  return lagrangian;
}

/**
 * Update Lagrange multipliers
 * λₖₜ₊₁ = max(0, λₖₜ + αₖ(E[cₖ] - dₖ))
 */
export function updateLagrangeMultipliers(
  lagrangeMultipliers: LagrangeMultipliers,
  constraintCosts: Map<string, number>,
  constraints: Constraint[],
  config: CMDPConfig
): LagrangeMultipliers {
  const newValues = new Map<string, number>();
  
  for (const constraint of constraints) {
    const cost = constraintCosts.get(constraint.id) || 0;
    const lambda = lagrangeMultipliers.values.get(constraint.id) || 0;
    const alpha = lagrangeMultipliers.learningRates.get(constraint.id) || config.dualLearningRate;
    
    // Update: λₖₜ₊₁ = λₖₜ + αₖ(E[cₖ] - dₖ)
    const violation = cost - constraint.budget;
    let newLambda = lambda + alpha * violation;
    
    // Clip: λₖ ≥ 0
    newLambda = Math.max(0, newLambda);
    
    // Clip max
    newLambda = Math.min(config.dualClipMax, newLambda);
    
    newValues.set(constraint.id, newLambda);
  }
  
  return {
    values: newValues,
    learningRates: lagrangeMultipliers.learningRates,
  };
}

// ========================================
// KKT CONDITIONS CHECK
// ========================================

/**
 * Check KKT optimality conditions
 */
export function checkKKT(
  constraintCosts: Map<string, number>,
  lagrangeMultipliers: LagrangeMultipliers,
  constraints: Constraint[],
  tolerance: number = 1e-3
): {
  satisfied: boolean;
  primalFeasible: boolean;
  dualFeasible: boolean;
  complementarySlackness: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  let primalFeasible = true;
  let dualFeasible = true;
  let complementarySlackness = true;
  
  for (const constraint of constraints) {
    const cost = constraintCosts.get(constraint.id) || 0;
    const lambda = lagrangeMultipliers.values.get(constraint.id) || 0;
    
    // 1. Primal feasibility: E[cₖ] ≤ dₖ
    if (cost > constraint.budget + tolerance) {
      primalFeasible = false;
      violations.push(`Primal violation: ${constraint.name} cost=${cost.toFixed(3)} > budget=${constraint.budget}`);
    }
    
    // 2. Dual feasibility: λₖ ≥ 0
    if (lambda < -tolerance) {
      dualFeasible = false;
      violations.push(`Dual violation: ${constraint.name} λ=${lambda.toFixed(3)} < 0`);
    }
    
    // 3. Complementary slackness: λₖ(E[cₖ] - dₖ) = 0
    const slackness = lambda * (cost - constraint.budget);
    if (Math.abs(slackness) > tolerance) {
      complementarySlackness = false;
      violations.push(`Slackness violation: ${constraint.name} λ×slack=${slackness.toFixed(3)} != 0`);
    }
  }
  
  const satisfied = primalFeasible && dualFeasible && complementarySlackness;
  
  return {
    satisfied,
    primalFeasible,
    dualFeasible,
    complementarySlackness,
    violations,
  };
}

// ========================================
// CMDP SOLVER
// ========================================

/**
 * Solve CMDP using Primal-Dual Algorithm
 * 
 * Main entry point
 */
export function solveCMDP(
  initialPolicy: Policy,
  rewardFn: RewardFunction,
  constraints: Constraint[],
  sampleTrajectory: Array<{
    state: CMDPState;
    action: CMDPAction;
    nextState: CMDPState;
  }>,
  config: CMDPConfig = DEFAULT_CMDP_CONFIG
): CMDPSolution {
  console.info(`[CMDP] Starting solver with ${constraints.length} constraints...`);
  
  // Initialize Lagrange multipliers
  const lagrangeMultipliers: LagrangeMultipliers = {
    values: new Map(constraints.map(c => [c.id, 0])),
    learningRates: new Map(constraints.map(c => [c.id, config.dualLearningRate])),
  };
  
  let policy = initialPolicy;
  let converged = false;
  let iteration = 0;
  
  for (iteration = 0; iteration < config.maxIterations; iteration++) {
    // 1. Evaluate policy on trajectory
    let expectedReward = 0;
    const constraintCosts = new Map<string, number>();
    
    for (const constraint of constraints) {
      constraintCosts.set(constraint.id, 0);
    }
    
    // Monte Carlo evaluation
    let discountFactor = 1.0;
    for (const { state, action, nextState } of sampleTrajectory) {
      // Reward
      const reward = rewardFn(state, action, nextState);
      expectedReward += discountFactor * reward;
      
      // Costs
      for (const constraint of constraints) {
        const cost = constraint.costFn(state, action, nextState);
        const currentCost = constraintCosts.get(constraint.id) || 0;
        constraintCosts.set(constraint.id, currentCost + discountFactor * cost);
      }
      
      discountFactor *= config.gamma;
    }
    
    // Normalize by trajectory length
    const trajectoryLength = sampleTrajectory.length;
    expectedReward /= trajectoryLength;
    for (const [k, v] of Array.from(constraintCosts.entries())) {
      constraintCosts.set(k, v / trajectoryLength);
    }
    
    // 2. Update Lagrange multipliers
    const newMultipliers = updateLagrangeMultipliers(
      lagrangeMultipliers,
      constraintCosts,
      constraints,
      config
    );
    
    // Check convergence (λ not changing much)
    let maxChange = 0;
    for (const constraint of constraints) {
      const oldLambda = lagrangeMultipliers.values.get(constraint.id) || 0;
      const newLambda = newMultipliers.values.get(constraint.id) || 0;
      maxChange = Math.max(maxChange, Math.abs(newLambda - oldLambda));
    }
    
    // Update multipliers
    for (const [k, v] of Array.from(newMultipliers.values.entries())) {
      lagrangeMultipliers.values.set(k, v);
    }
    
    // Log progress
    if (iteration % 100 === 0) {
      console.info(
        `[CMDP] Iteration ${iteration}: ` +
        `reward=${expectedReward.toFixed(2)}, ` +
        `λ_change=${maxChange.toFixed(4)}`
      );
      
      for (const constraint of constraints) {
        const cost = constraintCosts.get(constraint.id) || 0;
        const lambda = lagrangeMultipliers.values.get(constraint.id) || 0;
        console.info(
          `  ${constraint.name}: cost=${cost.toFixed(3)}, ` +
          `budget=${constraint.budget}, λ=${lambda.toFixed(3)}`
        );
      }
    }
    
    // Check convergence
    if (maxChange < config.convergenceThreshold) {
      console.info(`[CMDP] Converged at iteration ${iteration}`);
      converged = true;
      break;
    }
    
    // 3. Policy would be updated here in full implementation
    // (For simplicity, we keep the initial policy)
  }
  
  // Final evaluation
  const constraintViolations = new Map<string, number>();
  const finalConstraintCosts = new Map<string, number>();
  
  // Re-evaluate final policy
  let finalReward = 0;
  for (const constraint of constraints) {
    finalConstraintCosts.set(constraint.id, 0);
  }
  
  let discountFactor = 1.0;
  for (const { state, action, nextState } of sampleTrajectory) {
    finalReward += discountFactor * rewardFn(state, action, nextState);
    
    for (const constraint of constraints) {
      const cost = constraint.costFn(state, action, nextState);
      const current = finalConstraintCosts.get(constraint.id) || 0;
      finalConstraintCosts.set(constraint.id, current + discountFactor * cost);
    }
    
    discountFactor *= config.gamma;
  }
  
  finalReward /= sampleTrajectory.length;
  for (const [k, v] of Array.from(finalConstraintCosts.entries())) {
    finalConstraintCosts.set(k, v / sampleTrajectory.length);
  }
  
  // Calculate violations
  for (const constraint of constraints) {
    const cost = finalConstraintCosts.get(constraint.id) || 0;
    const violation = Math.max(0, cost - constraint.budget);
    constraintViolations.set(constraint.id, violation);
  }
  
  // Check KKT
  const kkt = checkKKT(finalConstraintCosts, lagrangeMultipliers, constraints);
  
  console.info(
    `[CMDP] Final solution: ` +
    `reward=${finalReward.toFixed(2)}, ` +
    `KKT=${kkt.satisfied ? "✓ SATISFIED" : "✗ VIOLATED"}`
  );
  
  return {
    policy,
    lagrangeMultipliers,
    expectedReward: finalReward,
    constraintCosts: finalConstraintCosts,
    constraintViolations,
    satisfiesKKT: kkt.satisfied,
    iterations: iteration,
    converged,
    timestamp: new Date(),
  };
}

// ========================================
// UTILITIES
// ========================================

/**
 * Create example constraints for e-commerce AI
 */
export function createEcommerceConstraints(): Constraint[] {
  return [
    {
      id: "persuasion",
      name: "Persuasion Limit",
      costFn: persuasionCost,
      budget: 0.7,  // Max 70% persuasion
      currentCost: 0,
      violation: 0,
    },
    {
      id: "risk",
      name: "Risk Limit",
      costFn: riskCost,
      budget: 0.7,  // Max 70% risk
      currentCost: 0,
      violation: 0,
    },
    {
      id: "violations",
      name: "Policy Violations",
      costFn: policyViolationCost,
      budget: 0,    // Zero violations allowed
      currentCost: 0,
      violation: 0,
    },
  ];
}

/**
 * Export CMDP solution
 */
export function exportCMDPSolution(solution: CMDPSolution): string {
  const lines: string[] = [];
  
  lines.push(`CMDP Solution:`);
  lines.push(`  Expected Reward: ${solution.expectedReward.toFixed(3)}`);
  lines.push(`  Iterations: ${solution.iterations}`);
  lines.push(`  Converged: ${solution.converged ? "✓ Yes" : "✗ No"}`);
  lines.push(`  KKT Satisfied: ${solution.satisfiesKKT ? "✓ Yes" : "✗ No"}`);
  lines.push(``);
  lines.push(`Constraints:`);
  
  for (const [k, cost] of Array.from(solution.constraintCosts.entries())) {
    const lambda = solution.lagrangeMultipliers.values.get(k) || 0;
    const violation = solution.constraintViolations.get(k) || 0;
    const status = violation > 0 ? "✗ VIOLATED" : "✓ OK";
    
    lines.push(
      `  ${k}: cost=${cost.toFixed(3)}, ` +
      `λ=${lambda.toFixed(3)}, ` +
      `violation=${violation.toFixed(3)} ${status}`
    );
  }
  
  return lines.join("\n");
}
