"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
  SeriesMarker,
} from "lightweight-charts";
import { Trade } from "@/hooks/useBot";

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
}

export default function CandleChart({ symbol, timeframe, trades }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

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

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) chart.applyOptions({ width: e.contentRect.width });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Cargar velas de Binance (misma fuente que el bot) al cambiar símbolo/tf.
  useEffect(() => {
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
  }, [symbol, timeframe]);

  // Marcadores de trades (entrada / salida) sobre las velas.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const step = INTERVAL_SEC[timeframe] ?? 14400;
    // Alinear cada marcador al inicio de su vela para que caiga sobre la barra.
    const snap = (d: string | Date) =>
      (Math.floor(new Date(d).getTime() / 1000 / step) * step) as Time;

    const markers: SeriesMarker<Time>[] = [];
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
  }, [trades, timeframe]);

  return <div ref={containerRef} className="w-full" />;
}
