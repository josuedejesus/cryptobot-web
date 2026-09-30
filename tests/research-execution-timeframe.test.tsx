import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResearchLab from "@/components/research/ResearchLab";
import ResearchLifecycle from "@/components/research/ResearchLifecycle";
import ResearchTradeTable from "@/components/research/ResearchTradeTable";
import * as api from "@/lib/research/research-api";
import type {
  ResearchTraceRequest,
  ResearchTraceResponse,
  ResearchVariant,
} from "@/lib/research/types";
import lifecycle from "./lifecycle.fixture.json";
import { capabilities, configs, single, comparison } from "./research.fixture";

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

const fine = structuredClone(single);
fine.metadata.executionTimeframe = "15m";
const fineCompare = structuredClone(comparison);
fineCompare.metadata.executionTimeframe = "15m";

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

describe("Execution timeframe selector", () => {
  it("defaults to the signal timeframe and lists the finer options from capabilities", async () => {
    await ready();
    const select = screen.getByLabelText("Execution timeframe");
    expect(select).toHaveValue("");
    expect(
      within(select).getByRole("option", { name: "Same as signal (4h)" }),
    ).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "15m" })).toBeInTheDocument();
    // El propio signal timeframe no se repite como opción explícita.
    expect(
      within(select).queryByRole("option", { name: "4h" }),
    ).not.toBeInTheDocument();
  });

  it("explains that signals stay on the signal timeframe", async () => {
    const user = await ready();
    expect(
      screen.getByText(
        /Controla con cuánta precisión se gestionan las posiciones después de la entrada/,
      ),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Execution timeframe"),
      "15m",
    );
    expect(
      screen.getByText(
        /Las señales se siguen generando en 4h\. Stops y salidas se reproducen con velas de 15m\./,
      ),
    ).toBeInTheDocument();
  });

  it("omits executionTimeframe from the request while the default is selected", async () => {
    const user = await ready();
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    await waitFor(() => expect(api.runResearch).toHaveBeenCalled());
    expect(vi.mocked(api.runResearch).mock.calls[0][0]).not.toHaveProperty(
      "executionTimeframe",
    );
  });

  it("sends the selected executionTimeframe on run and on compare", async () => {
    const user = await ready();
    await user.selectOptions(
      screen.getByLabelText("Execution timeframe"),
      "15m",
    );
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    await waitFor(() => expect(api.runResearch).toHaveBeenCalled());
    expect(api.runResearch).toHaveBeenCalledWith(
      expect.objectContaining({ executionTimeframe: "15m" }),
      expect.any(AbortSignal),
    );
    await user.click(screen.getByRole("button", { name: "Comparar exits" }));
    await user.click(
      screen.getAllByRole("button", { name: "Comparar exits" })[1],
    );
    await waitFor(() => expect(api.compareResearchExits).toHaveBeenCalled());
    expect(api.compareResearchExits).toHaveBeenCalledWith(
      expect.objectContaining({ executionTimeframe: "15m" }),
      expect.any(AbortSignal),
    );
  });
});

describe("Execution timeframe in the results", () => {
  it("shows signal, execution and trend in the header", async () => {
    vi.mocked(api.runResearch).mockResolvedValue(fine);
    const user = await ready();
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "XRPUSDT · Signal 4h · Execution 15m · Trend 1d",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Las señales se siguen generando en 4h\. Stops y salidas se reproducen usando velas de 15m\./,
      ),
    ).toBeInTheDocument();
  });

  it("does not show the replay note when execution equals the signal timeframe", async () => {
    const user = await ready();
    await user.click(
      screen.getByRole("button", { name: "Ejecutar experimento" }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "XRPUSDT · Signal 4h · Execution 4h · Trend 1d",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Execution replay/ }),
    ).not.toBeInTheDocument();
  });

  it("shows both timeframes and the exact exit timestamp in the trade detail", async () => {
    vi.mocked(api.compareResearchExits).mockResolvedValue(fineCompare);
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Comparar exits" }));
    await user.click(
      screen.getAllByRole("button", { name: "Comparar exits" })[1],
    );
    await screen.findByRole("heading", { name: /Execution 15m/ });
    await user.click(screen.getAllByRole("button", { name: /Detalle/ })[0]);
    const detail = await screen.findByRole("region", { name: /Detalle LONG/ });
    expect(
      within(detail).getByText(
        /Signal timeframe: 4h · Execution timeframe: 15m/,
      ),
    ).toBeInTheDocument();
    expect(
      within(detail).getAllByText(
        new Date(single.trades[0].trade.exitTime).toISOString(),
      ).length,
    ).toBeGreaterThan(0);
  });

  it("forwards executionTimeframe to the lifecycle trace request", async () => {
    vi.mocked(api.compareResearchExits).mockResolvedValue({
      ...fineCompare,
      results: [
        {
          ...fineCompare.results[0],
          exitStrategy: { type: "ADAPTIVE_RUNNER" },
          variantId: "ADAPTIVE_RUNNER",
        },
      ],
    });
    vi.mocked(api.traceResearchTrade).mockReturnValue(new Promise(() => {}));
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Comparar exits" }));
    await user.click(
      screen.getAllByRole("button", { name: "Comparar exits" })[1],
    );
    await user.click(
      (await screen.findAllByRole("button", { name: /Inspect lifecycle/ }))[0],
    );
    await waitFor(() => expect(api.traceResearchTrade).toHaveBeenCalled());
    expect(api.traceResearchTrade).toHaveBeenCalledWith(
      expect.objectContaining({ executionTimeframe: "15m" }),
      expect.any(AbortSignal),
    );
  });
});

describe("Lifecycle rows with a finer execution timeframe", () => {
  const response = lifecycle as unknown as ResearchTraceResponse;
  const fineTrace = structuredClone(response);
  (
    fineTrace.trace as unknown as {
      executionTimeframe: string;
      signalTimeframe: string;
    }
  ).executionTimeframe = "15m";
  const request: ResearchTraceRequest = {
    configId: 7,
    from: response.metadata.from,
    to: response.metadata.to,
    initialBalance: 1000,
    executionTimeframe: "15m",
    entryId: response.trace.entryId,
    exitStrategy: response.trace.exitStrategy,
  };
  const variant: ResearchVariant = {
    ...single,
    variantId: response.trace.variantId,
    exitStrategy: response.trace.exitStrategy,
    trades: [
      {
        ...single.trades[0],
        entryId: request.entryId,
        trade: response.trace.final,
      },
    ],
  };

  it("labels every row with the execution timeframe and shows the ATR as-of close", async () => {
    vi.mocked(api.traceResearchTrade).mockResolvedValue(
      structuredClone(fineTrace),
    );
    render(<ResearchLifecycle request={request} onClose={() => {}} />);
    await screen.findByRole("table", { name: "Lifecycle candles" });
    expect(
      screen.getByText(/Signal timeframe:/).textContent?.replace(/\s+/g, " "),
    ).toContain("Execution timeframe: 15m");
    expect(
      screen.getByText(
        /Cada fila de abajo es una vela de 15m: NEXT_CANDLE significa la siguiente vela de 15m/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "ATR / source / as of" }),
    ).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    for (const row of rows) {
      expect(within(row).getByText("15m")).toBeInTheDocument();
      expect(within(row).getByText(/As of:/)).toBeInTheDocument();
    }
  });

  it("keeps the signal-timeframe wording when execution equals the signal", async () => {
    vi.mocked(api.traceResearchTrade).mockResolvedValue(
      structuredClone(response),
    );
    render(
      <ResearchLifecycle
        request={{ ...request, executionTimeframe: undefined }}
        onClose={() => {}}
      />,
    );
    await screen.findByRole("table", { name: "Lifecycle candles" });
    expect(
      screen.getByText("Cada fila es una vela de 4h."),
    ).toBeInTheDocument();
  });

  it("does not add executionTimeframe to a trace request that omits it", () => {
    render(
      <ResearchTradeTable
        variants={[variant]}
        compare={false}
        traceBase={{
          configId: 7,
          from: response.metadata.from,
          to: response.metadata.to,
        }}
        timeframes={{ signal: "4h", execution: "4h" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Inspect lifecycle/ }),
    ).toBeInTheDocument();
    expect(api.traceResearchTrade).not.toHaveBeenCalled();
  });
});
