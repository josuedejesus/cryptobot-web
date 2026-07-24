import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface Trade {
  id: number;
  type: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  result?: "WIN" | "LOSS";
  pnl?: number;
  reason?: string;
  openedAt: string;
  closedAt?: string;
  peakPrice?: number;
  troughPrice?: number;
  trailingStop?: number;
  breakevenApplied?: boolean; // 👈 nuevo
}
export interface Summary {
  balance: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: string;
  totalPnl: string;
  activeTrade: Trade | null;
  trades: Trade[];
  todayPnl?: string;
  killSwitchActive?: boolean;
  isTestnet?: boolean;
}

export interface Signal {
  signal: "LONG" | "SHORT" | "HOLD";
  price: number;
  ema9: number;
  ema21: number;
  rsi: number;
  timestamp: string;
  priceAboveVwap: boolean;
  isHighVolume: boolean;
  bbWidth: number;
  bbSqueeze: boolean;
  vwap: number;
  confirmed: boolean;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  reason: string;
}

export type BotConfig = {
  id: number;
  name: string;
  isActive: boolean;
  symbol: string;
  timeframe: string;
  emaFast: number;
  emaSlow: number;
  rsiPeriod: number;
  rsiMin: number;
  rsiMax: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  positionSize: number;
  volumeLookback: number;
  volumeMultiplier: number;
  bbPeriod: number;
  bbStdDev: number;
  emaSeparation: number;
  ema21Tolerance: number;
  vwapStrict: boolean;
  onlyLong: boolean;
  onlyShort: boolean;
  maxTradesPerDay: number;
  mode: string;
  minBandWidth: number;
  trendTimeframe: string;
  isPaused: boolean;
  marketType: string;
  leverage: number;
  atrPeriod: number;
  slAtrMultiplier: number;
  maxSlDistancePct: number;
  feePct: number;
  trailAtrMultiplier: number | null;
  trendStrengthScale: number;

  // Score compuesto
  scoreMinToEnter: number;
  scoreVolumeHigh: number;
  scoreTrendAligned: number;
  scoreVwapAligned: number;

  // Stochastic RSI
  stochRsiRsiPeriod: number;
  stochRsiStochPeriod: number;
  stochRsiKPeriod: number;
  stochRsiDPeriod: number;
  stochRsiOversold: number;
  stochRsiOverbought: number;
  scoreStochRsiCross: number;

  // Squeeze Release + ATR Expansion
  squeezeTreshold: number;
  scoreSqueezeExpansion: number;

  // VWAP Reversion
  scoreVwapReversion: number;

  // Trailing stop (reemplaza el TP fijo)
  enableTrailingStop: boolean;
  trailingActivationPct: number;
  trailingDistancePct: number;

  // Breakeven (reemplaza el SL fijo)
  enableBreakeven: boolean;
  breakevenActivationPct: number;
  breakevenOffsetPct: number;

  // Live Trading — Kill Switch
  maxDailyLossUsd: number | null;

  // Live Trading — Entrada por limit order
  entryLimitOffsetPct: number;
  entryLimitTimeoutMs: number;
  entryMaxDriftPct: number;

  enableEntryConfirmation: boolean;
  entryReboundPct: number;
  entryMaxPullbackPct: number;
  entryConfirmMaxCandles: number;
  entryConfirmTimeoutMs: number;

  // Take profit fijo
  enableFixedTP: boolean;
  tpAtrMultiplier: number | null;

  // Entrada intravela (riesgoso — sin validar contra backtest)
  enableUnconfirmedEntry: boolean;
};

export function useBot() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lastSignal, setLastSignal] = useState<Signal | null>(null);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<BotConfig | null>(null);

  useEffect(() => {
    fetch(`${API}/bot-config`)
      .then((r) => r.json())
      .then((cfg: BotConfig) => {
        setConfig(cfg);
        fetch(`${API}/${getEndpoint(cfg.mode)}/summary`)
          .then((r) => r.json())
          .then(setSummary);
      });

    // 👈 nuevo: traer el último signal conocido, para no quedar en
    // blanco esperando el próximo tick del websocket tras un refresh
    // o un reinicio reciente del backend.
    fetch(`${API}/bot/last-signal`)
      .then((r) => r.json())
      .then((s) => {
        if (s && s.signal) setLastSignal(s);
      })
      .catch(() => {}); // si falla, simplemente esperamos el próximo evento del socket

    const socket: Socket = io(API);
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("signal", (s: Signal) => setLastSignal(s));
    socket.on("summary", (s: Summary) => setSummary(s));
    socket.on("trade:opened", async () => {
      const cfg = await fetch(`${API}/bot-config`).then((r) => r.json());
      const s = await fetch(`${API}/${getEndpoint(cfg.mode)}/summary`).then(
        (r) => r.json(),
      );
      setSummary(s);
    });
    socket.on("trade:closed", async () => {
      const cfg = await fetch(`${API}/bot-config`).then((r) => r.json());
      const s = await fetch(`${API}/${getEndpoint(cfg.mode)}/summary`).then(
        (r) => r.json(),
      );
      setSummary(s);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const updateConfig = async (data: Partial<BotConfig>) => {
    const res = await fetch(`${API}/bot-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    setConfig(updated);
    return updated;
  };

  const applyPreset = async (timeframe: string) => {
    const res = await fetch(`${API}/bot-config/preset/${timeframe}`, {
      method: "PATCH",
    });
    const updated = await res.json();
    setConfig(updated);
    return updated;
  };

  const closeActiveTrade = async () => {
    const endpoint = getEndpoint(config?.mode ?? "paper");
    const res = await fetch(`${API}/${endpoint}/close`, { method: "POST" });
    const data = await res.json();
    const s = await fetch(`${API}/${endpoint}/summary`).then((r) => r.json());
    setSummary(s);
    return data;
  };

  const getSnapshot = async () => {
    const res = await fetch(`${API}/bot/snapshot`);
    const data = await res.json();
    return data;
  };

  const getEndpoint = (mode: string) =>
    mode === "live" ? "live-trade" : "paper-trade";

  return {
    summary,
    lastSignal,
    connected,
    config,
    updateConfig,
    applyPreset,
    closeActiveTrade,
    getSnapshot,
  };
}
