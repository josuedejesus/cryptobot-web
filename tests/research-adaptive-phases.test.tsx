import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResearchAdaptivePhases from "@/components/research/ResearchAdaptivePhases";
import ResearchLab from "@/components/research/ResearchLab";
import * as api from "@/lib/research/research-api";
import type {
  AnalyzeAdaptiveResponse,
  AdaptivePhaseAnalysis,
} from "@/lib/research/types";
import { capabilities, configs, single, comparison } from "./research.fixture";

const adaptiveVariant = {
  ...single,
  variantId: "ADAPTIVE_RUNNER:protect=0.005",
  exitStrategy: { type: "ADAPTIVE_RUNNER" } as const,
};
const v2Variant = {
  ...single,
  variantId: "ADAPTIVE_RUNNER_V2:protect=0.005",
  exitStrategy: { type: "ADAPTIVE_RUNNER_V2" } as const,
};

vi.mock("@/lib/research/research-api", () => ({
  getResearchCapabilities: vi.fn(),
  getSavedConfigs: vi.fn(),
  runResearch: vi.fn(),
  compareResearchExits: vi.fn(),
  traceResearchTrade: vi.fn(),
  analyzeAdaptivePhases: vi.fn(),
}));

const analysis: AdaptivePhaseAnalysis = {
  totalTrades: 39,
  strategies: ["ADAPTIVE_RUNNER"],
  phaseReach: { RISK: 39, PROTECTED: 35, RUNNER: 9, TIGHT_RUNNER: 4 },
  phaseReachRate: {
    RISK: 1,
    PROTECTED: 35 / 39,
    RUNNER: 9 / 39,
    TIGHT_RUNNER: 4 / 39,
  },
  transitions: { "RISK->PROTECTED": 26, "PROTECTED->RUNNER": 0 },
  transitionRate: { "RISK->PROTECTED": 26 / 39, "PROTECTED->RUNNER": 0 },
  phases: [
    {
      phase: "RISK",
      tradesReached: 39,
      tradesReachedRate: 1,
      candlesInPhase: 27,
      effectiveStopUpdates: 0,
      ineffectiveCandidates: 0,
    },
    {
      phase: "PROTECTED",
      tradesReached: 35,
      tradesReachedRate: 35 / 39,
      candlesInPhase: 52,
      effectiveStopUpdates: 26,
      ineffectiveCandidates: 0,
    },
    {
      phase: "RUNNER",
      tradesReached: 9,
      tradesReachedRate: 9 / 39,
      candlesInPhase: 12,
      effectiveStopUpdates: 7,
      ineffectiveCandidates: 0,
    },
    {
      phase: "TIGHT_RUNNER",
      tradesReached: 4,
      tradesReachedRate: 4 / 39,
      candlesInPhase: 11,
      effectiveStopUpdates: 7,
      ineffectiveCandidates: 0,
    },
  ],
  candidates: {
    PROTECTED: {
      generated: 40,
      improvedStop: 40,
      rejectedByExistingStop: 0,
      equalToExistingStop: 0,
      wonWithinStep: 39,
      effectiveStopUpdates: 39,
    },
    RUNNER_ATR: {
      generated: 7,
      improvedStop: 5,
      rejectedByExistingStop: 2,
      equalToExistingStop: 0,
      wonWithinStep: 0,
      effectiveStopUpdates: 0,
    },
    STRONG_RUNNER_ATR: {
      generated: 7,
      improvedStop: 4,
      rejectedByExistingStop: 3,
      equalToExistingStop: 0,
      wonWithinStep: 1,
      effectiveStopUpdates: 1,
    },
  },
  runnerInertia: {
    phaseReached: 9,
    runnerReached: 9,
    candidateGenerated: 7,
    candidateImprovedStop: 5,
    candidateRejectedByExistingStop: 2,
    candidateEqualToExistingStop: 0,
    effectivenessRate: 5 / 7,
    tradesWhereRunnerChangedAtLeastOneStop: 0,
    tradesWhereRunnerNeverChangedStop: 9,
    candidateLostToProtectedCandidate: 7,
    candidateWonAgainstProtectedCandidate: 0,
    candidateEqualToProtectedCandidate: 0,
    rejectionDistancePct: {
      count: 2,
      mean: 0.0121,
      median: 0.0121,
      p25: 0.0037,
      p75: 0.0204,
      p90: 0.0204,
      max: 0.0204,
    },
  },
  strongRunnerInertia: {
    phaseReached: 4,
    runnerReached: 4,
    candidateGenerated: 7,
    candidateImprovedStop: 4,
    candidateRejectedByExistingStop: 3,
    candidateEqualToExistingStop: 0,
    effectivenessRate: 4 / 7,
    tradesWhereRunnerChangedAtLeastOneStop: 1,
    tradesWhereRunnerNeverChangedStop: 3,
    candidateLostToProtectedCandidate: 6,
    candidateWonAgainstProtectedCandidate: 1,
    candidateEqualToProtectedCandidate: 0,
    rejectionDistancePct: null,
  },
  exitControl: {
    INITIAL_STOP: 4,
    PROTECTED_STOP: 10,
    RUNNER_STOP: 0,
    STRONG_RUNNER_STOP: 1,
    GAP: 24,
    TP: 0,
    TIMEOUT: 0,
    OTHER: 0,
  },
  exitStopSource: {
    INITIAL_STOP: 4,
    PROTECTED: 34,
    RUNNER: 0,
    STRONG_RUNNER: 1,
  },
  trades: [],
  topInertRunnerCases: [
    {
      entryId: "LONG:1787457600000:1787472000000",
      side: "LONG",
      candleIndex: 325,
      candleOpenTime: 1787472000000,
      entryPrice: 1.461892,
      bestPrice: 1.5056,
      atrUsed: 0.078243,
      atrSource: "CURRENT",
      stopBefore: 1.418036,
      stopSource: "INITIAL_STOP",
      protectedCandidate: 1.48462,
      runnerCandidate: 1.388236,
      candidateKind: "RUNNER_ATR",
      distancePct: 0.0204,
      favorablePct: 0.0299,
      phase: "RUNNER",
      exitReason: "stop",
      pnl: 2.8472,
    },
  ],
};

const response: AnalyzeAdaptiveResponse = {
  metadata: {
    ...single.metadata,
    executionMode: "FIXED_ENTRY_COHORT",
    entries: 39,
    cohortSource: "CURRENT_SEQUENTIAL",
  },
  exitStrategy: { type: "ADAPTIVE_RUNNER" },
  comparedWith: null,
  analysis,
  sensitivity: null,
};

const request = {
  configId: 7,
  from: single.metadata.from,
  to: single.metadata.to,
  initialBalance: 1000,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.analyzeAdaptivePhases).mockResolvedValue(response);
});

describe("Adaptive Phase Analysis · render", () => {
  const renderSection = () =>
    render(
      <ResearchAdaptivePhases request={request} variants={[adaptiveVariant]} />,
    );

  it("20 · muestra alcance de fases y efectividad por candidato", async () => {
    renderSection();
    await screen.findByRole("table", { name: "Phase reach" });
    const phases = screen.getByRole("table", { name: "Phase reach" });
    expect(within(phases).getByText("RUNNER")).toBeInTheDocument();
    expect(within(phases).getByText("TIGHT_RUNNER")).toBeInTheDocument();
    expect(within(phases).getByText("9 / 39")).toBeInTheDocument();

    const cands = screen.getByRole("table", {
      name: "Candidate effectiveness",
    });
    const runnerRow = within(cands)
      .getByText("Runner ATR")
      .closest("tr") as HTMLElement;
    // Genera 7 candidatos, mejora 5 sobre el stop… y 0 updates efectivos.
    const cells = within(runnerRow)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(cells).toEqual(["7", "5", "2", "0", "0", "0"]);
  });

  it("21 · destaca la inercia de RUNNER y la atribución de salidas", async () => {
    renderSection();
    await screen.findByRole("table", { name: "Phase reach" });
    const inertia = screen.getByLabelText("Runner effectiveness");
    const runnerCard = within(inertia)
      .getByRole("heading", { name: "Runner" })
      .closest("div") as HTMLElement;
    expect(
      within(runnerCard).getByText("Trades where it never did"),
    ).toBeInTheDocument();
    // RUNNER nunca movió un stop en ningún trade: 0 / 9.
    const definitions = within(runnerCard).getByText(
      "Trades where it never did",
    ).nextElementSibling;
    expect(definitions).toHaveTextContent("9");
    expect(
      within(inertia).getByRole("heading", { name: "Strong runner" }),
    ).toBeInTheDocument();
    const exits = screen.getByRole("table", { name: "Exit control" });
    expect(within(exits).getByText("GAP")).toBeInTheDocument();
    expect(within(exits).getByText("PROTECTED_STOP")).toBeInTheDocument();
    // Los buckets vacíos no se muestran.
    expect(within(exits).queryByText("RUNNER_STOP")).not.toBeInTheDocument();
    expect(within(exits).queryByText("TIMEOUT")).not.toBeInTheDocument();
  });

  it("lista los casos inertes y permite inspeccionar el lifecycle", async () => {
    vi.mocked(api.traceResearchTrade).mockReturnValue(
      new Promise(() => {}) as never,
    );
    renderSection();
    const cases = await screen.findByRole("table", {
      name: "Inert runner cases",
    });
    expect(
      within(cases).getByText("LONG:1787457600000:1787472000000"),
    ).toBeInTheDocument();
    await userEvent.click(
      within(cases).getByRole("button", { name: /Inspect lifecycle/ }),
    );
    await waitFor(() => expect(api.traceResearchTrade).toHaveBeenCalled());
    expect(api.traceResearchTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        entryId: "LONG:1787457600000:1787472000000",
        exitStrategy: { type: "ADAPTIVE_RUNNER" },
      }),
      expect.any(AbortSignal),
    );
  });

  it("muestra la comparación de sensibilidad cuando viene", async () => {
    vi.mocked(api.analyzeAdaptivePhases).mockResolvedValue({
      ...response,
      comparedWith: { type: "ADAPTIVE_RUNNER" },
      sensitivity: {
        comparedTrades: 39,
        sameExitCount: 39,
        differentExitCount: 0,
        tradesWithDifferentPhaseTiming: 10,
        tradesWithDifferentRunnerCandidate: 10,
        tradesWithDifferentEffectiveStop: 0,
        tradesWithDifferentExit: 0,
        trades: [],
      },
    });
    renderSection();
    const sensitivity = await screen.findByLabelText("Adaptive sensitivity");
    expect(
      within(sensitivity).getByText("Different runner candidate"),
    ).toBeInTheDocument();
    expect(
      within(sensitivity).getByText("Different effective stop"),
    ).toBeInTheDocument();
  });

  // ── 21 · empty states ───────────────────────────────────────────────────

  it("21 · estado de carga sin métricas inventadas", () => {
    vi.mocked(api.analyzeAdaptivePhases).mockReturnValue(
      new Promise(() => {}) as never,
    );
    renderSection();
    expect(screen.getByRole("status")).toHaveTextContent("Analizando fases…");
    expect(
      screen.queryByRole("table", { name: "Phase reach" }),
    ).not.toBeInTheDocument();
  });

  it("21 · cohort vacío no dibuja tablas", async () => {
    vi.mocked(api.analyzeAdaptivePhases).mockResolvedValue({
      ...response,
      analysis: { ...analysis, totalTrades: 0 },
    });
    renderSection();
    expect(
      await screen.findByText(/El cohort no produjo entradas/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "Phase reach" }),
    ).not.toBeInTheDocument();
  });

  // ── 22 · error y retry ──────────────────────────────────────────────────

  it("22 · muestra el error y permite reintentar", async () => {
    vi.mocked(api.analyzeAdaptivePhases)
      .mockRejectedValueOnce(new Error("La solicitud no es válida."))
      .mockResolvedValueOnce(response);
    renderSection();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("La solicitud no es válida.");
    await userEvent.click(
      screen.getByRole("button", { name: "Reintentar análisis" }),
    );
    await screen.findByRole("table", { name: "Phase reach" });
    expect(api.analyzeAdaptivePhases).toHaveBeenCalledTimes(2);
  });
});

describe("Adaptive Phase Analysis · integración con el Lab", () => {
  beforeEach(() => {
    vi.mocked(api.getResearchCapabilities).mockResolvedValue(capabilities);
    vi.mocked(api.getSavedConfigs).mockResolvedValue(configs);
    vi.mocked(api.runResearch).mockResolvedValue(single);
    vi.mocked(api.compareResearchExits).mockResolvedValue(comparison);
    vi.mocked(api.analyzeAdaptivePhases).mockResolvedValue(response);
  });

  const ready = async () => {
    render(<ResearchLab />);
    await screen.findByLabelText("Preset guardado");
    return userEvent.setup();
  };

  it("no se muestra para CURRENT", async () => {
    const user = await ready();
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    await screen.findByRole("region", { name: "Resultados Research" });
    expect(
      screen.queryByRole("region", { name: "Adaptive Phase Analysis" }),
    ).not.toBeInTheDocument();
    expect(api.analyzeAdaptivePhases).not.toHaveBeenCalled();
  });

  it("se muestra cuando el resultado incluye ADAPTIVE_RUNNER", async () => {
    vi.mocked(api.runResearch).mockResolvedValue({
      ...single,
      variantId: "ADAPTIVE_RUNNER",
      exitStrategy: { type: "ADAPTIVE_RUNNER" },
    });
    const user = await ready();
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    expect(
      await screen.findByRole("region", { name: "Adaptive Phase Analysis" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.analyzeAdaptivePhases).toHaveBeenCalled());
    expect(api.analyzeAdaptivePhases).toHaveBeenCalledWith(
      expect.objectContaining({
        configId: single.metadata.configId,
        exitStrategy: { type: "ADAPTIVE_RUNNER" },
      }),
      expect.any(AbortSignal),
    );
  });
});

/**
 * Paso 5.3 · ADAPTIVE_RUNNER_V2 en el Research Lab.
 *
 * Las capabilities se extienden localmente (como hace research-adaptive.test)
 * para no alterar el fixture compartido que usan los otros specs.
 */
const adaptiveParams = [
  {
    name: "protectionActivationPct" as const,
    default: 0.005,
    minExclusive: 0,
    unit: "ratio" as const,
    label: "Protection activation",
  },
  {
    name: "protectionCaptureRatio" as const,
    default: 0.52,
    minExclusive: 0,
    max: 1,
    unit: "ratio" as const,
    label: "Protection capture",
  },
  {
    name: "runnerActivationPct" as const,
    default: 0.015,
    minExclusive: 0,
    greaterThan: "protectionActivationPct" as const,
    unit: "ratio" as const,
    label: "Runner activation",
  },
  {
    name: "runnerAtrMultiplier" as const,
    default: 1.5,
    minExclusive: 0,
    unit: "multiplier" as const,
    label: "Runner ATR",
  },
  {
    name: "strongRunnerActivationPct" as const,
    default: 0.03,
    minExclusive: 0,
    greaterThan: "runnerActivationPct" as const,
    unit: "ratio" as const,
    label: "Strong runner activation",
  },
  {
    name: "strongRunnerAtrMultiplier" as const,
    default: 1.25,
    minExclusive: 0,
    maxReference: "runnerAtrMultiplier" as const,
    unit: "multiplier" as const,
    label: "Strong runner ATR",
  },
];

describe("ADAPTIVE_RUNNER_V2 · Research Lab", () => {
  const withBoth = {
    ...capabilities,
    exitStrategies: [
      ...capabilities.exitStrategies,
      {
        type: "ADAPTIVE_RUNNER" as const,
        experimental: true,
        params: adaptiveParams,
      },
      {
        type: "ADAPTIVE_RUNNER_V2" as const,
        experimental: true,
        params: adaptiveParams,
      },
    ],
  };

  beforeEach(() => {
    vi.mocked(api.getResearchCapabilities).mockResolvedValue(withBoth);
    vi.mocked(api.getSavedConfigs).mockResolvedValue(configs);
    vi.mocked(api.runResearch).mockResolvedValue(v2Variant);
    vi.mocked(api.compareResearchExits).mockResolvedValue({
      ...comparison,
      results: [...comparison.results, adaptiveVariant, v2Variant],
    });
    vi.mocked(api.analyzeAdaptivePhases).mockResolvedValue(response);
  });

  const ready = async () => {
    render(<ResearchLab />);
    await screen.findByLabelText("Preset guardado");
    return userEvent.setup();
  };

  it("31 · el selector ofrece V2 con su etiqueta de phase handoff", async () => {
    const user = await ready();
    const select = screen.getByLabelText("Estrategia de salida");
    expect(
      within(select).getByRole("option", {
        name: "Adaptive Runner V2 · Phase Handoff",
      }),
    ).toBeInTheDocument();
    expect(
      within(select).getByRole("option", { name: "Adaptive Runner" }),
    ).toBeInTheDocument();
    // Reutiliza los MISMOS inputs de Adaptive v1.
    await user.selectOptions(select, "ADAPTIVE_RUNNER_V2");
    expect(screen.getByLabelText(/^Runner ATR/)).toHaveValue(1.5);
    expect(screen.getByLabelText(/^Protection capture/)).toHaveValue(52);
  });

  it("31 · envía ADAPTIVE_RUNNER_V2 con params normalizados", async () => {
    const user = await ready();
    await user.selectOptions(
      screen.getByLabelText("Estrategia de salida"),
      "ADAPTIVE_RUNNER_V2",
    );
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    await waitFor(() => expect(api.runResearch).toHaveBeenCalled());
    expect(vi.mocked(api.runResearch).mock.calls[0][0].exitStrategy).toEqual({
      type: "ADAPTIVE_RUNNER_V2",
      params: {
        protectionActivationPct: 0.005,
        protectionCaptureRatio: 0.52,
        runnerActivationPct: 0.015,
        runnerAtrMultiplier: 1.5,
        strongRunnerActivationPct: 0.03,
        strongRunnerAtrMultiplier: 1.25,
      },
    });
  });

  it("32 · compara CURRENT + CHANDELIER + V1 + V2 a la vez", async () => {
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Comparar exits" }));
    await user.click(
      screen.getAllByRole("button", { name: "Comparar exits" })[1],
    );
    await waitFor(() => expect(api.compareResearchExits).toHaveBeenCalled());
    expect(
      vi
        .mocked(api.compareResearchExits)
        .mock.calls[0][0].exits.map((v) => v.type),
    ).toEqual([
      "CURRENT",
      "CHANDELIER",
      "ADAPTIVE_RUNNER",
      "ADAPTIVE_RUNNER_V2",
    ]);
  });

  it("33 · el análisis de fases permite elegir entre V1 y V2", async () => {
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Comparar exits" }));
    await user.click(
      screen.getAllByRole("button", { name: "Comparar exits" })[1],
    );
    await screen.findByRole("region", { name: "Adaptive Phase Analysis" });
    await waitFor(() => expect(api.analyzeAdaptivePhases).toHaveBeenCalled());
    // Arranca en la primera variante Adaptive del resultado (V1).
    expect(
      vi.mocked(api.analyzeAdaptivePhases).mock.calls[0][0].exitStrategy.type,
    ).toBe("ADAPTIVE_RUNNER");

    const picker = screen.getByLabelText("Variante Adaptive");
    await user.selectOptions(picker, "1");
    await waitFor(() =>
      expect(api.analyzeAdaptivePhases).toHaveBeenCalledTimes(2),
    );
    expect(
      vi.mocked(api.analyzeAdaptivePhases).mock.calls[1][0].exitStrategy.type,
    ).toBe("ADAPTIVE_RUNNER_V2");
  });

  it("33 · sin variantes Adaptive no se monta la sección", async () => {
    vi.mocked(api.runResearch).mockResolvedValue(single);
    const user = await ready();
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    await screen.findByRole("region", { name: "Resultados Research" });
    expect(
      screen.queryByRole("region", { name: "Adaptive Phase Analysis" }),
    ).not.toBeInTheDocument();
    expect(api.analyzeAdaptivePhases).not.toHaveBeenCalled();
  });

  it("34 · lifecycle inspect funciona para V2", async () => {
    vi.mocked(api.traceResearchTrade).mockReturnValue(
      new Promise(() => {}) as never,
    );
    render(<ResearchAdaptivePhases request={request} variants={[v2Variant]} />);
    const cases = await screen.findByRole("table", {
      name: "Inert runner cases",
    });
    await userEvent.click(
      within(cases).getByRole("button", { name: /Inspect lifecycle/ }),
    );
    await waitFor(() => expect(api.traceResearchTrade).toHaveBeenCalled());
    expect(api.traceResearchTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        entryId: "LONG:1787457600000:1787472000000",
        exitStrategy: { type: "ADAPTIVE_RUNNER_V2" },
      }),
      expect.any(AbortSignal),
    );
  });
});
