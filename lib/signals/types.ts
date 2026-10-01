/**
 * Tipos de la UI de Señales. Espejo EXPLÍCITO de los DTO del backend
 * (`src/observability/explorer/trading-decision-explorer.types.ts`).
 *
 * Nada de `any`: lo que llega es JSON versionado y la UI tiene que poder
 * degradar sin romperse, no fingir que conoce la forma.
 */

export interface SignalListItem {
  id: number;
  mode: string;
  symbol: string;
  timeframe: string;
  signalType: string | null;
  side: string | null;
  score: number | null;
  status: string;
  rejectionCode: string | null;
  decisionTime: string;
  tradeId: number | null;
  configHash: string;
  createdAt: string;
  exitStrategyType: string | null;
}

export interface SignalScoreStats {
  scored: number;
  average: number | null;
  median: number | null;
}

export interface SignalSummary {
  signals: number;
  executed: number;
  rejected: number;
  executionRate: number | null;
  byStatus: Record<string, number>;
  score: {
    all: SignalScoreStats;
    executed: SignalScoreStats;
    rejected: SignalScoreStats;
  };
}

export interface SignalListResponse {
  items: SignalListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: SignalSummary;
}

export interface SignalTradeSummary {
  id: number;
  type: string;
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  result: string | null;
  pnl: number | null;
  reason: string | null;
  openedAt: string;
  closedAt: string | null;
  quantity: number | null;
  exitStrategyType: string | null;
}

export interface SignalExitStrategy {
  type: string;
  params: Record<string, number> | null;
}

/**
 * `context` v1. Todo opcional y todo nullable: la UI muestra "—" ante un
 * null y NUNCA lo convierte en 0, que diría algo distinto.
 */
export interface SignalContextV1 {
  price?: number | null;
  rsi?: number | null;
  prevRsi?: number | null;
  stochRsi?: {
    k?: number | null;
    d?: number | null;
    prevK?: number | null;
    prevD?: number | null;
  } | null;
  ema?: {
    fast?: number | null;
    slow?: number | null;
    spreadPct?: number | null;
  } | null;
  vwap?: number | null;
  priceAboveVwap?: boolean | null;
  atr?: number | null;
  atrPct?: number | null;
  atrExpanding?: boolean | null;
  bb?: {
    upper?: number | null;
    middle?: number | null;
    lower?: number | null;
    bandWidth?: number | null;
    squeeze?: boolean | null;
    squeezeRelease?: boolean | null;
  } | null;
  volume?: {
    current?: number | null;
    average?: number | null;
    relative?: number | null;
    isHigh?: boolean | null;
  } | null;
  trend?: { direction?: string | null; strength?: number | null } | null;
}

export interface ScoreFactor {
  code: string;
  label: string;
  category: string;
  points: number;
}

/** `scoreBreakdown` tal como lo persiste la estrategia. */
export interface ScoreBreakdown {
  signal?: string;
  selectedSide?: string | null;
  scores?: Record<string, number>;
  eventCount?: Record<string, number>;
  factors?: Record<string, ScoreFactor[]>;
  selectedTotal?: number | null;
  reasonCodes?: string[];
}

export interface SignalDetail {
  id: number;
  mode: string;
  symbol: string;
  timeframe: string;

  signalCandleOpenTime: string;
  signalCandleCloseTime: string;
  decisionTime: string;
  createdAt: string;

  side: string | null;
  signalType: string | null;
  score: number | null;
  reason: string | null;

  status: string;
  rejectionStage: string | null;
  rejectionCode: string | null;
  rejectionDetail: string | null;

  decisionPrice: number;
  expectedEntryPrice: number | null;

  configId: number | null;
  configHash: string;
  signalIdentity: string;

  contextVersion: number;
  context: unknown;
  scoreBreakdown: unknown;

  executionAttemptedAt: string | null;
  orderAcknowledgedAt: string | null;
  clientOrderId: string | null;
  exchangeOrderId: string | null;

  trade: SignalTradeSummary | null;
  configSnapshot: Record<string, unknown> | null;
  exitStrategy: SignalExitStrategy | null;
  causalTiming: boolean;
}

export interface SignalFacets {
  symbols: string[];
  signalTypes: string[];
  rejectionCodes: string[];
}

export interface SignalMeta {
  statuses: string[];
  rejectionCodes: string[];
  rejectionStages: string[];
  sides: string[];
  modes: string[];
  limits: {
    defaultLimit: number;
    maxLimit: number;
    maxSymbolLength: number;
    maxSignalTypeLength: number;
  };
}

/** Filtros tal como los maneja el formulario: strings, "ALL" = sin filtro. */
export interface SignalFilters {
  mode: string;
  status: string;
  side: string;
  symbol: string;
  signalType: string;
  rejectionCode: string;
  minScore: string;
  maxScore: string;
  from: string;
  to: string;
}

export const emptyFilters: SignalFilters = {
  mode: "ALL",
  status: "ALL",
  side: "ALL",
  symbol: "ALL",
  signalType: "ALL",
  rejectionCode: "ALL",
  minScore: "",
  maxScore: "",
  from: "",
  to: "",
};
