import { describe, expect, it } from "vitest";
import {
  initialValue,
  isRatio,
  selectionFromDraft,
  type ParameterCapability,
} from "@/lib/research/exit-parameters";
import { exitStrategyLabel } from "@/lib/research/presentation";

/**
 * Los descriptores replican los que publica `/research/capabilities` para
 * ADAPTIVE_CHANDELIER. Lo que se prueba es la conversión de unidades: si una
 * ratio se enviara sin dividir, o un percentil se dividiera por 100, el backend
 * rechazaría el request o —peor— aceptaría otra configuración.
 */
const params: ParameterCapability[] = [
  {
    name: "activationPct",
    default: 0.0025,
    min: 0,
    unit: "ratio",
    label: "Activacion",
  },
  {
    name: "lowAtrMultiplier",
    default: 0.8,
    minExclusive: 0,
    unit: "multiplier",
    label: "ATR LOW_VOL",
  },
  {
    name: "normalAtrMultiplier",
    default: 1,
    minExclusive: 0,
    unit: "multiplier",
    label: "ATR NORMAL_VOL",
  },
  {
    name: "highAtrMultiplier",
    default: 1.4,
    minExclusive: 0,
    unit: "multiplier",
    label: "ATR HIGH_VOL",
  },
  {
    name: "volatilityWindow",
    default: 100,
    min: 20,
    max: 1000,
    unit: "candles",
    label: "Ventana de volatilidad",
  },
  {
    name: "lowPercentile",
    default: 25,
    minExclusive: 0,
    unit: "percentile",
    label: "Percentil LOW",
  },
  {
    name: "highPercentile",
    default: 75,
    greaterThan: "lowPercentile",
    unit: "percentile",
    label: "Percentil HIGH",
  },
];
const draftFrom = (fields: ParameterCapability[]) =>
  Object.fromEntries(fields.map((p) => [p.name, initialValue(p)]));

describe("Adaptive Chandelier · mapeo de parámetros", () => {
  it("solo la activación se trata como porcentaje", () => {
    expect(params.filter(isRatio).map((p) => p.name)).toEqual([
      "activationPct",
    ]);
  });

  it("prellena los inputs con los defaults del backend", () => {
    expect(draftFrom(params)).toEqual({
      activationPct: "0.25",
      lowAtrMultiplier: "0.8",
      normalAtrMultiplier: "1",
      highAtrMultiplier: "1.4",
      volatilityWindow: "100",
      lowPercentile: "25",
      highPercentile: "75",
    });
  });

  it("envía las siete claves con las unidades del backend", () => {
    expect(
      selectionFromDraft("ADAPTIVE_CHANDELIER", draftFrom(params), params),
    ).toEqual({
      type: "ADAPTIVE_CHANDELIER",
      params: {
        activationPct: 0.0025,
        lowAtrMultiplier: 0.8,
        normalAtrMultiplier: 1,
        highAtrMultiplier: 1.4,
        // Ni la ventana ni los percentiles se dividen por 100.
        volatilityWindow: 100,
        lowPercentile: 25,
        highPercentile: 75,
      },
    });
  });

  it("convierte la activación editada de porcentaje a ratio", () => {
    const selection = selectionFromDraft(
      "ADAPTIVE_CHANDELIER",
      { ...draftFrom(params), activationPct: "0.5" },
      params,
    );
    expect(selection).toMatchObject({
      params: { activationPct: 0.005 },
    });
  });

  it("valida la relación entre percentiles antes de enviar", () => {
    expect(() =>
      selectionFromDraft(
        "ADAPTIVE_CHANDELIER",
        { ...draftFrom(params), highPercentile: "10" },
        params,
      ),
    ).toThrow(/Percentil HIGH/);
  });

  it("valida los límites de la ventana antes de enviar", () => {
    for (const value of ["10", "1001", ""])
      expect(() =>
        selectionFromDraft(
          "ADAPTIVE_CHANDELIER",
          { ...draftFrom(params), volatilityWindow: value },
          params,
        ),
      ).toThrow(/Ventana de volatilidad/);
  });

  it("no mezcla los parámetros con los de Adaptive Runner", () => {
    const selection = selectionFromDraft(
      "ADAPTIVE_CHANDELIER",
      draftFrom(params),
      params,
    );
    expect(Object.keys(selection.params ?? {})).not.toContain(
      "protectionCaptureRatio",
    );
  });

  it("tiene una etiqueta legible propia", () => {
    expect(exitStrategyLabel("ADAPTIVE_CHANDELIER")).toBe(
      "Adaptive Chandelier · Volatility Regime",
    );
  });
});
