/**
 * Lyapunov Stability Analysis
 * Based on EAAS Whitepaper 02 - Appendix A + Chapter 14
 * 
 * Mathematical Foundation:
 * ========================
 * 
 * Lyapunov Function V(t):
 * - Scalar function V: S → R⁺ (state space to non-negative reals)
 * - Measures "distance" from equilibrium/optimality
 * - Example: V(t) = ||θₜ - θ*||² (distance from optimal parameters)
 * 
 * Convergence Theorem:
 * If ∆V = V(t+1) - V(t) ≤ -ε||gₜ||² for all t
 * Then: lim(t→∞) V(t) = 0 (asymptotic convergence)
 * 
 * where:
 * - ∆V = change in Lyapunov function
 * - ε > 0 = convergence rate constant
 * - gₜ = gradient/update vector at time t
 * - ||gₜ||² = squared norm of gradient
 * 
 * Stability Conditions:
 * 1. V(x) > 0 for all x ≠ x*  (positive definite)
 * 2. V(x*) = 0               (equilibrium has zero energy)
 * 3. ∆V(x) < 0 for all x ≠ x* (strictly decreasing)
 * 
 * Application to AI Training:
 * - V(t) = policy loss / error
 * - ∆V < 0 means policy improving
 * - If ∆V < 0 always, guaranteed convergence
 * 
 * LaSalle's Invariance Principle:
 * - Even if ∆V ≤ 0 (not strictly <), system converges to largest invariant set
 * - Allows for plateaus in learning
 */

// ========================================
// TYPES AND INTERFACES
// ========================================

/**
 * Lyapunov Function Configuration
 */
export interface LyapunovConfig {
  // Convergence rate
  epsilon: number;               // ε - minimum decrease rate (default: 0.01)
  
  // Function type
  functionType: "quadratic" | "cross_entropy" | "custom";
  
  // Tolerance
  convergenceTolerance: number;  // When to consider converged (default: 1e-6)
  maxIterations: number;         // Safety limit (default: 10000)
}

/**
 * State Vector
 */
export interface State {
  parameters: number[];      // θₜ (model parameters)
  timestamp: number;         // t
  metadata: Record<string, any>;
}

/**
 * Lyapunov Analysis Result
 */
export interface LyapunovAnalysis {
  // Current state
  currentV: number;          // V(t)
  previousV?: number;        // V(t-1)
  deltaV?: number;           // ∆V = V(t) - V(t-1)
  
  // Stability check
  isStable: boolean;         // ∆V ≤ -ε||g||²?
  isConverged: boolean;      // V(t) < tolerance?
  
  // Convergence metrics
  gradientNorm: number;      // ||g||
  epsilonBound: number;      // -ε||g||²
  
  // Trajectory
  vHistory: number[];        // [V(0), V(1), ..., V(t)]
  
  // Metadata
  iteration: number;
  timestamp: Date;
}

/**
 * Convergence Certificate
 */
export interface ConvergenceCertificate {
  converged: boolean;
  finalValue: number;
  iterations: number;
  
  // Proof elements
  allDecreasing: boolean;    // ∆V < 0 for all steps?
  monotonic: boolean;        // V never increased?
  averageDecrease: number;   // Mean(∆V)
  
  // Metadata
  startValue: number;
  endValue: number;
  totalDecrease: number;
  convergenceTime: number;   // ms
}

// ========================================
// DEFAULT CONFIGURATION
// ========================================

export const DEFAULT_LYAPUNOV_CONFIG: LyapunovConfig = {
  epsilon: 0.01,
  functionType: "quadratic",
  convergenceTolerance: 1e-6,
  maxIterations: 10000,
};

// ========================================
// LYAPUNOV FUNCTIONS
// ========================================

/**
 * Quadratic Lyapunov function
 * V(θ) = ||θ - θ*||²
 * 
 * Measures squared distance from optimal parameters
 */
export function quadraticLyapunov(
  currentParams: number[],
  optimalParams: number[]
): number {
  if (currentParams.length !== optimalParams.length) {
    throw new Error("Parameter dimension mismatch");
  }
  
  let sumSquares = 0;
  for (let i = 0; i < currentParams.length; i++) {
    const diff = currentParams[i] - optimalParams[i];
    sumSquares += diff * diff;
  }
  
  return sumSquares;
}

/**
 * Cross-entropy Lyapunov function
 * V(θ) = -E[y log(p(y|x,θ))]
 * 
 * Measures prediction error (common in classification)
 */
export function crossEntropyLyapunov(
  predictions: number[],
  targets: number[]
): number {
  if (predictions.length !== targets.length) {
    throw new Error("Prediction/target dimension mismatch");
  }
  
  let crossEntropy = 0;
  for (let i = 0; i < targets.length; i++) {
    // Avoid log(0)
    const p = Math.max(1e-10, Math.min(1 - 1e-10, predictions[i]));
    crossEntropy -= targets[i] * Math.log(p);
  }
  
  return crossEntropy;
}

/**
 * Generic policy loss Lyapunov
 * V(θ) = E[(reward_optimal - reward_current)²]
 * 
 * Measures suboptimality of current policy
 */
export function policyLossLyapunov(
  currentReward: number,
  optimalReward: number
): number {
  const gap = optimalReward - currentReward;
  return gap * gap;
}

// ========================================
// STABILITY CHECKING
// ========================================

/**
 * Check Lyapunov stability condition
 * 
 * Verifies: ∆V = V(t+1) - V(t) ≤ -ε||g||²
 */
export function checkStability(
  Vt: number,        // V(t)
  Vt1: number,       // V(t+1)
  gradient: number[],
  config: LyapunovConfig
): {
  stable: boolean;
  deltaV: number;
  gradientNorm: number;
  epsilonBound: number;
  satisfied: boolean;  // ∆V ≤ -ε||g||²?
} {
  // Calculate ∆V = V(t+1) - V(t)
  const deltaV = Vt1 - Vt;
  
  // Calculate ||g||²
  const gradientNormSquared = gradient.reduce((sum, g) => sum + g * g, 0);
  const gradientNorm = Math.sqrt(gradientNormSquared);
  
  // Calculate -ε||g||²
  const epsilonBound = -config.epsilon * gradientNormSquared;
  
  // Check condition: ∆V ≤ -ε||g||²
  const satisfied = deltaV <= epsilonBound;
  
  // Overall stability: V decreasing (∆V ≤ 0)
  const stable = deltaV <= 0;
  
  return {
    stable,
    deltaV,
    gradientNorm,
    epsilonBound,
    satisfied,
  };
}

/**
 * Analyze Lyapunov trajectory
 * 
 * Given history of V values, analyze convergence
 */
export function analyzeLyapunovTrajectory(
  vHistory: number[],
  config: LyapunovConfig
): ConvergenceCertificate {
  const startTime = Date.now();
  
  if (vHistory.length < 2) {
    return {
      converged: false,
      finalValue: vHistory[0] || 0,
      iterations: vHistory.length,
      allDecreasing: false,
      monotonic: false,
      averageDecrease: 0,
      startValue: vHistory[0] || 0,
      endValue: vHistory[vHistory.length - 1] || 0,
      totalDecrease: 0,
      convergenceTime: Date.now() - startTime,
    };
  }
  
  // Check if all steps decreased
  let allDecreasing = true;
  let monotonic = true;
  let totalDecrease = 0;
  let numDecreases = 0;
  
  for (let t = 1; t < vHistory.length; t++) {
    const deltaV = vHistory[t] - vHistory[t - 1];
    
    if (deltaV < 0) {
      totalDecrease += Math.abs(deltaV);
      numDecreases++;
    } else if (deltaV > 0) {
      monotonic = false;
      allDecreasing = false;
    }
  }
  
  const averageDecrease = numDecreases > 0 ? totalDecrease / numDecreases : 0;
  
  // Check convergence: final value below tolerance
  const finalValue = vHistory[vHistory.length - 1];
  const converged = finalValue < config.convergenceTolerance;
  
  return {
    converged,
    finalValue,
    iterations: vHistory.length,
    allDecreasing,
    monotonic,
    averageDecrease,
    startValue: vHistory[0],
    endValue: finalValue,
    totalDecrease,
    convergenceTime: Date.now() - startTime,
  };
}

// ========================================
// GRADIENT DESCENT WITH LYAPUNOV TRACKING
// ========================================

/**
 * Perform gradient descent with Lyapunov stability tracking
 * 
 * θₜ₊₁ = θₜ - η∇f(θₜ)
 * 
 * Tracks V(t) at each step to verify convergence
 */
export function gradientDescentWithLyapunov(
  initialParams: number[],
  optimalParams: number[],
  gradientFn: (params: number[]) => number[],
  learningRate: number,
  config: LyapunovConfig = DEFAULT_LYAPUNOV_CONFIG
): {
  finalParams: number[];
  vHistory: number[];
  certificate: ConvergenceCertificate;
  stableSteps: number;
  unstableSteps: number;
} {
  let params = [...initialParams];
  const vHistory: number[] = [];
  let stableSteps = 0;
  let unstableSteps = 0;
  
  // Initial Lyapunov value
  let Vt = quadraticLyapunov(params, optimalParams);
  vHistory.push(Vt);
  
  console.info(`[Lyapunov] Starting: V(0) = ${Vt.toFixed(6)}`);
  
  for (let t = 0; t < config.maxIterations; t++) {
    // Compute gradient
    const gradient = gradientFn(params);
    
    // Update parameters: θₜ₊₁ = θₜ - η∇f(θₜ)
    for (let i = 0; i < params.length; i++) {
      params[i] = params[i] - learningRate * gradient[i];
    }
    
    // Compute new Lyapunov value
    const Vt1 = quadraticLyapunov(params, optimalParams);
    vHistory.push(Vt1);
    
    // Check stability
    const stability = checkStability(Vt, Vt1, gradient, config);
    
    if (stability.stable) {
      stableSteps++;
    } else {
      unstableSteps++;
      console.warn(
        `[Lyapunov] t=${t}: UNSTABLE - ∆V=${stability.deltaV.toFixed(6)} > 0`
      );
    }
    
    // Log progress
    if (t % 100 === 0) {
      console.info(
        `[Lyapunov] t=${t}: V=${Vt1.toFixed(6)}, ` +
        `∆V=${stability.deltaV.toFixed(6)}, ` +
        `||g||=${stability.gradientNorm.toFixed(6)}`
      );
    }
    
    // Check convergence
    if (Vt1 < config.convergenceTolerance) {
      console.info(`[Lyapunov] CONVERGED at t=${t}: V=${Vt1.toFixed(10)}`);
      break;
    }
    
    // Update for next iteration
    Vt = Vt1;
  }
  
  // Analyze trajectory
  const certificate = analyzeLyapunovTrajectory(vHistory, config);
  
  console.info(
    `[Lyapunov] Complete: ${certificate.iterations} iterations, ` +
    `converged=${certificate.converged}, ` +
    `stable=${stableSteps}/${stableSteps + unstableSteps} steps`
  );
  
  return {
    finalParams: params,
    vHistory,
    certificate,
    stableSteps,
    unstableSteps,
  };
}

// ========================================
// POLICY CONVERGENCE TRACKING
// ========================================

/**
 * Track policy convergence using Lyapunov analysis
 * 
 * Use this to monitor AI policy during training
 */
export class PolicyLyapunovTracker {
  private vHistory: number[] = [];
  private config: LyapunovConfig;
  
  constructor(config: LyapunovConfig = DEFAULT_LYAPUNOV_CONFIG) {
    this.config = config;
  }
  
  /**
   * Record new observation
   */
  public record(currentReward: number, optimalReward: number): LyapunovAnalysis {
    // Calculate V(t) = (optimal - current)²
    const Vt = policyLossLyapunov(currentReward, optimalReward);
    
    // Calculate ∆V if we have previous value
    let deltaV: number | undefined;
    let isStable = true;
    
    if (this.vHistory.length > 0) {
      const Vprev = this.vHistory[this.vHistory.length - 1];
      deltaV = Vt - Vprev;
      isStable = deltaV <= 0; // V should decrease
    }
    
    // Add to history
    this.vHistory.push(Vt);
    
    // Check convergence
    const isConverged = Vt < this.config.convergenceTolerance;
    
    // Gradient norm (approximate from policy gap)
    const gradientNorm = Math.sqrt(Vt);
    const epsilonBound = -this.config.epsilon * gradientNorm * gradientNorm;
    
    return {
      currentV: Vt,
      previousV: this.vHistory.length > 1 ? this.vHistory[this.vHistory.length - 2] : undefined,
      deltaV,
      isStable,
      isConverged,
      gradientNorm,
      epsilonBound,
      vHistory: [...this.vHistory],
      iteration: this.vHistory.length - 1,
      timestamp: new Date(),
    };
  }
  
  /**
   * Get convergence certificate
   */
  public getCertificate(): ConvergenceCertificate {
    return analyzeLyapunovTrajectory(this.vHistory, this.config);
  }
  
  /**
   * Reset tracker
   */
  public reset(): void {
    this.vHistory = [];
  }
  
  /**
   * Export history
   */
  public exportHistory(): number[] {
    return [...this.vHistory];
  }
}

// ========================================
// VISUALIZATION & EXPORT
// ========================================

/**
 * Format convergence certificate as string
 */
export function formatCertificate(cert: ConvergenceCertificate): string {
  const lines: string[] = [];
  
  lines.push(`Lyapunov Convergence Certificate:`);
  lines.push(`  Status: ${cert.converged ? "✓ CONVERGED" : "✗ NOT CONVERGED"}`);
  lines.push(`  Iterations: ${cert.iterations}`);
  lines.push(`  Final Value: ${cert.finalValue.toExponential(3)}`);
  lines.push(``);
  lines.push(`Stability Properties:`);
  lines.push(`  All Decreasing: ${cert.allDecreasing ? "✓ Yes" : "✗ No"}`);
  lines.push(`  Monotonic: ${cert.monotonic ? "✓ Yes" : "✗ No"}`);
  lines.push(`  Average Decrease: ${cert.averageDecrease.toFixed(6)}`);
  lines.push(``);
  lines.push(`Trajectory:`);
  lines.push(`  Start: V(0) = ${cert.startValue.toFixed(6)}`);
  lines.push(`  End: V(T) = ${cert.endValue.toExponential(3)}`);
  lines.push(`  Total Decrease: ${cert.totalDecrease.toFixed(6)}`);
  lines.push(`  Time: ${cert.convergenceTime}ms`);
  
  return lines.join("\n");
}

/**
 * Plot Lyapunov trajectory (ASCII art)
 */
export function plotLyapunovTrajectory(vHistory: number[], width: number = 60): string {
  if (vHistory.length === 0) return "";
  
  const lines: string[] = [];
  const maxV = Math.max(...vHistory);
  const minV = Math.min(...vHistory);
  const range = maxV - minV;
  
  // Scale to width
  const step = Math.max(1, Math.floor(vHistory.length / width));
  
  lines.push(`V(t) - Lyapunov Function Trajectory`);
  lines.push(`Max: ${maxV.toFixed(4)} ${"█".repeat(width)}`);
  
  for (let i = 0; i < vHistory.length; i += step) {
    const v = vHistory[i];
    const normalized = range > 0 ? (v - minV) / range : 0;
    const barLength = Math.floor(normalized * width);
    const bar = "█".repeat(barLength);
    
    lines.push(`t=${String(i).padStart(4)}: ${bar} ${v.toFixed(6)}`);
  }
  
  lines.push(`Min: ${minV.toFixed(4)}`);
  
  return lines.join("\n");
}
