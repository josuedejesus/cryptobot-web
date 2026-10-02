"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FastForward,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
} from "lucide-react";
import CandleChart from "@/components/CandleChart";
import { Button } from "@/components/ui/button";
import type { ReplayRunResponse } from "@/lib/research/replay-api";
import { replayEventsVisibleAt } from "@/lib/research/replay-visual";

interface Props {
  result: ReplayRunResponse;
  selectedTradeIndex: number | null;
  onSelectedTradeIndexChange: (index: number | null) => void;
  tradeFocusRequest: number;
}

type ReplayEvent = {
  tradeIndex: number;
  time: number;
  label: string;
  detail: string;
  kind: "ENTRY" | "EXIT" | "STOP" | "OBSERVED" | "STOP_TRIGGER";
};

const speeds = [1, 10, 50] as const;

function formatTime(time: number): string {
  return new Date(time).toISOString().slice(0, 16).replace("T", " ");
}

function formatPrice(value: number | null): string {
  return value === null ? "—" : value.toFixed(5);
}

export default function VisualReplay({
  result,
  selectedTradeIndex,
  onSelectedTradeIndexChange,
  tradeFocusRequest,
}: Props) {
  const [resolution, setResolution] = useState("strategy");
  const [visibleCount, setVisibleCount] = useState(
    result.market.strategy.candleCount,
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof speeds)[number]>(1);
  const [debug, setDebug] = useState(false);
  const [showExcursions, setShowExcursions] = useState(false);
  const [playbackEnd, setPlaybackEnd] = useState<number | null>(null);

  const series =
    resolution === "strategy"
      ? result.market.strategy
      : result.market.intrabar[resolution] ?? result.market.strategy;
  const intervalSeconds = series.durationSeconds;
  const maximum = series.candles.length;
  const safeCount = Math.min(visibleCount, maximum);
  const replayTime =
    safeCount === 0
      ? (series.candles[0]?.time ?? 0)
      : series.candles[safeCount - 1].time + intervalSeconds;

  const events = useMemo(() => {
    const timeline: ReplayEvent[] = [];
    result.trades.forEach((trade, tradeIndex) => {
      if (trade.entryTime)
        timeline.push({
          tradeIndex,
          time: Date.parse(trade.entryTime),
          label: `${trade.type ?? "ENTRY"} ENTRY`,
          detail: `@ ${formatPrice(trade.entryPrice)}`,
          kind: "ENTRY",
        });
      if (trade.exitTime)
        timeline.push({
          tradeIndex,
          time: Date.parse(trade.exitTime),
          label: "EXIT",
          detail: `${trade.reason ?? "—"} · ${trade.pnl == null ? "—" : `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`}`,
          kind: "EXIT",
        });
    });
    if (debug)
      result.lifecycle.forEach((event) => {
        if (event.type === "POSITION_UPDATE" && event.effectiveStop !== event.stopBefore) {
          const tradeIndex = result.trades.findIndex((trade) => trade.tradeId === event.tradeId);
          timeline.push({
            tradeIndex,
            time: event.time,
            label: "STOP UPDATE",
            detail: `→ ${formatPrice(event.effectiveStop)}`,
            kind: "STOP",
          });
        }
      });
    result.lifecycle.forEach((event) => {
      if (event.type !== "STOP_EXECUTION") return;
      const tradeIndex = result.trades.findIndex((trade) => trade.tradeId === event.tradeId);
      timeline.push({
        tradeIndex,
        time: event.timestamp,
        label: "STOP TRIGGER",
        detail: `${event.mode} ${event.executionTimeframe ?? "—"} · ${formatPrice(event.triggerPrice)} → ${formatPrice(event.executionPrice)}${event.gapThrough === null ? " · gap unknown" : event.gapThrough ? " · gap" : ""}${event.ambiguousIntrabar ? " · OHLC ambiguous" : ""}`,
        kind: "STOP_TRIGGER",
      });
    });
    for (const metric of result.intrabarAnalysis.trades) {
      const crossing = metric.observedIntrabarActivationCrossing;
      const metricDuration =
        result.market.intrabar[metric.timeframe]?.durationSeconds ?? intervalSeconds;
      const observedAt = crossing
        ? crossing.timeBucket * 1000 + metricDuration * 1000
        : undefined;
      if (observedAt !== undefined && observedAt <= replayTime * 1000) {
        const tradeIndex = result.trades.findIndex((trade) => trade.tradeId === metric.tradeId);
        timeline.push({
          tradeIndex,
          time: observedAt,
          label: "OBSERVED THRESHOLD",
          detail: `${metric.timeframe} · not an executed decision`,
          kind: "OBSERVED",
        });
      }
    }
    return timeline.sort((a, b) => a.time - b.time);
  }, [result.trades, result.lifecycle, result.intrabarAnalysis.trades, debug, intervalSeconds, replayTime]);

  const selectedTrade =
    selectedTradeIndex === null ? null : result.trades[selectedTradeIndex] ?? null;
  const currentCandle = safeCount > 0 ? series.candles[safeCount - 1] : null;
  const selectedMetric = selectedTrade
    ? result.intrabarAnalysis.trades.find(
        (metric) =>
          metric.tradeId === selectedTrade.tradeId &&
          metric.timeframe === series.timeframe,
      )
    : undefined;
  const selectedMetrics = selectedTrade
    ? result.intrabarAnalysis.trades.filter(
        (metric) => metric.tradeId === selectedTrade.tradeId,
      )
    : [];
  const selectedTradeClosedAtCursor = Boolean(
    selectedTrade?.exitTime &&
      Date.parse(selectedTrade.exitTime) <= replayTime * 1000,
  );
  const selectedLifecycle = selectedTrade
    ? result.lifecycle.filter((event) => event.tradeId === selectedTrade.tradeId)
    : [];
  const entryEvent = selectedLifecycle.find((event) => event.type === "ENTRY");
  const positionUpdates = selectedLifecycle.filter(
    (event) => event.type === "POSITION_UPDATE" && event.time <= replayTime * 1000,
  );
  const latestPosition = positionUpdates.at(-1);
  const stopPath = [
    ...(entryEvent?.type === "ENTRY"
      ? [{ time: entryEvent.entryTime, value: entryEvent.initialStop }]
      : []),
    ...positionUpdates.flatMap((event) =>
      event.type === "POSITION_UPDATE"
        ? [{ time: event.time, value: event.effectiveStop }]
        : [],
    ),
  ];
  const stopExecutionMarkers = result.lifecycle.flatMap((event) =>
    event.type === "STOP_EXECUTION"
      ? [{ time: event.timestamp / 1000, label: "STOP" }]
      : [],
  );
  const excursions = selectedMetric
    ? [
        { timeBucket: selectedMetric.peakTimeBucket, label: "MFE" },
        { timeBucket: selectedMetric.troughTimeBucket, label: "MAE" },
      ]
    : [];

  useEffect(() => {
    setResolution("strategy");
    setVisibleCount(result.market.strategy.candleCount);
    setPlaying(false);
    setPlaybackEnd(null);
  }, [result]);

  useEffect(() => {
    setVisibleCount(series.candleCount);
    setPlaying(false);
    setPlaybackEnd(null);
  }, [resolution, series.candleCount]);

  useEffect(() => {
    if (tradeFocusRequest === 0 || !selectedTrade?.entryTime) return;
    const entry = Date.parse(selectedTrade.entryTime) / 1000;
    const index = series.candles.findIndex(
      (candle) => candle.time + intervalSeconds >= entry,
    );
    setPlaying(false);
    setPlaybackEnd(null);
    setVisibleCount(Math.max(1, index < 0 ? maximum : index - 2));
  }, [tradeFocusRequest]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setVisibleCount((current) => {
        const next = Math.min(playbackEnd ?? maximum, current + speed);
        if (next >= (playbackEnd ?? maximum)) setPlaying(false);
        return next;
      });
    }, Math.max(20, 1000 / speed));
    return () => window.clearInterval(timer);
  }, [playing, speed, maximum, playbackEnd]);

  function revealTime(time: number) {
    const point = time / 1000;
    const index = series.candles.findIndex(
      (candle) => candle.time + intervalSeconds >= point,
    );
    setVisibleCount(index < 0 ? maximum : index + 1);
  }

  function replayTrade(index: number) {
    const trade = result.trades[index];
    if (!trade.entryTime) return;
    onSelectedTradeIndexChange(index);
    const entry = Date.parse(trade.entryTime) / 1000;
    const entryIndex = series.candles.findIndex(
      (candle) => candle.time + intervalSeconds >= entry,
    );
    const exit = trade.exitTime ? Date.parse(trade.exitTime) / 1000 : undefined;
    const exitIndex = exit === undefined
      ? maximum
      : series.candles.findIndex((candle) => candle.time + intervalSeconds >= exit) + 1;
    const end = Math.min(maximum, Math.max(1, exitIndex + 3));
    const start = Math.max(1, entryIndex - 3);
    setPlaybackEnd(end);
    setVisibleCount(start);
    setPlaying(true);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-gray-800 bg-[#0d0d14]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Visual Replay</h2>
          <p className="mt-1 text-xs text-gray-500">
            {result.manifest.symbol} · SIGNAL {result.manifest.timeframe} · EXECUTION {result.manifest.timeframe} · TREND {result.manifest.trendTimeframe}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-gray-800 p-1">
          <button
            type="button"
            className={`rounded px-2.5 py-1 text-xs ${!debug ? "bg-emerald-500/15 text-emerald-300" : "text-gray-400 hover:text-white"}`}
            onClick={() => setDebug(false)}
          >
            Normal
          </button>
          <button
            type="button"
            className={`rounded px-2.5 py-1 text-xs ${debug ? "bg-emerald-500/15 text-emerald-300" : "text-gray-400 hover:text-white"}`}
            onClick={() => setDebug(true)}
          >
            Debug
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 px-4 py-2">
        <span className="mr-1 text-xs text-gray-500">Chart resolution</span>
        <button
          type="button"
          onClick={() => setResolution("strategy")}
          className={`rounded px-2.5 py-1 text-xs ${resolution === "strategy" ? "bg-emerald-500 text-black" : "bg-gray-900 text-gray-300 hover:bg-gray-800"}`}
        >
          Strategy · {result.market.strategy.timeframe}
        </button>
        {Object.keys(result.market.intrabar).map((timeframe) => (
          <button
            key={timeframe}
            type="button"
            onClick={() => setResolution(timeframe)}
            className={`rounded px-2.5 py-1 text-xs ${resolution === timeframe ? "bg-emerald-500 text-black" : "bg-gray-900 text-gray-300 hover:bg-gray-800"}`}
          >
            Intrabar · {timeframe}
          </button>
        ))}
      </div>

      <div className="px-2 pt-2 sm:px-4">
        <CandleChart
          symbol={series.symbol}
          timeframe={series.timeframe}
          trades={[]}
          candles={series.candles}
          replayTrades={result.trades}
          replayTime={replayTime}
          intervalSeconds={intervalSeconds}
          onCandleClick={(time) => revealTime(time * 1000)}
          initialStop={
            entryEvent?.type === "ENTRY"
              ? {
                  entryTime: entryEvent.entryTime,
                  exitTime: selectedTrade?.exitTime ? Date.parse(selectedTrade.exitTime) : null,
                  value: entryEvent.initialStop,
                }
              : undefined
          }
          stopPath={stopPath}
          excursions={excursions}
          showExcursions={showExcursions && selectedTradeClosedAtCursor}
          stopExecutionMarkers={stopExecutionMarkers}
        />
      </div>

      <div className="space-y-3 border-t border-gray-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" title="Al inicio" onClick={() => { setPlaying(false); setVisibleCount(0); }}>
              <SkipBack />
            </Button>
            <Button variant="ghost" size="icon" title="Una candle atrás" onClick={() => setVisibleCount((count) => Math.max(0, count - 1))}>
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="icon" title={playing ? "Pausar" : "Reproducir"} onClick={() => {
              if (!playing && safeCount >= maximum) {
                setVisibleCount(0);
                setPlaybackEnd(null);
              }
              setPlaying((value) => !value);
            }} disabled={maximum === 0}>
              {playing ? <Pause /> : <Play />}
            </Button>
            <Button variant="ghost" size="icon" title="Una candle adelante" onClick={() => setVisibleCount((count) => Math.min(maximum, count + 1))}>
              <ChevronRight />
            </Button>
              <Button variant="ghost" size="icon" title="MAX: mostrar todo" onClick={() => { setPlaying(false); setPlaybackEnd(null); setVisibleCount(maximum); }}>
              <SkipForward />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-gray-500">Speed</span>
            {speeds.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSpeed(value)}
                className={`rounded px-2 py-1 text-xs ${speed === value ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800"}`}
              >
                {value}x
              </button>
            ))}
            <Button variant="ghost" size="sm" title="MAX: mostrar todo" onClick={() => { setPlaying(false); setPlaybackEnd(null); setVisibleCount(maximum); }}>
              <FastForward /> MAX
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <span className="whitespace-nowrap text-xs text-gray-500">
            {series.candles[0] ? formatTime(series.candles[0].time * 1000) : "—"}
          </span>
          <input
            aria-label="Replay timeline"
            className="w-full accent-emerald-400"
            type="range"
            min={0}
            max={maximum}
            value={safeCount}
            onChange={(event) => { setPlaying(false); setVisibleCount(Number(event.target.value)); }}
          />
          <span className="whitespace-nowrap text-xs text-gray-500">
            {series.candles.at(-1) ? formatTime((series.candles.at(-1)!.time + intervalSeconds) * 1000) : "—"}
          </span>
        </div>
        <div className="text-center font-mono text-xs text-gray-300">
          {replayTime ? formatTime(replayTime * 1000) : "No candle selected"}
        </div>
      </div>

      <div className="grid gap-0 border-t border-gray-800 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="border-b border-gray-800 lg:border-b-0 lg:border-r">
          <h3 className="px-4 py-2 text-xs font-semibold uppercase text-gray-500">Event timeline</h3>
          <div className="max-h-52 divide-y divide-gray-900 overflow-auto">
            {replayEventsVisibleAt(events, replayTime * 1000).map((event) => (
              <button
                key={`${event.tradeIndex}-${event.kind}`}
                type="button"
                onClick={() => {
                  onSelectedTradeIndexChange(event.tradeIndex);
                  revealTime(event.time);
                }}
                className={`flex w-full items-center gap-3 px-4 py-2 text-left text-xs hover:bg-gray-900 ${selectedTradeIndex === event.tradeIndex ? "bg-gray-900/70" : ""}`}
              >
                <time className="shrink-0 font-mono text-gray-500">{formatTime(event.time)}</time>
                <span className={event.kind === "ENTRY" ? "text-emerald-300" : event.kind === "EXIT" ? "text-sky-300" : event.kind === "STOP" ? "text-amber-300" : event.kind === "STOP_TRIGGER" ? "text-rose-300" : "text-orange-300"}>{event.label}</span>
                <span className="truncate text-gray-400">{event.detail}</span>
              </button>
            ))}
            {replayEventsVisibleAt(events, replayTime * 1000).length === 0 && (
              <p className="px-4 py-4 text-xs text-gray-600">No replay events visible at this time.</p>
            )}
          </div>
        </div>

        <aside className="p-4">
          <h3 className="text-xs font-semibold uppercase text-gray-500">Candle inspector</h3>
          {currentCandle ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <dt className="text-gray-500">Time</dt><dd className="text-right font-mono">{formatTime(currentCandle.time * 1000)}</dd>
              <dt className="text-gray-500">Open</dt><dd className="text-right font-mono">{formatPrice(currentCandle.open)}</dd>
              <dt className="text-gray-500">High</dt><dd className="text-right font-mono">{formatPrice(currentCandle.high)}</dd>
              <dt className="text-gray-500">Low</dt><dd className="text-right font-mono">{formatPrice(currentCandle.low)}</dd>
              <dt className="text-gray-500">Close</dt><dd className="text-right font-mono">{formatPrice(currentCandle.close)}</dd>
            </dl>
          ) : <p className="mt-3 text-xs text-gray-600">No candle selected.</p>}
          {selectedTrade && (
            <div className="mt-4 border-t border-gray-800 pt-3">
              <h4 className="text-xs font-semibold text-emerald-300">{selectedTrade.type} · SELECTED TRADE</h4>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <dt className="text-gray-500">Entry</dt><dd className="text-right font-mono">{formatPrice(selectedTrade.entryPrice)}</dd>
                <dt className="text-gray-500">Initial stop</dt><dd className="text-right font-mono">{formatPrice(selectedTrade.stopLoss)}</dd>
                <dt className="text-gray-500">Entry time</dt><dd className="text-right font-mono">{selectedTrade.entryTime ? formatTime(Date.parse(selectedTrade.entryTime)) : "—"}</dd>
                <dt className="text-gray-500">Exit time</dt><dd className="text-right font-mono">{selectedTrade.exitTime ? formatTime(Date.parse(selectedTrade.exitTime)) : "Open"}</dd>
              </dl>
              {debug && (
                <p className="mt-3 break-all font-mono text-[10px] text-gray-600">
                  signal {selectedTrade.signalCandleOpenTime ?? "—"} → {selectedTrade.signalCandleCloseTime ?? "—"} · decision {selectedTrade.decisionTime ?? "—"}
                </p>
              )}
              <Button className="mt-3 w-full" size="sm" onClick={() => replayTrade(selectedTradeIndex!)}>
                <Rewind /> Replay trade
              </Button>
              <label className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={showExcursions}
                  onChange={(event) => setShowExcursions(event.target.checked)}
                  disabled={!selectedTradeClosedAtCursor || !selectedMetric}
                  className="size-4 accent-emerald-400"
                />
                Excursions
              </label>
              {selectedTrade.entryTime &&
                Date.parse(selectedTrade.entryTime) <= replayTime * 1000 &&
                (!selectedTrade.exitTime || Date.parse(selectedTrade.exitTime) > replayTime * 1000) && (
                  <div className="mt-4 border-t border-gray-800 pt-3">
                    <h4 className="text-xs font-semibold uppercase text-amber-300">Position · observation only</h4>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <dt className="text-gray-500">Side</dt><dd className="text-right">{selectedTrade.type}</dd>
                      <dt className="text-gray-500">Entry</dt><dd className="text-right font-mono">{formatPrice(selectedTrade.entryPrice)}</dd>
                      <dt className="text-gray-500">Current</dt><dd className="text-right font-mono">{formatPrice(currentCandle?.close ?? null)}</dd>
                      <dt className="text-gray-500">Best price</dt><dd className="text-right font-mono">{latestPosition?.type === "POSITION_UPDATE" ? formatPrice(latestPosition.bestPrice) : "—"}</dd>
                      <dt className="text-gray-500">Initial stop</dt><dd className="text-right font-mono">{entryEvent?.type === "ENTRY" ? formatPrice(entryEvent.initialStop) : "—"}</dd>
                      <dt className="text-gray-500">Effective stop</dt><dd className="text-right font-mono">{latestPosition?.type === "POSITION_UPDATE" ? formatPrice(latestPosition.effectiveStop) : "—"}</dd>
                    </dl>
                  </div>
                )}
              {selectedTradeClosedAtCursor && selectedMetric && (
                <div className="mt-4 border-t border-gray-800 pt-3">
                  <h4 className="text-xs font-semibold uppercase text-sky-300">Intrabar · {selectedMetric.timeframe} · observed only</h4>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <dt className="text-gray-500">Peak / bucket</dt><dd className="text-right font-mono">{formatPrice(selectedMetric.peakPrice)} / {selectedMetric.peakTimeBucket === null ? "—" : formatTime(selectedMetric.peakTimeBucket * 1000)}</dd>
                    <dt className="text-gray-500">MFE / MAE</dt><dd className="text-right font-mono">{selectedMetric.mfePct === null ? "—" : `${(selectedMetric.mfePct * 100).toFixed(2)}%`} / {selectedMetric.maePct === null ? "—" : `${(selectedMetric.maePct * 100).toFixed(2)}%`}</dd>
                    <dt className="text-gray-500">Max retracement</dt><dd className="text-right font-mono">{selectedMetric.maxRetracementFromPeakPct === null ? "—" : `${(selectedMetric.maxRetracementFromPeakPct * 100).toFixed(2)}%`}</dd>
                    <dt className="text-gray-500">Time to MFE</dt><dd className="text-right font-mono">{selectedMetric.timeToMfeMs === null ? "—" : `${(selectedMetric.timeToMfeMs / 60000).toFixed(0)} min`}</dd>
                    <dt className="text-gray-500">Activation crossing</dt><dd className="text-right font-mono">{selectedMetric.observedIntrabarActivationCrossing ? formatTime(selectedMetric.observedIntrabarActivationCrossing.timeBucket * 1000) : "Not observed"}</dd>
                    <dt className="text-gray-500">Threshold</dt><dd className="text-right font-mono">{selectedMetric.activationThresholdPct === null ? "Not configured" : `${(selectedMetric.activationThresholdPct * 100).toFixed(2)}%`}</dd>
                    <dt className="text-gray-500">Boundary</dt><dd className="text-right font-mono">{selectedMetric.boundaryStatus}</dd>
                    <dt className="text-gray-500">Path order</dt><dd className="text-right font-mono">{selectedMetric.milestones.some((milestone) => milestone.orderAmbiguous) ? "ORDER_AMBIGUOUS" : "Bucket ordered"}</dd>
                  </dl>
                  <p className="mt-2 text-[10px] text-amber-300">Observed intrabar event · Not an executed strategy decision</p>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400">
                    {selectedMetric.milestones.map((milestone) => (
                      <span key={milestone.favorablePct}>
                        +{(milestone.favorablePct * 100).toFixed(2)}%: {milestone.timeBucket === null ? "not reached" : `${formatTime(milestone.timeBucket * 1000)}${milestone.orderAmbiguous ? " · ORDER_AMBIGUOUS" : " · bucket"}`}
                      </span>
                    ))}
                  </div>
                  {selectedMetrics.length > 1 && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[360px] text-left text-[10px]">
                        <thead className="text-gray-500"><tr><th className="py-1">Resolution</th><th>Peak bucket</th><th>MFE</th><th>MAE</th><th>Retracement</th></tr></thead>
                        <tbody>
                          {selectedMetrics.map((metric) => (
                            <tr key={metric.timeframe} className="border-t border-gray-900 text-gray-300">
                              <td className="py-1 font-mono">{metric.timeframe}</td>
                              <td>{metric.peakTimeBucket === null ? "—" : formatTime(metric.peakTimeBucket * 1000)}</td>
                              <td>{metric.mfePct === null ? "—" : `${(metric.mfePct * 100).toFixed(2)}%`}</td>
                              <td>{metric.maePct === null ? "—" : `${(metric.maePct * 100).toFixed(2)}%`}</td>
                              <td>{metric.maxRetracementFromPeakPct === null ? "—" : `${(metric.maxRetracementFromPeakPct * 100).toFixed(2)}%`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              {selectedTrade.exitTime && !selectedTradeClosedAtCursor && (
                <p className="mt-3 text-[10px] text-gray-500">Final excursion metrics stay hidden until the historical exit is reached.</p>
              )}
            </div>
          )}
        </aside>
      </div>

      {safeCount === maximum && result.intrabarAnalysis.summaries.length > 0 && (
        <div className="border-t border-gray-800 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase text-gray-500">Final post-trade intrabar analysis · observation only</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="text-gray-500">
                <tr><th className="py-2">Resolution</th><th>Trades</th><th>Median MFE</th><th>Median MAE</th><th>Time to MFE</th><th>Max retracement</th><th>Giveback</th><th>Activation crossed</th><th>+0.5%</th><th>+1%</th><th>+2%</th></tr>
              </thead>
              <tbody>
                {result.intrabarAnalysis.summaries.map((summary) => (
                  <tr key={summary.timeframe} className="border-t border-gray-900 text-gray-300">
                    <td className="py-2 font-mono">{summary.timeframe}</td>
                    <td>{summary.tradeCount}</td>
                    <td>{summary.medianMfePct === null ? "—" : `${(summary.medianMfePct * 100).toFixed(2)}%`}</td>
                    <td>{summary.medianMaePct === null ? "—" : `${(summary.medianMaePct * 100).toFixed(2)}%`}</td>
                    <td>{summary.medianTimeToMfeMs === null ? "—" : `${(summary.medianTimeToMfeMs / 60000).toFixed(0)}m`}</td>
                    <td>{summary.medianMaxRetracementPct === null ? "—" : `${(summary.medianMaxRetracementPct * 100).toFixed(2)}%`}</td>
                    <td>{summary.medianGivebackPct === null ? "—" : `${(summary.medianGivebackPct * 100).toFixed(2)}%`}</td>
                    <td>{summary.activationThresholdReachedPct === null ? "—" : `${(summary.activationThresholdReachedPct * 100).toFixed(0)}%`}</td>
                    <td>{(summary.favorableThresholdsReachedPct["0.005"] * 100).toFixed(0)}%</td>
                    <td>{(summary.favorableThresholdsReachedPct["0.01"] * 100).toFixed(0)}%</td>
                    <td>{(summary.favorableThresholdsReachedPct["0.02"] * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}