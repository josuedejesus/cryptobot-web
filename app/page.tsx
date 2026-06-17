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
  BarChart2,
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
  const { summary, lastSignal, connected, config, updateConfig, applyPreset } =
    useBot();
  const [tab, setTab] = useState<"dashboard" | "config">("dashboard");
  const [saving, setSaving] = useState(false);

  const signalColor = {
    LONG: "text-green-400",
    SHORT: "text-red-400",
    HOLD: "text-gray-400",
  };

  const signalIcon = {
    LONG: <TrendingUp className="w-6 h-6 text-green-400" />,
    SHORT: <TrendingDown className="w-6 h-6 text-red-400" />,
    HOLD: <Minus className="w-6 h-6 text-gray-400" />,
  };

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

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">CryptoBot</h1>
          <div className="flex items-center gap-4">
            {/* Botón pausa */}
            {config && (
              <button
                onClick={() => handleConfigChange("isPaused", !config.isPaused)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  config.isPaused
                    ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-400"
                }`}
              >
                {config.isPaused ? "▶️ Reanudar" : "⏸️ Pausar"}
              </button>
            )}
            {connected ? (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <Wifi className="w-4 h-4" /> Conectado
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <WifiOff className="w-4 h-4" /> Desconectado
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "dashboard" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
          >
            <BarChart2 className="w-4 h-4" /> Dashboard
          </button>
          <button
            onClick={() => setTab("config")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "config" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
          >
            <Settings className="w-4 h-4" /> Configuración
          </button>
        </div>

        {/* Dashboard Tab */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            {/* Par y timeframe activo */}
            {config && (
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="bg-gray-800 px-3 py-1 rounded-full font-medium text-white">
                  {config.symbol}
                </span>
                <span className="bg-gray-800 px-3 py-1 rounded-full">
                  {config.timeframe}
                </span>
                <span className="bg-gray-800 px-3 py-1 rounded-full">
                  {config.mode === "paper" ? "📄 Paper Trading" : "💰 Real"}
                </span>
              </div>
            )}

            {/* Señal actual */}
            {lastSignal && (
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <p className="text-gray-400 text-sm mb-2">Última señal</p>
                <div className="flex items-center gap-3">
                  {signalIcon[lastSignal.signal]}
                  <span
                    className={`text-2xl font-bold ${signalColor[lastSignal.signal]}`}
                  >
                    {lastSignal.signal}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-gray-400 text-sm">
                      ${lastSignal.price.toLocaleString()}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${lastSignal.confirmed ? "bg-green-900 text-green-400" : "bg-yellow-900 text-yellow-400"}`}
                    >
                      {lastSignal.confirmed ? "✅ Confirmada" : "⚡ En vivo"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-4 text-sm">
                  <div>
                    <p className="text-gray-500">EMA {config?.emaFast}</p>
                    <p className="font-medium">{lastSignal.ema9.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">EMA {config?.emaSlow}</p>
                    <p className="font-medium">{lastSignal.ema21.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">RSI</p>
                    <p
                      className={`font-medium ${lastSignal.rsi > 70 ? "text-red-400" : lastSignal.rsi < 30 ? "text-green-400" : "text-white"}`}
                    >
                      {lastSignal.rsi.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">VWAP</p>
                    <p
                      className={`font-medium ${lastSignal.priceAboveVwap ? "text-green-400" : "text-red-400"}`}
                    >
                      {lastSignal.priceAboveVwap ? "⬆️ Sobre" : "⬇️ Bajo"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Volumen</p>
                    <p
                      className={`font-medium ${lastSignal.isHighVolume ? "text-green-400" : "text-gray-400"}`}
                    >
                      {lastSignal.isHighVolume ? "🟢 Alto" : "🔴 Bajo"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">BB Width</p>
                    <p
                      className={`font-medium ${lastSignal.bbSqueeze ? "text-yellow-400" : "text-white"}`}
                    >
                      {lastSignal.bbWidth?.toFixed(2)}%{" "}
                      {lastSignal.bbSqueeze ? "⚡" : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">
                      Tendencia {config?.trendTimeframe}
                    </p>
                    <p
                      className={`font-medium ${
                        lastSignal.trend === "BULLISH"
                          ? "text-green-400"
                          : lastSignal.trend === "BEARISH"
                            ? "text-red-400"
                            : "text-gray-400"
                      }`}
                    >
                      {lastSignal.trend === "BULLISH"
                        ? "⬆️ Alcista"
                        : lastSignal.trend === "BEARISH"
                          ? "⬇️ Bajista"
                          : "➡️ Neutral"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Resumen */}
            {summary && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <p className="text-gray-500 text-sm">Balance</p>
                    <p className="text-xl font-bold">
                      ${summary.balance.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <p className="text-gray-500 text-sm">PnL Total</p>
                    <p
                      className={`text-xl font-bold ${parseFloat(summary.totalPnl) >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      ${summary.totalPnl}
                    </p>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <p className="text-gray-500 text-sm">Win Rate</p>
                    <p className="text-xl font-bold">{summary.winRate}</p>
                  </div>
                  <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                    <p className="text-gray-500 text-sm">Trades</p>
                    <p className="text-xl font-bold">
                      {summary.totalTrades}{" "}
                      <span className="text-sm text-gray-500">
                        ({summary.wins}W / {summary.losses}L)
                      </span>
                    </p>
                  </div>
                </div>

               {/* Trade activo */}
{summary.activeTrade && (
  <div className="bg-gray-900 rounded-xl p-5 border border-yellow-800">
    <p className="text-yellow-400 text-sm font-medium mb-3">
      ⚡ Trade Activo
    </p>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <p className="text-gray-500">Tipo</p>
        <p className={`font-bold ${summary.activeTrade.type === "LONG" ? "text-green-400" : "text-red-400"}`}>
          {summary.activeTrade.type}
        </p>
      </div>
      <div>
        <p className="text-gray-500">Entrada</p>
        <p className="font-medium">
          ${summary.activeTrade.entryPrice.toFixed(4)}
        </p>
      </div>
      <div>
        <p className="text-gray-500">Stop Loss</p>
        <p className="font-medium text-red-400">
          ${summary.activeTrade.stopLoss.toFixed(4)}
        </p>
      </div>
      <div>
        <p className="text-gray-500">Take Profit</p>
        <p className="font-medium text-green-400">
          ${summary.activeTrade.takeProfit.toFixed(4)}
        </p>
      </div>

      {/* PnL actual */}
      {lastSignal && (() => {
        const currentPrice = lastSignal.price;
        const entryPrice   = summary.activeTrade.entryPrice;
        const positionSize = config?.positionSize ?? 100;

        const priceChange = summary.activeTrade.type === 'LONG'
          ? (currentPrice - entryPrice) / entryPrice
          : (entryPrice - currentPrice) / entryPrice;

        const unrealizedPnl = positionSize * priceChange;
        const isPositive    = unrealizedPnl >= 0;

        return (
          <>
            <div>
              <p className="text-gray-500">Precio actual</p>
              <p className="font-medium">${currentPrice.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-gray-500">PnL actual</p>
              <p className={`font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                {isPositive ? '+' : ''}{unrealizedPnl.toFixed(2)} USDT
              </p>
            </div>
            <div>
              <p className="text-gray-500">Progreso TP</p>
              <p className="font-medium text-gray-300">
                {Math.min(Math.abs(priceChange / (config?.takeProfitPercent ?? 0.01)) * 100, 100).toFixed(0)}%
              </p>
            </div>
          </>
        );
      })()}
    </div>
  </div>
)}

                {/* Historial */}
                {summary.trades.length > 0 && (
                  <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                    <p className="text-gray-400 text-sm mb-4">
                      Historial de trades
                    </p>
                    <div className="space-y-2">
                      {summary.trades
                        .filter((t) => t.result)
                        .map((trade) => (
                          <div
                            key={trade.id}
                            className="flex items-center justify-between text-sm py-2 border-b border-gray-800 last:border-0"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`font-bold ${trade.type === "LONG" ? "text-green-400" : "text-red-400"}`}
                              >
                                {trade.type}
                              </span>
                              <span className="text-gray-400">
                                ${trade.entryPrice.toFixed(4)}
                              </span>
                              <span className="text-gray-600">→</span>
                              <span className="text-gray-400">
                                ${trade.exitPrice?.toFixed(4)}
                              </span>
                            </div>
                            <span
                              className={`font-bold ${trade.result === "WIN" ? "text-green-400" : "text-red-400"}`}
                            >
                              {trade.pnl && trade.pnl >= 0 ? "+" : ""}
                              {trade.pnl?.toFixed(2)} USDT
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Config Tab */}
        {tab === "config" && config && (
          <div className="space-y-6">
            {saving && (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg px-4 py-2 text-yellow-400 text-sm">
                Guardando... recuerda reiniciar el bot para aplicar cambios de
                símbolo o timeframe.
              </div>
            )}

            {/* Symbol */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-sm mb-3 font-medium">
                Par de trading
              </p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {SYMBOLS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSymbolChange(s)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${config.symbol === s ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                  >
                    {s.replace("USDT", "")}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-sm mb-3 font-medium">
                Timeframe
              </p>
              <div className="flex gap-2">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => handleTimeframeChange(tf)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${config.timeframe === tf ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <p className="text-gray-600 text-xs mt-2">
                Al cambiar el timeframe se aplica el preset automáticamente.
              </p>
            </div>

            {/* Risk */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-sm mb-4 font-medium">
                Gestión de riesgo
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-gray-500 text-xs">
                    Position Size (USDT)
                  </label>
                  <input
                    type="number"
                    value={config.positionSize}
                    onChange={(e) =>
                      handleConfigChange(
                        "positionSize",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">Stop Loss %</label>
                  <input
                    type="number"
                    step="0.001"
                    value={config.stopLossPercent}
                    onChange={(e) =>
                      handleConfigChange(
                        "stopLossPercent",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">Take Profit %</label>
                  <input
                    type="number"
                    step="0.001"
                    value={config.takeProfitPercent}
                    onChange={(e) =>
                      handleConfigChange(
                        "takeProfitPercent",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Indicadores */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-sm mb-4 font-medium">
                Indicadores
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-gray-500 text-xs">EMA Rápida</label>
                  <input
                    type="number"
                    value={config.emaFast}
                    onChange={(e) =>
                      handleConfigChange("emaFast", parseInt(e.target.value))
                    }
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">EMA Lenta</label>
                  <input
                    type="number"
                    value={config.emaSlow}
                    onChange={(e) =>
                      handleConfigChange("emaSlow", parseInt(e.target.value))
                    }
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">RSI Período</label>
                  <input
                    type="number"
                    value={config.rsiPeriod}
                    onChange={(e) =>
                      handleConfigChange("rsiPeriod", parseInt(e.target.value))
                    }
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">RSI Min</label>
                  <input
                    type="number"
                    value={config.rsiMin}
                    onChange={(e) =>
                      handleConfigChange("rsiMin", parseFloat(e.target.value))
                    }
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">RSI Max</label>
                  <input
                    type="number"
                    value={config.rsiMax}
                    onChange={(e) =>
                      handleConfigChange("rsiMax", parseFloat(e.target.value))
                    }
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">
                    Max Trades/día
                  </label>
                  <input
                    type="number"
                    value={config.maxTradesPerDay}
                    onChange={(e) =>
                      handleConfigChange(
                        "maxTradesPerDay",
                        parseInt(e.target.value),
                      )
                    }
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs">
                    Min Band Width %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.minBandWidth}
                    onChange={(e) =>
                      handleConfigChange(
                        "minBandWidth",
                        parseFloat(e.target.value),
                      )
                    }
                    className="w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-sm mb-4 font-medium">Opciones</p>
              <div className="space-y-3">
                {[
                  {
                    key: "vwapStrict",
                    label: "VWAP estricto",
                    desc: "Solo opera en la dirección del VWAP",
                  },
                  {
                    key: "onlyLong",
                    label: "Solo LONG",
                    desc: "Ignora señales SHORT",
                  },
                  {
                    key: "onlyShort",
                    label: "Solo SHORT",
                    desc: "Ignora señales LONG",
                  },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-gray-500 text-xs">{desc}</p>
                    </div>
                    <button
                      onClick={() =>
                        handleConfigChange(
                          key,
                          !config[key as keyof typeof config],
                        )
                      }
                      className={`w-12 h-6 rounded-full transition-colors ${config[key as keyof typeof config] ? "bg-green-600" : "bg-gray-700"}`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 ${config[key as keyof typeof config] ? "translate-x-6" : "translate-x-0"}`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
