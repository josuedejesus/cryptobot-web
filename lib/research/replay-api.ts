import { ResearchApiError, getSavedConfigs } from "./research-api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface ReplayWindow {
  warmupStart: number;
  reportFrom: number;
  reportTo: number;
}

export interface ReplayManifest {
  symbol: string;
  timeframe: string;
  trendTimeframe: string;
  window: ReplayWindow;
  configHash: string;
  datasetHash: string;
  strategyDatasetHash: string;
  intrabarDatasets: {
    timeframe: string;
    datasetHash: string;
    candleCount: number;
    from: number;
    to: number;
  }[];
  stopExecution: {
    mode: "CANDLE_CLOSE" | "INTRABAR";
    timeframe: string | null;
    datasetHash: string | null;
    candleCount: number;
    from: number | null;
    to: number | null;
  };
  signalCandles: number;
  trendCandles: number;
}

export interface ReplaySummary {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  maxConcurrentPositions: number;
  stopExits: number;
  gapThroughStops: number;
  averageStopSlippage: number | null;
  averageEffectiveStopToExecution: number | null;
}

export interface ReplayTradeView {
  tradeId: number;
  type: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  stopLoss: number | null;
  initialStop: number | null;
  effectiveStop: number | null;
  stopExecutionMode: string | null;
  stopExecutionTimeframe: string | null;
  stopTriggerPrice: number | null;
  stopExecutionPrice: number | null;
  stopEffectiveFrom: string | null;
  stopTriggeredAt: string | null;
  stopExecutedAt: string | null;
  stopTimestampPrecision: 'EXACT' | 'CANDLE_BUCKET' | null;
  stopGapThrough: boolean | null;
  stopIntrabarAmbiguity: boolean | null;
  takeProfit: number | null;
  pnl: number | null;
  result: string | null;
  reason: string | null;
  openedAt: string | null;
  closedAt: string | null;
  signalCandleOpenTime: string | null;
  signalCandleCloseTime: string | null;
  decisionTime: string | null;
  entryTime: string | null;
  exitTime: string | null;
}

export interface IntrabarTradeMetric {
  tradeId: number;
  side: "LONG" | "SHORT";
  timeframe: string;
  entryPrice: number;
  entryTime: number;
  exitTime: number;
  exitPrice: number;
  activationThresholdPct: number | null;
  peakPrice: number | null;
  peakTimeBucket: number | null;
  troughPrice: number | null;
  troughTimeBucket: number | null;
  mfe: number | null;
  mfePct: number | null;
  mae: number | null;
  maePct: number | null;
  timeToMfeMs: number | null;
  timeToMaeMs: number | null;
  maxRetracementFromPeak: number | null;
  maxRetracementFromPeakPct: number | null;
  timePeakToExitMs: number | null;
  observedIntrabarActivationCrossing: {
    timeBucket: number;
    level: number;
    orderAmbiguous: boolean;
  } | null;
  milestones: { favorablePct: number; timeBucket: number | null; orderAmbiguous: boolean }[];
  boundaryStatus: "CLEAR" | "BOUNDARY_AMBIGUOUS" | "NO_COMPLETE_CANDLES";
}

export interface IntrabarResolutionSummary {
  timeframe: string;
  tradeCount: number;
  medianMfePct: number | null;
  medianMaePct: number | null;
  medianTimeToMfeMs: number | null;
  medianMaxRetracementPct: number | null;
  medianGivebackPct: number | null;
  activationThresholdReachedPct: number | null;
  favorableThresholdsReachedPct: Record<string, number>;
  bySide: Record<"LONG" | "SHORT", { tradeCount: number; medianMfePct: number | null; medianMaePct: number | null }>;
}

export interface ReplaySeriesCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ReplayMarketSeries {
  symbol: string;
  timeframe: string;
  from: number;
  to: number;
  datasetHash: string;
  candleCount: number;
  durationSeconds: number;
  candles: ReplaySeriesCandle[];
}

export type ReplayLifecycleEvent =
  | {
      type: "ENTRY";
      tradeId: number;
      side: "LONG" | "SHORT";
      signalCandleOpenTime: number;
      signalCandleCloseTime: number;
      decisionTime: number;
      entryTime: number;
      entryPrice: number;
      initialStop: number;
      effectiveFrom?: number;
      stopUpdateTiming?: string;
      adaptiveActivatedAt?: number | null;
    }
  | {
      type: "EXIT";
      tradeId: number;
      exitTime: number;
      exitPrice: number;
      reason: string;
      balance?: number;
      grossPnl?: number;
      fee?: number;
    }
  | {
      type: "POSITION_UPDATE";
      tradeId: number;
      time: number;
      bestPrice: number;
      stopBefore: number;
      effectiveStop: number;
      breakevenApplied: boolean;
      stopCandidate?: number | null;
      candidateTime?: number | null;
      effectiveFrom?: number;
      stopUpdateTiming?: string;
      adaptiveActivatedAt?: number | null;
    }
  | {
      type: "STOP_EXECUTION";
      tradeId: number;
      side: "LONG" | "SHORT";
      mode: "CANDLE_CLOSE" | "INTRABAR";
      timestamp: number;
      triggerTime?: number;
      executionTime?: number;
      effectiveFrom?: number | null;
      timestampPrecision?: "EXACT" | "CANDLE_BUCKET";
      effectiveStop: number;
      triggerPrice: number;
      executionPrice: number;
      executionTimeframe: string | null;
      gapThrough: boolean | null;
      ambiguousIntrabar: boolean;
    };

export interface ReplayRunResponse {
  manifest: ReplayManifest;
  summary: ReplaySummary;
  trades: ReplayTradeView[];
  market: {
    strategy: ReplayMarketSeries;
    intrabar: Record<string, ReplayMarketSeries>;
  };
  strategyResultHash: string;
  resultHash: string;
  intrabarAnalysis: {
    version: string;
    analysisHash: string;
    trades: IntrabarTradeMetric[];
    summaries: IntrabarResolutionSummary[];
  };
  lifecycle: ReplayLifecycleEvent[];
}

export interface StopExecutionVariantResult {
  mode: "CANDLE_CLOSE" | "INTRABAR";
  resolution: string;
  configHash: string;
  strategyDatasetHash: string;
  stopDatasetHash: string | null;
  stopCandleCount: number;
  resultHash: string;
  summary: {
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    netPnl: number;
    profitFactor: number | null;
    expectancy: number;
    maxDrawdown: number;
    finalBalance: number;
    balanceCurve: { time: string; balance: number }[];
    fees: number;
    averageHoldTimeMs: number | null;
    medianHoldTimeMs: number | null;
    medianMfe: number | null;
    medianMae: number | null;
    medianCaptureRatio: number | null;
    medianGiveback: number | null;
    greenToRedCount: number;
    greenToRedRate: number;
    activationThresholdReachedCount: number;
    stopExits: number;
    gapExits: number;
    averageStopSlippage: number | null;
    averageEffectiveStopToExecution: number | null;
  };
  executionDiagnostics: {
    resolution: string;
    requestedRange: { from: number | null; to: number | null };
    returnedRange: {
      from: number | null;
      to: number | null;
      firstOpenTime: number | null;
      lastOpenTime: number | null;
    };
    candleCount: number;
    datasetHash: string | null;
    effectiveStopCount: number;
    adaptiveActivationCount: number;
    stopCandidateCount: number;
    eligibleCandles: number;
    eligibleTouches: number;
    stopExecutions: number;
    gapExecutions: number;
    unexecutedEligibleTouches: number | null;
    firstEligibleTouch: {
      tradeId: number;
      effectiveStop: number;
      effectiveFrom: number;
      candle: { openTime: number; open: number; high: number; low: number; close: number };
      gapThrough: boolean;
      executed: boolean;
      executionTime: number | null;
      executionPrice: number | null;
    } | null;
  };
  comparisonDelta: { changedEntries: number; changedExits: number };
  trades: ReplayTradeView[];
  firstDivergence: {
    index: number;
    baselineTradeId: number | null;
    variantTradeId: number | null;
    kind: string;
    explanation: string;
    baselineExitTime?: string | null;
    variantExitTime?: string | null;
    stopTouch?: StopExecutionVariantResult['executionDiagnostics']['firstEligibleTouch'];
  } | null;
}

export interface StopExecutionComparisonResponse {
  symbol: string;
  managementTimeframe: string;
  analysisTimeframe: string;
  window: ReplayWindow;
  variants: StopExecutionVariantResult[];
  noWinnerSelected: true;
}

export interface ReplayRunRequest {
  configId: number;
  from: string;
  to: string;
  intrabarTimeframes?: string[];
  stopExecutionTimeframe?: string;
  stopExecutionTimeframes?: string[];
}

export async function getIntrabarTimeframes(
  executionTimeframe: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await fetch(
    `${API}/replay/intrabar-timeframes?executionTimeframe=${encodeURIComponent(executionTimeframe)}`,
    { signal },
  );
  if (!response.ok)
    throw new ResearchApiError(
      'No se pudieron cargar las resoluciones intrabar.',
      response.status,
    );
  return response.json() as Promise<string[]>;
}

export async function compareStopExecution(
  body: ReplayRunRequest & { stopExecutionTimeframes: string[] },
  signal?: AbortSignal,
): Promise<StopExecutionComparisonResponse> {
  const response = await fetch(`${API}/replay/compare-stop-execution`, {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : "Stop Execution Comparison falló.";
    throw new ResearchApiError(message, response.status);
  }
  return response.json() as Promise<StopExecutionComparisonResponse>;
}

export { getSavedConfigs, ResearchApiError };

/** Corre un Production Replay histórico. Mismo manejo de errores que Research. */
export async function runReplay(
  body: ReplayRunRequest,
  signal?: AbortSignal,
): Promise<ReplayRunResponse> {
  let response: Response;
  try {
    response = await fetch(`${API}/replay/run`, {
      signal,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ResearchApiError(
      "No se pudo conectar con el Replay. Revisá la conexión e intentá de nuevo.",
      0,
    );
  }
  if (!response.ok) {
    let message =
      response.status === 404
        ? "Configuración no encontrada."
        : response.status >= 500
          ? "El Replay no pudo completar la simulación. Intentá de nuevo."
          : "La solicitud no es válida.";
    const payload: unknown = await response.json().catch(() => null);
    if (payload && typeof payload === "object" && "message" in payload) {
      const value = (payload as { message: unknown }).message;
      if (typeof value === "string") message = value;
      else if (Array.isArray(value) && value.every((v) => typeof v === "string"))
        message = value.join("; ");
    }
    throw new ResearchApiError(message, response.status);
  }
  return response.json() as Promise<ReplayRunResponse>;
}
