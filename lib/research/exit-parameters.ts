import type {
  AdaptiveChandelierExitParams,
  ExitParamName,
  ExitStrategySelection,
  ExitStrategyType,
  ResearchCapabilities,
} from "./types";
export type ParameterCapability =
  ResearchCapabilities["exitStrategies"][number]["params"][number];
/** Valor inicial del input: la recomendación del backend o, si no hay, el default. */
export const initialValue = (p: ParameterCapability) =>
  String((p.recommended ?? p.default) * (isRatio(p) ? 100 : 1));
export const isRatio = (p: ParameterCapability) =>
  p.unit === "ratio" || p.name === "activationPct";
export const parameterLabel = (p: ParameterCapability) =>
  p.label ??
  (p.name === "activationPct"
    ? "Activación"
    : p.name === "atrMultiplier"
      ? "Multiplicador ATR"
      : p.name);
export function selectionFromDraft(
  type: ExitStrategyType,
  draft: Partial<Record<ExitParamName, string>>,
  fields: ParameterCapability[],
): ExitStrategySelection {
  if (type === "CURRENT") return { type };
  const params: Partial<Record<ExitParamName, number>> = {};
  for (const p of fields) {
    const raw = draft[p.name];
    const value = Number(raw) / (isRatio(p) ? 100 : 1);
    if (
      !raw?.trim() ||
      !Number.isFinite(value) ||
      (p.min !== undefined && value < p.min) ||
      (p.minExclusive !== undefined && value <= p.minExclusive) ||
      (p.max !== undefined && value > p.max)
    ) {
      throw new Error(`Valor inválido: ${parameterLabel(p)}.`);
    }
    params[p.name] = value;
  }
  for (const p of fields) {
    if (
      (p.greaterThan && !(params[p.name]! > params[p.greaterThan]!)) ||
      (p.maxReference && !(params[p.name]! <= params[p.maxReference]!))
    )
      throw new Error(`Relación inválida: ${parameterLabel(p)}.`);
  }
  if (type === "CHANDELIER")
    return {
      type,
      params: {
        activationPct: params.activationPct,
        atrMultiplier: params.atrMultiplier,
      },
    };
  if (type === "ADAPTIVE_CHANDELIER")
    return {
      type,
      // Se envían las siete claves que el backend valida; `volatilityWindow`
      // es un conteo de velas, no una ratio, así que no se divide por 100.
      params: Object.fromEntries(
        (
          [
            "activationPct",
            "lowAtrMultiplier",
            "normalAtrMultiplier",
            "highAtrMultiplier",
            "volatilityWindow",
            "lowPercentile",
            "highPercentile",
          ] as (keyof AdaptiveChandelierExitParams)[]
        ).map((key) => [key, params[key]]),
      ) as Partial<AdaptiveChandelierExitParams>,
    };
  return {
    type,
    params: {
      protectionActivationPct: params.protectionActivationPct,
      protectionCaptureRatio: params.protectionCaptureRatio,
      runnerActivationPct: params.runnerActivationPct,
      runnerAtrMultiplier: params.runnerAtrMultiplier,
      strongRunnerActivationPct: params.strongRunnerActivationPct,
      strongRunnerAtrMultiplier: params.strongRunnerAtrMultiplier,
    },
  };
}
