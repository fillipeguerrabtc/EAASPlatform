/**
 * Dream Loops - Self-Reflection & Counterfactual Simulation
 * Based on EAAS Whitepaper 02 - Chapter 16 + Appendix D
 * 
 * Mathematical Foundation:
 * ========================
 * 
 * Dream Loops Concept:
 * - AI simulates alternative "worlds" W = {w₁, w₂, ..., wₙ}
 * - Each world is a counterfactual scenario: "what if I had chosen differently?"
 * - Compare outcomes across worlds to improve policy
 * 
 * Coherence Metric (from whitepaper):
 * Coherence = 1 - E[rₜ]² / Var(rₜ)
 * 
 * where:
 * - rₜ = reward at timestep t in simulated world
 * - E[rₜ] = expected reward across all simulated worlds
 * - Var(rₜ) = variance of rewards across worlds
 * - Coherence ∈ [0, 1], higher is better (consistent outcomes)
 * 
 * Dream Loop Algorithm:
 * 1. Take real execution trace π = ⟨s₀, a₀, s₁, a₁, ...⟩
 * 2. Generate n alternative worlds by varying actions
 * 3. Simulate outcomes in each world
 * 4. Calculate coherence metric
 * 5. If coherence low (< 0.5), policy needs improvement
 * 6. Update policy based on best-performing world
 * 
 * Self-Consistency Check:
 * - Dreams should have high coherence (consistent predictions)
 * - Low coherence = high uncertainty = need more learning
 * - Formula: Coherence = 1 - (mean²/variance)
 */

import { storage } from "../storage";
import type { PlanSession, PlanNode } from "@shared/schema";

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * World State (counterfactual scenario)
 */
export interface World {
  id: string;
  name: string;
  description: string;
  
  // Initial state (same as real world)
  initialState: any;
  
  // Alternative action sequence
  actionSequence: Array<{
    step: number;
    action: string;
    params: Record<string, any>;
  }>;
  
  // Simulated outcome
  finalState: any;
  totalReward: number;
  success: boolean;
  
  // Metrics
  steps: number;
  simulationTime: number; // ms
}

/**
 * Dream Session (collection of simulated worlds)
 */
export interface DreamSession {
  id: string;
  planSessionId?: string;
  
  // Real-world baseline
  realTrace: {
    states: any[];
    actions: any[];
    totalReward: number;
  };
  
  // Simulated worlds
  worlds: World[];
  
  // Coherence Analysis
  coherence: number;          // Coherence = 1 - E[r]²/Var(r)
  meanReward: number;         // E[rₜ]
  rewardVariance: number;     // Var(rₜ)
  
  // Recommendations
  bestWorld: string;          // ID of best-performing world
  policyImprovement: {
    suggestedAction: string;
    reason: string;
    expectedGain: number;
  } | null;
  
  createdAt: Date;
  metadata: Record<string, any>;
}

/**
 * Reward Function for outcome evaluation
 */
export interface RewardFunction {
  (state: any, action: any, nextState: any): number;
}

// ========================================
// REWARD FUNCTIONS
// ========================================

/**
 * Default reward function for e-commerce AI
 */
export function ecommerceReward(
  state: any,
  action: any,
  nextState: any
): number {
  let reward = 0;
  
  // Positive rewards
  if (action.type === "add_to_cart" && nextState.cartValue > state.cartValue) {
    reward += 10; // Product added to cart
  }
  
  if (action.type === "checkout" && nextState.orderCompleted) {
    reward += 50; // Order completed (high value)
  }
  
  if (action.type === "answer_question" && nextState.customerSatisfied) {
    reward += 5; // Helpful answer
  }
  
  // Negative rewards (penalties)
  if (action.type === "escalate_human") {
    reward -= 5; // Escalation is failure (we want AI to handle)
  }
  
  if (nextState.customerFrustrated) {
    reward -= 10; // Customer frustration
  }
  
  if (nextState.riskViolation) {
    reward -= 20; // Policy violation (high penalty)
  }
  
  // Neutral/small rewards
  if (action.type === "search_products") {
    reward += 1; // Browsing is okay
  }
  
  return reward;
}

// ========================================
// WORLD SIMULATION
// ========================================

/**
 * Simulate world outcome given action sequence
 * 
 * This is a simplified simulation - in production would use
 * learned transition model T(s'|s,a)
 */
export function simulateWorld(
  initialState: any,
  actionSequence: World["actionSequence"],
  rewardFn: RewardFunction = ecommerceReward
): {
  finalState: any;
  totalReward: number;
  success: boolean;
} {
  let currentState = { ...initialState };
  let totalReward = 0;
  
  for (const { action, params } of actionSequence) {
    // Simulate state transition (simplified)
    const nextState = simulateStateTransition(currentState, action, params);
    
    // Calculate reward
    const reward = rewardFn(currentState, { type: action, params }, nextState);
    totalReward += reward;
    
    currentState = nextState;
  }
  
  // Success if positive reward and no critical failures
  const success = totalReward > 0 && !currentState.riskViolation;
  
  return {
    finalState: currentState,
    totalReward,
    success,
  };
}

/**
 * Simulate state transition T(s'|s,a)
 * 
 * This is a heuristic simulation - in production would use
 * learned model from experience
 */
function simulateStateTransition(
  state: any,
  action: string,
  params: Record<string, any>
): any {
  const nextState = { ...state };
  
  switch (action) {
    case "add_to_cart":
      // Simulate adding product to cart
      nextState.cartValue = (state.cartValue || 0) + (params.productPrice || 100);
      nextState.cartItems = (state.cartItems || 0) + 1;
      
      // Risk increases with cart value
      if (nextState.cartValue > 1000) {
        nextState.riskScore = 0.4;
      }
      if (nextState.cartValue > 5000) {
        nextState.riskScore = 0.8;
        nextState.riskViolation = true; // Exceeds limit
      }
      break;
    
    case "checkout":
      // Simulate checkout
      if (nextState.cartValue > 0) {
        nextState.orderCompleted = true;
        nextState.customerSatisfied = true;
      } else {
        nextState.customerFrustrated = true; // Empty cart checkout
      }
      break;
    
    case "answer_question":
      // Simulate answering question
      if (params.hasKBMatch) {
        nextState.customerSatisfied = true;
      } else {
        nextState.customerSatisfied = false;
      }
      break;
    
    case "escalate_human":
      // Simulate escalation
      nextState.isEscalated = true;
      nextState.aiHandled = false; // AI gave up
      break;
    
    case "search_products":
      // Simulate product search
      nextState.browsing = true;
      break;
    
    case "clarify_intent":
      // Simulate clarification
      nextState.intentClarified = true;
      break;
  }
  
  return nextState;
}

// ========================================
// WORLD GENERATION
// ========================================

/**
 * Generate alternative worlds from real trace
 * 
 * Strategy: vary actions at key decision points
 */
export function generateAlternativeWorlds(
  realTrace: {
    states: any[];
    actions: any[];
    totalReward: number;
  },
  numWorlds: number = 5
): World[] {
  const worlds: World[] = [];
  
  // World 1: More aggressive (push for checkout earlier)
  worlds.push({
    id: "world-aggressive",
    name: "Aggressive Sales",
    description: "Push for checkout earlier, higher persuasion",
    initialState: realTrace.states[0],
    actionSequence: generateAggressiveActions(realTrace),
    finalState: {},
    totalReward: 0,
    success: false,
    steps: 0,
    simulationTime: 0,
  });
  
  // World 2: More conservative (answer questions, build trust)
  worlds.push({
    id: "world-conservative",
    name: "Conservative Support",
    description: "Focus on answering questions, slower sales",
    initialState: realTrace.states[0],
    actionSequence: generateConservativeActions(realTrace),
    finalState: {},
    totalReward: 0,
    success: false,
    steps: 0,
    simulationTime: 0,
  });
  
  // World 3: Balanced (mix of sales and support)
  worlds.push({
    id: "world-balanced",
    name: "Balanced Approach",
    description: "Balance between sales and customer support",
    initialState: realTrace.states[0],
    actionSequence: generateBalancedActions(realTrace),
    finalState: {},
    totalReward: 0,
    success: false,
    steps: 0,
    simulationTime: 0,
  });
  
  // World 4: Early escalation (when in doubt, escalate)
  worlds.push({
    id: "world-escalate",
    name: "Early Escalation",
    description: "Escalate to human early for safety",
    initialState: realTrace.states[0],
    actionSequence: generateEscalationActions(realTrace),
    finalState: {},
    totalReward: 0,
    success: false,
    steps: 0,
    simulationTime: 0,
  });
  
  // World 5: Real-world baseline (what actually happened)
  worlds.push({
    id: "world-real",
    name: "Real World (Baseline)",
    description: "Actual actions taken by AI",
    initialState: realTrace.states[0],
    actionSequence: realTrace.actions.map((a: any, i: number) => ({
      step: i,
      action: a.type,
      params: a.params,
    })),
    finalState: realTrace.states[realTrace.states.length - 1],
    totalReward: realTrace.totalReward,
    success: realTrace.totalReward > 0,
    steps: realTrace.actions.length,
    simulationTime: 0,
  });
  
  return worlds.slice(0, numWorlds);
}

/**
 * Generate aggressive action sequence
 */
function generateAggressiveActions(realTrace: any): World["actionSequence"] {
  return [
    { step: 0, action: "search_products", params: {} },
    { step: 1, action: "add_to_cart", params: { productPrice: 200 } },
    { step: 2, action: "checkout", params: {} },
  ];
}

/**
 * Generate conservative action sequence
 */
function generateConservativeActions(realTrace: any): World["actionSequence"] {
  return [
    { step: 0, action: "answer_question", params: { hasKBMatch: true } },
    { step: 1, action: "search_products", params: {} },
    { step: 2, action: "answer_question", params: { hasKBMatch: true } },
    { step: 3, action: "add_to_cart", params: { productPrice: 100 } },
  ];
}

/**
 * Generate balanced action sequence
 */
function generateBalancedActions(realTrace: any): World["actionSequence"] {
  return [
    { step: 0, action: "answer_question", params: { hasKBMatch: true } },
    { step: 1, action: "add_to_cart", params: { productPrice: 150 } },
    { step: 2, action: "checkout", params: {} },
  ];
}

/**
 * Generate escalation-focused sequence
 */
function generateEscalationActions(realTrace: any): World["actionSequence"] {
  return [
    { step: 0, action: "clarify_intent", params: {} },
    { step: 1, action: "escalate_human", params: { reason: "safety" } },
  ];
}

// ========================================
// COHERENCE CALCULATION
// ========================================

/**
 * Calculate coherence metric
 * 
 * Coherence = 1 - E[rₜ]² / Var(rₜ)
 * 
 * High coherence = consistent outcomes across worlds
 * Low coherence = high variance = uncertainty
 */
export function calculateCoherence(worlds: World[]): {
  coherence: number;
  meanReward: number;
  rewardVariance: number;
} {
  const rewards = worlds.map(w => w.totalReward);
  
  // Calculate mean E[rₜ]
  const meanReward = rewards.reduce((sum, r) => sum + r, 0) / rewards.length;
  
  // Calculate variance Var(rₜ)
  const squaredDiffs = rewards.map(r => Math.pow(r - meanReward, 2));
  const rewardVariance = squaredDiffs.reduce((sum, d) => sum + d, 0) / rewards.length;
  
  // Calculate coherence
  let coherence: number;
  if (rewardVariance === 0) {
    // Perfect coherence (all worlds have same reward)
    coherence = 1.0;
  } else {
    // Formula: Coherence = 1 - E[r]²/Var(r)
    coherence = 1.0 - (Math.pow(meanReward, 2) / rewardVariance);
    
    // Clamp to [0, 1]
    coherence = Math.max(0, Math.min(1, coherence));
  }
  
  return {
    coherence,
    meanReward,
    rewardVariance,
  };
}

// ========================================
// DREAM LOOP EXECUTION
// ========================================

/**
 * Run dream loop simulation
 * 
 * Main entry point for self-reflection
 */
export async function runDreamLoop(
  realTrace: {
    states: any[];
    actions: any[];
    totalReward: number;
  },
  options: {
    numWorlds?: number;
    rewardFn?: RewardFunction;
    planSessionId?: string;
  } = {}
): Promise<DreamSession> {
  const startTime = Date.now();
  
  // Generate alternative worlds
  const numWorlds = options.numWorlds || 5;
  const rewardFn = options.rewardFn || ecommerceReward;
  
  console.info(`[Dream Loops] Generating ${numWorlds} alternative worlds...`);
  const worlds = generateAlternativeWorlds(realTrace, numWorlds);
  
  // Simulate each world
  for (const world of worlds) {
    if (world.id === "world-real") {
      continue; // Skip real world (already has outcome)
    }
    
    const simStart = Date.now();
    const outcome = simulateWorld(world.initialState, world.actionSequence, rewardFn);
    
    world.finalState = outcome.finalState;
    world.totalReward = outcome.totalReward;
    world.success = outcome.success;
    world.steps = world.actionSequence.length;
    world.simulationTime = Date.now() - simStart;
    
    console.info(
      `[Dream Loops] ${world.name}: reward=${world.totalReward.toFixed(1)}, ` +
      `success=${world.success}, time=${world.simulationTime}ms`
    );
  }
  
  // Calculate coherence
  const { coherence, meanReward, rewardVariance } = calculateCoherence(worlds);
  
  console.info(`[Dream Loops] Coherence: ${coherence.toFixed(3)}`);
  console.info(`[Dream Loops] Mean Reward: ${meanReward.toFixed(2)}`);
  console.info(`[Dream Loops] Reward Variance: ${rewardVariance.toFixed(2)}`);
  
  // Find best world
  const sortedWorlds = [...worlds].sort((a, b) => b.totalReward - a.totalReward);
  const bestWorld = sortedWorlds[0];
  
  // Generate policy improvement recommendation
  let policyImprovement: DreamSession["policyImprovement"] = null;
  
  if (bestWorld.id !== "world-real") {
    // Real world was not optimal, suggest improvement
    const expectedGain = bestWorld.totalReward - realTrace.totalReward;
    
    policyImprovement = {
      suggestedAction: bestWorld.name,
      reason: `${bestWorld.description}. Expected gain: +${expectedGain.toFixed(1)} reward`,
      expectedGain,
    };
    
    console.info(
      `[Dream Loops] RECOMMENDATION: Switch to "${bestWorld.name}" ` +
      `(+${expectedGain.toFixed(1)} expected gain)`
    );
  } else {
    console.info(`[Dream Loops] Real-world policy is already optimal`);
  }
  
  // Check coherence level
  if (coherence < 0.5) {
    console.warn(
      `[Dream Loops] LOW COHERENCE (${coherence.toFixed(3)}) - ` +
      `Policy has high uncertainty, needs more learning`
    );
  }
  
  return {
    id: `dream-${Date.now()}`,
    planSessionId: options.planSessionId,
    realTrace,
    worlds,
    coherence,
    meanReward,
    rewardVariance,
    bestWorld: bestWorld.id,
    policyImprovement,
    createdAt: new Date(),
    metadata: {
      totalSimulationTime: Date.now() - startTime,
      numWorldsSimulated: worlds.length,
    },
  };
}

/**
 * Interpret coherence value
 */
export function interpretCoherence(coherence: number): string {
  if (coherence >= 0.8) {
    return "EXCELLENT - Very consistent outcomes, policy is stable";
  } else if (coherence >= 0.6) {
    return "GOOD - Reasonably consistent, minor improvements possible";
  } else if (coherence >= 0.4) {
    return "MODERATE - Some variance, consider policy refinement";
  } else if (coherence >= 0.2) {
    return "LOW - High uncertainty, policy needs learning";
  } else {
    return "CRITICAL - Extremely unstable, requires immediate attention";
  }
}

/**
 * Export dream session for analysis
 */
export function exportDreamSession(session: DreamSession): string {
  return JSON.stringify({
    coherence: session.coherence,
    meanReward: session.meanReward,
    rewardVariance: session.rewardVariance,
    interpretation: interpretCoherence(session.coherence),
    bestWorld: session.bestWorld,
    policyImprovement: session.policyImprovement,
    worlds: session.worlds.map(w => ({
      id: w.id,
      name: w.name,
      totalReward: w.totalReward,
      success: w.success,
    })),
  }, null, 2);
}
