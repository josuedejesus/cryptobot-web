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

export interface BotConfig {
  id: number;
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
  squeezeTreshold: number;
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
}

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
        // Cargar summary con el endpoint correcto según mode
        fetch(`${API}/${getEndpoint(cfg.mode)}/summary`)
          .then((r) => r.json())
          .then(setSummary);
      });

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

  // Helper dinámico
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
  };
}
