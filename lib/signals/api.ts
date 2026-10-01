import type {
  SignalDetail,
  SignalFacets,
  SignalFilters,
  SignalListResponse,
  SignalMeta,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Errores con status, para que la UI pueda distinguir "no hay decisiones" de
 * "la API falló" de "esa decisión no existe" (§40).
 */
export class SignalsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new SignalsApiError("No se pudo conectar con el bot.", 0);
  }
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (
        body !== null &&
        typeof body === "object" &&
        typeof (body as { message?: unknown }).message === "string"
      )
        message = (body as { message: string }).message;
    } catch {
      // Cuerpo no-JSON: el status alcanza para decidir qué mostrar.
    }
    throw new SignalsApiError(message, response.status);
  }
  return (await response.json()) as T;
}

/** Solo manda los filtros con valor: "ALL" y vacío no viajan. */
export function buildQuery(
  filters: SignalFilters,
  page: number,
  limit: number,
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  const entries: [keyof SignalFilters, string][] = Object.entries(
    filters,
  ) as [keyof SignalFilters, string][];
  for (const [key, value] of entries) {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "ALL") continue;
    params.set(key, trimmed);
  }
  return params.toString();
}

export const getSignals = (
  filters: SignalFilters,
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<SignalListResponse> =>
  get(`/trading-decisions?${buildQuery(filters, page, limit)}`, signal);

export const getSignalDetail = (
  id: number,
  signal?: AbortSignal,
): Promise<SignalDetail> => get(`/trading-decisions/${String(id)}`, signal);

export const getSignalFacets = (signal?: AbortSignal): Promise<SignalFacets> =>
  get("/trading-decisions/facets", signal);

export const getSignalMeta = (signal?: AbortSignal): Promise<SignalMeta> =>
  get("/trading-decisions/meta", signal);
