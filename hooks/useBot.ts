import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const API = "http://localhost:3001";

export interface Trade {
  id: number;
  type: "LONG" | "SHORT";
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  result?: "WIN" | "LOSS";
  pnl?: number;
  openedAt: string;
  closedAt?: string;
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
}

export function useBot() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [lastSignal, setLastSignal] = useState<Signal | null>(null);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<BotConfig | null>(null);

  useEffect(() => {
    fetch(`${API}/paper-trade/summary`)
      .then((r) => r.json())
      .then(setSummary);
    fetch(`${API}/bot-config`)
      .then((r) => r.json())
      .then(setConfig);

    const socket: Socket = io(API);
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("signal", (s: Signal) => setLastSignal(s));
    socket.on("summary", (s: Summary) => setSummary(s));

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

  return { summary, lastSignal, connected, config, updateConfig, applyPreset };
}
