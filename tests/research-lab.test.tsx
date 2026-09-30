import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResearchLab from "@/components/research/ResearchLab";
import ResearchSummary from "@/components/research/ResearchSummary";
import ResearchTradeTable from "@/components/research/ResearchTradeTable";
import * as api from "@/lib/research/research-api";
import { capabilities, configs, single, comparison } from "./research.fixture";
import { formatCurrency, formatPercent } from "@/lib/research/format";
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
async function ready() {
  render(<ResearchLab />);
  await screen.findByLabelText("Preset guardado");
  return userEvent.setup();
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getResearchCapabilities).mockResolvedValue(capabilities);
  vi.mocked(api.getSavedConfigs).mockResolvedValue(configs);
  vi.mocked(api.runResearch).mockResolvedValue(single);
  vi.mocked(api.compareResearchExits).mockResolvedValue(comparison);
});
describe("Research Lab", () => {
  it("refreshes excursion after changing dates and comparing again", async () => {
    const next = structuredClone(comparison);
    next.results[0].excursion = {...next.results[0].excursion, distribution: {...next.results[0].excursion.distribution, p90: .1234}};
    vi.mocked(api.compareResearchExits).mockResolvedValueOnce(comparison).mockResolvedValueOnce(next);
    const user = await ready();
    await user.click(screen.getByRole("button", {name: "Comparar exits"}));
    await user.click(screen.getAllByRole("button", {name: "Comparar exits"})[1]);
    await screen.findByRole("region", {name: "MFE Excursion Analysis"});
    fireEvent.change(screen.getByLabelText("Desde (UTC)"), {target: {value: "2026-08-01T00:00"}});
    fireEvent.change(screen.getByLabelText("Hasta (UTC)"), {target: {value: "2026-09-01T00:00"}});
    await user.click(screen.getAllByRole("button", {name: "Comparar exits"})[1]);
    await screen.findByText("12.34%");
    expect(api.compareResearchExits).toHaveBeenLastCalledWith(expect.objectContaining({from: "2026-08-01T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z"}), expect.any(AbortSignal));
  });

  it("loads capabilities and saved configs; CURRENT has no params", async () => {
    await ready();
    expect(api.getResearchCapabilities).toHaveBeenCalled();
    expect(api.getSavedConfigs).toHaveBeenCalled();
    expect(screen.getByRole("option", { name: /XRP 4H/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Activación/)).not.toBeInTheDocument();
  });
  it("shows CHANDELIER params, converts 0.5 percent to 0.005 and runs single", async () => {
    const user = await ready();
    await user.selectOptions(
      screen.getByLabelText("Estrategia de salida"),
      "CHANDELIER",
    );
    expect(screen.getByLabelText(/Activación/)).toHaveValue(0.5);
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    await waitFor(() =>
      expect(api.runResearch).toHaveBeenCalledWith(
        expect.objectContaining({
          configId: 7,
          executionMode: "SEQUENTIAL",
          exitStrategy: {
            type: "CHANDELIER",
            params: { activationPct: 0.005, atrMultiplier: 2 },
          },
        }),
        expect.any(AbortSignal),
      ),
    );
  });
  it("supports fixed cohort in single run and sends UTC dates", async () => {
    const user = await ready();
    await user.selectOptions(
      screen.getByLabelText("Modo de ejecución"),
      "FIXED_ENTRY_COHORT",
    );
    fireEvent.change(screen.getByLabelText("Desde (UTC)"), {
      target: { value: "2026-01-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Hasta (UTC)"), {
      target: { value: "2026-02-01T10:00" },
    });
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    expect(api.runResearch).toHaveBeenCalledWith(
      expect.objectContaining({
        executionMode: "FIXED_ENTRY_COHORT",
        from: "2026-01-01T10:00:00.000Z",
        to: "2026-02-01T10:00:00.000Z",
        exitStrategy: { type: "CURRENT" },
      }),
      expect.any(AbortSignal),
    );
  });
  it("compares selected exits and renders fixed cohort banner", async () => {
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Comparar exits" }));
    await user.click(
      screen.getAllByRole("button", { name: "Comparar exits" })[1],
    );
    await screen.findByText(
      "2 entradas idénticas evaluadas independientemente.",
    );
    expect(api.compareResearchExits).toHaveBeenCalledWith(
      expect.objectContaining({
        exits: [
          { type: "CURRENT" },
          {
            type: "CHANDELIER",
            params: { activationPct: 0.005, atrMultiplier: 2 },
          },
        ],
      }),
      expect.any(AbortSignal),
    );
  });
  it("uses enabled variants only", async () => {
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Comparar exits" }));
    await user.click(screen.getByLabelText("CURRENT"));
    await user.click(
      screen.getAllByRole("button", { name: "Comparar exits" })[1],
    );
    expect(api.compareResearchExits).toHaveBeenCalledWith(
      expect.objectContaining({
        exits: [
          {
            type: "CHANDELIER",
            params: { activationPct: 0.005, atrMultiplier: 2 },
          },
        ],
      }),
      expect.any(AbortSignal),
    );
  });
  it("disables submit during simulation and prevents double submit", async () => {
    let resolve!: (value: typeof single) => void;
    vi.mocked(api.runResearch).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const user = await ready();
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    expect(
      screen.getByRole("button", { name: /Ejecutando simulación/ }),
    ).toBeDisabled();
    expect(api.runResearch).toHaveBeenCalledTimes(1);
    await act(async () => resolve(single));
  });
  it("shows request errors without fabricated zero results", async () => {
    vi.mocked(api.runResearch).mockRejectedValue(
      new Error("Configuration not found."),
    );
    const user = await ready();
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Configuration not found.",
    );
    expect(screen.queryByText("PnL total")).not.toBeInTheDocument();
  });
  it("retries failed capability loading", async () => {
    vi.mocked(api.getResearchCapabilities).mockRejectedValueOnce(
      new Error("Network unavailable"),
    );
    render(<ResearchLab />);
    await screen.findByRole("alert");
    await userEvent.click(
      screen.getByRole("button", { name: "Reintentar carga" }),
    );
    await screen.findByLabelText("Preset guardado");
    expect(api.getResearchCapabilities).toHaveBeenCalledTimes(2);
  });
  it("validates reversed dates before calling API", async () => {
    const user = await ready();
    fireEvent.change(screen.getByLabelText("Desde (UTC)"), {
      target: { value: "2027-01-01T00:00" },
    });
    fireEvent.change(screen.getByLabelText("Hasta (UTC)"), {
      target: { value: "2026-01-01T00:00" },
    });
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("anterior");
    expect(api.runResearch).not.toHaveBeenCalled();
  });
  it("uses capability defaults rather than fixed Chandelier params", async () => {
    vi.mocked(api.getResearchCapabilities).mockResolvedValue({
      ...capabilities,
      exitStrategies: [
        {
          type: "CHANDELIER",
          params: [
            { name: "activationPct", default: 0.012 },
            { name: "atrMultiplier", default: 3 },
          ],
        },
      ],
    });
    await ready();
    expect(screen.getByLabelText(/Activación/)).toHaveValue(1.2);
    expect(screen.getByLabelText(/Multiplicador/)).toHaveValue(3);
  });
  it("renders backend summary values and unbounded factor without recalculation", () => {
    render(
      <ResearchSummary
        variants={[
          {
            ...single,
            summary: { ...single.summary, totalPnl: 987.65 },
            quality: {
              ...single.quality,
              profitFactor: null,
              profitFactorStatus: "UNBOUNDED",
            },
          },
        ]}
        compare={false}
      />,
    );
    expect(screen.getByText(formatCurrency(987.65))).toBeInTheDocument();
    expect(screen.getByText("∞")).toBeInTheDocument();
  });
  it("joins reversed variant trades by entryId, not index, and opens shared detail", async () => {
    render(<ResearchTradeTable variants={comparison.results} compare />);
    const button = screen.getByRole("button", {
      name: `Detalle ${single.trades[0].entryId}`,
    });
    const row = button.closest("tr")!;
    expect(within(row).getByText(formatCurrency(17))).toBeInTheDocument();
    expect(within(row).queryByText(formatCurrency(42))).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(
      screen.getByRole("region", {
        name: `Detalle ${single.trades[0].entryId}`,
      }),
    ).toHaveTextContent("Fees");
  });
  it("displays green to red and filters backend classifications", async () => {
    render(<ResearchTradeTable variants={[single]} compare={false} />);
    expect(screen.getByText("Sí")).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("Filtrar resultados"),
      "GREEN_TO_RED",
    );
    expect(
      screen.getAllByRole("button", { name: /Detalle LONG/ }),
    ).toHaveLength(1);
    expect(screen.getByText(formatPercent(-0.1))).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("Filtrar resultados"),
      "WIN",
    );
    expect(
      screen.getAllByRole("button", { name: /Detalle LONG/ }),
    ).toHaveLength(1);
  });
  it("can display 39 vs 39 without truncating the cohort", async () => {
    const trades = Array.from({ length: 39 }, (_, i) => ({
      ...single.trades[0],
      entryId: `entry-${i}`,
    }));
    vi.mocked(api.compareResearchExits).mockResolvedValue({
      ...comparison,
      metadata: { ...comparison.metadata, entries: 39 },
      results: comparison.results.map((v) => ({
        ...v,
        trades,
        summary: { ...v.summary, totalTrades: 39 },
      })),
    });
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Comparar exits" }));
    await user.click(
      screen.getAllByRole("button", { name: "Comparar exits" })[1],
    );
    await screen.findByText(
      "39 entradas idénticas evaluadas independientemente.",
    );
    expect(
      screen.getAllByRole("button", { name: /Detalle entry-/ }),
    ).toHaveLength(39);
  });
});
