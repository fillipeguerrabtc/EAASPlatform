/**
 * COMPLETE POMDP + Tree-of-Thought (ToT) / Graph-of-Thought (GoT) Planner
 * Based on EAAS Whitepaper 02 - Chapter 10: Núcleo Cognitivo
 * 
 * Mathematical Foundation:
 * ========================
 * 
 * POMDP Formulation:
 * - States S = {s₁, s₂, ..., sₙ}
 * - Actions A = {a₁, a₂, ..., aₘ}
 * - Observations O = {o₁, o₂, ..., oₖ}
 * - Transition model T(s'|s,a) - probability of reaching s' from s via action a
 * - Observation model Ω(o|s',a) - probability of observing o after reaching s' via a
 * - Belief state b(s) - probability distribution over states
 * - Belief update: b'(s') = η · Ω(o|s',a) · ∑ₛ T(s'|s,a) · b(s)
 * 
 * Action Scoring Formula:
 * score(a|s) = λ₁Q̂(s,a) - λ₂risk(s,a) + λ₃explain(s,a)
 * 
 * where:
 * - Q̂(s,a) = Expected utility of action a in state s
 * - risk(s,a) = Risk penalty for action a
 * - explain(s,a) = Explainability score (SHAP-like)
 * - λ₁=0.5, λ₂=0.3, λ₃=0.2 (default weights)
 * 
 * Tree-of-Thought:
 * - Each node represents an action hypothesis
 * - Branches explore alternative reasoning paths
 * - Depth-limited search with maxDepth parameter
 * - Best-first expansion using score(a|s)
 * - Backpropagation updates parent node values
 * 
 * Graph-of-Thought (for multi_step_plan):
 * - DAG structure with dependencies
 * - Nodes can have multiple parents
 * - Topological sorting for execution order
 */

import { storage } from "../storage";
import type { PlanSession, PlanNode, Tenant } from "@shared/schema";

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * World State Representation
 * Complete observable state from customer perspective
 */
export interface WorldState {
  // Customer Context
  customerId: string;
  conversationId?: string;
  
  // Observable State
  message: string;
  conversationHistory: any[];
  currentCart?: {
    items: any[];
    total: string;
    itemCount: number;
  };
  
  // Available Resources
  availableProducts: any[];
  knowledgeBase: any[];
  
  // Customer Profile (affects preferences)
  userPreferences?: {
    pastPurchases?: string[];
    interests?: string[];
    priceRange?: { min: number; max: number };
  };
  
  // Environmental Factors
  timestamp: number;
  channel: string;
}

/**
 * Belief State b(s)
 * Probability distribution over possible states
 */
export interface BeliefState {
  // Customer Intent Distribution
  intentProbabilities: {
    purchase: number;          // Wants to buy something
    information: number;        // Asking a question
    browse: number;            // Just looking around
    checkout: number;          // Ready to pay
    support: number;           // Needs help/frustrated
    clarification: number;     // Unclear what they want
  };
  
  // Confidence Metrics
  intentConfidence: number;    // [0,1] How sure we are about intent
  stateUncertainty: number;    // [0,1] Overall state uncertainty
  
  // Historical Beliefs (for belief tracking)
  previousBeliefs?: BeliefState[];
}

/**
 * Action Types (from whitepaper)
 */
export type ActionType =
  | "answer_question"
  | "search_products"
  | "add_to_cart"
  | "checkout"
  | "escalate_human"
  | "clarify_intent"
  | "multi_step_plan";

/**
 * Action Representation
 */
export interface Action {
  type: ActionType;
  params: Record<string, any>;
  description: string;
  estimatedComplexity: number; // [0,1]
}

/**
 * Scored Action with POMDP components
 */
export interface ScoredAction extends Action {
  score: number;                    // Total score(a|s)
  qValue: number;                   // Q̂(s,a)
  risk: number;                     // risk(s,a)
  explainability: number;           // explain(s,a)
  reasoning: string;
  expectedNextState?: WorldState;   // T(s'|s,a) prediction
  confidenceInterval: [number, number]; // [min, max] score uncertainty
}

/**
 * Planner Configuration
 */
export interface PlannerConfig {
  weights: {
    lambda1: number; // Q-value weight
    lambda2: number; // Risk penalty weight
    lambda3: number; // Explainability weight
  };
  maxActionsToConsider: number; // Branching factor per node
  maxDepth: number;              // Tree depth limit
  explorationFactor: number;     // UCB1 exploration constant
  pruningThreshold: number;      // Min score to keep exploring
  sessionTimeoutMinutes: number; // Plan session TTL
}

export const DEFAULT_CONFIG: PlannerConfig = {
  weights: {
    lambda1: 0.5, // Utility most important
    lambda2: 0.3, // Risk second
    lambda3: 0.2, // Explainability third
  },
  maxActionsToConsider: 5,
  maxDepth: 3,
  explorationFactor: 1.4, // UCB1 constant (sqrt(2) ≈ 1.414)
  pruningThreshold: 0.1,  // Prune branches with score < 0.1
  sessionTimeoutMinutes: 30,
};

/**
 * Planner Context (shared state for critics/RAG integration)
 */
export interface PlannerContext {
  state: WorldState;
  belief: BeliefState;
  tenant: Tenant;
  session?: PlanSession;
  config: PlannerConfig;
  // Integration points
  criticsEnabled: boolean;
  ragEnabled: boolean;
}

// ========================================
// BELIEF STATE ESTIMATION
// ========================================

/**
 * Initial Belief State from Observation
 * 
 * From whitepaper: b₀(s) - initial belief before any actions
 */
export function estimateInitialBelief(state: WorldState): BeliefState {
  const message = state.message.toLowerCase();
  const hasCart = state.currentCart && state.currentCart.itemCount > 0;
  
  // Intent detection via keyword matching (simple observation model Ω(o|s))
  const buyPatterns = /(comprar|adicionar|quero|buy|add|purchase)/i;
  const checkoutPatterns = /(checkout|finalizar|pagar|concluir|pay)/i;
  const questionPatterns = /(como|quando|onde|o que|what|how|when|where|why)/i;
  const browsePatterns = /(produto|ver|mostrar|show|product|list|browse)/i;
  const supportPatterns = /(problema|erro|não funciona|ajuda|help|issue|error)/i;
  
  // Calculate intent probabilities (normalize to sum to 1.0)
  let purchase = buyPatterns.test(message) ? 0.7 : 0.05;
  let checkout = checkoutPatterns.test(message) ? 0.8 : (hasCart ? 0.3 : 0.02);
  let information = questionPatterns.test(message) ? 0.6 : 0.1;
  let browse = browsePatterns.test(message) ? 0.5 : 0.15;
  let support = supportPatterns.test(message) ? 0.7 : 0.05;
  let clarification = (message.length < 10 || !message.match(/\w{3,}/g)) ? 0.6 : 0.1;
  
  // Normalize probabilities (softmax-like)
  const total = purchase + checkout + information + browse + support + clarification;
  
  const intentProbabilities = {
    purchase: purchase / total,
    information: information / total,
    browse: browse / total,
    checkout: checkout / total,
    support: support / total,
    clarification: clarification / total,
  };
  
  // Confidence based on message clarity
  const messageLength = state.message.length;
  const hasKeywords = buyPatterns.test(message) || checkoutPatterns.test(message) ||
                      questionPatterns.test(message) || browsePatterns.test(message);
  const intentConfidence = Math.min(1.0, (hasKeywords ? 0.7 : 0.3) + (messageLength / 200));
  
  // Uncertainty = 1 - max(intentProbabilities)
  const maxIntent = Math.max(...Object.values(intentProbabilities));
  const stateUncertainty = 1.0 - maxIntent;
  
  return {
    intentProbabilities,
    intentConfidence,
    stateUncertainty,
  };
}

/**
 * Belief Update after Action
 * 
 * From whitepaper: b'(s') = η · Ω(o|s',a) · ∑ₛ T(s'|s,a) · b(s)
 */
export function updateBelief(
  currentBelief: BeliefState,
  action: Action,
  observation: any
): BeliefState {
  // Store previous belief
  const previousBeliefs = currentBelief.previousBeliefs || [];
  previousBeliefs.push(currentBelief);
  
  // Simplified belief update (full Bayes filter would be more complex)
  // After action execution, we get new observation, update intent distribution
  
  const updatedBelief = { ...currentBelief };
  updatedBelief.previousBeliefs = previousBeliefs.slice(-5); // Keep last 5
  
  // If action was successful, increase confidence
  if (observation?.success) {
    updatedBelief.intentConfidence = Math.min(1.0, updatedBelief.intentConfidence + 0.1);
    updatedBelief.stateUncertainty = Math.max(0.0, updatedBelief.stateUncertainty - 0.1);
  }
  
  return updatedBelief;
}

// ========================================
// ACTION GENERATION (ToT Branching)
// ========================================

/**
 * Generate Candidate Actions
 * 
 * ToT explores multiple reasoning paths by generating alternative actions
 */
export function generateCandidateActions(
  state: WorldState,
  belief: BeliefState,
  depth: number,
  config: PlannerConfig
): Action[] {
  const actions: Action[] = [];
  const messageLower = state.message.toLowerCase();
  
  // Action generation based on belief state intent distribution
  const { intentProbabilities } = belief;
  
  // 1. Purchase intent actions
  if (intentProbabilities.purchase > 0.3) {
    actions.push({
      type: "add_to_cart",
      params: { searchQuery: state.message },
      description: "Search and add product to cart based on user intent",
      estimatedComplexity: 0.4,
    });
    
    actions.push({
      type: "search_products",
      params: { query: state.message, limit: 5 },
      description: "Show product options before adding to cart",
      estimatedComplexity: 0.3,
    });
  }
  
  // 2. Checkout intent actions
  if (intentProbabilities.checkout > 0.3) {
    actions.push({
      type: "checkout",
      params: {},
      description: "Initiate checkout process for current cart",
      estimatedComplexity: 0.3,
    });
  }
  
  // 3. Information seeking actions
  if (intentProbabilities.information > 0.3) {
    actions.push({
      type: "answer_question",
      params: { query: state.message },
      description: "Answer question using Knowledge Base or AI",
      estimatedComplexity: 0.5,
    });
  }
  
  // 4. Browse intent actions
  if (intentProbabilities.browse > 0.3) {
    actions.push({
      type: "search_products",
      params: { query: state.message },
      description: "Search and display available products",
      estimatedComplexity: 0.3,
    });
  }
  
  // 5. Support escalation
  if (intentProbabilities.support > 0.5) {
    actions.push({
      type: "escalate_human",
      params: { reason: "customer_frustration" },
      description: "Escalate to human agent due to detected frustration",
      estimatedComplexity: 0.2,
    });
  }
  
  // 6. Clarification needed
  if (intentProbabilities.clarification > 0.4) {
    actions.push({
      type: "clarify_intent",
      params: {},
      description: "Ask clarifying question to understand user intent",
      estimatedComplexity: 0.1,
    });
  }
  
  // 7. Multi-step planning (for complex requests at depth 0)
  if (depth === 0 && (state.message.length > 100 || state.message.split(/\s+/).length > 20)) {
    actions.push({
      type: "multi_step_plan",
      params: { originalMessage: state.message },
      description: "Decompose complex request into sequential steps (GoT)",
      estimatedComplexity: 0.8,
    });
  }
  
  // Limit to maxActionsToConsider
  return actions.slice(0, config.maxActionsToConsider);
}

// ========================================
// POMDP SCORING COMPONENTS
// ========================================

/**
 * Q-Value Estimation: Q̂(s,a)
 * 
 * Expected utility of action in current state
 * From whitepaper: Q̂ incorporates transition model T(s'|s,a)
 */
function estimateQValue(action: Action, state: WorldState, belief: BeliefState): number {
  let qValue = 0.5; // Base utility
  const { intentProbabilities } = belief;
  
  switch (action.type) {
    case "add_to_cart":
      // High Q if products available and purchase intent
      if (state.availableProducts?.length > 0) {
        qValue += 0.2 * intentProbabilities.purchase;
      }
      
      // Check product match
      const messageLower = state.message.toLowerCase();
      const hasProductMatch = state.availableProducts?.some(p =>
        messageLower.includes(p.name?.toLowerCase() || "")
      );
      
      if (hasProductMatch) {
        qValue += 0.3;
      }
      
      // Penalty if cart already has many items
      if (state.currentCart && state.currentCart.itemCount > 5) {
        qValue -= 0.1;
      }
      break;
      
    case "checkout":
      // High Q if cart has items and checkout intent
      if (state.currentCart && state.currentCart.itemCount > 0) {
        qValue += 0.4 * intentProbabilities.checkout;
      } else {
        qValue = 0.0; // Cannot checkout with empty cart
      }
      break;
      
    case "answer_question":
      // High Q if KB available and information intent
      if (state.knowledgeBase?.length > 0) {
        qValue += 0.3 * intentProbabilities.information;
      }
      break;
      
    case "search_products":
      // Moderate Q for browsing
      qValue += 0.2 * (intentProbabilities.browse + intentProbabilities.purchase) / 2;
      break;
      
    case "escalate_human":
      // High Q only if support intent detected
      qValue = 0.2 + (0.6 * intentProbabilities.support);
      break;
      
    case "clarify_intent":
      // Q proportional to uncertainty
      qValue = 0.3 * belief.stateUncertainty;
      break;
      
    case "multi_step_plan":
      // High Q for complex messages
      qValue += 0.3;
      break;
  }
  
  return Math.max(0, Math.min(1, qValue));
}

/**
 * Risk Estimation: risk(s,a)
 * 
 * From whitepaper: R_fraude = P(chargeback) · impacto_econômico
 */
function estimateRisk(action: Action, state: WorldState, belief: BeliefState): number {
  let risk = 0.0;
  
  switch (action.type) {
    case "add_to_cart":
      // Risk based on cart value
      const cartValue = parseFloat(state.currentCart?.total || "0");
      if (cartValue > 1000) risk += 0.2;
      if (cartValue > 5000) risk += 0.4;
      
      // Risk if low intent confidence
      risk += (1.0 - belief.intentConfidence) * 0.2;
      break;
      
    case "checkout":
      const checkoutValue = parseFloat(state.currentCart?.total || "0");
      if (checkoutValue > 500) risk += 0.2;
      if (checkoutValue > 2000) risk += 0.4;
      
      // High risk if checkout with low confidence
      if (belief.intentProbabilities.checkout < 0.5) {
        risk += 0.3;
      }
      break;
      
    case "answer_question":
      // Low risk, but increase if sensitive topics
      risk += 0.05;
      if (/(reembolso|estorno|fraude|refund|chargeback)/i.test(state.message)) {
        risk += 0.5;
      }
      break;
      
    case "search_products":
    case "clarify_intent":
      // Very low risk
      risk += 0.02;
      break;
      
    case "escalate_human":
      // Low risk (safe option)
      risk += 0.1;
      break;
      
    case "multi_step_plan":
      // Moderate risk due to complexity
      risk += 0.2;
      break;
  }
  
  return Math.max(0, Math.min(1, risk));
}

/**
 * Explainability Score: explain(s,a)
 * 
 * From whitepaper: SHAP-like attribution
 * How well can we explain this action choice?
 */
function estimateExplainability(action: Action, state: WorldState, belief: BeliefState): number {
  let explainScore = 0.5;
  
  // Simple actions are more explainable
  if (action.estimatedComplexity < 0.3) {
    explainScore += 0.3;
  } else if (action.estimatedComplexity > 0.7) {
    explainScore -= 0.2;
  }
  
  // High intent probability = high explainability
  const relevantIntent = getRelevantIntent(action.type, belief);
  if (relevantIntent > 0.6) {
    explainScore += 0.4;
  }
  
  // Clear keywords in message = high explainability
  const hasKeywords = detectKeywords(action.type, state.message);
  if (hasKeywords) {
    explainScore += 0.3;
  }
  
  return Math.max(0, Math.min(1, explainScore));
}

function getRelevantIntent(actionType: ActionType, belief: BeliefState): number {
  const { intentProbabilities } = belief;
  
  switch (actionType) {
    case "add_to_cart": return intentProbabilities.purchase;
    case "checkout": return intentProbabilities.checkout;
    case "answer_question": return intentProbabilities.information;
    case "search_products": return intentProbabilities.browse;
    case "escalate_human": return intentProbabilities.support;
    case "clarify_intent": return intentProbabilities.clarification;
    case "multi_step_plan": return 0.5;
    default: return 0.0;
  }
}

function detectKeywords(actionType: ActionType, message: string): boolean {
  const lower = message.toLowerCase();
  
  const keywords: Record<ActionType, RegExp> = {
    add_to_cart: /(comprar|adicionar|buy|add)/i,
    checkout: /(checkout|finalizar|pagar|pay)/i,
    answer_question: /(como|quando|o que|what|how|when)/i,
    search_products: /(produto|ver|mostrar|show|product)/i,
    escalate_human: /(problema|erro|ajuda|help|issue)/i,
    clarify_intent: /.*/i, // Always true
    multi_step_plan: /.*/i,
  };
  
  return keywords[actionType]?.test(lower) || false;
}

/**
 * Score Action: score(a|s) = λ₁Q̂ - λ₂risk + λ₃explain
 */
export function scoreAction(
  action: Action,
  state: WorldState,
  belief: BeliefState,
  config: PlannerConfig = DEFAULT_CONFIG
): ScoredAction {
  const qValue = estimateQValue(action, state, belief);
  const risk = estimateRisk(action, state, belief);
  const explainability = estimateExplainability(action, state, belief);
  
  // Apply scoring formula
  const score =
    config.weights.lambda1 * qValue -
    config.weights.lambda2 * risk +
    config.weights.lambda3 * explainability;
  
  // Confidence interval (uncertainty estimate)
  const uncertainty = belief.stateUncertainty * 0.2; // Max ±20% from uncertainty
  const confidenceInterval: [number, number] = [
    Math.max(0, score - uncertainty),
    Math.min(1, score + uncertainty),
  ];
  
  const reasoning =
    `Q̂=${qValue.toFixed(3)} (utility) · risk=${risk.toFixed(3)} · ` +
    `explain=${explainability.toFixed(3)} → score=${score.toFixed(3)} ` +
    `CI=[${confidenceInterval[0].toFixed(2)}, ${confidenceInterval[1].toFixed(2)}]`;
  
  return {
    ...action,
    score,
    qValue,
    risk,
    explainability,
    reasoning,
    confidenceInterval,
  };
}

// ========================================
// TREE-OF-THOUGHT EXPANSION
// ========================================

/**
 * Create ToT Node in Database
 */
async function createTreeNode(
  sessionId: string,
  parentId: string | null,
  depth: number,
  scoredAction: ScoredAction
): Promise<PlanNode> {
  return await storage.createPlanNode({
    sessionId,
    parentId: parentId || undefined,
    depth,
    actionType: scoredAction.type,
    actionParams: scoredAction.params,
    description: scoredAction.description,
    qValue: scoredAction.qValue.toString(),
    riskScore: scoredAction.risk.toString(),
    explainScore: scoredAction.explainability.toString(),
    totalScore: scoredAction.score.toString(),
    dependencies: [],
    status: "pending",
  });
}

/**
 * Expand ToT Frontier
 * 
 * Best-first expansion: choose highest scoring unexplored node
 */
export async function expandFrontier(
  context: PlannerContext
): Promise<PlanNode | null> {
  if (!context.session) {
    throw new Error("No active plan session");
  }
  
  // Get all pending nodes
  const allNodes = await storage.getNodesBySession(context.session.id);
  const pendingNodes = allNodes.filter(n => n.status === "pending");
  
  if (pendingNodes.length === 0) {
    return null; // No more nodes to expand
  }
  
  // Find highest scoring pending node at shallowest depth
  pendingNodes.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return parseFloat(b.totalScore) - parseFloat(a.totalScore);
  });
  
  const nodeToExpand = pendingNodes[0];
  
  // Check depth limit
  if (nodeToExpand.depth >= context.config.maxDepth) {
    // Prune this node (too deep)
    await storage.updatePlanNode(nodeToExpand.id, { status: "pruned" });
    return null;
  }
  
  // Check pruning threshold
  if (parseFloat(nodeToExpand.totalScore) < context.config.pruningThreshold) {
    await storage.updatePlanNode(nodeToExpand.id, { status: "pruned" });
    return null;
  }
  
  // Generate child actions for this node
  const childActions = generateCandidateActions(
    context.state,
    context.belief,
    nodeToExpand.depth + 1,
    context.config
  );
  
  // Score and create child nodes
  for (const action of childActions) {
    const scored = scoreAction(action, context.state, context.belief, context.config);
    
    await createTreeNode(
      context.session.id,
      nodeToExpand.id,
      nodeToExpand.depth + 1,
      scored
    );
  }
  
  // Mark this node as explored
  await storage.updatePlanNode(nodeToExpand.id, { status: "completed" });
  
  return nodeToExpand;
}

// ========================================
// PLAN SESSION MANAGEMENT
// ========================================

/**
 * Create or Resume Plan Session
 */
export async function getOrCreatePlanSession(
  context: Omit<PlannerContext, "session">
): Promise<PlanSession> {
  // Try to resume existing session
  if (context.state.conversationId) {
    const existing = await storage.getActivePlanSession(
      context.state.conversationId
    );
    
    if (existing) {
      return existing;
    }
  }
  
  // Create new session
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + context.config.sessionTimeoutMinutes);
  
  const session = await storage.createPlanSession({
    conversationId: context.state.conversationId,
    customerId: context.state.customerId,
    beliefState: context.belief,
    currentState: context.state,
    maxDepth: context.config.maxDepth,
    exploredPaths: 0,
    completedActions: 0,
    expiresAt,
  });
  
  // Create root node (virtual)
  const rootAction: ScoredAction = {
    type: "clarify_intent",
    params: {},
    description: "Root planning node",
    estimatedComplexity: 0,
    score: 1.0,
    qValue: 1.0,
    risk: 0.0,
    explainability: 1.0,
    reasoning: "Root node",
    confidenceInterval: [1.0, 1.0],
  };
  
  const rootNode = await createTreeNode(session.id, null, 0, rootAction);
  
  // Update session with root
  await storage.updatePlanSession(session.id, {
    rootNodeId: rootNode.id,
    currentNodeId: rootNode.id,
  });
  
  return session;
}

/**
 * Select Best Action from ToT
 * 
 * After tree exploration, select highest scoring leaf action
 */
export async function selectBestAction(session: PlanSession): Promise<ScoredAction | null> {
  const allNodes = await storage.getNodesBySession(session.id);
  
  if (allNodes.length <= 1) {
    return null; // Only root node
  }
  
  // Get all leaf nodes (no children)
  const leafNodes: PlanNode[] = [];
  for (const node of allNodes) {
    const children = await storage.getChildNodes(node.id);
    if (children.length === 0 && node.status !== "pruned") {
      leafNodes.push(node);
    }
  }
  
  if (leafNodes.length === 0) {
    return null;
  }
  
  // Select highest scoring leaf
  leafNodes.sort((a, b) => parseFloat(b.totalScore) - parseFloat(a.totalScore));
  const best = leafNodes[0];
  
  return {
    type: best.actionType as ActionType,
    params: best.actionParams as Record<string, any>,
    description: best.description,
    estimatedComplexity: 0.5, // Not stored in DB
    score: parseFloat(best.totalScore),
    qValue: parseFloat(best.qValue),
    risk: parseFloat(best.riskScore),
    explainability: parseFloat(best.explainScore),
    reasoning: `Selected from ToT depth=${best.depth}, explored ${allNodes.length} nodes`,
    confidenceInterval: [
      Math.max(0, parseFloat(best.totalScore) - 0.1),
      Math.min(1, parseFloat(best.totalScore) + 0.1),
    ],
  };
}

// ========================================
// MAIN PLANNING ENTRY POINT
// ========================================

/**
 * Plan Action with Full POMDP + ToT
 * 
 * This is the main entry point called by routes.ts
 */
export async function planActionWithPOMDP(
  state: WorldState,
  tenant: Tenant,
  config: PlannerConfig = DEFAULT_CONFIG
): Promise<ScoredAction> {
  // Step 1: Estimate initial belief b₀(s)
  const belief = estimateInitialBelief(state);
  
  console.info(`[POMDP Planner] Initial belief - Intent: ${JSON.stringify(belief.intentProbabilities)}`);
  console.info(`[POMDP Planner] Confidence: ${belief.intentConfidence.toFixed(2)}, Uncertainty: ${belief.stateUncertainty.toFixed(2)}`);
  
  // Step 2: Create planner context
  const context: Omit<PlannerContext, "session"> = {
    state,
    belief,
    tenant,
    config,
    criticsEnabled: true,
    ragEnabled: true,
  };
  
  // Step 3: Get or create plan session
  const session = await getOrCreatePlanSession(context);
  const fullContext: PlannerContext = { ...context, session };
  
  // Step 4: Expand ToT frontier (explore maxDepth levels)
  let expansions = 0;
  const maxExpansions = config.maxActionsToConsider * config.maxDepth;
  
  while (expansions < maxExpansions) {
    const expanded = await expandFrontier(fullContext);
    if (!expanded) break; // No more nodes to expand
    expansions++;
  }
  
  console.info(`[POMDP Planner] Explored ${expansions} ToT nodes`);
  
  // Step 5: Select best action from tree
  const bestAction = await selectBestAction(session);
  
  if (!bestAction) {
    // Fallback: generate and score actions directly (no tree)
    console.warn("[POMDP Planner] No tree nodes available, using fallback");
    const actions = generateCandidateActions(state, belief, 0, config);
    const scoredActions = actions.map(a => scoreAction(a, state, belief, config));
    return scoredActions.reduce((best, curr) => curr.score > best.score ? curr : best);
  }
  
  console.info(`[POMDP Planner] Selected action: ${bestAction.type} (score: ${bestAction.score.toFixed(3)})`);
  console.info(`[POMDP Planner] Reasoning: ${bestAction.reasoning}`);
  
  return bestAction;
}

/**
 * Legacy Interface (for backward compatibility)
 */
export interface PlannerState {
  customerId: string;
  message: string;
  conversationHistory?: any[];
  currentCart?: any;
  availableProducts?: any[];
  knowledgeBase?: any[];
  userPreferences?: any;
}

export async function planAction(
  legacyState: PlannerState,
  config: PlannerConfig = DEFAULT_CONFIG
): Promise<ScoredAction> {
  // Convert legacy state to WorldState
  const state: WorldState = {
    customerId: legacyState.customerId,
    message: legacyState.message,
    conversationHistory: legacyState.conversationHistory || [],
    currentCart: legacyState.currentCart,
    availableProducts: legacyState.availableProducts || [],
    knowledgeBase: legacyState.knowledgeBase || [],
    userPreferences: legacyState.userPreferences,
    timestamp: Date.now(),
    channel: "web",
  };
  
  // Get single tenant (single-tenant mode)
  const tenants = await storage.listTenants();
  const tenant = tenants[0];
  if (!tenant) {
    throw new Error(`No tenant found in single-tenant system`);
  }
  
  return await planActionWithPOMDP(state, tenant, config);
}

// ========================================
// GRAPH-OF-THOUGHT (GoT) FOR MULTI-STEP
// ========================================

/**
 * Decompose into DAG with dependencies
 */
export interface GoTNode {
  step: number;
  action: Action;
  dependencies: number[]; // Which steps must complete first
  nodeId?: string;
}

export async function decomposeIntoGoT(
  message: string,
  sessionId: string,
  state: WorldState,
  belief: BeliefState,
  config: PlannerConfig
): Promise<GoTNode[]> {
  const nodes: GoTNode[] = [];
  
  // Simple decomposition: split by conjunctions
  const segments = message.split(/\s+(e|and|então|then|depois|after|,)\s+/i);
  const meaningfulSegments = segments.filter(s => s.length > 5 && !/^(e|and|então|then|depois|after)$/i.test(s));
  
  for (let i = 0; i < Math.min(meaningfulSegments.length, config.maxDepth); i++) {
    const segment = meaningfulSegments[i].trim();
    
    // Generate action for this segment
    const segmentState = { ...state, message: segment };
    const segmentBelief = estimateInitialBelief(segmentState);
    const candidateActions = generateCandidateActions(segmentState, segmentBelief, i, config);
    
    if (candidateActions.length > 0) {
      const scoredAction = scoreAction(candidateActions[0], segmentState, segmentBelief, config);
      
      // Create node in database
      const dbNode = await createTreeNode(sessionId, null, i, scoredAction);
      
      nodes.push({
        step: i + 1,
        action: candidateActions[0],
        dependencies: i > 0 ? [i] : [], // Sequential dependency
        nodeId: dbNode.id,
      });
    }
  }
  
  return nodes;
}
