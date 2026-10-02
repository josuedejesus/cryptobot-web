import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ActiveTradeStrategyStatus from "@/components/ActiveTradeStrategyStatus";
import type { Trade } from "@/hooks/useBot";

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 1,
    type: "LONG",
    entryPrice: 1.5,
    exitPrice: undefined,
    stopLoss: 1.47,
    initialStop: 1.47,
    effectiveStop: 1.53,
    trailingStop: 1.53,
    takeProfit: 1.6,
    reason: "test",
    openedAt: "2026-10-01T12:00:00.000Z",
    strategyState: {
      type: "ADAPTIVE_CHANDELIER",
      label: "Adaptive Chandelier",
      status: "ACTIVE",
      priceState: { bestPrice: 1.54, currentPrice: 1.535 },
      stop: {
        initial: 1.47,
        candidate: 1.52,
        effective: 1.53,
        previousEffective: 1.52,
        candidateBlockedByMonotonicity: true,
        updateTiming: "NEXT_CANDLE",
        lastUpdatedAt: Date.parse("2026-10-02T00:00:00.000Z"),
      },
      lastStrategyEvaluationAt: Date.parse("2026-10-02T00:00:00.000Z"),
      activation: {
        status: "ACTIVE",
        thresholdPct: 0.0025,
        activationPrice: 1.50375,
        remainingPct: 0,
        activatedAt: Date.parse("2026-10-01T14:00:00.000Z"),
      },
      volatility: {
        atr: 0.02,
        atrSource: "CURRENT",
        regime: "NORMAL_VOL",
        multiplier: 1,
      },
    },
    ...overrides,
  };
}

describe("ActiveTradeStrategyStatus", () => {
  it("shows locked LONG profit and distinguishes the initial/effective stops", () => {
    render(<ActiveTradeStrategyStatus trade={trade()} currentPrice={1.535} />);
    expect(screen.getAllByText("2.00%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1.4700").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$1.5300").length).toBeGreaterThan(0);
    expect(screen.getByText(/candidate no mejora el stop protegido/i)).toBeTruthy();
  });

  it("calculates locked profit for SHORT and clamps an unprotected LONG to zero", () => {
    const baseState = trade().strategyState!;
    const { rerender } = render(
      <ActiveTradeStrategyStatus
        trade={trade({
          type: "SHORT",
          entryPrice: 1.5,
          stopLoss: 1.53,
          initialStop: 1.53,
          effectiveStop: 1.47,
          trailingStop: 1.47,
          strategyState: {
            ...baseState,
            priceState: { bestPrice: 1.46, currentPrice: 1.46 },
            stop: { ...baseState.stop, initial: 1.53, effective: 1.47 },
          },
        })}
        currentPrice={1.46}
      />,
    );
    expect(screen.getAllByText("2.00%").length).toBeGreaterThan(0);

    rerender(
      <ActiveTradeStrategyStatus
        trade={trade({
          type: "LONG",
          entryPrice: 1.5,
          stopLoss: 1.47,
          initialStop: 1.47,
          effectiveStop: 1.47,
          trailingStop: 1.47,
          strategyState: {
            ...baseState,
            stop: { ...baseState.stop, initial: 1.47, effective: 1.47 },
          },
        })}
        currentPrice={1.48}
      />,
    );
    expect(screen.getAllByText("0.00%").length).toBeGreaterThan(0);
  });

  it("shows Current mechanisms without Adaptive fields and tolerates missing state", () => {
    render(
      <ActiveTradeStrategyStatus
        trade={trade({
          exitStrategyType: "CURRENT",
          strategyState: {
            type: "CURRENT",
            label: "Current",
            status: "ACTIVE",
            priceState: { bestPrice: 1.54, currentPrice: 1.535 },
            stop: {
              initial: 1.47,
              candidate: null,
              effective: 1.53,
              previousEffective: null,
              candidateBlockedByMonotonicity: false,
              updateTiming: "AT_CLOSE",
              lastUpdatedAt: null,
            },
            lastStrategyEvaluationAt: null,
            current: { breakeven: "ACTIVE", trailing: "WAITING" },
          },
        })}
        currentPrice={1.535}
      />,
    );
    expect(screen.getByText("Breakeven")).toBeTruthy();
    expect(screen.queryByText("Activation price")).toBeNull();
  });
});
