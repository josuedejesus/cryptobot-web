import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResearchLifecycle from "@/components/research/ResearchLifecycle";
import ResearchTradeTable from "@/components/research/ResearchTradeTable";
import * as api from "@/lib/research/research-api";
import type {
  ResearchTraceRequest,
  ResearchTraceResponse,
  ResearchVariant,
} from "@/lib/research/types";
import fixture from "./lifecycle.fixture.json";
import { single } from "./research.fixture";
import {
  formatCurrency,
  formatPercent,
  formatPrice,
} from "@/lib/research/format";
vi.mock("@/lib/research/research-api", () => ({ traceResearchTrade: vi.fn() }));
const response = fixture as ResearchTraceResponse;
const request: ResearchTraceRequest = {
  configId: 7,
  from: response.metadata.from,
  to: response.metadata.to,
  initialBalance: 1000,
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
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.traceResearchTrade).mockResolvedValue(
    structuredClone(response),
  );
});
async function loaded() {
  render(<ResearchLifecycle request={request} onClose={() => {}} />);
  await screen.findByRole("table", { name: "Lifecycle candles" });
}
describe("Research lifecycle diagnostics", () => {
  it("shows Adaptive inspect action without fetching automatically", () => {
    render(
      <ResearchTradeTable
        variants={[variant]}
        compare={false}
        traceBase={request}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Inspect lifecycle/ }),
    ).toBeInTheDocument();
    expect(api.traceResearchTrade).not.toHaveBeenCalled();
  });
  it("click fetches the selected identity, strategy and result dates", async () => {
    render(
      <ResearchTradeTable variants={[variant]} compare traceBase={request} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Inspect lifecycle/ }),
    );
    await screen.findByRole("table", { name: "Lifecycle candles" });
    expect(api.traceResearchTrade).toHaveBeenCalledWith(
      request,
      expect.any(AbortSignal),
    );
  });
  it("shows loading without fabricated trace values", () => {
    vi.mocked(api.traceResearchTrade).mockReturnValue(new Promise(() => {}));
    render(<ResearchLifecycle request={request} onClose={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando lifecycle");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("shows API error and retries", async () => {
    vi.mocked(api.traceResearchTrade).mockRejectedValueOnce(
      new Error("Entry not in cohort"),
    );
    render(<ResearchLifecycle request={request} onClose={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Entry not in cohort",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Reintentar trace" }),
    );
    await screen.findByRole("table");
    expect(api.traceResearchTrade).toHaveBeenCalledTimes(2);
  });
  it("renders only backend phases reached", async () => {
    await loaded();
    expect(screen.getByLabelText("Lifecycle phases")).toHaveTextContent(
      "ENTRY → RISK → PROTECTED → EXIT",
    );
    expect(screen.getByLabelText("Lifecycle phases")).not.toHaveTextContent(
      "TIGHT_RUNNER",
    );
  });
  it("renders candle rows with OHLC from API", async () => {
    await loaded();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(
      response.trace.steps.length + 1,
    );
    expect(table).toHaveTextContent(
      `H ${formatPrice(response.trace.steps[0].candle.high)}`,
    );
  });
  it("renders stop before, candidate and after independently", async () => {
    await loaded();
    const table = screen.getByRole("table");
    const row = within(table).getAllByRole("row")[1];
    expect(row).toHaveTextContent(
      formatPrice(response.trace.steps[0].stopBefore),
    );
    expect(row).toHaveTextContent(
      formatPrice(response.trace.steps[0].stopAfter),
    );
    expect(row).toHaveTextContent("NEXT_CANDLE");
  });
  it("renders ATR source and used value without deriving them", async () => {
    const custom: ResearchTraceResponse = {
      ...response,
      trace: {
        ...response.trace,
        steps: response.trace.steps.map((s, i) =>
          i === 0 ? { ...s, atrSource: "ENTRY", atrUsed: 0.123456 } : s,
        ),
      },
    };
    vi.mocked(api.traceResearchTrade).mockResolvedValue(custom);
    await loaded();
    expect(screen.getByRole("table")).toHaveTextContent(
      `${formatPrice(0.123456)} · ENTRY`,
    );
  });
  it("renders backend threshold crossings with percentage units", async () => {
    await loaded();
    expect(screen.getByRole("table")).toHaveTextContent(
      "PROTECTION_ACTIVATED 0.75%",
    );
  });
  it("distinguishes stop-gap from actual opening price gap", async () => {
    await loaded();
    const row = within(screen.getByRole("table")).getAllByRole("row")[2];
    expect(row).toHaveTextContent("Gap stop");
    expect(row).toHaveTextContent("Open gap: 0%");
  });
  it("renders raw and slipped fill prices separately", async () => {
    await loaded();
    const row = within(screen.getByRole("table")).getAllByRole("row")[2];
    expect(row).toHaveTextContent(
      `Raw: ${formatPrice(response.trace.steps[1].exit!.rawPrice)}`,
    );
    expect(row).toHaveTextContent(
      `Fill: ${formatPrice(response.trace.final.exitPrice)}`,
    );
  });
  it("exposes collapsible raw JSON", async () => {
    await loaded();
    const summary = screen.getByText("Raw trace");
    expect(summary.closest("details")).not.toHaveAttribute("open");
    await userEvent.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    expect(summary.closest("details")).toHaveTextContent("stopCandidate");
  });
  it("does not recompute backend MFE or phases from candle prices", async () => {
    const custom: ResearchTraceResponse = {
      ...response,
      trace: {
        ...response.trace,
        summary: {
          ...response.trace.summary,
          maxManagedFavorablePct: 0.1234,
          phasesReached: ["RISK"],
        },
      },
    };
    vi.mocked(api.traceResearchTrade).mockResolvedValue(custom);
    await loaded();
    expect(screen.getByText(formatPercent(0.1234))).toBeInTheDocument();
    expect(screen.getByLabelText("Lifecycle phases")).toHaveTextContent(
      "ENTRY → RISK → EXIT",
    );
  });
  it("formats monetary PnL and favorable ratios", async () => {
    await loaded();
    expect(
      screen.getByText(formatCurrency(response.trace.final.pnl)),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(formatPercent(response.trace.final.maxFavorablePct))
        .length,
    ).toBeGreaterThan(0);
  });
  it("aborts pending request when closed/unmounted", () => {
    vi.mocked(api.traceResearchTrade).mockReturnValue(new Promise(() => {}));
    const { unmount } = render(
      <ResearchLifecycle request={request} onClose={() => {}} />,
    );
    const signal = vi.mocked(api.traceResearchTrade).mock.calls[0][1]!;
    unmount();
    expect(signal.aborted).toBe(true);
  });
  it("does not enable Adaptive-specific action for CURRENT", () => {
    render(
      <ResearchTradeTable
        variants={[single]}
        compare={false}
        traceBase={request}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Inspect lifecycle/ }),
    ).not.toBeInTheDocument();
  });
});
