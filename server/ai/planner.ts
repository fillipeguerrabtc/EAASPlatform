/**
 * AI Planner/Decomposer with Tree-of-Thought (ToT) / Graph-of-Thought (GoT)
 * Based on EAAS Whitepaper 02 - Chapter 10
 * 
 * Mathematical Foundation:
 * score(a|s) = λ₁Q̂(s,a) - λ₂risk(s,a) + λ₃explain(s,a)
 * 
 * where:
 * - Q̂(s,a) = expected value (utility) of action a in state s
 * - risk(s,a) = risk penalty for action a
 * - explain(s,a) = explainability score (SHAP-like attribution)
 * - λ₁, λ₂, λ₃ = configurable weights (default: 0.5, 0.3, 0.2)
 * 
 * Decision Process:
 * 1. State Representation: Parse customer message + context
 * 2. Action Generation: Generate candidate actions via ToT
 * 3. Action Scoring: Evaluate each action with score function
 * 4. Action Selection: Choose highest-scoring action
 * 5. Execution Plan: Decompose into sub-tasks if needed
 */

export interface PlannerState {
  customerId: string;
  tenantId: string;
  message: string;
  conversationHistory?: any[];
  currentCart?: any;
  availableProducts?: any[];
  knowledgeBase?: any[];
  userPreferences?: any;
}

export interface Action {
  type: "answer_question" | "search_products" | "add_to_cart" | "checkout" | 
        "escalate_human" | "clarify_intent" | "multi_step_plan";
  params: Record<string, any>;
  description: string;
  estimatedComplexity: number; // [0,1] - 0=simple, 1=complex
}

export interface ScoredAction extends Action {
  score: number;
  breakdown: {
    qValue: number;      // Q̂(s,a) - expected utility
    risk: number;        // risk(s,a) - risk penalty
    explainability: number; // explain(s,a) - how well we can explain this
  };
  reasoning: string;
}

export interface PlannerConfig {
  weights: {
    lambda1: number; // Q-value weight
    lambda2: number; // Risk penalty weight  
    lambda3: number; // Explainability weight
  };
  maxActionsToConsider: number; // ToT breadth
  maxDepth: number; // ToT depth for multi-step plans
}

const DEFAULT_CONFIG: PlannerConfig = {
  weights: {
    lambda1: 0.5, // Utility most important
    lambda2: 0.3, // Risk second
    lambda3: 0.2, // Explainability third
  },
  maxActionsToConsider: 5,
  maxDepth: 3,
};

/**
 * Generate Candidate Actions via Tree-of-Thought
 * 
 * From whitepaper: ToT explores multiple reasoning paths
 * by generating alternative actions and evaluating them
 */
export function generateCandidateActions(state: PlannerState): Action[] {
  const actions: Action[] = [];
  const messageLower = state.message.toLowerCase();

  // Action 1: Direct product purchase intent
  if (/(comprar|adicionar|quero|add|buy)/i.test(messageLower)) {
    actions.push({
      type: "add_to_cart",
      params: { searchQuery: state.message },
      description: "Search and add product to cart based on user intent",
      estimatedComplexity: 0.4,
    });
  }

  // Action 2: Checkout intent
  if (/(checkout|finalizar|pagar|concluir)/i.test(messageLower)) {
    actions.push({
      type: "checkout",
      params: {},
      description: "Initiate checkout process for current cart",
      estimatedComplexity: 0.3,
    });
  }

  // Action 3: Information query (Knowledge Base)
  if (/(como|quando|onde|o que|what|how|when|where)/i.test(messageLower)) {
    actions.push({
      type: "answer_question",
      params: { query: state.message },
      description: "Answer question using Knowledge Base or AI",
      estimatedComplexity: 0.5,
    });
  }

  // Action 4: Product browsing/search
  if (/(produto|ver|mostrar|show|product|list)/i.test(messageLower)) {
    actions.push({
      type: "search_products",
      params: { query: state.message },
      description: "Search and display available products",
      estimatedComplexity: 0.3,
    });
  }

  // Action 5: Human escalation (frustration detected)
  if (/(problema|erro|não funciona|ajuda|help|issue)/i.test(messageLower)) {
    actions.push({
      type: "escalate_human",
      params: { reason: "customer_frustration" },
      description: "Escalate to human agent due to potential issue",
      estimatedComplexity: 0.2,
    });
  }

  // Action 6: Intent clarification (ambiguous message)
  if (actions.length === 0 || state.message.length < 10) {
    actions.push({
      type: "clarify_intent",
      params: {},
      description: "Ask clarifying question to understand user intent",
      estimatedComplexity: 0.1,
    });
  }

  // Action 7: Multi-step plan for complex requests
  if (state.message.length > 100 || 
      (state.message.match(/e|and/gi) || []).length > 2) {
    actions.push({
      type: "multi_step_plan",
      params: { originalMessage: state.message },
      description: "Decompose complex request into sequential steps",
      estimatedComplexity: 0.8,
    });
  }

  return actions;
}

/**
 * Q-Value Estimation: Q̂(s,a)
 * 
 * Estimates expected utility of action in current state
 * Higher Q means better expected outcome for customer
 */
function estimateQValue(action: Action, state: PlannerState): number {
  let qValue = 0.5; // Base utility

  switch (action.type) {
    case "add_to_cart":
      // High utility if products available
      if (state.availableProducts && state.availableProducts.length > 0) {
        qValue += 0.3;
      }
      // Check if product name in message matches available products
      const messageLower = state.message.toLowerCase();
      const hasProductMatch = state.availableProducts?.some(p => 
        messageLower.includes(p.name.toLowerCase())
      );
      if (hasProductMatch) {
        qValue += 0.2;
      }
      break;

    case "checkout":
      // High utility if cart has items
      if (state.currentCart && (state.currentCart.items?.length || 0) > 0) {
        qValue += 0.4;
      } else {
        qValue -= 0.5; // Negative if cart empty
      }
      break;

    case "answer_question":
      // High utility if KB has relevant content
      if (state.knowledgeBase && state.knowledgeBase.length > 0) {
        qValue += 0.3;
      }
      break;

    case "search_products":
      // Moderate utility for browsing
      qValue += 0.2;
      break;

    case "escalate_human":
      // Lower utility (we prefer AI to solve)
      qValue -= 0.1;
      // But high utility if customer frustrated
      if (/(problema|erro|não funciona)/i.test(state.message)) {
        qValue += 0.5;
      }
      break;

    case "clarify_intent":
      // Low utility, but necessary for ambiguity
      qValue += 0.1;
      break;

    case "multi_step_plan":
      // High utility for complex tasks
      qValue += 0.3;
      break;
  }

  return Math.max(0, Math.min(1, qValue));
}

/**
 * Risk Estimation: risk(s,a)
 * 
 * From whitepaper: R_fraude = P(chargeback) · impacto_econômico
 * Estimates risk penalty for action
 */
function estimateRisk(action: Action, state: PlannerState): number {
  let risk = 0.0;

  switch (action.type) {
    case "add_to_cart":
      // Risk if cart value becomes very high
      const currentCartValue = parseFloat(state.currentCart?.total || "0");
      if (currentCartValue > 1000) {
        risk += 0.3;
      }
      if (currentCartValue > 5000) {
        risk += 0.5;
      }
      break;

    case "checkout":
      // Risk based on cart value
      const checkoutValue = parseFloat(state.currentCart?.total || "0");
      if (checkoutValue > 500) {
        risk += 0.2;
      }
      if (checkoutValue > 2000) {
        risk += 0.4;
      }
      // Risk if cart empty
      if ((state.currentCart?.items?.length || 0) === 0) {
        risk += 0.8;
      }
      break;

    case "answer_question":
      // Low risk for information queries
      risk += 0.05;
      // Unless question is about refunds/disputes
      if (/(reembolso|estorno|cancelar|fraude)/i.test(state.message)) {
        risk += 0.6;
      }
      break;

    case "search_products":
      // Very low risk
      risk += 0.02;
      break;

    case "escalate_human":
      // Low risk (it's the safe option)
      risk += 0.1;
      break;

    case "clarify_intent":
      // Minimal risk
      risk += 0.05;
      break;

    case "multi_step_plan":
      // Moderate risk due to complexity
      risk += 0.2;
      break;
  }

  // Additional risk factors from message content
  if (/(urgente|imediato|agora)/i.test(state.message)) {
    risk += 0.1; // Urgency pressure
  }

  return Math.max(0, Math.min(1, risk));
}

/**
 * Explainability Score: explain(s,a)
 * 
 * From whitepaper: SHAP-like attribution
 * How well can we explain why this action was chosen?
 */
function estimateExplainability(action: Action, state: PlannerState): number {
  let explainScore = 0.5; // Base explainability

  // Simple actions are more explainable
  if (action.estimatedComplexity < 0.3) {
    explainScore += 0.3;
  } else if (action.estimatedComplexity > 0.7) {
    explainScore -= 0.2;
  }

  // Actions with clear intent signals are more explainable
  const messageLower = state.message.toLowerCase();
  
  switch (action.type) {
    case "add_to_cart":
      if (/(comprar|adicionar|buy|add)/i.test(messageLower)) {
        explainScore += 0.4; // Clear purchase intent
      }
      break;

    case "checkout":
      if (/(checkout|finalizar|pagar)/i.test(messageLower)) {
        explainScore += 0.5; // Very clear checkout intent
      }
      break;

    case "answer_question":
      if (/(como|quando|o que|what|how)/i.test(messageLower)) {
        explainScore += 0.4; // Clear question words
      }
      break;

    case "escalate_human":
      if (/(problema|erro|ajuda|help)/i.test(messageLower)) {
        explainScore += 0.4; // Clear distress signals
      }
      break;
  }

  return Math.max(0, Math.min(1, explainScore));
}

/**
 * Action Scoring Function
 * 
 * Mathematical Formula from whitepaper:
 * score(a|s) = λ₁Q̂(s,a) - λ₂risk(s,a) + λ₃explain(s,a)
 */
export function scoreAction(
  action: Action,
  state: PlannerState,
  config: PlannerConfig = DEFAULT_CONFIG
): ScoredAction {
  const qValue = estimateQValue(action, state);
  const risk = estimateRisk(action, state);
  const explainability = estimateExplainability(action, state);

  // Apply scoring formula
  const score = 
    config.weights.lambda1 * qValue -
    config.weights.lambda2 * risk +
    config.weights.lambda3 * explainability;

  // Generate reasoning explanation
  const reasoning = `Q-Value: ${qValue.toFixed(2)} (expected utility), ` +
                   `Risk: ${risk.toFixed(2)} (penalty), ` +
                   `Explainability: ${explainability.toFixed(2)} → ` +
                   `Final Score: ${score.toFixed(2)}`;

  return {
    ...action,
    score,
    breakdown: {
      qValue,
      risk,
      explainability,
    },
    reasoning,
  };
}

/**
 * Plan Action - Main Entry Point
 * 
 * Uses Tree-of-Thought to:
 * 1. Generate candidate actions
 * 2. Score each action
 * 3. Select best action
 * 4. Return execution plan
 */
export function planAction(
  state: PlannerState,
  config: PlannerConfig = DEFAULT_CONFIG
): ScoredAction {
  // Step 1: Generate candidate actions via ToT
  const candidates = generateCandidateActions(state);

  // Limit to maxActionsToConsider for efficiency
  const consideredActions = candidates.slice(0, config.maxActionsToConsider);

  // Step 2: Score all actions
  const scoredActions = consideredActions.map(action => 
    scoreAction(action, state, config)
  );

  // Step 3: Select best action (highest score)
  const bestAction = scoredActions.reduce((best, current) => 
    current.score > best.score ? current : best
  );

  // Log decision process
  console.info(`[AI Planner] Considered ${scoredActions.length} actions`);
  console.info(`[AI Planner] Selected: ${bestAction.type} (score: ${bestAction.score.toFixed(2)})`);
  console.info(`[AI Planner] Reasoning: ${bestAction.reasoning}`);

  return bestAction;
}

/**
 * Decompose Complex Task into Sub-Tasks
 * 
 * For multi_step_plan action type
 * Uses Graph-of-Thought to handle dependencies
 */
export interface SubTask {
  step: number;
  action: Action;
  dependencies: number[]; // Which steps must complete first
}

export function decomposePlan(
  message: string,
  state: PlannerState,
  maxDepth: number = 3
): SubTask[] {
  const subTasks: SubTask[] = [];
  
  // Simple decomposition: split by "and", "then", "e", "depois"
  const segments = message.split(/\s+(e|and|então|then|depois|after)\s+/i);
  
  for (let i = 0; i < Math.min(segments.length, maxDepth); i++) {
    const segment = segments[i].trim();
    
    // Skip conjunction words themselves
    if (/(^e$|^and$|^então$|^then$|^depois$|^after$)/i.test(segment)) {
      continue;
    }
    
    // Generate action for this segment
    const segmentState = { ...state, message: segment };
    const candidateActions = generateCandidateActions(segmentState);
    
    if (candidateActions.length > 0) {
      subTasks.push({
        step: subTasks.length + 1,
        action: candidateActions[0], // Take first (most relevant)
        dependencies: i > 0 ? [i] : [], // Sequential dependency
      });
    }
  }
  
  return subTasks;
}
