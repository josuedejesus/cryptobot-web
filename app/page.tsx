"use client";

import { useState } from "react";
import { useBot } from "@/hooks/useBot";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Wifi,
  WifiOff,
  Settings,
  LayoutDashboard,
  Pause,
  Play,
  X,
  ChevronRight,
} from "lucide-react";

const SYMBOLS = [
  "XRPUSDT",
  "BTCUSDT",
  "ETHUSDT",
  "DOGEUSDT",
  "BNBUSDT",
  "SOLUSDT",
];
const TIMEFRAMES = ["3m", "5m", "15m"];

export default function Home() {
  const {
    summary,
    lastSignal,
    connected,
    config,
    updateConfig,
    applyPreset,
    closeActiveTrade,
  } = useBot();
  const [tab, setTab] = useState<"dashboard" | "config">("dashboard");
  const [saving, setSaving] = useState(false);

  const handleSymbolChange = async (symbol: string) => {
    setSaving(true);
    await updateConfig({ symbol });
    setSaving(false);
  };

  const handleTimeframeChange = async (timeframe: string) => {
    setSaving(true);
    await applyPreset(timeframe);
    setSaving(false);
  };

  const handleConfigChange = async (key: string, value: any) => {
    setSaving(true);
    await updateConfig({ [key]: value });
    setSaving(false);
  };

  const signalBg = {
    LONG: "border-emerald-500/30 bg-emerald-500/5",
    SHORT: "border-red-500/30 bg-red-500/5",
    HOLD: "border-gray-700 bg-gray-900",
  };

  const signalTextColor = {
    LONG: "text-emerald-400",
    SHORT: "text-red-400",
    HOLD: "text-gray-500",
  };

  const trendColor = (t: string) =>
    t === "BULLISH"
      ? "text-emerald-400"
      : t === "BEARISH"
        ? "text-red-400"
        : "text-gray-500";

  const trendLabel = (t: string) =>
    t === "BULLISH" ? "↑ Alcista" : t === "BEARISH" ? "↓ Bajista" : "→ Neutral";

  // Compute unrealized PnL
  let unrealizedPnl: number | null = null;
  let progressPct = 0;
  if (lastSignal && summary?.activeTrade) {
    const cp = lastSignal.price;
    const ep = summary.activeTrade.entryPrice;
    const ps = config?.positionSize ?? 100;
    const pc =
      summary.activeTrade.type === "LONG" ? (cp - ep) / ep : (ep - cp) / ep;
    unrealizedPnl = ps * pc;
    progressPct = Math.min(
      Math.abs(pc / (config?.takeProfitPercent ?? 0.01)) * 100,
      100,
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Top bar */}
      <header className="border-b border-gray-800/60 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-bold tracking-tight shrink-0">
            CryptoBot
          </span>
          {config && (
            <div className="flex items-center gap-1 text-xs min-w-0">
              <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-mono shrink-0">
                {config.symbol.replace("USDT", "")}
              </span>
              <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-mono shrink-0">
                {config.timeframe}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${config.mode === "paper" ? "bg-blue-900/40 text-blue-400" : "bg-emerald-900/40 text-emerald-400"}`}
              >
                {config.mode === "paper" ? "Paper" : "Real"}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {config && (
            <button
              onClick={() => handleConfigChange("isPaused", !config.isPaused)}
              className={`p-1.5 rounded-lg transition-colors ${
                config.isPaused
                  ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
              title={config.isPaused ? "Reanudar" : "Pausar"}
            >
              {config.isPaused ? (
                <Play className="w-4 h-4" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>
          )}
          <div
            className={`flex items-center gap-1 text-xs ${connected ? "text-emerald-400" : "text-red-400"}`}
          >
            {connected ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {connected ? "En vivo" : "Sin conexión"}
            </span>
          </div>
        </div>
      </header>

      {/* Nav tabs */}
      <div className="border-b border-gray-800/60 px-6">
        <div className="flex gap-1">
          {[
            { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
            { id: "config", icon: Settings, label: "Configuración" },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 max-w-5xl mx-auto space-y-5">
        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <>
            {/* Signal card */}
            {lastSignal && (
              <div
                className={`rounded-xl border p-5 transition-colors ${signalBg[lastSignal.signal]}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
                      Última señal
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-3xl font-bold ${signalTextColor[lastSignal.signal]}`}
                      >
                        {lastSignal.signal}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          lastSignal.confirmed
                            ? "bg-emerald-900/50 text-emerald-400"
                            : "bg-amber-900/50 text-amber-400"
                        }`}
                      >
                        {lastSignal.confirmed ? "✓ Confirmada" : "⚡ En vivo"}
                      </span>
                    </div>
                    {lastSignal.reason && lastSignal.signal !== "HOLD" && (
                      <p className="text-xs text-gray-400 mt-1">
                        {lastSignal.reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Precio</p>
                    <p className="text-xl font-mono font-semibold">
                      ${lastSignal.price.toFixed(4)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 md:grid-cols-7 gap-3 pt-4 border-t border-gray-700/50 text-xs">
                  {[
                    {
                      label: `EMA ${config?.emaFast ?? 9}`,
                      value: lastSignal.ema9.toFixed(4),
                    },
                    {
                      label: `EMA ${config?.emaSlow ?? 21}`,
                      value: lastSignal.ema21.toFixed(4),
                    },
                    {
                      label: "RSI",
                      value: lastSignal.rsi.toFixed(1),
                      color:
                        lastSignal.rsi > 70
                          ? "text-red-400"
                          : lastSignal.rsi < 30
                            ? "text-emerald-400"
                            : "text-white",
                    },
                    {
                      label: "VWAP",
                      value: lastSignal.priceAboveVwap ? "↑ Sobre" : "↓ Bajo",
                      color: lastSignal.priceAboveVwap
                        ? "text-emerald-400"
                        : "text-red-400",
                    },
                    {
                      label: "Volumen",
                      value: lastSignal.isHighVolume ? "Alto" : "Bajo",
                      color: lastSignal.isHighVolume
                        ? "text-emerald-400"
                        : "text-gray-500",
                    },
                    {
                      label: "BB Width",
                      value: `${lastSignal.bbWidth?.toFixed(2)}%`,
                      color: lastSignal.bbSqueeze
                        ? "text-amber-400"
                        : "text-white",
                    },
                    {
                      label: `Tendencia ${config?.trendTimeframe ?? "1h"}`,
                      value: trendLabel(lastSignal.trend),
                      color: trendColor(lastSignal.trend),
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <p className="text-gray-600 mb-0.5">{label}</p>
                      <p className={`font-medium ${color ?? "text-white"}`}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats row */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {
                    label: "Balance",
                    value: `$${summary.balance.toFixed(2)}`,
                    color: "text-white",
                  },
                  {
                    label: "PnL Total",
                    value: `${parseFloat(summary.totalPnl) >= 0 ? "+" : ""}$${summary.totalPnl}`,
                    color:
                      parseFloat(summary.totalPnl) >= 0
                        ? "text-emerald-400"
                        : "text-red-400",
                  },
                  {
                    label: "Win Rate",
                    value: summary.winRate,
                    color: "text-white",
                  },
                  {
                    label: "Trades",
                    value: `${summary.totalTrades}`,
                    sub: `${summary.wins}W / ${summary.losses}L`,
                    color: "text-white",
                  },
                ].map(({ label, value, sub, color }) => (
                  <div
                    key={label}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                  >
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                    {sub && (
                      <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Active trade */}
            {summary?.activeTrade && (
              <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
                    Trade activo
                  </p>
                  <button
                    onClick={async () => {
                      if (!closeActiveTrade) return;
                      const data = await closeActiveTrade();
                      alert(`Cerrado | PnL: $${data.pnl?.toFixed(2)}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors"
                  >
                    <X className="w-3 h-3" /> Cerrar manualmente
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Tipo</p>
                    <p
                      className={`font-bold text-lg ${summary.activeTrade.type === "LONG" ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {summary.activeTrade.type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Entrada</p>
                    <p className="font-mono font-medium">
                      ${summary.activeTrade.entryPrice.toFixed(4)}
                    </p>
                  </div>
                  {unrealizedPnl !== null && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">PnL actual</p>
                      <p
                        className={`font-bold text-lg ${unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {unrealizedPnl >= 0 ? "+" : ""}
                        {unrealizedPnl.toFixed(2)} USDT
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Stop Loss</p>
                    <p className="font-mono text-red-400">
                      ${summary.activeTrade.stopLoss.toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Take Profit</p>
                    <p className="font-mono text-emerald-400">
                      ${summary.activeTrade.takeProfit.toFixed(4)}
                    </p>
                  </div>
                  {lastSignal && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">
                        Precio actual
                      </p>
                      <p className="font-mono font-medium">
                        ${lastSignal.price.toFixed(4)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progreso al TP</span>
                    <span>{progressPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${unrealizedPnl && unrealizedPnl >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Trade history */}
            {summary &&
              summary.trades
                .filter((t) => t.result)
                .map((trade) => (
                  <div
                    key={trade.id}
                    className="py-2.5 border-b border-gray-800/50 last:border-0 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            trade.type === "LONG"
                              ? "bg-emerald-900/40 text-emerald-400"
                              : "bg-red-900/40 text-red-400"
                          }`}
                        >
                          {trade.type}
                        </span>
                        <span className="font-mono text-gray-400 text-xs">
                          ${trade.entryPrice.toFixed(4)}
                        </span>
                        <ChevronRight className="w-3 h-3 text-gray-600" />
                        <span className="font-mono text-gray-400 text-xs">
                          ${trade.exitPrice?.toFixed(4)}
                        </span>
                      </div>
                      <span
                        className={`font-bold ${trade.result === "WIN" ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {trade.pnl && trade.pnl >= 0 ? "+" : ""}
                        {trade.pnl?.toFixed(2)} USDT
                      </span>
                    </div>
                    {/* Picos */}
                    {(trade.peakPrice || trade.troughPrice) && (
                      <div className="flex gap-4 mt-1 text-xs">
                        {trade.peakPrice && (
                          <span
                            className={
                              trade.type === "LONG"
                                ? "text-emerald-700"
                                : "text-red-700"
                            }
                          >
                            {trade.type === "LONG"
                              ? "↑ máx favorable:"
                              : "↓ mín favorable:"}{" "}
                            ${trade.peakPrice.toFixed(4)}
                          </span>
                        )}
                        {trade.troughPrice && (
                          <span
                            className={
                              trade.type === "LONG"
                                ? "text-red-700"
                                : "text-emerald-700"
                            }
                          >
                            {trade.type === "LONG"
                              ? "↓ mín adverso:"
                              : "↑ máx adverso:"}{" "}
                            ${trade.troughPrice.toFixed(4)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
          </>
        )}

        {/* ── CONFIG ── */}
        {tab === "config" && config && (
          <>
            {/* Bloqueo si hay trade activo */}
            {summary?.activeTrade && (
              <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 flex items-center gap-3">
                <X className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <p className="text-red-400 text-sm font-medium">
                    Trade activo en curso
                  </p>
                  <p className="text-gray-500 text-xs">
                    Cerrá el trade antes de modificar la configuración.
                  </p>
                </div>
              </div>
            )}
            {saving && (
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-2 text-amber-400 text-xs">
                Guardado. Reiniciá el bot para aplicar cambios de símbolo o
                timeframe.
              </div>
            )}
            <div
              className={
                summary?.activeTrade
                  ? "opacity-40 pointer-events-none select-none"
                  : ""
              }
            >
              {/* Symbol */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                  Par de trading
                </p>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {SYMBOLS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSymbolChange(s)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        config.symbol === s
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                      }`}
                    >
                      {s.replace("USDT", "")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                  Timeframe
                </p>
                <div className="flex gap-2">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleTimeframeChange(tf)}
                      className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                        config.timeframe === tf
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <p className="text-gray-600 text-xs mt-2">
                  Cambiar el timeframe aplica el preset automáticamente.
                </p>
              </div>

              {/* Risk */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
                  Gestión de riesgo
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      label: "Position Size (USDT)",
                      key: "positionSize",
                      type: "float",
                    },
                    {
                      label: "Stop Loss %",
                      key: "stopLossPercent",
                      type: "float",
                      step: 0.001,
                    },
                    {
                      label: "Take Profit %",
                      key: "takeProfitPercent",
                      type: "float",
                      step: 0.001,
                    },
                  ].map(({ label, key, type, step }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 block mb-1">
                        {label}
                      </label>
                      <input
                        type="number"
                        step={step}
                        value={(config as any)[key]}
                        onChange={(e) =>
                          handleConfigChange(
                            key,
                            type === "float"
                              ? parseFloat(e.target.value)
                              : parseInt(e.target.value),
                          )
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Indicators */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
                  Indicadores
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "EMA Rápida", key: "emaFast", type: "int" },
                    { label: "EMA Lenta", key: "emaSlow", type: "int" },
                    { label: "RSI Período", key: "rsiPeriod", type: "int" },
                    { label: "RSI Mín", key: "rsiMin", type: "float" },
                    { label: "RSI Máx", key: "rsiMax", type: "float" },
                    {
                      label: "Max Trades/día",
                      key: "maxTradesPerDay",
                      type: "int",
                    },
                    {
                      label: "Min Band Width %",
                      key: "minBandWidth",
                      type: "float",
                      step: 0.1,
                    },
                  ].map(({ label, key, type, step }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 block mb-1">
                        {label}
                      </label>
                      <input
                        type="number"
                        step={step}
                        value={(config as any)[key]}
                        onChange={(e) =>
                          handleConfigChange(
                            key,
                            type === "float"
                              ? parseFloat(e.target.value)
                              : parseInt(e.target.value),
                          )
                        }
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-600"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
                  Opciones
                </p>
                <div className="space-y-4">
                  {[
                    {
                      key: "vwapStrict",
                      label: "VWAP estricto",
                      desc: "Solo opera en la dirección del VWAP del día",
                    },
                    {
                      key: "onlyLong",
                      label: "Solo LONG",
                      desc: "Ignora todas las señales SHORT",
                    },
                    {
                      key: "onlyShort",
                      label: "Solo SHORT",
                      desc: "Ignora todas las señales LONG",
                    },
                  ].map(({ key, label, desc }) => {
                    const val = (config as any)[key] as boolean;
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-gray-500">{desc}</p>
                        </div>
                        <button
                          onClick={() => handleConfigChange(key, !val)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${val ? "bg-emerald-600" : "bg-gray-700"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${val ? "translate-x-5" : "translate-x-0"}`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
