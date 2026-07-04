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
  ClipboardCopy,
  BarChart2,
  Clock,
  Flag,
} from "lucide-react";
import BotController from "./BotController";
import BacktestPanel from "./BacktestPanel";
import { formatInTimeZone } from "date-fns-tz";

import { formatDuration, intervalToDuration } from "date-fns";

const SYMBOLS = [
  "XRPUSDT",
  "BTCUSDT",
  "ETHUSDT",
  "DOGEUSDT",
  "BNBUSDT",
  "SOLUSDT",
];

const TIMEFRAMES = ["3m", "5m", "15m", "30m"];

export default function Home() {
  const {
    summary,
    lastSignal,
    connected,
    config,
    updateConfig,
    applyPreset,
    closeActiveTrade,
    getSnapshot,
  } = useBot();
  const [tab, setTab] = useState<"dashboard" | "config" | "backtest">(
    "dashboard",
  );
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

  if (lastSignal && summary?.activeTrade) {
    const cp = lastSignal.price;
    const ep = summary.activeTrade.entryPrice;
    // notional real: margen × leverage, mismo criterio que backend
    // (BacktestService y PaperTradeService.closeTrade)
    const notional = (config?.positionSize ?? 100) * (config?.leverage ?? 1);

    const pc =
      summary.activeTrade.type === "LONG" ? (cp - ep) / ep : (ep - cp) / ep;
    unrealizedPnl = notional * pc;
  }

  function formatElapsed(openedAt: string | Date, closedAt: string | Date) {
    const duration = intervalToDuration({
      start: new Date(openedAt),
      end: new Date(closedAt),
    });

    const parts: string[] = [];
    if (duration.hours) parts.push(`${duration.hours}h`);
    if (duration.minutes) parts.push(`${duration.minutes}m`);
    if (!duration.hours && !duration.minutes) {
      parts.push(`${duration.seconds ?? 0}s`);
    }
    return parts.join(" ");
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur border-b border-gray-800/60 px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-bold tracking-tight shrink-0">
            CryptoBot
          </span>
          {config && (
            <div className="flex items-center gap-1 text-xs min-w-0 overflow-x-auto no-scrollbar">
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
              className={`p-2 sm:p-1.5 rounded-lg transition-colors ${
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

      {/* Nav tabs — scroll horizontal en mobile en vez de apretarse o
          desbordar; en desktop se ve igual que antes. */}
      <div className="sticky top-[49px] z-20 bg-[#0a0a0f]/95 backdrop-blur border-b border-gray-800/60 px-3 sm:px-6 overflow-x-auto no-scrollbar">
        <div className="flex gap-1 w-max sm:w-auto">
          {[
            { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
            { id: "config", icon: Settings, label: "Configuración" },
            { id: "backtest", icon: Play, label: "Backtest" },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id as any)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === id
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 sm:px-6 py-5 sm:py-6 max-w-5xl mx-auto space-y-4 sm:space-y-5">
        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <>
            {/* Signal card */}
            {lastSignal && (
              <div
                className={`rounded-xl border p-4 sm:p-5 transition-colors ${signalBg[lastSignal.signal]}`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
                      Última señal
                    </p>
                    <div className="flex items-center flex-wrap gap-2">
                      <span
                        className={`text-2xl sm:text-3xl font-bold ${signalTextColor[lastSignal.signal]}`}
                      >
                        {lastSignal.signal}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                          lastSignal.confirmed
                            ? "bg-emerald-900/50 text-emerald-400"
                            : "bg-amber-900/50 text-amber-400"
                        }`}
                      >
                        {lastSignal.confirmed ? "✓ Confirmada" : "⚡ En vivo"}
                      </span>
                    </div>
                    {lastSignal.reason && lastSignal.signal !== "HOLD" && (
                      <p className="text-xs text-gray-400 mt-1 break-words">
                        {lastSignal.reason}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">Precio</p>
                    <p className="text-lg sm:text-xl font-mono font-semibold">
                      ${lastSignal.price.toFixed(4)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-4 border-t border-gray-700/50 text-xs">
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
                    <div key={label} className="min-w-0">
                      <p className="text-gray-600 mb-0.5 truncate">{label}</p>
                      <p
                        className={`font-medium truncate ${color ?? "text-white"}`}
                      >
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
                    className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4 min-w-0"
                  >
                    <p className="text-xs text-gray-500 mb-1 truncate">
                      {label}
                    </p>
                    <p
                      className={`text-lg sm:text-xl font-bold truncate ${color}`}
                    >
                      {value}
                    </p>
                    {sub && (
                      <p className="text-xs text-gray-600 mt-0.5 truncate">
                        {sub}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Active trade */}
            {summary?.activeTrade && (
              <div className="bg-gray-900 border border-amber-500/30 rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
                    Trade activo
                  </p>
                  <button
                    onClick={async () => {
                      if (!closeActiveTrade) return;
                      const data = await closeActiveTrade();
                      alert(`Cerrado | PnL: $${data.pnl?.toFixed(2)}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 text-red-400 text-xs font-medium rounded-lg transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                    <span className="hidden xs:inline">Cerrar manualmente</span>
                    <span className="xs:hidden">Cerrar</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Tipo</p>
                    <p
                      className={`font-bold text-lg ${summary.activeTrade.type === "LONG" ? "text-emerald-400" : "text-red-400"}`}
                    >
                      {summary.activeTrade.type}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Entrada</p>
                    <p className="font-mono font-medium truncate">
                      ${summary.activeTrade.entryPrice.toFixed(4)}
                    </p>
                  </div>
                  {unrealizedPnl !== null && (
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">PnL actual</p>
                      <p
                        className={`font-bold text-lg truncate ${unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {unrealizedPnl >= 0 ? "+" : ""}
                        {unrealizedPnl.toFixed(2)} USDT
                      </p>
                    </div>
                  )}
                  {lastSignal && (
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">
                        Precio actual
                      </p>
                      <p className="font-mono font-medium truncate">
                        ${lastSignal.price.toFixed(4)}
                      </p>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">
                      {summary.activeTrade.trailingStop
                        ? "Stop protegido"
                        : "Stop inicial (SL)"}
                    </p>
                    <p
                      className={`font-mono truncate ${summary.activeTrade.trailingStop ? "text-emerald-400" : "text-red-400"}`}
                    >
                      $
                      {(
                        summary.activeTrade.trailingStop ??
                        summary.activeTrade.stopLoss
                      ).toFixed(4)}
                    </p>
                    {summary.activeTrade.trailingStop && (
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        SL original: ${summary.activeTrade.stopLoss.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-gray-600 border-t border-gray-800 pt-3">
                  Sin take profit fijo — la salida es dinámica. El trade se
                  cierra automáticamente si el precio toca el stop actual
                  (breakeven o trailing, lo que esté activo), dejando correr el
                  resto del movimiento.
                </p>
              </div>
            )}

            {/* Trade history */}
            {summary && summary.trades.filter((t) => t.result).length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">
                    Historial
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!getSnapshot) return;
                        const data = await getSnapshot();
                        navigator.clipboard.writeText(
                          JSON.stringify(data, null, 2),
                        );
                        alert("✅ Snapshot copiado al clipboard");
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 active:bg-purple-500/30 text-purple-400 text-xs font-medium rounded-lg transition-colors"
                      title="Copiar snapshot para análisis"
                    >
                      <ClipboardCopy className="w-3 h-3 shrink-0" /> Snapshot
                    </button>
                    <button
                      onClick={() => {
                        if (!summary) return;
                        const trades = summary.trades.filter((t) => t.result);
                        const byReason = trades.reduce(
                          (acc, t) => {
                            const key =
                              t.reason?.split("|")[0].trim() ?? "Desconocido";
                            if (!acc[key])
                              acc[key] = { wins: 0, losses: 0, pnl: 0 };
                            if (t.result === "WIN") acc[key].wins++;
                            else acc[key].losses++;
                            acc[key].pnl += t.pnl ?? 0;
                            return acc;
                          },
                          {} as Record<
                            string,
                            { wins: number; losses: number; pnl: number }
                          >,
                        );

                        const report = {
                          resumen: {
                            totalTrades: trades.length,
                            wins: trades.filter((t) => t.result === "WIN")
                              .length,
                            losses: trades.filter((t) => t.result === "LOSS")
                              .length,
                            winRate: summary.winRate,
                            pnlTotal: summary.totalPnl,
                            balance: summary.balance,
                          },
                          porSenal: Object.entries(byReason).map(
                            ([signal, data]) => ({
                              signal,
                              wins: data.wins,
                              losses: data.losses,
                              winRate: `${((data.wins / (data.wins + data.losses)) * 100).toFixed(0)}%`,
                              pnl: data.pnl.toFixed(2),
                            }),
                          ),
                          trades: trades.map((t) => ({
                            type: t.type,
                            entry: t.entryPrice.toFixed(4),
                            exit: t.exitPrice?.toFixed(4),
                            pnl: t.pnl?.toFixed(2),
                            result: t.result,
                            reason: t.reason,
                            peakFavorable: t.peakPrice?.toFixed(4),
                            peakAdverso: t.troughPrice?.toFixed(4),
                          })),
                        };

                        navigator.clipboard.writeText(
                          JSON.stringify(report, null, 2),
                        );
                        alert("✅ Datos copiados al clipboard");
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 text-blue-400 text-xs font-medium rounded-lg transition-colors"
                    >
                      <BarChart2 className="w-3 h-3 shrink-0" /> Copiar análisis
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  {summary.trades
                    .filter((t) => t.result)
                    .map((trade) => (
                      <div
                        key={trade.id}
                        className="py-2.5 border-b border-gray-800/50 last:border-0 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 min-w-0">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                                trade.type === "LONG"
                                  ? "bg-emerald-900/40 text-emerald-400"
                                  : "bg-red-900/40 text-red-400"
                              }`}
                            >
                              {trade.type}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-gray-400 text-xs shrink-0">
                              ${trade.entryPrice.toFixed(4)}
                              <ChevronRight className="w-3 h-3 text-gray-600" />
                              ${trade.exitPrice?.toFixed(4)}
                            </span>
                            {trade.reason && (
                              <span className="text-gray-600 text-xs hidden md:inline truncate max-w-32 lg:max-w-48 xl:max-w-64">
                                {trade.reason.split("|")[0].trim()}
                              </span>
                            )}
                          </div>
                          <span
                            className={`font-bold text-xs sm:text-sm shrink-0 whitespace-nowrap ${(trade.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {(trade.pnl ?? 0) >= 0 ? "+" : ""}
                            {trade.pnl?.toFixed(2)} USDT
                          </span>
                        </div>

                        {/* fechas en horario HN */}
                        {(trade.openedAt || trade.closedAt) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-600">
                            {trade.openedAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-400/70" />{" "}
                                {formatInTimeZone(
                                  new Date(trade.openedAt),
                                  "America/Tegucigalpa",
                                  "dd/MM HH:mm:ss",
                                )}
                              </span>
                            )}
                            {trade.closedAt && (
                              <span className="flex items-center gap-1">
                                <Flag
                                  className={`w-3 h-3 ${
                                    trade.result === "WIN"
                                      ? "text-emerald-500"
                                      : "text-red-500"
                                  }`}
                                />
                                {formatInTimeZone(
                                  new Date(trade.closedAt),
                                  "America/Tegucigalpa",
                                  "dd/MM HH:mm:ss",
                                )}
                                {trade.openedAt && (
                                  <span className="text-gray-600">
                                    (
                                    {formatElapsed(
                                      trade.openedAt,
                                      trade.closedAt,
                                    )}
                                    )
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        )}

                        {(trade.peakPrice || trade.troughPrice) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs">
                            {trade.peakPrice && (
                              <span className="text-emerald-700">
                                {trade.type === "LONG"
                                  ? "↑ máx favorable:"
                                  : "↓ mín favorable:"}{" "}
                                ${trade.peakPrice.toFixed(4)}
                              </span>
                            )}
                            {trade.troughPrice && (
                              <span className="text-red-700">
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
                </div>
              </div>
            )}
          </>
        )}

        {/* ── CONFIG ── */}
        {tab === "config" && config && (
          <BotController
            config={config}
            onSave={async (data) => {
              setSaving(true);
              await updateConfig(data);
              setSaving(false);
            }}
            activeTrade={!!summary?.activeTrade}
          />
        )}
        {tab === "backtest" && <BacktestPanel />}
      </div>
    </main>
  );
}
