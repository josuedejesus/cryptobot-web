import type {
  AnalyzedTrade,
  ExitStrategyType,
  ResearchVariant,
  TradeResult,
} from "./types";

/** Nombre legible de una estrategia de salida. */
export function exitStrategyLabel(type: ExitStrategyType): string {
  if (type === "ADAPTIVE_RUNNER") return "Adaptive Runner";
  if (type === "ADAPTIVE_RUNNER_V2")
    return "Adaptive Runner V2 · Phase Handoff";
  if (type === "ADAPTIVE_CHANDELIER")
    return "Adaptive Chandelier · Volatility Regime";
  return type.replaceAll("_", " ");
}

/** Variantes Adaptive, las únicas que admiten el análisis de fases. */
export const isAdaptive = (type: ExitStrategyType): boolean =>
  type === "ADAPTIVE_RUNNER" || type === "ADAPTIVE_RUNNER_V2";
export type TradeFilter = "ALL" | TradeResult | "GREEN_TO_RED";
export function matchesFilter(
  item: AnalyzedTrade | undefined,
  filter: TradeFilter,
): boolean {
  return (
    !!item &&
    (filter === "ALL" ||
      (filter === "GREEN_TO_RED"
        ? item.metrics.greenToRed
        : item.trade.result === filter))
  );
}
/** Join exclusively by backend entry identity; array order is not identity. */
export function joinTrades(variants: ResearchVariant[]) {
  const maps = variants.map(
    (v) => new Map(v.trades.map((t) => [t.entryId, t])),
  );
  const ids = [
    ...new Set(variants.flatMap((v) => v.trades.map((t) => t.entryId))),
  ];
  return ids.map((entryId) => ({
    entryId,
    variants: maps.map((map) => map.get(entryId)),
  }));
}
