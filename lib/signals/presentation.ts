import type {
  ScoreBreakdown,
  ScoreFactor,
  SignalContextV1,
} from "./types";

/**
 * Etiquetas y lectura segura del JSON persistido.
 *
 * Regla de §33: ninguna etiqueta interpreta el score como calidad. No hay
 * "señal fuerte" ni "mala señal" — todavía estamos investigando si el score
 * predice algo. Se muestra el número.
 */

// ── Estados ───────────────────────────────────────────────────────────────

/** Los seis estados REALES de `DecisionStatus`. No se inventa ninguno. */
export const statusLabels: Record<string, string> = {
  SIGNAL_GENERATED: "Señal generada",
  AWAITING_CONFIRMATION: "Esperando confirmación",
  REJECTED: "Rechazada",
  EXECUTION_ATTEMPTED: "Orden enviada",
  EXECUTED: "Ejecutada",
  EXECUTION_FAILED: "Ejecución falló",
};

export const statusLabel = (status: string) => statusLabels[status] ?? status;

/**
 * Color del badge. EXECUTED en verde y REJECTED en gris, no en rojo: una
 * señal rechazada no es un error, es el bot aplicando sus reglas. El rojo
 * queda para `EXECUTION_FAILED`, que sí es un fallo.
 */
export const statusTone = (
  status: string,
): "executed" | "rejected" | "failed" | "pending" => {
  if (status === "EXECUTED") return "executed";
  if (status === "REJECTED") return "rejected";
  if (status === "EXECUTION_FAILED") return "failed";
  return "pending";
};

// ── Códigos de rechazo ────────────────────────────────────────────────────

/**
 * Los diez códigos REALES de `RejectionCode`. La tabla muestra la versión
 * amigable; el detalle muestra además el código técnico, que es la identidad
 * estable.
 */
export const rejectionLabels: Record<string, string> = {
  BOT_PAUSED: "Bot en pausa",
  POSITION_ALREADY_OPEN: "Ya había una posición abierta",
  CONFIRMATION_PENDING: "Confirmación en curso",
  CONFIRMATION_PULLBACK_EXCEEDED: "Pullback excedido",
  CONFIRMATION_TIMEOUT: "Confirmación expirada",
  DAILY_KILL_SWITCH: "Límite diario alcanzado",
  PRICE_DRIFT_EXCEEDED: "Precio se movió demasiado",
  CONCURRENT_OPEN_IN_PROGRESS: "Apertura concurrente en curso",
  ORDER_FAILED: "La orden falló",
  UNKNOWN: "Sin clasificar",
};

export const rejectionLabel = (code: string) => rejectionLabels[code] ?? code;

export const stageLabels: Record<string, string> = {
  STRATEGY_RISK: "Estrategia / riesgo",
  EXECUTION: "Ejecución",
};

export const stageLabel = (stage: string) => stageLabels[stage] ?? stage;

// ── Lectura segura de JSON versionado ─────────────────────────────────────

/** `contextVersion` que esta UI sabe renderizar campo a campo. */
export const KNOWN_CONTEXT_VERSION = 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Lee el contexto sin confiar en él. Una versión futura con campos nuevos
 * sigue mostrando los conocidos; no se rompe y no se adivina (§39).
 */
export function readContext(value: unknown): SignalContextV1 | null {
  return isRecord(value) ? (value as SignalContextV1) : null;
}

export function readBreakdown(value: unknown): ScoreBreakdown | null {
  if (!isRecord(value)) return null;
  return value as ScoreBreakdown;
}

/**
 * Factores del side elegido. Si no hay side (por ejemplo `signal: NONE`) no
 * se elige uno por nuestra cuenta: se devuelve lista vacía.
 */
export function selectedFactors(breakdown: ScoreBreakdown): ScoreFactor[] {
  const side = breakdown.selectedSide ?? breakdown.signal ?? null;
  if (side === null || side === "NONE") return [];
  const list = breakdown.factors?.[side];
  if (!Array.isArray(list)) return [];
  return list.filter(
    (factor): factor is ScoreFactor =>
      isRecord(factor) &&
      typeof factor.label === "string" &&
      typeof factor.points === "number",
  );
}

/**
 * Suma de los factores mostrados. Es una SUMA de lo persistido, no un
 * recálculo del score: sirve para ver si el total guardado y el desglose
 * coinciden, que es exactamente el debugging que pide §10.
 */
export const factorsTotal = (factors: ScoreFactor[]) =>
  factors.reduce((sum, factor) => sum + factor.points, 0);

// ── Agrupación del contexto ───────────────────────────────────────────────

export interface ContextField {
  label: string;
  value: number | boolean | string | null | undefined;
  kind: "number" | "price" | "percent" | "boolean" | "text";
}

export interface ContextGroup {
  title: string;
  fields: ContextField[];
}

/**
 * Organiza el contexto en grupos. Un grupo cuyos campos son todos `null` o
 * ausentes NO se oculta: que un indicador no estuviera disponible al decidir
 * es información, no ruido.
 */
export function contextGroups(context: SignalContextV1): ContextGroup[] {
  return [
    {
      title: "Momentum",
      fields: [
        { label: "RSI", value: context.rsi, kind: "number" },
        { label: "RSI previo", value: context.prevRsi, kind: "number" },
        { label: "Stoch RSI K", value: context.stochRsi?.k, kind: "number" },
        { label: "Stoch RSI D", value: context.stochRsi?.d, kind: "number" },
        { label: "K previo", value: context.stochRsi?.prevK, kind: "number" },
        { label: "D previo", value: context.stochRsi?.prevD, kind: "number" },
      ],
    },
    {
      title: "Tendencia",
      fields: [
        { label: "Dirección", value: context.trend?.direction, kind: "text" },
        { label: "Fuerza", value: context.trend?.strength, kind: "number" },
      ],
    },
    {
      title: "Medias móviles",
      fields: [
        { label: "EMA rápida", value: context.ema?.fast, kind: "price" },
        { label: "EMA lenta", value: context.ema?.slow, kind: "price" },
        { label: "Separación", value: context.ema?.spreadPct, kind: "number" },
      ],
    },
    {
      title: "VWAP",
      fields: [
        { label: "VWAP", value: context.vwap, kind: "price" },
        { label: "Precio sobre VWAP", value: context.priceAboveVwap, kind: "boolean" },
      ],
    },
    {
      title: "Volatilidad",
      fields: [
        { label: "ATR", value: context.atr, kind: "price" },
        { label: "ATR / precio", value: context.atrPct, kind: "number" },
        { label: "ATR expandiendo", value: context.atrExpanding, kind: "boolean" },
        { label: "Banda superior", value: context.bb?.upper, kind: "price" },
        { label: "Banda media", value: context.bb?.middle, kind: "price" },
        { label: "Banda inferior", value: context.bb?.lower, kind: "price" },
        { label: "Ancho de banda", value: context.bb?.bandWidth, kind: "number" },
        { label: "Squeeze", value: context.bb?.squeeze, kind: "boolean" },
        { label: "Squeeze release", value: context.bb?.squeezeRelease, kind: "boolean" },
      ],
    },
    {
      title: "Volumen",
      fields: [
        { label: "Volumen", value: context.volume?.current, kind: "number" },
        { label: "Promedio", value: context.volume?.average, kind: "number" },
        { label: "Relativo", value: context.volume?.relative, kind: "number" },
        { label: "Volumen alto", value: context.volume?.isHigh, kind: "boolean" },
      ],
    },
  ];
}

// ── Parámetros de exit strategy ───────────────────────────────────────────

export const exitParamLabels: Record<string, string> = {
  activationPct: "Activación",
  lowAtrMultiplier: "ATR baja volatilidad",
  normalAtrMultiplier: "ATR volatilidad normal",
  highAtrMultiplier: "ATR alta volatilidad",
  volatilityWindow: "Ventana",
  lowPercentile: "Percentil bajo",
  highPercentile: "Percentil alto",
};

/**
 * Orden de presentación. El snapshot guarda las claves canonicalizadas, o sea
 * ordenadas alfabéticamente, y eso deja "percentil bajo" entre "activación" y
 * los multiplicadores. Este orden es el del schema, que es el que se lee.
 */
export const EXIT_PARAM_ORDER: readonly string[] = [
  "activationPct",
  "lowAtrMultiplier",
  "normalAtrMultiplier",
  "highAtrMultiplier",
  "volatilityWindow",
  "lowPercentile",
  "highPercentile",
];

/** Un parámetro desconocido va al final, no se oculta. */
export const orderExitParams = (
  params: Record<string, number>,
): [string, number][] =>
  Object.entries(params).sort(([a], [b]) => {
    const ia = EXIT_PARAM_ORDER.indexOf(a);
    const ib = EXIT_PARAM_ORDER.indexOf(b);
    return (
      (ia === -1 ? EXIT_PARAM_ORDER.length : ia) -
      (ib === -1 ? EXIT_PARAM_ORDER.length : ib)
    );
  });

/** `activationPct` es una fracción; el resto son multiplicadores o conteos. */
export const exitParamKind = (
  name: string,
): "percent" | "multiplier" | "integer" => {
  if (name === "activationPct") return "percent";
  if (name.endsWith("Multiplier")) return "multiplier";
  return "integer";
};
