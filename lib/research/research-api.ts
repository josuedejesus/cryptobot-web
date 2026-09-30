import type {
  AnalyzeAdaptiveRequest,
  AnalyzeAdaptiveResponse,
  ResearchCapabilities,
  ResearchRunRequest,
  ResearchRunResponse,
  ResearchCompareRequest,
  ResearchCompareResponse,
  SavedConfig,
  ResearchTraceRequest,
  ResearchTraceResponse,
} from "./types";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
export class ResearchApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function call<T>(
  path: string,
  signal?: AbortSignal,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      signal,
      ...(body === undefined
        ? {}
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ResearchApiError(
      "No se pudo conectar con Research. Revisá la conexión e intentá de nuevo.",
      0,
    );
  }
  if (!response.ok) {
    let message =
      response.status === 404
        ? "Configuración no encontrada."
        : response.status >= 500
          ? "Research no pudo completar la simulación. Intentá de nuevo."
          : "La solicitud no es válida.";
    if (response.status === 400) {
      const payload: unknown = await response.json().catch(() => null);
      if (payload && typeof payload === "object" && "message" in payload) {
        const value = payload.message;
        if (typeof value === "string") message = value;
        else if (
          Array.isArray(value) &&
          value.every((v) => typeof v === "string")
        )
          message = value.join("; ");
      }
    }
    if (response.status === 404 && path === "/research/trace")
      message =
        "Entrada o configuración no encontrada en el cohort CURRENT reproducido.";
    throw new ResearchApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}
export const getResearchCapabilities = (signal?: AbortSignal) =>
  call<ResearchCapabilities>("/research/capabilities", signal);
export const getSavedConfigs = (signal?: AbortSignal) =>
  call<SavedConfig[]>("/bot-config/saved-configs", signal);
export const runResearch = (body: ResearchRunRequest, signal?: AbortSignal) =>
  call<ResearchRunResponse>("/research/run", signal, body);
export const compareResearchExits = (
  body: ResearchCompareRequest,
  signal?: AbortSignal,
) => call<ResearchCompareResponse>("/research/compare-exits", signal, body);

export const analyzeAdaptivePhases = (
  body: AnalyzeAdaptiveRequest,
  signal?: AbortSignal,
) => call<AnalyzeAdaptiveResponse>("/research/analyze-adaptive", signal, body);

export const traceResearchTrade = (
  body: ResearchTraceRequest,
  signal?: AbortSignal,
) => call<ResearchTraceResponse>("/research/trace", signal, body);
