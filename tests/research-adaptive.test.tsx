import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResearchLab from "@/components/research/ResearchLab";
import ResearchTradeTable from "@/components/research/ResearchTradeTable";
import * as api from "@/lib/research/research-api";
import type {
  ResearchCapabilities,
  AdaptiveRunnerExitParams,
  ResearchVariant,
} from "@/lib/research/types";
import { capabilities, configs, single, comparison } from "./research.fixture";
import { formatCurrency } from "@/lib/research/format";
vi.mock("@/lib/research/research-api", () => ({
  getResearchCapabilities: vi.fn(),
  getSavedConfigs: vi.fn(),
  runResearch: vi.fn(),
  compareResearchExits: vi.fn(),
  traceResearchTrade: vi.fn(),
  // Devuelve una promesa que nunca resuelve: el análisis de fases es una
  // sección aparte y estos tests no lo ejercitan (queda en "Analizando…").
  analyzeAdaptivePhases: vi.fn(() => new Promise(() => {})),
}));
const params: AdaptiveRunnerExitParams = {
  protectionActivationPct: 0.0075,
  protectionCaptureRatio: 0.25,
  runnerActivationPct: 0.015,
  runnerAtrMultiplier: 2,
  strongRunnerActivationPct: 0.03,
  strongRunnerAtrMultiplier: 1.5,
};
const adaptiveCapability: ResearchCapabilities["exitStrategies"][number] = {
  type: "ADAPTIVE_RUNNER",
  experimental: true,
  params: [
    {
      name: "protectionActivationPct",
      default: 0.0075,
      minExclusive: 0,
      unit: "ratio",
      label: "Protection activation",
      description:
        "Movimiento favorable requerido antes de comenzar a asegurar beneficio.",
    },
    {
      name: "protectionCaptureRatio",
      default: 0.25,
      minExclusive: 0,
      max: 1,
      unit: "ratio",
      label: "Protection capture",
    },
    {
      name: "runnerActivationPct",
      default: 0.015,
      minExclusive: 0,
      greaterThan: "protectionActivationPct",
      unit: "ratio",
      label: "Runner activation",
    },
    {
      name: "runnerAtrMultiplier",
      default: 2,
      minExclusive: 0,
      unit: "multiplier",
      label: "Runner ATR",
    },
    {
      name: "strongRunnerActivationPct",
      default: 0.03,
      minExclusive: 0,
      greaterThan: "runnerActivationPct",
      unit: "ratio",
      label: "Strong runner activation",
    },
    {
      name: "strongRunnerAtrMultiplier",
      default: 1.5,
      minExclusive: 0,
      maxReference: "runnerAtrMultiplier",
      unit: "multiplier",
      label: "Strong runner ATR",
    },
  ],
};
const adaptive: ResearchVariant = {
  ...single,
  variantId: "ADAPTIVE_RUNNER:test",
  exitStrategy: { type: "ADAPTIVE_RUNNER", params },
  trades: [
    { ...single.trades[1], trade: { ...single.trades[1].trade, pnl: 77 } },
    { ...single.trades[0], trade: { ...single.trades[0].trade, pnl: 88 } },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getResearchCapabilities).mockResolvedValue({
    ...capabilities,
    exitStrategies: [...capabilities.exitStrategies, adaptiveCapability],
  });
  vi.mocked(api.getSavedConfigs).mockResolvedValue(configs);
  vi.mocked(api.runResearch).mockResolvedValue({
    ...adaptive,
    metadata: single.metadata,
  });
  vi.mocked(api.compareResearchExits).mockResolvedValue({
    ...comparison,
    results: [...comparison.results, adaptive],
  });
});
async function ready() {
  render(<ResearchLab />);
  await screen.findByLabelText("Preset guardado");
  return userEvent.setup();
}
describe("Adaptive Runner Research Lab", () => {
  it("loads six controls with backend defaults, percent units and help", async () => {
    const user = await ready();
    await user.selectOptions(
      screen.getByLabelText("Estrategia de salida"),
      "ADAPTIVE_RUNNER",
    );
    for (const [label, value] of [
      ["Protection activation", 0.75],
      ["Protection capture", 25],
      ["Runner activation", 1.5],
      ["Runner ATR", 2],
      ["Strong runner activation", 3],
      ["Strong runner ATR", 1.5],
    ] as const)
      expect(screen.getByLabelText(new RegExp("^" + label))).toHaveValue(value);
    expect(
      screen.getByText(/Defaults experimentales baseline/),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/^Protection activation/),
    ).toHaveAccessibleDescription(adaptiveCapability.params[0].description);
  });
  it("sends normalized Adaptive params for single, without changing metrics", async () => {
    const user = await ready();
    await user.selectOptions(
      screen.getByLabelText("Estrategia de salida"),
      "ADAPTIVE_RUNNER",
    );
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    await screen.findByRole("region", { name: "MFE Excursion Analysis" });
    expect(api.runResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        exitStrategy: { type: "ADAPTIVE_RUNNER", params },
      }),
      expect.any(AbortSignal),
    );
  });
  it("converts edited percentage to API ratio and preserves ATR units", async () => {
    const user = await ready();
    await user.selectOptions(
      screen.getByLabelText("Estrategia de salida"),
      "ADAPTIVE_RUNNER",
    );
    fireEvent.change(screen.getByLabelText(/^Protection capture/), {
      target: { value: "50" },
    });
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    expect(api.runResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        exitStrategy: {
          type: "ADAPTIVE_RUNNER",
          params: { ...params, protectionCaptureRatio: 0.5 },
        },
      }),
      expect.any(AbortSignal),
    );
  });
  it("compares three selected exits and renders excursion for each variantId", async () => {
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Comparar exits" }));
    await user.click(
      screen.getAllByRole("button", { name: "Comparar exits" })[1],
    );
    await screen.findByRole("region", { name: "MFE Excursion Analysis" });
    expect(
      vi
        .mocked(api.compareResearchExits)
        .mock.calls[0][0].exits.map((v) => v.type),
    ).toEqual(["CURRENT", "CHANDELIER", "ADAPTIVE_RUNNER"]);
    expect(screen.getByTestId("excursion-0.0025-2")).toHaveTextContent(
      adaptive.variantId,
    );
  });
  it("can disable Adaptive in compare", async () => {
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Comparar exits" }));
    await user.click(screen.getByLabelText("Adaptive Runner"));
    expect(
      screen.queryByLabelText(/^Protection activation/),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: "Comparar exits" })[1],
    );
    expect(
      vi
        .mocked(api.compareResearchExits)
        .mock.calls[0][0].exits.map((v) => v.type),
    ).toEqual(["CURRENT", "CHANDELIER"]);
  });
  it("uses capability relationship validation before submit", async () => {
    const user = await ready();
    await user.selectOptions(
      screen.getByLabelText("Estrategia de salida"),
      "ADAPTIVE_RUNNER",
    );
    fireEvent.change(screen.getByLabelText(/^Runner activation/), {
      target: { value: ".5" },
    });
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Runner activation");
    expect(api.runResearch).not.toHaveBeenCalled();
  });
  it("uses updated capability defaults rather than hardcoded Adaptive values", async () => {
    vi.mocked(api.getResearchCapabilities).mockResolvedValue({
      ...capabilities,
      exitStrategies: [
        {
          ...adaptiveCapability,
          params: adaptiveCapability.params.map((p) =>
            p.name === "protectionCaptureRatio" ? { ...p, default: 0.4 } : p,
          ),
        },
      ],
    });
    await ready();
    expect(screen.getByLabelText(/^Protection capture/)).toHaveValue(40);
  });
  // ── Prefill recomendado ───────────────────────────────────────────────────
  // El backend sugiere la mejor config MEDIDA sin mover los defaults de la
  // estrategia: el Lab arranca en `recommended` y el request manda eso.
  const RECOMMENDED: AdaptiveRunnerExitParams = {
    protectionActivationPct: 0.005,
    protectionCaptureRatio: 0.52,
    runnerActivationPct: 0.015,
    runnerAtrMultiplier: 1.5,
    strongRunnerActivationPct: 0.03,
    strongRunnerAtrMultiplier: 1.25,
  };
  const withRecommended = (
    only?: string[],
  ): ResearchCapabilities["exitStrategies"][number] => ({
    ...adaptiveCapability,
    params: adaptiveCapability.params.map((p) =>
      only && !only.includes(p.name)
        ? p
        : { ...p, recommended: RECOMMENDED[p.name as keyof typeof RECOMMENDED] },
    ),
  });
  it("pre-llena los inputs con `recommended` y no con los defaults", async () => {
    vi.mocked(api.getResearchCapabilities).mockResolvedValue({
      ...capabilities,
      exitStrategies: [withRecommended()],
    });
    await ready();
    for (const [label, value] of [
      ["Protection activation", 0.5],
      ["Protection capture", 52],
      ["Runner activation", 1.5],
      ["Runner ATR", 1.5],
      ["Strong runner activation", 3],
      ["Strong runner ATR", 1.25],
    ] as const)
      expect(screen.getByLabelText(new RegExp("^" + label))).toHaveValue(value);
    // El aviso deja claro que el prefill no es el default ni un óptimo validado.
    expect(screen.getByText(/mejor configuración MEDIDA/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Defaults experimentales baseline/),
    ).not.toBeInTheDocument();
  });
  it("manda los valores recomendados normalizados al ejecutar", async () => {
    vi.mocked(api.getResearchCapabilities).mockResolvedValue({
      ...capabilities,
      exitStrategies: [withRecommended()],
    });
    const user = await ready();
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    await screen.findByRole("region", { name: "MFE Excursion Analysis" });
    expect(api.runResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        exitStrategy: { type: "ADAPTIVE_RUNNER", params: RECOMMENDED },
      }),
      expect.any(AbortSignal),
    );
  });
  it("cae al default en cada parámetro sin recomendación", async () => {
    vi.mocked(api.getResearchCapabilities).mockResolvedValue({
      ...capabilities,
      exitStrategies: [withRecommended(["protectionCaptureRatio"])],
    });
    await ready();
    expect(screen.getByLabelText(/^Protection capture/)).toHaveValue(52);
    expect(screen.getByLabelText(/^Runner ATR/)).toHaveValue(2);
  });
  it("el usuario puede sobrescribir el prefill recomendado", async () => {
    vi.mocked(api.getResearchCapabilities).mockResolvedValue({
      ...capabilities,
      exitStrategies: [withRecommended()],
    });
    const user = await ready();
    fireEvent.change(screen.getByLabelText(/^Runner ATR/), {
      target: { value: "2" },
    });
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    expect(api.runResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        exitStrategy: {
          type: "ADAPTIVE_RUNNER",
          params: { ...RECOMMENDED, runnerAtrMultiplier: 2 },
        },
      }),
      expect.any(AbortSignal),
    );
  });
  it("joins three trade variants exclusively by entryId and opens detail", async () => {
    render(
      <ResearchTradeTable
        variants={[...comparison.results, adaptive]}
        compare
      />,
    );
    const button = screen.getByRole("button", {
      name: `Detalle ${single.trades[0].entryId}`,
    });
    const row = button.closest("tr")!;
    expect(within(row).getByText(formatCurrency(88))).toBeInTheDocument();
    expect(within(row).queryByText(formatCurrency(77))).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(
      screen.getByRole("region", {
        name: `Detalle ${single.trades[0].entryId}`,
      }),
    ).toHaveTextContent(adaptive.variantId);
  });
});
