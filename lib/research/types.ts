import type { BotConfig } from "@/hooks/useBot";

export type ResearchExecutionMode = "SEQUENTIAL" | "FIXED_ENTRY_COHORT";
export interface AdaptiveRunnerExitParams {
  protectionActivationPct: number;
  protectionCaptureRatio: number;
  runnerActivationPct: number;
  runnerAtrMultiplier: number;
  strongRunnerActivationPct: number;
  strongRunnerAtrMultiplier: number;
}
/** Trailing ATR por régimen de volatilidad; research only. */
export interface AdaptiveChandelierExitParams {
  activationPct: number;
  lowAtrMultiplier: number;
  normalAtrMultiplier: number;
  highAtrMultiplier: number;
  volatilityWindow: number;
  lowPercentile: number;
  highPercentile: number;
}
export type ExitParamName =
  | "activationPct"
  | "atrMultiplier"
  | keyof AdaptiveRunnerExitParams
  | keyof AdaptiveChandelierExitParams;
export type ExitStrategyType =
  | "CURRENT"
  | "CHANDELIER"
  | "ADAPTIVE_RUNNER"
  | "ADAPTIVE_RUNNER_V2"
  | "ADAPTIVE_CHANDELIER";
export type ExitStrategySelection =
  | { type: "ADAPTIVE_RUNNER"; params?: Partial<AdaptiveRunnerExitParams> }
  | { type: "ADAPTIVE_RUNNER_V2"; params?: Partial<AdaptiveRunnerExitParams> }
  | { type: "CURRENT"; params?: never }
  | {
      type: "CHANDELIER";
      params?: { activationPct?: number; atrMultiplier?: number };
    }
  | {
      type: "ADAPTIVE_CHANDELIER";
      params?: Partial<AdaptiveChandelierExitParams>;
    };
export interface ResearchCapabilities {
  executionModes: ResearchExecutionMode[];
  exitStrategies: {
    type: ExitStrategyType;
    experimental?: boolean;
    params: {
      name: ExitParamName;
      unit?: "ratio" | "multiplier" | "candles" | "percentile";
      label?: string;
      description?: string;
      max?: number;
      greaterThan?: ExitParamName;
      maxReference?: ExitParamName;
      default: number;
      /**
       * Prefill sugerido por el backend cuando la mejor configuración medida no
       * es el default de la estrategia. Solo afecta el valor inicial del input:
       * el request sigue mandando lo que el usuario deje escrito.
       */
      recommended?: number;
      min?: number;
      minExclusive?: number;
    }[];
  }[];
  /**
   * Execution timeframes válidos por signal timeframe. El primero de cada lista
   * es el más fino; el propio signal timeframe siempre está incluido y es el
   * default ("igual que la señal").
   */
  executionTimeframes: Record<string, string[]>;
  limits: { maxRangeDays: number; maxExitVariants: number; maxCandles: number };
  initialBalanceDefault: number;
  analysis: { mfeExcursionThresholds: number[] };
}
export type SavedConfig = Pick<
  BotConfig,
  "id" | "name" | "symbol" | "timeframe" | "trendTimeframe" | "isActive"
>;
export interface ResearchRequest {
  configId: number;
  from: string;
  to: string;
  initialBalance?: number;
  /**
   * Omitido = igual al signal timeframe. Controla con cuánta precisión se
   * gestionan las posiciones DESPUÉS de la entrada; las señales no cambian.
   */
  executionTimeframe?: string;
}
export interface ResearchRunRequest extends ResearchRequest {
  executionMode?: ResearchExecutionMode;
  exitStrategy?: ExitStrategySelection;
}
export interface ResearchCompareRequest extends ResearchRequest {
  exits: ExitStrategySelection[];
}
export interface ResearchSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number;
  initialBalance: number;
  finalBalance: number;
  totalPnl: number;
  totalFees: number;
  totalFunding: number;
  signalsEvaluated: number;
  signalsExecuted: number;
  signalsRejected: number;
}
export type TradeResult = "WIN" | "LOSS" | "SCRATCH";
export type ExitReason = "stop" | "tp" | "trailing-crossed" | "timeout";
export interface ExperimentTrade {
  side: "LONG" | "SHORT";
  reason: string;
  signalTime: number;
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  fee: number;
  funding: number;
  result: TradeResult;
  exitReason: ExitReason;
  candlesHeld: number;
  maxFavorable: number;
  maxAdverse: number;
  maxFavorablePnl: number;
  maxAdversePnl: number;
  candlesToMaxFavorable: number;
  candlesToMaxAdverse: number;
  adverseBeforeFavorable: boolean;
  wasProfit: boolean;
  peakPnlBeforeLoss: number;
}
export interface AnalyzedTrade {
  entryId: string;
  trade: ExperimentTrade;
  metrics: {
    grossRealizedPnl: number;
    mfeCaptureRatio: number | null;
    peakGiveback: number;
    peakGivebackRatio: number | null;
    favorablePricePct: number;
    maxFavorablePct: number;
    greenToRed: boolean;
  };
}
export interface ExitQualityMetrics {
  evaluatedEntries: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number;
  totalPnl: number;
  expectancy: number;
  profitFactor: number | null;
  profitFactorStatus: "DEFINED" | "UNBOUNDED" | "UNDEFINED";
  maxDrawdownAbsolute: number;
  maxDrawdownPct: number | null;
  avgMfe: number;
  avgMae: number;
  avgMfeCaptureRatio: number | null;
  medianMfeCaptureRatio: number | null;
  avgPeakGiveback: number;
  medianPeakGiveback: number;
  greenToRedCount: number;
  greenToRedRate: number;
  avgCandlesHeld: number;
  medianCandlesHeld: number;
  exitReasons: Record<ExitReason, number>;
}
export interface ResearchMetadata {
  configId: number;
  symbol: string;
  timeframe: string;
  trendTimeframe: string;
  /** Siempre explícito; igual a `timeframe` cuando el request lo omite. */
  executionTimeframe: string;
  from: string;
  to: string;
  executionMode: ResearchExecutionMode;
}
export interface ResearchVariant {
  variantId: string;
  exitStrategy: ExitStrategySelection;
  summary: ResearchSummary;
  quality: ExitQualityMetrics;
  excursion: MfeExcursionAnalysis;
  greenThresholdPct: number;
  trades: AnalyzedTrade[];
}
export interface ResearchRunResponse extends ResearchVariant {
  metadata: ResearchMetadata;
}
export interface ResearchCompareResponse {
  metadata: ResearchMetadata & {
    entries: number;
    cohortSource: "CURRENT_SEQUENTIAL";
  };
  results: ResearchVariant[];
}
export type LabResult =
  | { kind: "single"; data: ResearchRunResponse }
  | { kind: "compare"; data: ResearchCompareResponse };
export type LabRequest =
  | { kind: "single"; body: ResearchRunRequest }
  | { kind: "compare"; body: ResearchCompareRequest };

export interface MfeExcursionThresholdResult {
  thresholdPct: number;
  reachedCount: number;
  reachedRate: number;
  finishedPositiveCount: number;
  finishedNegativeCount: number;
  finishedScratchCount: number;
  greenToRedCount: number;
  greenToRedRate: number;
  avgRealizedPnl: number;
  totalRealizedPnl: number;
  avgMfeCaptureRatio: number | null;
  medianMfeCaptureRatio: number | null;
  avgPeakGiveback: number;
  medianPeakGiveback: number;
  avgCandlesHeld: number;
}
export interface MfeExcursionAnalysis {
  totalTrades: number;
  distribution: {
    mean: number;
    median: number;
    p25: number;
    p75: number;
    p90: number;
    max: number;
  };
  thresholds: MfeExcursionThresholdResult[];
  largestExcursionLosses: AnalyzedTrade[];
}

export interface ExitTraceStep {
  readonly candleIndex: number;
  readonly candleOpenTime: number;
  readonly decisionTime: number;
  readonly previousClose: number;
  readonly openGapPct: number;
  readonly closeBeyondStopAfter: boolean;
  readonly candle: Readonly<{
    open: number;
    high: number;
    low: number;
    close: number;
  }>;
  readonly phaseBefore: string | null;
  readonly phaseAfter: string | null;
  readonly entryPrice: number;
  readonly bestPriceBefore: number;
  readonly bestPriceAfter: number;
  readonly favorablePctBefore: number;
  readonly favorablePctAfter: number;
  readonly stopBefore: number;
  readonly stopCandidate: number | null;
  readonly protectedCandidate: number | null;
  readonly atrCandidate: number | null;
  /** Fase que propuso el candidato. Solo lo emite ADAPTIVE_RUNNER_V2. */
  readonly candidateSource?:
    "PROTECTED" | "RUNNER_ATR" | "STRONG_RUNNER_ATR" | null;
  readonly stopAfter: number;
  readonly currentAtr: number | null;
  /** Cierre de signal candle del ATR usado; nunca posterior a decisionTime. */
  readonly atrAsOfTime: number | null;
  readonly atrAtEntry: number | null;
  readonly atrUsed: number | null;
  readonly atrSource: "CURRENT" | "ENTRY" | "NONE" | null;
  readonly stopUpdateTiming: "AT_CLOSE" | "NEXT_CANDLE";
  readonly effectiveFrom: "CURRENT_CLOSE" | "NEXT_CANDLE";
  readonly stopTriggered: boolean;
  readonly gapExit: boolean;
  readonly thresholdCrossings: readonly {
    readonly type: string;
    readonly threshold: number;
    readonly phase: string;
  }[];
  /** Engine tracking includes the entire exit candle; not the same as managed bestPrice. */
  readonly excursion: Readonly<{
    maxFavorable: number;
    maxAdverse: number;
    maxFavorablePct: number;
    maxFavorablePnl: number;
    maxAdversePnl: number;
  }>;
  readonly exit: Readonly<{
    rawPrice: number;
    price: number;
    reason: ExperimentTrade["exitReason"];
  }> | null;
}
export interface TradeLifecycleTrace {
  readonly entryId: string;
  readonly variantId: string;
  readonly signalTimeframe: string;
  readonly executionTimeframe: string;
  readonly exitStrategy: ExitStrategySelection;
  readonly side: "LONG" | "SHORT";
  readonly signalTime: number;
  readonly entryTime: number;
  readonly entryPrice: number;
  readonly initialStop: number;
  readonly atrAtEntry: number;
  readonly steps: readonly ExitTraceStep[];
  readonly final: ExperimentTrade & { maxFavorablePct: number };
  readonly summary: {
    readonly phasesReached: readonly string[];
    readonly phaseTransitions: readonly {
      candleIndex: number;
      from: string;
      to: string;
    }[];
    readonly maxManagedFavorablePct: number;
    readonly maxFavorablePct: number;
    readonly stoppedByGap: boolean;
    readonly largestStopTightening: number;
    readonly mostProtectiveStop: number;
    readonly finalStopBeforeExit: number;
  };
}

// ── Adaptive Phase Analysis (solo diagnóstico, Paso 5.2) ──────────────────
export type AdaptivePhase = "RISK" | "PROTECTED" | "RUNNER" | "TIGHT_RUNNER";
export type AdaptiveCandidateKind =
  "PROTECTED" | "RUNNER_ATR" | "STRONG_RUNNER_ATR";
export type AdaptiveStopSource =
  "INITIAL_STOP" | "PROTECTED" | "RUNNER" | "STRONG_RUNNER";
export type AdaptiveExitControl =
  | "INITIAL_STOP"
  | "PROTECTED_STOP"
  | "RUNNER_STOP"
  | "STRONG_RUNNER_STOP"
  | "GAP"
  | "TP"
  | "TIMEOUT"
  | "OTHER";
export interface AdaptiveCandidateEffectiveness {
  generated: number;
  improvedStop: number;
  rejectedByExistingStop: number;
  equalToExistingStop: number;
  wonWithinStep: number;
  effectiveStopUpdates: number;
}
export interface AdaptivePhaseEffectiveness {
  phase: AdaptivePhase;
  tradesReached: number;
  tradesReachedRate: number;
  candlesInPhase: number;
  effectiveStopUpdates: number;
  ineffectiveCandidates: number;
}
export interface AdaptiveDistribution {
  count: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  p90: number;
  max: number;
}
export interface AdaptiveRunnerInertia {
  phaseReached: number;
  runnerReached: number;
  candidateGenerated: number;
  candidateImprovedStop: number;
  candidateRejectedByExistingStop: number;
  candidateEqualToExistingStop: number;
  effectivenessRate: number | null;
  tradesWhereRunnerChangedAtLeastOneStop: number;
  tradesWhereRunnerNeverChangedStop: number;
  candidateLostToProtectedCandidate: number;
  candidateWonAgainstProtectedCandidate: number;
  candidateEqualToProtectedCandidate: number;
  rejectionDistancePct: AdaptiveDistribution | null;
}
export interface AdaptiveInertRunnerCase {
  entryId: string;
  side: "LONG" | "SHORT";
  candleIndex: number;
  candleOpenTime: number;
  entryPrice: number;
  bestPrice: number;
  atrUsed: number | null;
  atrSource: string | null;
  stopBefore: number;
  stopSource: AdaptiveStopSource;
  protectedCandidate: number | null;
  runnerCandidate: number;
  candidateKind: AdaptiveCandidateKind;
  distancePct: number;
  favorablePct: number;
  phase: string;
  exitReason: ExitReason;
  pnl: number;
}
export interface AdaptiveTradeDiagnostics {
  entryId: string;
  side: "LONG" | "SHORT";
  phasesReached: string[];
  transitions: string[];
  effectiveStopUpdates: {
    protected: number;
    runner: number;
    strongRunner: number;
  };
  candidates: {
    protectedGenerated: number;
    protectedEffective: number;
    runnerGenerated: number;
    runnerEffective: number;
    runnerRejectedByExistingStop: number;
    runnerEqualToExistingStop: number;
    runnerLostToProtectedCandidate: number;
    strongGenerated: number;
    strongEffective: number;
  };
  finalStopSource: AdaptiveStopSource;
  exitStopSource: AdaptiveStopSource | null;
  exitControl: AdaptiveExitControl;
  exitReason: ExitReason;
  pnl: number;
  maxFavorablePct: number;
  candlesHeld: number;
}
export interface AdaptivePhaseAnalysis {
  totalTrades: number;
  strategies: string[];
  phaseReach: Record<AdaptivePhase, number>;
  phaseReachRate: Record<AdaptivePhase, number>;
  transitions: Record<string, number>;
  transitionRate: Record<string, number>;
  phases: AdaptivePhaseEffectiveness[];
  candidates: Record<AdaptiveCandidateKind, AdaptiveCandidateEffectiveness>;
  runnerInertia: AdaptiveRunnerInertia;
  strongRunnerInertia: AdaptiveRunnerInertia;
  exitControl: Record<AdaptiveExitControl, number>;
  exitStopSource: Record<AdaptiveStopSource, number>;
  trades: AdaptiveTradeDiagnostics[];
  topInertRunnerCases: AdaptiveInertRunnerCase[];
}
export interface AdaptiveSensitivityComparison {
  comparedTrades: number;
  sameExitCount: number;
  differentExitCount: number;
  tradesWithDifferentPhaseTiming: number;
  tradesWithDifferentRunnerCandidate: number;
  tradesWithDifferentEffectiveStop: number;
  tradesWithDifferentExit: number;
  trades: {
    entryId: string;
    differentPhaseTiming: boolean;
    differentRunnerCandidate: boolean;
    differentEffectiveStop: boolean;
    differentExit: boolean;
  }[];
}
export interface AnalyzeAdaptiveRequest extends ResearchRequest {
  exitStrategy: ExitStrategySelection;
  compareWith?: ExitStrategySelection;
}
export interface AnalyzeAdaptiveResponse {
  metadata: ResearchMetadata & {
    entries: number;
    cohortSource: "CURRENT_SEQUENTIAL";
  };
  exitStrategy: ExitStrategySelection;
  comparedWith: ExitStrategySelection | null;
  analysis: AdaptivePhaseAnalysis;
  sensitivity: AdaptiveSensitivityComparison | null;
}

export interface ResearchTraceRequest extends ResearchRequest {
  entryId: string;
  exitStrategy: ExitStrategySelection;
}
export interface ResearchTraceResponse {
  metadata: ResearchMetadata & { cohortSource: "CURRENT_SEQUENTIAL" };
  trace: TradeLifecycleTrace;
}
