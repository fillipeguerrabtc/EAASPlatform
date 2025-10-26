/**
 * AI Critics System - Multi-Layer Validation
 * Based on EAAS Whitepaper 02 mathematical foundations
 * 
 * Implements 4 critical layers:
 * 1. Factual Critic - validates citations and knowledge base grounding
 * 2. Numeric Critic - validates arithmetic, prices, dates, units
 * 3. Ethical Critic - validates persuasion limits and ethical boundaries
 * 4. Risk Critic - detects financial/fraud risk for human escalation
 */

export interface CriticResult {
  passed: boolean;
  confidence: number; // [0,1]
  issues: string[];
  recommendations: string[];
}

export interface CriticContext {
  message: string;
  response: string;
  source: "knowledge_base" | "openai" | "autonomous_sales";
  customerId: number;
  cartValue?: number;
  knowledgeBaseMatch?: any;
  persuasionLevel?: number; // [0,1]
}

/**
 * Factual Critic
 * 
 * Mathematical Foundation:
 * Factual accuracy requirement from whitepaper:
 * G(answer → O citation) - "Always, if there's an answer, citation is obligatory"
 * 
 * Validates:
 * - Responses have proper KB grounding when source="knowledge_base"
 * - Citations are valid and traceable
 * - No hallucinations in autonomous sales (product must exist)
 */
export function factualCritic(context: CriticContext): CriticResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let confidence = 1.0;

  // Rule 1: Knowledge Base responses MUST have matching source
  if (context.source === "knowledge_base") {
    if (!context.knowledgeBaseMatch) {
      issues.push("Knowledge Base source claimed but no match found");
      confidence *= 0.3;
      recommendations.push("Fallback to OpenAI with explicit uncertainty");
    } else {
      // Validate content similarity (basic check)
      const matchLength = context.knowledgeBaseMatch.content?.length || 0;
      const responseLength = context.response.length;
      
      if (matchLength > 0 && responseLength > matchLength * 3) {
        issues.push("Response significantly longer than KB source - possible hallucination");
        confidence *= 0.7;
      }
    }
  }

  // Rule 2: Autonomous sales must reference actual products
  if (context.source === "autonomous_sales") {
    const hasProductReference = /R\$\s*[\d,\.]+/.test(context.response);
    const hasProductName = /\w{3,}/.test(context.response);
    
    if (!hasProductReference && context.response.includes("adicionado")) {
      issues.push("Product addition claimed without price reference");
      confidence *= 0.5;
    }
  }

  // Rule 3: OpenAI responses should acknowledge uncertainty on uncertain topics
  if (context.source === "openai") {
    const hasCertaintyLanguage = /(certamente|definitivamente|com certeza|100%)/i.test(context.response);
    const isFactualQuestion = /(quando|onde|quantos|qual|quem)/i.test(context.message);
    
    if (hasCertaintyLanguage && isFactualQuestion) {
      recommendations.push("OpenAI expressing high certainty on factual question - verify against KB");
      confidence *= 0.85;
    }
  }

  return {
    passed: issues.length === 0,
    confidence,
    issues,
    recommendations,
  };
}

/**
 * Helper: Parse currency string to number
 * Handles BRL ("R$ 1.234,56") and International ("$1,234.56") formats
 */
function parseCurrency(priceStr: string): number {
  // Remove currency symbol
  let cleaned = priceStr.replace(/(?:R\$|\$)\s*/g, '');
  
  // Count separators
  const commaCount = (cleaned.match(/,/g) || []).length;
  const periodCount = (cleaned.match(/\./g) || []).length;
  const totalSeps = commaCount + periodCount;
  
  // Case 1: No separators → integer
  if (totalSeps === 0) {
    return parseFloat(cleaned);
  }
  
  // Detect format by last separator position
  const lastComma = cleaned.lastIndexOf(',');
  const lastPeriod = cleaned.lastIndexOf('.');
  
  // Case 2: Single separator
  if (totalSeps === 1) {
    const separator = lastComma !== -1 ? lastComma : lastPeriod;
    const beforeSep = cleaned.substring(0, separator);
    const afterSep = cleaned.substring(separator + 1);
    
    // Thousands heuristic: exactly 3 digits after AND integer part is not "0" or empty
    // Examples:
    // - "1.234" → 1234 (thousands)
    // - "0.500" → 0.5 (decimal, not thousands)
    // - "12,345" → 12345 (thousands)
    // - "0,123" → 0.123 (decimal, not thousands)
    const intPart = parseInt(beforeSep, 10);
    if (afterSep.length === 3 && intPart > 0) {
      // Remove thousands separator
      cleaned = cleaned.replace(/[,.]/, '');
      return parseFloat(cleaned);
    }
    
    // Otherwise it's decimal - normalize to period
    cleaned = cleaned.replace(',', '.');
    return parseFloat(cleaned);
  }
  
  // Case 3: Multiple separators
  //  - If SAME separator type repeated → all thousands (e.g., "$1,234,567" or "R$ 1.234.567")
  //  - If MIXED separators → last is decimal, others are thousands (e.g., "R$ 1.234,56" or "$1,234.56")
  
  const hasMixedSeparators = commaCount > 0 && periodCount > 0;
  
  if (!hasMixedSeparators) {
    // Same separator type repeated → all are thousands
    // Examples: "$1,234,567" or "R$ 1.234.567"
    cleaned = cleaned.replace(/[,.]/g, '');
    return parseFloat(cleaned);
  }
  
  // Mixed separators → last is decimal, others are thousands
  if (lastComma > lastPeriod) {
    // BRL: "1.234,56" or "1.234.567,89" → periods are thousands, comma is decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // International: "1,234.56" or "1,234,567.89" → commas are thousands, period is decimal
    cleaned = cleaned.replace(/,/g, '');
  }
  
  return parseFloat(cleaned);
}

/**
 * Numeric Critic
 * 
 * Mathematical Foundation:
 * From whitepaper: ∑Débitos = ∑Créditos (double-entry validation)
 * Validates arithmetic consistency in prices, totals, calculations
 * 
 * Prevents errors like:
 * - Incorrect price calculations
 * - Mismatched totals
 * - Invalid date arithmetic
 */
export function numericCritic(context: CriticContext): CriticResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let confidence = 1.0;

  // Extract all numbers from response (BRL and international formats)
  const numbers = context.response.match(/(?:R\$|\$)\s*[\d.,]+/g);
  
  if (numbers && numbers.length > 0) {
    // Parse prices using helper function
    const prices = numbers.map(parseCurrency);

    // Rule 1: Validate cart totals if present
    if (context.cartValue !== undefined && prices.length > 1) {
      const lastPrice = prices[prices.length - 1];
      const diff = Math.abs(lastPrice - context.cartValue);
      
      if (diff > 0.01) { // Allow 1 cent rounding error
        issues.push(`Cart total mismatch: response shows ${lastPrice}, cart has ${context.cartValue}`);
        confidence *= 0.4;
        recommendations.push("Recalculate total from server-side cart data");
      }
    }

    // Rule 2: Check for obviously invalid prices
    const hasInvalidPrice = prices.some(p => p < 0 || p > 100000000 || isNaN(p));
    if (hasInvalidPrice) {
      issues.push("Invalid price detected (negative, NaN, or > 100M)");
      confidence *= 0.2;
    }

    // Rule 3: Check for precision issues (BRL and international safe)
    const hasTooManyDecimals = numbers.some(n => {
      // Remove currency symbols: "R$ 1.234,56" → "1.234,56"
      const cleaned = n.replace(/(?:R\$|\$)\s*/g, '');
      
      // Count separators
      const commaCount = (cleaned.match(/,/g) || []).length;
      const periodCount = (cleaned.match(/\./g) || []).length;
      const totalSeparators = commaCount + periodCount;
      
      // Case 1: No separators → integer (valid)
      if (totalSeparators === 0) {
        return false;
      }
      
      // Case 2: Single separator
      if (totalSeparators === 1) {
        const lastComma = cleaned.lastIndexOf(',');
        const lastPeriod = cleaned.lastIndexOf('.');
        const separator = lastComma !== -1 ? lastComma : lastPeriod;
        const beforeSep = cleaned.substring(0, separator);
        const afterSep = cleaned.substring(separator + 1);
        
        // Exactly 3 digits after AND integer part > 0 → thousands (e.g., "1.234", "12,345")
        // Otherwise → decimal (e.g., "1.5", "0.123")
        const intPart = parseInt(beforeSep, 10);
        if (afterSep.length === 3 && intPart > 0) {
          return false; // Valid thousands separator
        }
        
        // Otherwise it's a decimal separator → check precision
        return afterSep.length > 2;
      }
      
      // Case 3: Multiple separators
      const commaCountClean = (cleaned.match(/,/g) || []).length;
      const periodCountClean = (cleaned.match(/\./g) || []).length;
      const hasMixedSeps = commaCountClean > 0 && periodCountClean > 0;
      
      const lastComma = cleaned.lastIndexOf(',');
      const lastPeriod = cleaned.lastIndexOf('.');
      let lastSeparatorIndex: number;
      if (lastComma > lastPeriod) {
        lastSeparatorIndex = lastComma;
      } else {
        lastSeparatorIndex = lastPeriod;
      }
      
      const decimalPart = cleaned.substring(lastSeparatorIndex + 1);
      
      // SAME separator type repeated → all thousands (e.g., "$1,234,567")
      if (!hasMixedSeps && decimalPart.length === 3) {
        return false; // No decimals, valid
      }
      
      // MIXED separators OR non-3-digit → last separator is decimal
      return decimalPart.length > 2;
    });
    
    if (hasTooManyDecimals) {
      issues.push("Price has more than 2 decimal places");
      confidence *= 0.9;
      recommendations.push("Round to 2 decimal places");
    }
  }

  // Rule 4: Validate quantity arithmetic
  const quantityMatch = context.response.match(/(\d+)x/);
  if (quantityMatch) {
    const qty = parseInt(quantityMatch[1]);
    if (qty <= 0 || qty > 10000) {
      issues.push(`Invalid quantity: ${qty}`);
      confidence *= 0.3;
    }
  }

  return {
    passed: issues.length === 0,
    confidence,
    issues,
    recommendations,
  };
}

/**
 * Ethical Critic
 * 
 * Mathematical Foundation:
 * From whitepaper:
 * Pt = min{P̄, ψ(It)} where:
 * - Pt = persuasion at time t
 * - P̄ = max persuasion limit (tenant config)
 * - It = intensity (function of sentiment, context)
 * 
 * LTL+D Policy: G((channel=WA ∧ persuasion>ρ) → Fob execute(a))
 * "Always, if channel is WhatsApp and persuasion > threshold, execution is forbidden"
 */
export function ethicalCritic(context: CriticContext): CriticResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let confidence = 1.0;

  // Calculate persuasion intensity from response
  const persuasionMarkers = {
    high: /(não perca|última chance|só hoje|oferta imperdível|exclusivo|agora mesmo)/gi,
    medium: /(recomendo|sugiro|vale a pena|boa oportunidade|interessante)/gi,
    low: /(disponível|pode|talvez|caso queira)/gi,
  };

  let persuasionScore = 0;
  const highMatches = context.response.match(persuasionMarkers.high)?.length || 0;
  const mediumMatches = context.response.match(persuasionMarkers.medium)?.length || 0;
  const lowMatches = context.response.match(persuasionMarkers.low)?.length || 0;

  persuasionScore = (highMatches * 1.0 + mediumMatches * 0.5 + lowMatches * 0.2) / 
                     Math.max(1, highMatches + mediumMatches + lowMatches);

  // Rule 1: Respect max persuasion limit (default 0.7 if not configured)
  const maxPersuasion = context.persuasionLevel ?? 0.7;
  
  if (persuasionScore > maxPersuasion) {
    issues.push(`Persuasion level ${persuasionScore.toFixed(2)} exceeds limit ${maxPersuasion.toFixed(2)}`);
    confidence *= 0.5;
    recommendations.push("Tone down aggressive sales language");
  }

  // Rule 2: No false urgency or scarcity
  const hasFalseUrgency = /(último|última unidade|esgotando|corre)/gi.test(context.response);
  if (hasFalseUrgency && context.source !== "knowledge_base") {
    issues.push("False urgency detected without KB validation");
    confidence *= 0.6;
    recommendations.push("Remove urgency claims or validate against inventory");
  }

  // Rule 3: Transparency about AI vs Human
  const claimsHumanExpertise = /(eu sei que|tenho certeza|minha experiência|como especialista)/gi.test(context.response);
  if (claimsHumanExpertise) {
    issues.push("AI claiming human expertise or certainty");
    confidence *= 0.7;
    recommendations.push("Add disclaimer that this is AI assistance");
  }

  // Rule 4: No price manipulation language
  const priceManipulation = /(normalmente custa|antes era|preço original)/gi.test(context.response);
  if (priceManipulation && context.source !== "knowledge_base") {
    issues.push("Price comparison without KB support");
    confidence *= 0.6;
  }

  return {
    passed: issues.length === 0,
    confidence,
    issues,
    recommendations,
  };
}

/**
 * Risk Critic
 * 
 * Mathematical Foundation:
 * From whitepaper:
 * G(risk(a) > τ → O handoff(a))
 * "Always, if risk exceeds threshold τ, handoff to human is obligatory"
 * 
 * Risk penalty: R_fraude = P(chargeback) · impacto_econômico
 * 
 * Triggers human escalation when:
 * - High financial value
 * - Suspicious patterns
 * - Customer frustration detected
 */
export function riskCritic(context: CriticContext): CriticResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let confidence = 1.0;
  let riskScore = 0;

  // Risk Factor 1: Financial value (threshold: R$ 500)
  if (context.cartValue !== undefined) {
    if (context.cartValue > 500) {
      riskScore += 0.3;
      recommendations.push("High value transaction - consider human review");
    }
    if (context.cartValue > 2000) {
      riskScore += 0.4;
      issues.push("Very high value transaction requires human approval");
    }
  }

  // Risk Factor 2: Customer frustration signals
  const frustrationMarkers = /(não funciona|problema|erro|bug|reclamação|péssimo|horrível|não entendo)/gi;
  const frustrationMatches = context.message.match(frustrationMarkers)?.length || 0;
  
  if (frustrationMatches > 0) {
    riskScore += frustrationMatches * 0.15;
    if (frustrationMatches >= 2) {
      issues.push("High customer frustration detected");
      recommendations.push("ESCALATE: Transfer to human agent immediately");
    }
  }

  // Risk Factor 3: Repeated failures (detected by certain phrases in response)
  const admitsFailure = /(desculpe|não consigo|não encontrei|erro|problema)/gi.test(context.response);
  if (admitsFailure) {
    riskScore += 0.2;
    recommendations.push("AI unable to fulfill request - consider human handoff");
  }

  // Risk Factor 4: Refund/dispute keywords
  const disputeKeywords = /(reembolso|estorno|cancelar|devolver|fraude|reclama)/gi.test(context.message);
  if (disputeKeywords) {
    riskScore += 0.5;
    issues.push("Dispute/refund request detected");
    recommendations.push("CRITICAL: Immediate human escalation required");
  }

  // Risk Factor 5: Anomalous behavior (very long messages)
  if (context.message.length > 1000) {
    riskScore += 0.1;
    recommendations.push("Unusually long message - may require human understanding");
  }

  // Final risk assessment
  const RISK_THRESHOLD = 0.7;
  if (riskScore >= RISK_THRESHOLD) {
    issues.push(`Risk score ${riskScore.toFixed(2)} exceeds threshold ${RISK_THRESHOLD}`);
    confidence = 1.0 - Math.min(riskScore, 0.95); // High risk = low confidence in automated response
  }

  return {
    passed: riskScore < RISK_THRESHOLD,
    confidence,
    issues,
    recommendations,
  };
}

/**
 * Master Critic Runner
 * 
 * Runs all critics and aggregates results
 * Returns overall validation and escalation decision
 */
export interface MasterCriticResult {
  passed: boolean;
  overallConfidence: number;
  shouldEscalateToHuman: boolean;
  criticsResults: {
    factual: CriticResult;
    numeric: CriticResult;
    ethical: CriticResult;
    risk: CriticResult;
  };
  finalRecommendation: string;
}

export function runAllCritics(context: CriticContext): MasterCriticResult {
  const factual = factualCritic(context);
  const numeric = numericCritic(context);
  const ethical = ethicalCritic(context);
  const risk = riskCritic(context);

  // Aggregate confidence using geometric mean (more conservative than arithmetic)
  const overallConfidence = Math.pow(
    factual.confidence * numeric.confidence * ethical.confidence * risk.confidence,
    0.25
  );

  // Decision logic for human escalation
  const shouldEscalateToHuman = 
    !risk.passed || // Risk threshold exceeded
    overallConfidence < 0.5 || // Very low confidence
    (!factual.passed && !numeric.passed) || // Multiple critical failures
    risk.recommendations.some(r => r.includes("ESCALATE") || r.includes("CRITICAL"));

  // Generate final recommendation
  let finalRecommendation = "";
  if (shouldEscalateToHuman) {
    finalRecommendation = "ESCALATE TO HUMAN: ";
    const reasons = [
      ...risk.issues,
      ...factual.issues.slice(0, 1),
      ...ethical.issues.slice(0, 1),
    ];
    finalRecommendation += reasons.join("; ");
  } else if (overallConfidence < 0.8) {
    finalRecommendation = "Proceed with caution. " + [
      ...factual.recommendations.slice(0, 1),
      ...numeric.recommendations.slice(0, 1),
      ...ethical.recommendations.slice(0, 1),
    ].join("; ");
  } else {
    finalRecommendation = "Response validated. Safe to proceed.";
  }

  return {
    passed: factual.passed && numeric.passed && ethical.passed && risk.passed,
    overallConfidence,
    shouldEscalateToHuman,
    criticsResults: {
      factual,
      numeric,
      ethical,
      risk,
    },
    finalRecommendation,
  };
}
