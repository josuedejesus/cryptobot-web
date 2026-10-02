"use client";

import type { Trade } from "@/hooks/useBot";

interface Props {
  trade: Trade;
  currentPrice: number | null;
}

const money = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : `$${value.toFixed(4)}`;
const pct = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(2)}%`;
const time = (value: number | null | undefined) =>
  value == null ? "—" : new Date(value).toISOString().slice(0, 16).replace("T", " ");
const duration = (openedAt: string) => {
  const elapsed = Math.max(0, Date.now() - Date.parse(openedAt));
  const hours = Math.floor(elapsed / 3_600_000);
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h ${Math.floor((elapsed % 3_600_000) / 60_000)}m`;
};

export default function ActiveTradeStrategyStatus({ trade, currentPrice }: Props) {
  const state = trade.strategyState;
  const initialStop = state?.stop.initial ?? trade.initialStop ?? trade.stopLoss;
  const effectiveStop = state?.stop.effective ?? trade.effectiveStop ?? trade.trailingStop ?? trade.stopLoss;
  const entryPrice = trade.entryPrice;
  const lockedProfit = trade.type === "LONG"
    ? Math.max(0, (effectiveStop - entryPrice) / entryPrice)
    : Math.max(0, (entryPrice - effectiveStop) / entryPrice);
  const distanceToStop = currentPrice == null || currentPrice <= 0
    ? null
    : trade.type === "LONG"
      ? (currentPrice - effectiveStop) / currentPrice
      : (effectiveStop - currentPrice) / currentPrice;
  const bestPrice = state?.priceState.bestPrice ?? trade.peakPrice ?? entryPrice;
  const engineMfe = trade.type === "LONG"
    ? (bestPrice - entryPrice) / entryPrice
    : (entryPrice - bestPrice) / entryPrice;
  const lockedProfitLabel = `+${(lockedProfit * 100).toFixed(2)}%`;
  const strategyType = state?.type ?? trade.exitStrategyType ?? "CURRENT";
  const adaptive = strategyType === "ADAPTIVE_CHANDELIER";
  const message = !state || state.status === "UNAVAILABLE"
    ? "Estado detallado de estrategia no disponible."
    : adaptive && state.status === "WAITING"
      ? "Esperando que el mejor precio alcance el umbral de activación."
      : adaptive && state.status === "THRESHOLD_REACHED"
        ? "Threshold alcanzado; esperando evaluación de la estrategia."
        : adaptive && state.stop.candidateBlockedByMonotonicity
            ? `Adaptive está activo, pero el candidate no mejora el stop protegido (${lockedProfitLabel} sobre la entrada).`
          : adaptive
              ? `Adaptive está activo y protege ${lockedProfitLabel} sobre la entrada.`
            : "Current gestiona el trade con los mecanismos habilitados en su snapshot.";

  return (
    <div className="border-t border-gray-800 pt-3">
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Metric label="Protection" value={pct(lockedProfit)} tone={lockedProfit > 0 ? "positive" : undefined} />
        <Metric label="Strategy" value={state?.label ?? (adaptive ? "Adaptive Chandelier" : "Current")} />
        <Metric label="MFE · engine" value={pct(engineMfe)} />
        <Metric label="MAE · engine" value="—" />
        <Metric
          label="Stop execution"
          value={trade.stopExecutionMode === "EXCHANGE_NATIVE"
            ? "EXCHANGE_NATIVE"
            : trade.stopExecutionMode === "INTRABAR"
            ? `INTRABAR · ${trade.stopExecutionTimeframe ?? "STREAM"}`
            : `CANDLE_CLOSE · ${trade.stopExecutionTimeframe ?? "—"}`}
        />
        <Metric label="Duration" value={duration(trade.openedAt)} />
      </div>

      <details className="group mt-3 rounded-md border border-gray-800 bg-black/10">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-gray-300 marker:hidden">
          <span className="flex items-center justify-between">
            <span>{state?.label ?? (adaptive ? "Adaptive Chandelier" : "Current")} · {state?.status ?? "UNAVAILABLE"}</span>
            <span className="text-gray-500 group-open:rotate-180">⌄</span>
          </span>
        </summary>
        <div className="space-y-4 border-t border-gray-800 px-3 py-3">
          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Protección</h3>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
              <Metric label="Initial stop" value={money(initialStop)} />
              <Metric label="Effective stop" value={money(effectiveStop)} tone="positive" />
              <Metric label="Distance to stop" value={pct(distanceToStop)} />
              <Metric label="Locked profit" value={pct(lockedProfit)} tone={lockedProfit > 0 ? "positive" : undefined} />
            </div>
            {state?.stop.previousEffective != null && state.stop.lastUpdatedAt != null && (
              <p className="mt-2 text-[11px] text-gray-500">
                Last stop update: {money(state.stop.previousEffective)} → {money(state.stop.effective)} · {time(state.stop.lastUpdatedAt)}
              </p>
            )}
          </div>

          {adaptive ? (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Adaptive Chandelier</h3>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
                <Metric label="Activation" value={state?.activation?.status ?? "UNAVAILABLE"} />
                <Metric label="Threshold" value={pct(state?.activation?.thresholdPct)} />
                <Metric label="Activation price" value={money(state?.activation?.activationPrice)} />
                <Metric label="Remaining" value={pct(state?.activation?.remainingPct)} />
                <Metric label="Best price" value={money(bestPrice)} />
                <Metric label="ATR" value={state?.volatility?.atr == null ? "—" : state.volatility.atr.toPrecision(4)} />
                <Metric label="ATR source" value={state?.volatility?.atrSource ?? "—"} />
                <Metric label="Volatility" value={state?.volatility?.regime?.replace("_VOL", "") ?? "—"} />
                <Metric label="Multiplier" value={state?.volatility?.multiplier == null ? "—" : `${state.volatility.multiplier.toFixed(2)}x`} />
                <Metric label="Candidate stop" value={money(state?.stop.candidate)} />
                <Metric label="Effective stop" value={money(state?.stop.effective)} />
                <Metric label="Initial stop" value={money(state?.stop.initial)} />
                <Metric label="Update timing" value={state?.stop.updateTiming ?? "—"} />
                <Metric label="Last evaluation" value={time(state?.lastStrategyEvaluationAt)} />
              </div>
              {state?.status === "THRESHOLD_REACHED" && (
                <p className="mt-2 text-[11px] text-amber-300">Threshold reached · awaiting strategy evaluation</p>
              )}
              {state?.stop.candidateBlockedByMonotonicity && (
                <p className="mt-2 text-[11px] text-amber-300">El stop efectivo es monotónico; un candidate menos protector no lo mueve.</p>
              )}
              {state?.activation?.activatedAt != null && (
                <p className="mt-2 text-[11px] text-gray-500">Activated at {time(state.activation.activatedAt)}</p>
              )}
            </div>
          ) : (
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Current</h3>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
                <Metric label="Stop execution" value={trade.stopExecutionMode ?? (trade.mode === "live" ? "EXCHANGE_NATIVE" : "CANDLE_CLOSE")} />
                <Metric label="Breakeven" value={state?.current?.breakeven ?? "UNAVAILABLE"} />
                <Metric label="Trailing" value={state?.current?.trailing ?? "UNAVAILABLE"} />
                <Metric label="Take profit" value={money(trade.takeProfit)} />
                <Metric label="Last evaluation" value={time(state?.lastStrategyEvaluationAt)} />
              </div>
            </div>
          )}
          <p className="border-t border-gray-800 pt-2 text-[11px] text-gray-500">{message}</p>
          <p className="text-[10px] text-gray-600">MFE usa bestPrice del PositionManager. MAE no se expone para la posición activa.</p>
        </div>
      </details>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive";
}) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[10px] text-gray-500">{label}</p>
      <p className={`truncate font-mono ${tone === "positive" ? "text-emerald-400" : "text-gray-200"}`}>
        {value}
      </p>
    </div>
  );
}
