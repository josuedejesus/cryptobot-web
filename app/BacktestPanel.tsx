"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  Play,
  TrendingUp,
  TrendingDown,
  Target,
  Percent,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface BacktestTrade {
  signal: "LONG" | "SHORT";
  reason: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  result: "WIN" | "LOSS";
  candlesHeld: number;
  maxFavorablePnl: number;
  maxAdversePnl: number;
}

interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: string;
  totalPnl: number;
  avgPnl: number;
  avgMaxAdverse: number;
  avgMaxFavorable: number;
  bySignal: Record<
    string,
    { wins: number; losses: number; winRate: string; pnl: number; avgMaxAdverse: number }
  >;
  trades: BacktestTrade[];
}

const DAY_OPTIONS = [1, 3, 7, 14, 30];

export default function BacktestPanel() {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllTrades, setShowAllTrades] = useState(false);

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/backtest?days=${days}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BacktestResult = await res.json();
      setResult(data);
    } catch (e) {
      setError("No se pudo correr el backtest. ¿Está el backend levantado?");
    } finally {
      setLoading(false);
    }
  };

  // Equity curve: PnL acumulado trade a trade
  const equityCurve = result
    ? result.trades.reduce<{ i: number; equity: number }[]>((acc, t, idx) => {
        const prev = acc[idx - 1]?.equity ?? 0;
        acc.push({ i: idx + 1, equity: parseFloat((prev + t.pnl).toFixed(2)) });
        return acc;
      }, [])
    : [];

  const bySignalData = result
    ? Object.entries(result.bySignal)
        .map(([name, s]) => ({
          name,
          pnl: s.pnl,
          wins: s.wins,
          losses: s.losses,
          winRate: s.winRate,
        }))
        .sort((a, b) => b.pnl - a.pnl)
    : [];

  const isPositive = (result?.totalPnl ?? 0) >= 0;
  const visibleTrades = showAllTrades ? result?.trades : result?.trades.slice(0, 15);

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header + controles */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-sm text-white">Backtest</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Corré la estrategia contra histórico y mirá el resultado
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-800 rounded-lg p-1">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    days === d
                      ? "bg-emerald-600 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <button
              onClick={runBacktest}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              <Play className="w-3.5 h-3.5" />
              {loading ? "Corriendo..." : "Correr backtest"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-emerald-500 rounded-full animate-spin" />
            Procesando {days} día{days > 1 ? "s" : ""} de histórico...
          </div>
        </div>
      )}

      {result && (
        <>
          {/* Stats principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={isPositive ? TrendingUp : TrendingDown}
              iconColor={isPositive ? "text-emerald-400" : "text-red-400"}
              label="PnL total"
              value={`${isPositive ? "+" : ""}$${result.totalPnl}`}
              valueColor={isPositive ? "text-emerald-400" : "text-red-400"}
              sub={`avg $${result.avgPnl} / trade`}
            />
            <StatCard
              icon={Percent}
              iconColor="text-blue-400"
              label="Win rate"
              value={result.winRate}
              sub={`${result.wins}W / ${result.losses}L`}
            />
            <StatCard
              icon={Target}
              iconColor="text-purple-400"
              label="Trades"
              value={`${result.totalTrades}`}
              sub={`en ${days} día${days > 1 ? "s" : ""}`}
            />
            <StatCard
              icon={TrendingDown}
              iconColor="text-amber-400"
              label="Adverso prom."
              value={`${(result.avgMaxAdverse * 100).toFixed(2)}%`}
              sub="excursión máx. en contra"
            />
          </div>

          {/* Equity curve */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
              Curva de equity
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={equityCurve} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={isPositive ? "#10b981" : "#ef4444"}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={isPositive ? "#10b981" : "#ef4444"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="i"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={{ stroke: "#374151" }}
                  tickLine={false}
                  label={{ value: "Trade #", position: "insideBottom", offset: -2, fill: "#6b7280", fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <ReferenceLine y={0} stroke="#374151" />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                  formatter={(v) => [`$${v}`, "Equity"]}
                  labelFormatter={(l) => `Trade #${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke={isPositive ? "#10b981" : "#ef4444"}
                  strokeWidth={2}
                  fill="url(#equityFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* PnL por tipo de señal */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
              PnL por señal
            </p>
            <ResponsiveContainer width="100%" height={Math.max(180, bySignalData.length * 40)}>
              <BarChart
                data={bySignalData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #1f2937",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#e5e7eb" }}
                  formatter={(v, _name, entry) => [
                    `$${v} (${(entry.payload as any).wins}W / ${(entry.payload as any).losses}L, ${(entry.payload as any).winRate})`,
                    "PnL",
                  ]}
                />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                  {bySignalData.map((d, idx) => (
                    <Cell key={idx} fill={d.pnl >= 0 ? "#10b981" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla de trades */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest">
                Trades ({result.trades.length})
              </p>
              {result.trades.length > 15 && (
                <button
                  onClick={() => setShowAllTrades((v) => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors"
                >
                  {showAllTrades ? "Ver menos" : "Ver todos"}
                  {showAllTrades ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
              {visibleTrades?.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${
                        t.signal === "LONG"
                          ? "bg-emerald-900/40 text-emerald-400"
                          : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {t.signal}
                    </span>
                    <span className="text-gray-600 text-xs truncate hidden sm:inline">
                      {t.reason.split("|")[0].trim()}
                    </span>
                    <span className="text-gray-500 text-xs shrink-0">
                      {t.candlesHeld} velas
                    </span>
                  </div>
                  <span
                    className={`font-bold shrink-0 ${
                      t.pnl > 0
                        ? "text-emerald-400"
                        : t.pnl < 0
                          ? "text-red-400"
                          : "text-gray-500"
                    }`}
                  >
                    {t.pnl > 0 ? "+" : ""}
                    {t.pnl.toFixed(2)} USDT
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!result && !loading && !error && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">
            Elegí un rango de días y corré el backtest para ver resultados
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  valueColor,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  value: string;
  valueColor?: string;
  sub?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={`text-xl font-bold ${valueColor ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}