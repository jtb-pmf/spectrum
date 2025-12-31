// Fund configuration types
export interface FundParams {
  // Core fund economics
  fundSize: number;           // Total LP commitments
  fundLife: number;           // Fund life in years (default 10)
  mgmtFeeRate: number;        // Annual fee on commitments (default 2%)
  mgmtFeeFullYears: number;   // Years at full fee
  mgmtFeeStepdown: number;    // Stepdown multiplier after full years
  carry: number;              // Carry on profits (default 20%)

  // Investment strategy
  targetConvictionCount: number;    // Target # of conviction investments (e.g., 25)
  graduationRate: number;           // % of discovery that graduate (e.g., 25%)
  // Derived: discoveryCount = targetConvictionCount / graduationRate

  // Check sizes
  discoveryCheckSize: number;       // $100K default
  convictionCheckSize: number;      // $400K default
  convictionCheckMin: number;       // $250K min (for reference)
  convictionCheckMax: number;       // $750K max (for reference)

  // Follow-on reserves (% of fund)
  followOnReservePercent: number;   // 10-30% depending on fund size

  // Base success rates (configurable inputs to Monte Carlo)
  discoverySuccessRate: number;     // Base rate for discovery companies (default 30%)
  convictionSuccessRate: number;    // Base rate for conviction companies (default 50%)
}

// Preset fund sizes
export const FUND_PRESETS: Record<string, Partial<FundParams>> = {
  '16M': {
    fundSize: 16_000_000,
    targetConvictionCount: 17,   // 15-18
    followOnReservePercent: 0.10,
  },
  '25M': {
    fundSize: 25_000_000,
    targetConvictionCount: 22,   // 20-25
    followOnReservePercent: 0.20,
  },
  '40M': {
    fundSize: 40_000_000,
    targetConvictionCount: 30,   // 28-32
    followOnReservePercent: 0.30,
  },
};

export const DEFAULT_FUND_PARAMS: FundParams = {
  fundSize: 25_000_000,
  fundLife: 10,
  mgmtFeeRate: 0.02,
  mgmtFeeFullYears: 4,
  mgmtFeeStepdown: 0.7,
  carry: 0.20,

  targetConvictionCount: 22,    // Target 20-25 conviction investments
  graduationRate: 0.25,         // 25% of discovery graduates

  discoveryCheckSize: 100_000,
  convictionCheckSize: 400_000,
  convictionCheckMin: 250_000,
  convictionCheckMax: 750_000,

  followOnReservePercent: 0.20,

  discoverySuccessRate: 0.30,   // 30% of discovery companies return >1x
  convictionSuccessRate: 0.50,  // 50% of conviction companies return >1x
};

// Investment tracking types
export type InvestmentStage = 'discovery' | 'conviction';
export type InvestmentStatus = 'active' | 'exited' | 'written_off';

export interface Investment {
  id: string;
  companyName: string;
  stage: InvestmentStage;
  status: InvestmentStatus;

  // Capital deployed
  discoveryAmount: number;
  convictionAmount: number;
  followOnAmount: number;
  totalInvested: number;

  // Valuation tracking
  entryValuation: number;
  currentValuation: number;
  lastValuationDate: string;

  // Dates
  investmentDate: string;
  graduationDate?: string;
  exitDate?: string;

  // Exit details
  exitValue?: number;
  exitMultiple?: number;

  // Notes
  notes?: string;

  createdAt: string;
  updatedAt: string;
}

export interface ValuationUpdate {
  id: string;
  investmentId: string;
  valuation: number;
  date: string;
  notes?: string;
  createdAt: string;
}

// Simulation result types
export interface SimulationResult {
  // Called capital
  totalCalled: number;

  // Distributions
  totalDistGross: number;
  totalDistNet: number;

  // Multiples
  grossTvpi: number;
  netTvpi: number;
  dpiGross: number;
  dpiNet: number;

  // IRR
  irrNet: number;

  // Carry
  carryPaid: number;

  // Portfolio breakdown
  discoveryOnlyCount: number;
  convictionCount: number;
  followOnCount: number;
}

export interface SimulationSummary {
  mean: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
}

export interface MonteCarloResults {
  simulations: SimulationResult[];
  summary: {
    grossTvpi: SimulationSummary;
    netTvpi: SimulationSummary;
    dpiNet: SimulationSummary;
    irrNet: SimulationSummary;
  };
  // Probability metrics
  probReturnFund: number;      // P(TVPI >= 1x)
  prob2x: number;              // P(TVPI >= 2x)
  prob3x: number;              // P(TVPI >= 3x)

  // Fund config used
  params: FundParams;
  numSimulations: number;
}

// Database types (Supabase)
export interface DbFund {
  id: string;
  name: string;
  params: FundParams;
  created_at: string;
  updated_at: string;
}

export interface DbInvestment {
  id: string;
  fund_id: string;
  company_name: string;
  stage: InvestmentStage;
  status: InvestmentStatus;
  discovery_amount: number;
  conviction_amount: number;
  follow_on_amount: number;
  entry_valuation: number;
  current_valuation: number;
  last_valuation_date: string;
  investment_date: string;
  graduation_date: string | null;
  exit_date: string | null;
  exit_value: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbValuationUpdate {
  id: string;
  investment_id: string;
  valuation: number;
  date: string;
  notes: string | null;
  created_at: string;
}
