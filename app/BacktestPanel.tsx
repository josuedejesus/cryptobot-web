"use client";

import { useEffect, useState } from "react";
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
  Save,
  Check,
  Trash2,
  Pencil,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface SavedConfig {
  id: number;
  name: string;
  isActive: boolean;
  symbol: string;
  timeframe: string;
}

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
  configId: number;
  configName: string;
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
    {
      wins: number;
      losses: number;
      winRate: string;
      pnl: number;
      avgMaxAdverse: number;
    }
  >;
  trades: BacktestTrade[];
}

interface OptimizerCombo {
  tpAtrMultiplier: number;
  slAtrMultiplier: number;
  totalPnl: number;
  avgPnl: number;
  winRate: string;
  totalTrades: number;
  wins: number;
  losses: number;
  riskRewardRatio: number;
}

interface OptimizerResult {
  configId: number;
  configName: string;
  days: number;
  baseline: OptimizerCombo;
  combos: OptimizerCombo[];
}

const DAY_OPTIONS = [1, 3, 7, 14, 30];

export default function BacktestPanel() {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllTrades, setShowAllTrades] = useState(false);

  // Presets guardados
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null); // null = modal cerrado
  const [presetActionLoading, setPresetActionLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const loadConfigs = async () => {
    try {
      const res = await fetch(`${API}/bot-config/saved-configs`);
      const data: SavedConfig[] = await res.json();
      setConfigs(data);
      // Por defecto, seleccionar la config activa
      const active = data.find((c) => c.isActive);
      if (active && selectedConfigId === null) setSelectedConfigId(active.id);
    } catch {
      // silencioso: si falla, el usuario igual puede correr contra la activa
    }
  };

  useEffect(() => {
    loadConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveCurrentAsPreset = async () => {
    if (!savingName?.trim()) return;
    setPresetActionLoading(true);
    try {
      await fetch(`${API}/bot-config/saved-configs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: savingName.trim() }),
      });
      setSavingName(null);
      await loadConfigs();
    } finally {
      setPresetActionLoading(false);
    }
  };

  const activatePreset = async (id: number) => {
    setPresetActionLoading(true);
    try {
      await fetch(`${API}/bot-config/saved-configs/${id}/activate`, {
        method: "PATCH",
      });
      await loadConfigs();
    } finally {
      setPresetActionLoading(false);
    }
  };

  const deletePreset = async (id: number) => {
    setPresetActionLoading(true);
    try {
      await fetch(`${API}/bot-config/saved-configs/${id}`, {
        method: "DELETE",
      });
      if (selectedConfigId === id) setSelectedConfigId(null);
      await loadConfigs();
    } finally {
      setPresetActionLoading(false);
    }
  };

  const renamePreset = async (id: number) => {
    if (!renameValue.trim()) return;
    setPresetActionLoading(true);
    try {
      await fetch(`${API}/bot-config/saved-configs/${id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      setRenamingId(null);
      await loadConfigs();
    } finally {
      setPresetActionLoading(false);
    }
  };

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ days: String(days) });
      if (selectedConfigId) qs.set("configId", String(selectedConfigId));
      const res = await fetch(`${API}/backtest?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: BacktestResult = await res.json();
      setResult(data);
    } catch (e) {
      setError("No se pudo correr el backtest. ¿Está el backend levantado?");
    } finally {
      setLoading(false);
    }
  };

  // Optimizador TP/SL
  const [optimizing, setOptimizing] = useState(false);
  const [optimizerResult, setOptimizerResult] =
    useState<OptimizerResult | null>(null);
  const [optimizerError, setOptimizerError] = useState<string | null>(null);

  const runOptimizer = async () => {
    setOptimizing(true);
    setOptimizerError(null);
    try {
      const qs = new URLSearchParams({ days: String(days) });
      if (selectedConfigId) qs.set("configId", String(selectedConfigId));
      const res = await fetch(`${API}/optimizer/tp-sl?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OptimizerResult = await res.json();
      setOptimizerResult(data);
    } catch (e) {
      setOptimizerError("No se pudo correr el optimizador.");
    } finally {
      setOptimizing(false);
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
  const visibleTrades = showAllTrades
    ? result?.trades
    : result?.trades.slice(0, 15);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Presets guardados */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest">
            Configuraciones guardadas
          </p>
          <button
            onClick={() => setSavingName("")}
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors shrink-0"
          >
            <Save className="w-3 h-3" />
            <span className="hidden sm:inline">Guardar config actual</span>
            <span className="sm:hidden">Guardar</span>
          </button>
        </div>

        {savingName !== null && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3 bg-gray-800 rounded-lg p-2">
            <input
              autoFocus
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveCurrentAsPreset()}
              placeholder="Nombre del preset, ej. 'SL activo v1'"
              className="flex-1 min-w-0 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 sm:py-1.5 text-base sm:text-sm text-white focus:outline-none focus:border-emerald-600"
            />
            <div className="flex gap-2">
              <button
                onClick={saveCurrentAsPreset}
                disabled={presetActionLoading || !savingName.trim()}
                className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md disabled:opacity-50"
              >
                Guardar
              </button>
              <button
                onClick={() => setSavingName(null)}
                className="flex-1 sm:flex-none px-3 py-1.5 text-gray-500 hover:text-white text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {configs.length === 0 ? (
          <p className="text-xs text-gray-600">
            Todavía no guardaste ninguna configuración.
          </p>
        ) : (
          <div className="space-y-1">
            {configs.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedConfigId(c.id)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedConfigId === c.id
                    ? "bg-emerald-600/10 border border-emerald-700/40"
                    : "bg-gray-800/50 border border-transparent hover:bg-gray-800"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${
                      selectedConfigId === c.id
                        ? "border-emerald-500 bg-emerald-500/20"
                        : "border-gray-600"
                    }`}
                  >
                    {selectedConfigId === c.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </div>
                  {renamingId === c.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && renamePreset(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => renamePreset(c.id)}
                      className="min-w-0 bg-gray-900 border border-gray-700 rounded px-2 py-0.5 text-base sm:text-sm text-white focus:outline-none focus:border-emerald-600"
                    />
                  ) : (
                    <span className="text-sm text-white truncate">
                      {c.name}
                    </span>
                  )}
                  {c.isActive && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 shrink-0">
                      <Check className="w-2.5 h-2.5" /> Activa
                    </span>
                  )}
                  <span className="text-xs text-gray-600 shrink-0 hidden sm:inline">
                    {c.symbol.replace("USDT", "")} · {c.timeframe}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!c.isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        activatePreset(c.id);
                      }}
                      disabled={presetActionLoading}
                      className="text-xs text-gray-500 hover:text-emerald-400 transition-colors px-2 py-1"
                      title="Activar (el bot va a usar esta config)"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(c.id);
                      setRenameValue(c.name);
                    }}
                    className="text-gray-600 hover:text-white transition-colors p-1.5"
                    title="Renombrar"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  {!c.isActive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePreset(c.id);
                      }}
                      disabled={presetActionLoading}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1.5"
                      title="Borrar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Header + controles */}
      {/* En mobile: título arriba, selector de días en su propia fila
          (scroll horizontal si hace falta), y los 2 botones de acción
          apilados a ancho completo — nada se corta ni se superpone. */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
        <div>
          <h2 className="font-semibold text-sm text-white">Backtest</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Corré la estrategia contra histórico y mirá el resultado
          </p>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex bg-gray-800 rounded-lg p-1 overflow-x-auto no-scrollbar">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  days === d
                    ? "bg-emerald-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto">
            <button
              onClick={runBacktest}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              <Play className="w-3.5 h-3.5 shrink-0" />
              {loading ? "Corriendo..." : "Correr backtest"}
            </button>
            <button
              onClick={runOptimizer}
              disabled={optimizing}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
              title="Grid search de tpAtrMultiplier / slAtrMultiplier sobre esta config"
            >
              <Target className="w-3.5 h-3.5 shrink-0" />
              {optimizing ? "Optimizando..." : "Optimizar TP/SL"}
            </button>
          </div>
        </div>
      </div>

      {optimizerError && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 text-red-400 text-sm">
          {optimizerError}
        </div>
      )}

      {optimizerResult && (
        <div className="bg-gray-900 border border-purple-800/40 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs text-purple-400 uppercase tracking-widest truncate">
              Optimizador TP/SL — {optimizerResult.configName}
            </p>
            <span className="text-[11px] text-gray-600 shrink-0">
              {optimizerResult.days}d
            </span>
          </div>
          <p className="text-[11px] text-gray-600 mb-4">
            Grid search sobre los mismos{" "}
            {optimizerResult.combos[0]?.totalTrades ?? 0} trades base. Confirmá
            el ganador con datos nuevos antes de activarlo en vivo — puede estar
            sobreajustado a este período.
          </p>

          {/* -mx-4/px-4 en mobile: el scroll horizontal de la tabla llega
              hasta el borde de la tarjeta en vez de quedar recortado por
              el padding del contenedor. */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="pb-2 pr-3">TP × ATR</th>
                  <th className="pb-2 pr-3">SL × ATR</th>
                  <th className="pb-2 pr-3">PnL</th>
                  <th className="pb-2 pr-3">Win rate</th>
                  <th className="pb-2 pr-3">W/L</th>
                  <th className="pb-2">R:R</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800 bg-gray-800/40">
                  <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                    {optimizerResult.baseline.tpAtrMultiplier}x
                  </td>
                  <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                    {optimizerResult.baseline.slAtrMultiplier}x
                  </td>
                  <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                    ${optimizerResult.baseline.totalPnl}
                  </td>
                  <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                    {optimizerResult.baseline.winRate}
                  </td>
                  <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                    {optimizerResult.baseline.wins}W/
                    {optimizerResult.baseline.losses}L
                  </td>
                  <td className="py-2 text-gray-400 whitespace-nowrap">
                    {optimizerResult.baseline.riskRewardRatio}
                    <span className="text-[10px] text-gray-600 ml-1">
                      actual
                    </span>
                  </td>
                </tr>
                {optimizerResult.combos.slice(0, 8).map((c, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-800/50 last:border-0 ${
                      idx === 0 ? "bg-emerald-900/10" : ""
                    }`}
                  >
                    <td className="py-2 pr-3 text-white whitespace-nowrap">
                      {c.tpAtrMultiplier}x
                    </td>
                    <td className="py-2 pr-3 text-white whitespace-nowrap">
                      {c.slAtrMultiplier}x
                    </td>
                    <td
                      className={`py-2 pr-3 font-medium whitespace-nowrap ${
                        c.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      ${c.totalPnl}
                    </td>
                    <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">
                      {c.winRate}
                    </td>
                    <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">
                      {c.wins}W/{c.losses}L
                    </td>
                    <td className="py-2 text-gray-300 whitespace-nowrap">
                      {c.riskRewardRatio}
                      {idx === 0 && (
                        <span className="text-[10px] text-emerald-400 ml-1">
                          mejor
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && !result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-500 text-sm text-center">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-emerald-500 rounded-full animate-spin shrink-0" />
            Procesando {days} día{days > 1 ? "s" : ""} de histórico...
          </div>
        </div>
      )}

      {result && (
        <>
          <p className="text-xs text-gray-500">
            Resultado para{" "}
            <span className="text-gray-300">{result.configName}</span>
          </p>
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
              Curva de equity
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={equityCurve}
                margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
              >
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
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1f2937"
                  vertical={false}
                />
                <XAxis
                  dataKey="i"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={{ stroke: "#374151" }}
                  tickLine={false}
                  label={{
                    value: "Trade #",
                    position: "insideBottom",
                    offset: -2,
                    fill: "#6b7280",
                    fontSize: 11,
                  }}
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">
              PnL por señal
            </p>
            <ResponsiveContainer
              width="100%"
              height={Math.max(180, bySignalData.length * 40)}
            >
              <BarChart
                data={bySignalData}
                layout="vertical"
                margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1f2937"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
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
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4 gap-2">
              <p className="text-xs text-gray-500 uppercase tracking-widest">
                Trades ({result.trades.length})
              </p>
              {result.trades.length > 15 && (
                <button
                  onClick={() => setShowAllTrades((v) => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors shrink-0"
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
              {visibleTrades?.map((t: any, idx: any) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 py-2 border-b border-gray-800/50 last:border-0 text-sm"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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
                    className={`font-bold shrink-0 text-xs sm:text-sm ${
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4 min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
        <p className="text-xs text-gray-500 truncate">{label}</p>
      </div>
      <p className={`text-lg sm:text-xl font-bold truncate ${valueColor ?? "text-white"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-600 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}