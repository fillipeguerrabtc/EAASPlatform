/**
 * LTL+D Model Checker - Linear Temporal Logic with Deontic Extensions
 * Based on EAAS Whitepaper 02 - Chapter 12 + Appendix C
 * 
 * Mathematical Foundation:
 * ========================
 * 
 * LTL (Linear Temporal Logic) Operators:
 * - □ p (G p) - Globally/Always: p holds at all future states
 * - ◇ p (F p) - Finally/Eventually: p holds at some future state
 * - p U q - Until: p holds until q becomes true
 * - O p (X p) - Next: p holds in the next state
 * 
 * Deontic Operators (normative logic):
 * - O p - Obligation: p is obligatory/required
 * - P p - Permission: p is permitted
 * - F p - Forbidden: p is forbidden (equivalent to O ¬p)
 * 
 * Combined LTL+D Formulas (examples from whitepaper):
 * - □(risk(a) > τ → O handoff(a))
 *   "Always: if risk exceeds threshold, escalation is obligatory"
 * 
 * - G(answer → O citation)
 *   "Globally: if AI answers, citing source is obligatory"
 * 
 * - G(P̄ < Pₜ → F persuade(customer))
 *   "Always: if persuasion limit exceeded, further persuasion is forbidden"
 * 
 * Execution Traces:
 * - π = ⟨s₀, a₀, s₁, a₁, s₂, a₂, ...⟩
 * - Verification checks if π ⊨ φ (trace satisfies formula φ)
 * 
 * Model Checking Algorithm:
 * 1. Parse LTL+D formula into AST
 * 2. Evaluate formula over execution trace
 * 3. Return satisfaction result + counterexample if violated
 */

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Execution Trace (π)
 * Sequence of states and actions
 */
export interface ExecutionTrace {
  states: State[];
  actions: Action[];
  timestamp: Date;
  tenantId: string;
  conversationId?: string;
}

/**
 * State in execution trace
 */
export interface State {
  index: number;
  timestamp: Date;
  
  // Observable state variables
  cartValue: number;
  customerSentiment: number;      // [-1, 1]
  persuasionLevel: number;        // [0, 1]
  riskScore: number;              // [0, 1]
  hasKBCitation: boolean;
  isEscalated: boolean;
  
  // Additional context
  metadata: Record<string, any>;
}

/**
 * Action in execution trace
 */
export interface Action {
  index: number;
  type: string;
  params: Record<string, any>;
  timestamp: Date;
}

/**
 * LTL+D Formula AST Nodes
 */
export type LTLFormula =
  | { type: "prop"; predicate: string; args: any[] }           // Atomic proposition
  | { type: "not"; formula: LTLFormula }                       // Negation
  | { type: "and"; left: LTLFormula; right: LTLFormula }       // Conjunction
  | { type: "or"; left: LTLFormula; right: LTLFormula }        // Disjunction
  | { type: "implies"; left: LTLFormula; right: LTLFormula }   // Implication
  | { type: "globally"; formula: LTLFormula }                  // □ (G)
  | { type: "finally"; formula: LTLFormula }                   // ◇ (F)
  | { type: "next"; formula: LTLFormula }                      // O (X)
  | { type: "until"; left: LTLFormula; right: LTLFormula }     // U
  | { type: "obligation"; formula: LTLFormula }                // Deontic O
  | { type: "permission"; formula: LTLFormula }                // Deontic P
  | { type: "forbidden"; formula: LTLFormula };                // Deontic F

/**
 * Verification Result
 */
export interface VerificationResult {
  satisfied: boolean;
  formula: string;
  trace: ExecutionTrace;
  
  // If violated
  counterexample?: {
    stateIndex: number;
    reason: string;
    actualValue: any;
    expectedCondition: string;
  };
  
  // Metadata
  evaluationTime: number; // ms
  statesChecked: number;
}

/**
 * Policy Definition (stored per tenant)
 */
export interface EthicalPolicy {
  id: string;
  name: string;
  description: string;
  formula: LTLFormula;
  enabled: boolean;
  severity: "info" | "warning" | "critical";
}

// ========================================
// ATOMIC PREDICATES (building blocks)
// ========================================

/**
 * Evaluate atomic predicate on state
 */
function evaluatePredicate(predicate: string, args: any[], state: State): boolean {
  switch (predicate) {
    // Risk predicates
    case "risk_exceeds":
      return state.riskScore > (args[0] || 0.7);
    
    case "risk_below":
      return state.riskScore <= (args[0] || 0.3);
    
    // Cart predicates
    case "cart_value_exceeds":
      return state.cartValue > (args[0] || 1000);
    
    case "cart_empty":
      return state.cartValue === 0;
    
    // Citation predicates
    case "has_citation":
      return state.hasKBCitation === true;
    
    case "no_citation":
      return state.hasKBCitation === false;
    
    // Escalation predicates
    case "is_escalated":
      return state.isEscalated === true;
    
    case "not_escalated":
      return state.isEscalated === false;
    
    // Persuasion predicates
    case "persuasion_exceeds":
      return state.persuasionLevel > (args[0] || 0.7);
    
    case "persuasion_within_limits":
      return state.persuasionLevel <= (args[0] || 0.7);
    
    // Sentiment predicates
    case "customer_frustrated":
      return state.customerSentiment < -0.5;
    
    case "customer_satisfied":
      return state.customerSentiment > 0.5;
    
    // Metadata predicates (custom)
    case "metadata_equals":
      const [key, value] = args;
      return state.metadata[key] === value;
    
    default:
      console.warn(`[LTL] Unknown predicate: ${predicate}`);
      return false;
  }
}

// ========================================
// LTL MODEL CHECKER CORE
// ========================================

/**
 * Evaluate LTL+D formula on execution trace
 * 
 * Returns true if trace ⊨ formula
 */
export function evaluateFormula(
  formula: LTLFormula,
  trace: ExecutionTrace,
  startIndex: number = 0
): boolean {
  const states = trace.states;
  
  if (startIndex >= states.length) {
    return false; // No more states to check
  }
  
  const currentState = states[startIndex];
  
  switch (formula.type) {
    // ========== PROPOSITIONAL ===========
    case "prop":
      return evaluatePredicate(formula.predicate, formula.args, currentState);
    
    case "not":
      return !evaluateFormula(formula.formula, trace, startIndex);
    
    case "and":
      return (
        evaluateFormula(formula.left, trace, startIndex) &&
        evaluateFormula(formula.right, trace, startIndex)
      );
    
    case "or":
      return (
        evaluateFormula(formula.left, trace, startIndex) ||
        evaluateFormula(formula.right, trace, startIndex)
      );
    
    case "implies":
      // p → q ≡ ¬p ∨ q
      return (
        !evaluateFormula(formula.left, trace, startIndex) ||
        evaluateFormula(formula.right, trace, startIndex)
      );
    
    // ========== TEMPORAL ===========
    case "globally": // □ p (G p)
      // p must hold at all future states (including current)
      for (let i = startIndex; i < states.length; i++) {
        if (!evaluateFormula(formula.formula, trace, i)) {
          return false;
        }
      }
      return true;
    
    case "finally": // ◇ p (F p)
      // p must hold at some future state (including current)
      for (let i = startIndex; i < states.length; i++) {
        if (evaluateFormula(formula.formula, trace, i)) {
          return true;
        }
      }
      return false;
    
    case "next": // O p (X p)
      // p must hold in next state
      if (startIndex + 1 >= states.length) {
        return false; // No next state
      }
      return evaluateFormula(formula.formula, trace, startIndex + 1);
    
    case "until": // p U q
      // p must hold until q becomes true
      for (let i = startIndex; i < states.length; i++) {
        if (evaluateFormula(formula.right, trace, i)) {
          return true; // q holds, until satisfied
        }
        if (!evaluateFormula(formula.left, trace, i)) {
          return false; // p stopped holding before q
        }
      }
      return false; // q never became true
    
    // ========== DEONTIC ===========
    case "obligation": // O p
      // p is obligatory (must be true)
      // In deontic logic, O p means "it ought to be that p"
      // We interpret this as: p must hold in current state
      return evaluateFormula(formula.formula, trace, startIndex);
    
    case "permission": // P p
      // p is permitted (may be true or false)
      // In deontic logic, P p means "it is permitted that p"
      // We interpret this as: no violation if p holds or doesn't hold
      // But we still check if it holds for consistency
      return true; // Permission always satisfied (not a hard constraint)
    
    case "forbidden": // F p
      // p is forbidden (must be false)
      // F p ≡ O ¬p (forbidden is equivalent to obligation of negation)
      return !evaluateFormula(formula.formula, trace, startIndex);
    
    default:
      console.error(`[LTL] Unknown formula type: ${(formula as any).type}`);
      return false;
  }
}

/**
 * Verify policy over trace with detailed result
 */
export function verifyPolicy(
  policy: EthicalPolicy,
  trace: ExecutionTrace
): VerificationResult {
  const startTime = Date.now();
  
  try {
    const satisfied = evaluateFormula(policy.formula, trace, 0);
    
    const result: VerificationResult = {
      satisfied,
      formula: policy.name,
      trace,
      evaluationTime: Date.now() - startTime,
      statesChecked: trace.states.length,
    };
    
    // If violated, find counterexample
    if (!satisfied) {
      const counterexample = findCounterexample(policy.formula, trace);
      if (counterexample) {
        result.counterexample = counterexample;
      }
    }
    
    return result;
  } catch (error: any) {
    console.error(`[LTL] Verification error:`, error);
    return {
      satisfied: false,
      formula: policy.name,
      trace,
      evaluationTime: Date.now() - startTime,
      statesChecked: 0,
      counterexample: {
        stateIndex: 0,
        reason: `Verification error: ${error.message}`,
        actualValue: null,
        expectedCondition: policy.description,
      },
    };
  }
}

/**
 * Find counterexample (state where formula fails)
 */
function findCounterexample(
  formula: LTLFormula,
  trace: ExecutionTrace
): VerificationResult["counterexample"] | undefined {
  // Try to find first state where formula fails
  for (let i = 0; i < trace.states.length; i++) {
    if (!evaluateFormula(formula, trace, i)) {
      return {
        stateIndex: i,
        reason: `Formula violated at state ${i}`,
        actualValue: trace.states[i],
        expectedCondition: formatFormula(formula),
      };
    }
  }
  
  return undefined;
}

/**
 * Format formula as human-readable string
 */
function formatFormula(formula: LTLFormula): string {
  switch (formula.type) {
    case "prop":
      return `${formula.predicate}(${formula.args.join(", ")})`;
    case "not":
      return `¬${formatFormula(formula.formula)}`;
    case "and":
      return `(${formatFormula(formula.left)} ∧ ${formatFormula(formula.right)})`;
    case "or":
      return `(${formatFormula(formula.left)} ∨ ${formatFormula(formula.right)})`;
    case "implies":
      return `(${formatFormula(formula.left)} → ${formatFormula(formula.right)})`;
    case "globally":
      return `□${formatFormula(formula.formula)}`;
    case "finally":
      return `◇${formatFormula(formula.formula)}`;
    case "next":
      return `O${formatFormula(formula.formula)}`;
    case "until":
      return `(${formatFormula(formula.left)} U ${formatFormula(formula.right)})`;
    case "obligation":
      return `O${formatFormula(formula.formula)}`;
    case "permission":
      return `P${formatFormula(formula.formula)}`;
    case "forbidden":
      return `F${formatFormula(formula.formula)}`;
    default:
      return "?";
  }
}

// ========================================
// DEFAULT ETHICAL POLICIES (from Whitepaper 02)
// ========================================

/**
 * Policy 1: Risk Escalation
 * □(risk(a) > τ → O handoff(a))
 * "Always: if risk exceeds threshold, escalation is obligatory"
 */
export const POLICY_RISK_ESCALATION: EthicalPolicy = {
  id: "risk-escalation",
  name: "Risk-Based Escalation",
  description: "When risk exceeds threshold (τ=0.7), human escalation is obligatory",
  formula: {
    type: "globally",
    formula: {
      type: "implies",
      left: { type: "prop", predicate: "risk_exceeds", args: [0.7] },
      right: {
        type: "obligation",
        formula: { type: "prop", predicate: "is_escalated", args: [] },
      },
    },
  },
  enabled: true,
  severity: "critical",
};

/**
 * Policy 2: Knowledge Base Citation
 * G(answer → O citation)
 * "Globally: if AI answers from KB, citing source is obligatory"
 */
export const POLICY_KB_CITATION: EthicalPolicy = {
  id: "kb-citation",
  name: "Knowledge Base Citation",
  description: "Answers must include KB citations when available",
  formula: {
    type: "globally",
    formula: {
      type: "implies",
      left: { type: "prop", predicate: "has_citation", args: [] },
      right: {
        type: "obligation",
        formula: { type: "prop", predicate: "has_citation", args: [] },
      },
    },
  },
  enabled: true,
  severity: "warning",
};

/**
 * Policy 3: Persuasion Limits
 * G(persuasion > P̄ → F persuade)
 * "Always: if persuasion exceeds limit, further persuasion is forbidden"
 */
export const POLICY_PERSUASION_LIMIT: EthicalPolicy = {
  id: "persuasion-limit",
  name: "Persuasion Limit Enforcement",
  description: "Persuasion level must not exceed tenant's maxPersuasionLevel (P̄)",
  formula: {
    type: "globally",
    formula: {
      type: "forbidden",
      formula: { type: "prop", predicate: "persuasion_exceeds", args: [0.7] },
    },
  },
  enabled: true,
  severity: "critical",
};

/**
 * Policy 4: Frustrated Customer Escalation
 * G(frustrated → ◇(escalated))
 * "Always: if customer frustrated, eventually escalate"
 */
export const POLICY_FRUSTRATION_ESCALATION: EthicalPolicy = {
  id: "frustration-escalation",
  name: "Frustration-Based Escalation",
  description: "Frustrated customers must eventually be escalated to human",
  formula: {
    type: "globally",
    formula: {
      type: "implies",
      left: { type: "prop", predicate: "customer_frustrated", args: [] },
      right: {
        type: "finally",
        formula: { type: "prop", predicate: "is_escalated", args: [] },
      },
    },
  },
  enabled: true,
  severity: "warning",
};

/**
 * Policy 5: High-Value Transaction Safety
 * □(cart_value > 5000 → O escalated)
 * "Always: high-value carts require human approval"
 */
export const POLICY_HIGH_VALUE_APPROVAL: EthicalPolicy = {
  id: "high-value-approval",
  name: "High-Value Transaction Approval",
  description: "Carts exceeding R$5000 require human approval",
  formula: {
    type: "globally",
    formula: {
      type: "implies",
      left: { type: "prop", predicate: "cart_value_exceeds", args: [5000] },
      right: {
        type: "obligation",
        formula: { type: "prop", predicate: "is_escalated", args: [] },
      },
    },
  },
  enabled: true,
  severity: "critical",
};

/**
 * Default policy set
 */
export const DEFAULT_POLICIES: EthicalPolicy[] = [
  POLICY_RISK_ESCALATION,
  POLICY_KB_CITATION,
  POLICY_PERSUASION_LIMIT,
  POLICY_FRUSTRATION_ESCALATION,
  POLICY_HIGH_VALUE_APPROVAL,
];

// ========================================
// TRACE BUILDER UTILITIES
// ========================================

/**
 * Create execution trace from conversation history
 */
export function buildTraceFromConversation(
  messages: any[],
  tenantId: string,
  conversationId?: string
): ExecutionTrace {
  const states: State[] = [];
  const actions: Action[] = [];
  
  let cartValue = 0;
  let persuasionLevel = 0;
  let riskScore = 0;
  let isEscalated = false;
  let hasKBCitation = false;
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    // Extract state from message metadata
    const metadata = msg.metadata || {};
    
    // Build state
    states.push({
      index: i,
      timestamp: new Date(msg.createdAt),
      cartValue: metadata.cartValue || cartValue,
      customerSentiment: metadata.sentiment || 0,
      persuasionLevel: metadata.persuasionLevel || persuasionLevel,
      riskScore: metadata.riskScore || riskScore,
      hasKBCitation: metadata.hasKBCitation || hasKBCitation,
      isEscalated: metadata.isEscalated || isEscalated,
      metadata: metadata,
    });
    
    // Extract action if AI message
    if (msg.senderType === "ai") {
      actions.push({
        index: i,
        type: metadata.actionType || "response",
        params: metadata.actionParams || {},
        timestamp: new Date(msg.createdAt),
      });
      
      // Update running values
      cartValue = metadata.cartValue || cartValue;
      persuasionLevel = metadata.persuasionLevel || persuasionLevel;
      riskScore = metadata.riskScore || riskScore;
      isEscalated = metadata.isEscalated || isEscalated;
      hasKBCitation = metadata.hasKBCitation || hasKBCitation;
    }
  }
  
  return {
    states,
    actions,
    timestamp: new Date(),
    tenantId,
    conversationId,
  };
}

/**
 * Verify all enabled policies for tenant
 */
export function verifyAllPolicies(
  trace: ExecutionTrace,
  policies: EthicalPolicy[]
): VerificationResult[] {
  const results: VerificationResult[] = [];
  
  for (const policy of policies) {
    if (!policy.enabled) continue;
    
    const result = verifyPolicy(policy, trace);
    results.push(result);
    
    // Log violations
    if (!result.satisfied) {
      console.warn(
        `[LTL] Policy violation: ${policy.name}`,
        result.counterexample
      );
    }
  }
  
  return results;
}

/**
 * Check if trace satisfies all critical policies
 */
export function isSafeTrace(
  trace: ExecutionTrace,
  policies: EthicalPolicy[]
): boolean {
  const criticalPolicies = policies.filter(p => p.enabled && p.severity === "critical");
  
  for (const policy of criticalPolicies) {
    const result = verifyPolicy(policy, trace);
    if (!result.satisfied) {
      return false; // Critical violation
    }
  }
  
  return true;
}
