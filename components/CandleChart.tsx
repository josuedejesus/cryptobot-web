"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  LineType,
  Time,
  SeriesMarker,
} from "lightweight-charts";
import { Trade } from "@/hooks/useBot";
import type {
  ReplaySeriesCandle,
  ReplayTradeView,
} from "@/lib/research/replay-api";
import { replayCandlesClosedAt } from "@/lib/research/replay-visual";

const FAPI = "https://fapi.binance.com/fapi/v1/klines";

const INTERVAL_SEC: Record<string, number> = {
  "3m": 180,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "2h": 7200,
  "4h": 14400,
  "1d": 86400,
};

interface Props {
  symbol: string;
  timeframe: string;
  trades: Trade[];
  candles?: ReplaySeriesCandle[];
  replayTrades?: ReplayTradeView[];
  replayTime?: number;
  intervalSeconds?: number;
  onCandleClick?: (time: number) => void;
  initialStop?: { entryTime: number; exitTime: number | null; value: number };
  stopPath?: { time: number; value: number }[];
  excursions?: { timeBucket: number | null; label: string }[];
  showExcursions?: boolean;
  stopExecutionMarkers?: { time: number; label: string }[];
}

export default function CandleChart({
  symbol,
  timeframe,
  trades,
  candles,
  replayTrades,
  replayTime,
  intervalSeconds,
  onCandleClick,
  initialStop,
  stopPath,
  excursions,
  showExcursions,
  stopExecutionMarkers,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const effectiveStopRef = useRef<ISeriesApi<"Line"> | null>(null);
  const initialStopRef = useRef<ISeriesApi<"Line"> | null>(null);
  const replayDataRef = useRef<{
    candles: ReplaySeriesCandle[];
    visibleCount: number;
  } | null>(null);

  // Crear el chart una sola vez.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      timeScale: { timeVisible: true, borderColor: "#374151" },
      rightPriceScale: { borderColor: "#374151" },
      crosshair: { mode: 0 },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    const effectiveStop = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 2,
      lineType: LineType.WithSteps,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const initialStopLine = chart.addLineSeries({
      color: "#9ca3af",
      lineWidth: 1,
      lineStyle: 2,
      lineType: LineType.WithSteps,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    effectiveStopRef.current = effectiveStop;
    initialStopRef.current = initialStopLine;

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) chart.applyOptions({ width: e.contentRect.width });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      effectiveStopRef.current = null;
      initialStopRef.current = null;
    };
  }, []);

  // Replay supplies its exact historical series; Dashboard keeps its Binance feed.
  useEffect(() => {
    if (candles !== undefined) {
      const visible = replayTime === undefined
        ? candles
        : replayCandlesClosedAt(
            candles,
            intervalSeconds ?? INTERVAL_SEC[timeframe] ?? 14400,
            replayTime,
          );
      const previous = replayDataRef.current;
      if (
        previous?.candles === candles &&
        visible.length > previous.visibleCount &&
        visible.length - previous.visibleCount < 1000
      ) {
        for (const candle of visible.slice(previous.visibleCount))
          seriesRef.current?.update({
            time: candle.time as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          });
      } else if (
        previous?.candles !== candles ||
        visible.length !== previous.visibleCount
      ) {
        seriesRef.current?.setData(
          visible.map((candle) => ({
          time: candle.time as Time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          })),
        );
        if (previous === null || previous.candles !== candles || visible.length < previous.visibleCount)
          chartRef.current?.timeScale().fitContent();
      }
      replayDataRef.current = { candles, visibleCount: visible.length };
      return;
    }
    replayDataRef.current = null;
    let cancelled = false;
    (async () => {
      try {
        const url = `${FAPI}?symbol=${symbol}&interval=${timeframe}&limit=500`;
        const raw = await fetch(url).then((r) => r.json());
        if (cancelled || !Array.isArray(raw) || !seriesRef.current) return;
        seriesRef.current.setData(
          raw.map((k: (string | number)[]) => ({
            time: (Number(k[0]) / 1000) as Time,
            open: +k[1],
            high: +k[2],
            low: +k[3],
            close: +k[4],
          })),
        );
        chartRef.current?.timeScale().fitContent();
      } catch {
        // si Binance no responde, el chart queda vacío — sin romper
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, candles, replayTime, intervalSeconds]);

  // Marcadores de trades (entrada / salida) sobre las velas.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const step = intervalSeconds ?? INTERVAL_SEC[timeframe] ?? 14400;
    // Alinear cada marcador al inicio de su vela para que caiga sobre la barra.
    const snap = (d: string | Date) =>
      (Math.floor(new Date(d).getTime() / 1000 / step) * step) as Time;

    const markers: SeriesMarker<Time>[] = [];
    if (replayTrades !== undefined) {
      const snapReplay = (value: string | null) => {
        if (!value) return null;
        const timestamp = new Date(value).getTime() / 1000;
        if (replayTime !== undefined && timestamp > replayTime) return null;
        return Math.floor((timestamp - 0.001) / step) * step as Time;
      };
      for (const trade of replayTrades) {
        const entry = snapReplay(trade.entryTime);
        if (entry !== null)
          markers.push({
            time: entry,
            position: trade.type === "LONG" ? "belowBar" : "aboveBar",
            color: trade.type === "LONG" ? "#10b981" : "#ef4444",
            shape: trade.type === "LONG" ? "arrowUp" : "arrowDown",
            text: trade.type === "LONG" ? "LONG" : "SHORT",
          });
        const exit = snapReplay(trade.exitTime);
        if (exit !== null)
          markers.push({
            time: exit,
            position: "aboveBar",
            color: (trade.pnl ?? 0) >= 0 ? "#10b981" : "#ef4444",
            shape: "circle",
            text: trade.pnl == null ? "EXIT" : `${trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(1)}`,
          });
      }
      if (showExcursions)
        for (const excursion of excursions ?? [])
          if (
            excursion.timeBucket !== null &&
            (replayTime === undefined || excursion.timeBucket <= replayTime)
          )
            markers.push({
              time: excursion.timeBucket as Time,
              position: excursion.label === "MFE" ? "aboveBar" : "belowBar",
              color: excursion.label === "MFE" ? "#fbbf24" : "#fb7185",
              shape: "circle",
              text: excursion.label,
            });
      for (const stopEvent of stopExecutionMarkers ?? [])
        if (replayTime === undefined || stopEvent.time <= replayTime)
          markers.push({
            time: stopEvent.time as Time,
            position: "aboveBar",
            color: "#fb7185",
            shape: "circle",
            text: stopEvent.label,
          });
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      series.setMarkers(markers);
      return;
    }
    for (const t of trades) {
      markers.push({
        time: snap(t.openedAt),
        position: t.type === "LONG" ? "belowBar" : "aboveBar",
        color: t.type === "LONG" ? "#10b981" : "#ef4444",
        shape: t.type === "LONG" ? "arrowUp" : "arrowDown",
        text: t.type === "LONG" ? "▲" : "▼",
      });
      if (t.closedAt && t.pnl != null) {
        markers.push({
          time: snap(t.closedAt),
          position: "aboveBar",
          color: t.pnl >= 0 ? "#10b981" : "#ef4444",
          shape: "circle",
          text: `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(1)}`,
        });
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    series.setMarkers(markers);
  }, [trades, timeframe, replayTrades, replayTime, intervalSeconds, excursions, showExcursions, stopExecutionMarkers]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onCandleClick) return;
    const handleClick = (param: { time?: Time }) => {
      if (param.time !== undefined) onCandleClick(Number(param.time));
    };
    chart.subscribeClick(handleClick);
    return () => chart.unsubscribeClick(handleClick);
  }, [onCandleClick]);

  useEffect(() => {
    const duration = intervalSeconds ?? INTERVAL_SEC[timeframe] ?? 14400;
    const bucketTime = (time: number) =>
      (Math.floor((time / 1000 - 1) / duration) * duration) as Time;
    const points = (stopPath ?? [])
      .filter((point) => replayTime === undefined || point.time / 1000 <= replayTime)
      .map((point) => ({ time: bucketTime(point.time), value: point.value }));
    const effectiveByTime = new Map<number, { time: Time; value: number }>();
    for (const point of points) effectiveByTime.set(point.time as number, point);
    effectiveStopRef.current?.setData(
      [...effectiveByTime.values()].sort((a, b) => (a.time as number) - (b.time as number)),
    );

    if (!initialStop || (replayTime !== undefined && initialStop.entryTime / 1000 > replayTime)) {
      initialStopRef.current?.setData([]);
      return;
    }
    const entryBucket = bucketTime(initialStop.entryTime);
    const endTime =
      initialStop.exitTime === null
        ? replayTime === undefined ? initialStop.entryTime : replayTime * 1000
        : Math.min(initialStop.exitTime, (replayTime ?? Number.POSITIVE_INFINITY) * 1000);
    const endBucket = bucketTime(endTime);
    initialStopRef.current?.setData(
      entryBucket === endBucket
        ? [{ time: entryBucket, value: initialStop.value }]
        : [
            { time: entryBucket, value: initialStop.value },
            { time: endBucket, value: initialStop.value },
          ],
    );
  }, [stopPath, initialStop, replayTime, intervalSeconds, timeframe]);

  return <div ref={containerRef} className="w-full" />;
}
