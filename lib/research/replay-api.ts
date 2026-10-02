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
}

export interface ReplayTradeView {
  type: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number | null;
  result: string | null;
  reason: string | null;
  openedAt: string | null;
  closedAt: string | null;
}

export interface ReplayRunResponse {
  manifest: ReplayManifest;
  summary: ReplaySummary;
  trades: ReplayTradeView[];
}

export interface ReplayRunRequest {
  configId: number;
  from: string;
  to: string;
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
