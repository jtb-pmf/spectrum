import { FundParams, SimulationResult, SimulationSummary, MonteCarloResults } from '@/types';

// Seeded random number generator for reproducibility
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Simple LCG random
  random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  // Box-Muller for normal distribution
  gaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = this.random();
    const u2 = this.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  // Random integer in range [min, max]
  randInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }
}

/**
 * Outcome distribution parameters that vary based on fund configuration.
 *
 * Key insight: Selectivity (graduation rate) affects conviction quality.
 * - Lower graduation rate (e.g., 15%) = more selective = better conviction outcomes
 * - Higher graduation rate (e.g., 35%) = less selective = worse conviction outcomes
 *
 * Base case assumes 25% graduation rate.
 */
interface OutcomeParams {
  // Discovery-only (companies that don't graduate)
  discoveryFailRate: number;      // % that return 0x
  discoveryLowReturnRate: number; // % that return 0.5-2x
  discoveryMidReturnRate: number; // % that return 2-5x
  discoveryHighReturnRate: number; // % that return 5-10x
  discoveryOutlierRate: number;   // % that return 10x+

  // Conviction (companies that graduate)
  convictionFailRate: number;
  convictionLowReturnRate: number;  // ~1x
  convictionMidReturnRate: number;  // ~3x
  convictionGoodReturnRate: number; // ~7x
  convictionGreatReturnRate: number; // ~20x
  convictionOutlierRate: number;    // 40x+
  convictionMegaOutlierRate: number; // 100x+

  // Multiplier ranges for conviction
  convictionGreatMultiplierBase: number;
  convictionOutlierMultiplierBase: number;
  convictionMegaOutlierMultiplierBase: number;
}

/**
 * Calculate outcome parameters based on fund configuration.
 *
 * Base success rates are configurable inputs:
 * - discoverySuccessRate: % of discovery companies that return >1x (default 30%)
 * - convictionSuccessRate: % of conviction companies that return >1x (default 50%)
 *
 * Selectivity bonus adjusts these based on graduation rate:
 * - Lower graduation rate = more selective = better outcomes
 */
function calculateOutcomeParams(params: FundParams): OutcomeParams {
  const { graduationRate, followOnReservePercent, fundSize, discoverySuccessRate, convictionSuccessRate } = params;

  // Selectivity bonus: how much better/worse are conviction picks vs baseline
  // Baseline is 25% graduation rate
  const baselineGraduationRate = 0.25;
  const selectivityBonus = (baselineGraduationRate - graduationRate) / baselineGraduationRate;

  // Follow-on bonus: larger reserves let you double down on winners
  // Baseline is 20% reserves
  const baselineFollowOn = 0.20;
  const followOnBonus = (followOnReservePercent - baselineFollowOn) / baselineFollowOn * 0.5;

  // Scale bonus: larger funds have more dry powder for follow-ons
  // Baseline is $25M
  const baselineFundSize = 25_000_000;
  const scaleBonus = Math.log(fundSize / baselineFundSize) * 0.1;

  // Combined conviction quality bonus (capped at reasonable range)
  const qualityBonus = Math.max(-0.3, Math.min(0.5, selectivityBonus + followOnBonus * 0.3 + scaleBonus * 0.2));

  // Discovery fail rate derived from configurable success rate
  // discoverySuccessRate is % that return >1x, so fail rate = 1 - successRate adjusted for selectivity
  const discoveryPenalty = selectivityBonus * 0.05; // Small effect - more selective means leftover discovery is worse
  const discoveryFailRate = Math.min(0.85, Math.max(0.50, (1 - discoverySuccessRate) + discoveryPenalty));

  // Distribute remaining discovery outcomes (companies that don't fail)
  const discoverySuccessPool = 1 - discoveryFailRate;
  const discoveryLowReturnRate = discoverySuccessPool * 0.50;   // Half return 0.5-2x
  const discoveryMidReturnRate = discoverySuccessPool * 0.25;   // Quarter return 2-5x
  const discoveryHighReturnRate = discoverySuccessPool * 0.15;  // 15% return 5-10x
  const discoveryOutlierRate = discoverySuccessPool * 0.10;     // 10% return 10x+

  // Conviction fail rate derived from configurable success rate + quality bonus
  const convictionFailRate = Math.min(0.65, Math.max(0.30, (1 - convictionSuccessRate) - qualityBonus * 0.10));

  // Distribute remaining conviction outcomes
  const convictionSuccessPool = 1 - convictionFailRate;
  const convictionLowReturnRate = convictionSuccessPool * 0.45;    // ~1x returns
  const convictionMidReturnRate = convictionSuccessPool * 0.22;    // ~3x returns
  const convictionGoodReturnRate = convictionSuccessPool * 0.15;   // ~7x returns
  const convictionGreatReturnRate = convictionSuccessPool * 0.10;  // ~20x returns
  const convictionOutlierRate = convictionSuccessPool * 0.05;      // ~40x returns
  const convictionMegaOutlierRate = convictionSuccessPool * 0.03;  // 100x+ returns

  return {
    discoveryFailRate,
    discoveryLowReturnRate,
    discoveryMidReturnRate,
    discoveryHighReturnRate,
    discoveryOutlierRate,

    convictionFailRate,
    convictionLowReturnRate,
    convictionMidReturnRate,
    convictionGoodReturnRate,
    convictionGreatReturnRate,
    convictionOutlierRate,
    convictionMegaOutlierRate,

    // Multiplier bases: better selectivity = higher potential multiples
    convictionGreatMultiplierBase: 15 + qualityBonus * 5,
    convictionOutlierMultiplierBase: 30 + qualityBonus * 15,
    convictionMegaOutlierMultiplierBase: 75 + qualityBonus * 25,
  };
}

/**
 * Sample outcome for discovery-only companies
 */
function sampleDiscoveryOnlyMultiple(rng: SeededRandom, outcomeParams: OutcomeParams): number {
  const r = rng.random();
  const {
    discoveryFailRate,
    discoveryLowReturnRate,
    discoveryMidReturnRate,
    discoveryHighReturnRate,
  } = outcomeParams;

  let cumulative = 0;

  cumulative += discoveryFailRate;
  if (r < cumulative) {
    return 0.0; // Fail
  }

  cumulative += discoveryLowReturnRate;
  if (r < cumulative) {
    return 0.5 + rng.random() * 1.5; // 0.5-2x
  }

  cumulative += discoveryMidReturnRate;
  if (r < cumulative) {
    return 2.0 + rng.random() * 3.0; // 2-5x
  }

  cumulative += discoveryHighReturnRate;
  if (r < cumulative) {
    return 5.0 + rng.random() * 5.0; // 5-10x
  }

  // Outlier
  if (rng.random() < 0.3) {
    return 10.0 + rng.random() * 10.0; // 10-20x
  }
  return 20.0 + rng.random() * 30.0; // 20-50x
}

/**
 * Sample outcome for conviction companies
 */
function sampleConvictionMultiple(rng: SeededRandom, outcomeParams: OutcomeParams): number {
  const r = rng.random();
  const {
    convictionFailRate,
    convictionLowReturnRate,
    convictionMidReturnRate,
    convictionGoodReturnRate,
    convictionGreatReturnRate,
    convictionOutlierRate,
    convictionGreatMultiplierBase,
    convictionOutlierMultiplierBase,
    convictionMegaOutlierMultiplierBase,
  } = outcomeParams;

  let cumulative = 0;

  cumulative += convictionFailRate;
  if (r < cumulative) {
    return 0.0; // Fail
  }

  cumulative += convictionLowReturnRate;
  if (r < cumulative) {
    return 0.8 + rng.random() * 0.4; // ~1x (0.8-1.2x)
  }

  cumulative += convictionMidReturnRate;
  if (r < cumulative) {
    return 2.5 + rng.random() * 1.5; // ~3x (2.5-4x)
  }

  cumulative += convictionGoodReturnRate;
  if (r < cumulative) {
    return 5.0 + rng.random() * 5.0; // ~7x (5-10x)
  }

  cumulative += convictionGreatReturnRate;
  if (r < cumulative) {
    return convictionGreatMultiplierBase + rng.random() * 10.0; // ~20x
  }

  cumulative += convictionOutlierRate;
  if (r < cumulative) {
    return convictionOutlierMultiplierBase + rng.random() * 20.0; // ~40x
  }

  // Mega-outlier
  return convictionMegaOutlierMultiplierBase + rng.random() * 75.0; // 75-150x+
}

/**
 * Calculate IRR using Newton-Raphson method
 */
function calculateIRR(cashFlows: number[], guess: number = 0.1): number {
  const maxIterations = 100;
  const tolerance = 1e-6;

  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      const discountFactor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / discountFactor;
      if (t > 0) {
        dnpv -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
      }
    }

    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    if (Math.abs(dnpv) < tolerance) {
      break;
    }

    const newRate = rate - npv / dnpv;

    if (newRate < -0.99) {
      rate = -0.99;
    } else if (newRate > 10) {
      rate = 10;
    } else {
      rate = newRate;
    }
  }

  return binarySearchIRR(cashFlows);
}

function binarySearchIRR(cashFlows: number[]): number {
  let low = -0.99;
  let high = 5.0;
  const tolerance = 1e-6;
  const maxIterations = 100;

  const npv = (rate: number): number => {
    return cashFlows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
  };

  const npvLow = npv(low);
  const npvHigh = npv(high);

  if (npvLow * npvHigh > 0) {
    return NaN;
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);

    if (Math.abs(npvMid) < tolerance) {
      return mid;
    }

    if (npvLow * npvMid < 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return (low + high) / 2;
}

/**
 * Simulate a single fund run
 */
export function simulateFundOnce(params: FundParams, rng: SeededRandom): SimulationResult {
  const { fundLife, fundSize, mgmtFeeRate, mgmtFeeFullYears, mgmtFeeStepdown, carry } = params;
  const { discoveryCheckSize, targetConvictionCount, convictionCheckSize, graduationRate, followOnReservePercent } = params;

  // Calculate outcome parameters based on fund configuration
  const outcomeParams = calculateOutcomeParams(params);

  // Calculate management fees over fund life
  let totalFees = 0;
  for (let year = 1; year <= fundLife; year++) {
    if (year <= mgmtFeeFullYears) {
      totalFees += mgmtFeeRate * fundSize;
    } else {
      totalFees += mgmtFeeStepdown * mgmtFeeRate * fundSize;
    }
  }

  const investableCapital = fundSize - totalFees;

  // Calculate follow-on reserve as % of investable capital (not fund size)
  const followOnReserve = investableCapital * followOnReservePercent;
  const deployableCapital = investableCapital - followOnReserve;

  // Derive number of discovery checks from target conviction count and graduation rate
  const numDiscovery = Math.round(targetConvictionCount / graduationRate);
  const numConviction = targetConvictionCount;

  // Capital allocation
  const discoveryTotal = numDiscovery * discoveryCheckSize;
  const convictionTotal = numConviction * convictionCheckSize;

  // Generate outcomes for all discovery companies
  const discoveryOutcomes: number[] = [];
  const tractionSignals: number[] = [];

  for (let i = 0; i < numDiscovery; i++) {
    const outcome = sampleDiscoveryOnlyMultiple(rng, outcomeParams);
    discoveryOutcomes.push(outcome);

    // Traction signal is noisy observation of quality
    // Lower noise = better signal = better selection
    const noiseLevel = 1.0 - (0.25 - graduationRate) * 0.5; // More selective = slightly less noise
    const signal = Math.log(outcome + 0.1) + rng.gaussian(0, Math.max(0.5, noiseLevel));
    tractionSignals.push(signal);
  }

  // Select top performers by traction signal for conviction
  const indexed = tractionSignals.map((signal, idx) => ({ signal, idx }));
  indexed.sort((a, b) => b.signal - a.signal);
  const convictionIndices = new Set(indexed.slice(0, numConviction).map(x => x.idx));

  // For conviction companies, resample with better distribution
  const convictionOutcomes: Map<number, number> = new Map();
  for (const idx of convictionIndices) {
    convictionOutcomes.set(idx, sampleConvictionMultiple(rng, outcomeParams));
  }

  // Follow-on allocation
  // Larger reserves = more follow-on investments, concentrated in winners
  const avgFollowOnCheck = convictionCheckSize * 0.5;
  const maxFollowOnByReserve = Math.floor(followOnReserve / avgFollowOnCheck);
  const maxFollowOnByPortfolio = Math.round(numConviction * (0.3 + followOnReservePercent));
  const numFollowOn = Math.min(maxFollowOnByReserve, maxFollowOnByPortfolio);

  // Select best conviction companies for follow-on (by outcome)
  const convictionByOutcome = Array.from(convictionIndices)
    .map(idx => ({ idx, outcome: convictionOutcomes.get(idx)! }))
    .sort((a, b) => b.outcome - a.outcome);

  const followOnIndices = new Set(convictionByOutcome.slice(0, numFollowOn).map(x => x.idx));
  const followOnCheckSize = numFollowOn > 0 ? followOnReserve / numFollowOn : 0;

  // Build cash flows
  const cashFlows: number[] = new Array(fundLife + 1).fill(0);

  // Year 1: Discovery + Conviction checks
  cashFlows[1] -= discoveryTotal;
  cashFlows[1] -= convictionTotal;

  // Year 2-3: Follow-on deployments
  if (numFollowOn > 0) {
    cashFlows[2] -= followOnReserve * 0.5;
    cashFlows[3] -= followOnReserve * 0.5;
  }

  // Calculate returns
  let totalDistGross = 0;

  for (let i = 0; i < numDiscovery; i++) {
    const exitYear = rng.randInt(4, fundLife);

    if (convictionIndices.has(i)) {
      const outcome = convictionOutcomes.get(i)!;
      const invested = discoveryCheckSize + convictionCheckSize;
      let distribution = invested * outcome;

      if (followOnIndices.has(i)) {
        // Follow-on invested at higher valuation
        // Step-up depends on company trajectory - winners have higher step-ups
        const stepUp = 2.5 + outcome * 0.1; // 2.5-5x step-up for big winners
        const followOnMultiple = Math.max(outcome / stepUp, 0);
        distribution += followOnCheckSize * followOnMultiple;
      }

      cashFlows[exitYear] += distribution;
      totalDistGross += distribution;
    } else {
      const outcome = discoveryOutcomes[i];
      const distribution = discoveryCheckSize * outcome;
      cashFlows[exitYear] += distribution;
      totalDistGross += distribution;
    }
  }

  // Calculate metrics
  const totalCalled = -cashFlows.filter(cf => cf < 0).reduce((a, b) => a + b, 0);

  const grossTvpi = totalDistGross / totalCalled;
  const dpiGross = grossTvpi;

  const profit = totalDistGross - totalCalled;
  const carryPaid = Math.max(profit, 0) * carry;
  const totalDistNet = totalDistGross - carryPaid;
  const netTvpi = totalDistNet / totalCalled;
  const dpiNet = netTvpi;

  const cashFlowsNet = [...cashFlows];
  cashFlowsNet[fundLife] -= carryPaid;
  const irrNet = calculateIRR(cashFlowsNet);

  return {
    totalCalled,
    totalDistGross,
    totalDistNet,
    grossTvpi,
    netTvpi,
    dpiGross,
    dpiNet,
    irrNet: isNaN(irrNet) ? 0 : irrNet,
    carryPaid,
    discoveryOnlyCount: numDiscovery - numConviction,
    convictionCount: numConviction,
    followOnCount: numFollowOn,
  };
}

/**
 * Calculate summary statistics
 */
function calculateSummary(values: number[]): SimulationSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const percentile = (p: number): number => {
    const idx = (p / 100) * (n - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  return {
    mean: values.reduce((a, b) => a + b, 0) / n,
    p10: percentile(10),
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/**
 * Run Monte Carlo simulation
 */
export function runMonteCarloSimulation(
  params: FundParams,
  numSimulations: number = 5000,
  seed?: number
): MonteCarloResults {
  const rng = new SeededRandom(seed ?? Date.now());

  const simulations: SimulationResult[] = [];

  for (let i = 0; i < numSimulations; i++) {
    simulations.push(simulateFundOnce(params, rng));
  }

  const grossTvpis = simulations.map(s => s.grossTvpi);
  const netTvpis = simulations.map(s => s.netTvpi);
  const dpiNets = simulations.map(s => s.dpiNet);
  const irrNets = simulations.map(s => s.irrNet);

  const probReturnFund = simulations.filter(s => s.netTvpi >= 1.0).length / numSimulations;
  const prob2x = simulations.filter(s => s.netTvpi >= 2.0).length / numSimulations;
  const prob3x = simulations.filter(s => s.netTvpi >= 3.0).length / numSimulations;

  return {
    simulations,
    summary: {
      grossTvpi: calculateSummary(grossTvpis),
      netTvpi: calculateSummary(netTvpis),
      dpiNet: calculateSummary(dpiNets),
      irrNet: calculateSummary(irrNets),
    },
    probReturnFund,
    prob2x,
    prob3x,
    params,
    numSimulations,
  };
}
