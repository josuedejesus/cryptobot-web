"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Save, Check, Trash2, Pencil } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface SavedConfig {
  id: number;
  name: string;
  isActive: boolean;
  symbol: string;
  timeframe: string;
}

interface WindowTrade {
  date: string;
  signal: string;
  reason: string;
  pnl: number;
  result: string;
}

interface WindowsResult {
  windows: {
    start: string;
    end: string;
    totalTrades: number;
    winRate: string;
    totalPnl: number;
  }[];
  positive: number;
  total: number;
  trades: WindowTrade[];
}

// El `reason` se arma como "{factor top} | Score: N (+ otros factores)". OJO:
// el factor top NO es el evento de entrada — es el de mayor puntaje (con
// scoreTrendAligned alto, suele ser "Tendencia a favor"). Para agrupar por
// TIPO DE ENTRADA real hay que detectar el/los EVENTOS (Stoch RSI / Squeeze /
// VWAP Reversion) en todo el reason, e ignorar las confirmaciones.
function parseReason(reason: string): {
  type: string;
  score: string;
  factors: string;
} {
  const events: string[] = [];
  if (/Stoch RSI/i.test(reason)) events.push("Stoch RSI");
  if (/Squeeze/i.test(reason)) events.push("Squeeze");
  if (/VWAP Reversion/i.test(reason)) events.push("VWAP Reversion");
  const type = events.join(" + ") || reason.split("|")[0]?.trim() || reason;

  const score = reason.match(/Score:\s*([\d.]+)/)?.[1] ?? "";

  // Confirmaciones (indicadores de apoyo), no eventos.
  const conf: string[] = [];
  const trend = reason.match(/Tendencia (a favor|en contra) \((\d+)%\)/);
  if (trend) conf.push(`Tend ${trend[1] === "a favor" ? "✓" : "✗"}${trend[2]}%`);
  if (/Volumen alto/i.test(reason)) conf.push("Vol");
  if (/Sobre VWAP/i.test(reason)) conf.push("↑VWAP");
  if (/Bajo VWAP/i.test(reason)) conf.push("↓VWAP");
  const factors = conf.join(" · ");

  return { type, score, factors };
}

export default function BacktestPanel() {
  // Presets guardados
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null); // null = modal cerrado
  const [presetActionLoading, setPresetActionLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Robustez multi-ventana — ÚNICA vía de evaluación. Se quitaron a propósito
  // el backtest de 1 período, el walk-forward y el optimizador de TP/SL: eran
  // superficie de auto-engaño (optimizar params sobre un período fabrica edges
  // que mueren en vivo). Solo se valida una config FIJA sobre 13 ventanas.
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [windowsResult, setWindowsResult] = useState<WindowsResult | null>(null);
  const [windowsError, setWindowsError] = useState<string | null>(null);
  const [onlyLosses, setOnlyLosses] = useState(true);

  const loadConfigs = async () => {
    try {
      const res = await fetch(`${API}/bot-config/saved-configs`);
      const data: SavedConfig[] = await res.json();
      setConfigs(data);
      const active = data.find((c) => c.isActive);
      if (active && selectedConfigId === null) setSelectedConfigId(active.id);
    } catch {
      // silencioso: si falla, igual se puede correr contra la activa
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

  const runWindows = async () => {
    setWindowsLoading(true);
    setWindowsError(null);
    try {
      const qs = new URLSearchParams({ months: "13" });
      if (selectedConfigId) qs.set("configId", String(selectedConfigId));
      const res = await fetch(`${API}/backtest/windows?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWindowsResult(await res.json());
    } catch {
      setWindowsError("No se pudo correr el test multi-ventana.");
    } finally {
      setWindowsLoading(false);
    }
  };

  const allTrades = windowsResult?.trades ?? [];
  const lossTrades = allTrades.filter((t) => t.result === "LOSS");
  const shownTrades = onlyLosses ? lossTrades : allTrades;
  // Pérdidas agrupadas por tipo de entrada — para ver qué señal causa los loss.
  const lossByType = Object.entries(
    lossTrades.reduce<Record<string, { n: number; pnl: number }>>((acc, t) => {
      const { type } = parseReason(t.reason);
      acc[type] = acc[type] || { n: 0, pnl: 0 };
      acc[type].n++;
      acc[type].pnl += t.pnl;
      return acc;
    }, {}),
  ).sort((a, b) => a[1].pnl - b[1].pnl);

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

      {/* Header + acción de robustez */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
        <div>
          <h2 className="font-semibold text-sm text-white">
            Robustez multi-ventana
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            La única evaluación honesta: corre 13 ventanas mensuales sobre la
            config fija. Un edge real aparece positivo en la mayoría, no en una
            con suerte. (Optimizar params sobre un período fabrica ganancias que
            mueren en vivo — por eso se quitó.)
          </p>
        </div>

        <div className="border-t border-gray-800 my-4" />

        <button
          onClick={runWindows}
          disabled={windowsLoading}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          title="Corre 13 ventanas mensuales sobre la config seleccionada"
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          {windowsLoading ? "Corriendo 13 ventanas..." : "Correr robustez (13 meses)"}
        </button>
      </div>

      {windowsError && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 text-red-400 text-sm">
          {windowsError}
        </div>
      )}

      {windowsResult && (
        <div className="bg-gray-900 border border-amber-800/40 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs text-amber-400 uppercase tracking-widest">
              Robustez multi-ventana
            </p>
            <span
              className={`text-sm font-bold ${
                windowsResult.positive === windowsResult.total
                  ? "text-emerald-400"
                  : windowsResult.positive >= windowsResult.total * 0.6
                    ? "text-amber-400"
                    : "text-red-400"
              }`}
            >
              {windowsResult.positive}/{windowsResult.total} positivas
            </span>
          </div>
          <p className="text-[11px] text-gray-600 mb-4">
            Cada fila es un backtest independiente de 30 días. Un edge real
            aparece positivo en la mayoría de las ventanas — no en una sola con
            suerte. (El PnL escala con el leverage; mirá el signo y el win rate.)
          </p>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm min-w-[440px]">
              <thead>
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="pb-2 pr-3">Ventana</th>
                  <th className="pb-2 pr-3">Trades</th>
                  <th className="pb-2 pr-3">Win rate</th>
                  <th className="pb-2">PnL</th>
                </tr>
              </thead>
              <tbody>
                {windowsResult.windows.map((w, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-800/50 last:border-0"
                  >
                    <td className="py-2 pr-3 text-gray-400 whitespace-nowrap">
                      {w.start} → {w.end}
                    </td>
                    <td className="py-2 pr-3 text-gray-300">{w.totalTrades}</td>
                    <td className="py-2 pr-3 text-gray-300">{w.winRate}</td>
                    <td
                      className={`py-2 font-medium whitespace-nowrap ${
                        w.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {w.totalPnl >= 0 ? "+" : ""}${w.totalPnl}{" "}
                      {w.totalPnl >= 0 ? "✅" : "❌"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trades: cuáles pierden y con qué tipo de entrada + indicadores */}
      {windowsResult && allTrades.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs text-gray-500 uppercase tracking-widest">
              Trades —{" "}
              {onlyLosses
                ? `${lossTrades.length} pérdidas`
                : `${allTrades.length} total`}
            </p>
            <button
              onClick={() => setOnlyLosses((v) => !v)}
              className="text-xs text-gray-500 hover:text-white transition-colors shrink-0"
            >
              {onlyLosses ? "Ver todos" : "Solo pérdidas"}
            </button>
          </div>

          {/* Resumen: pérdidas por tipo de entrada (dónde se concentran) */}
          {lossByType.length > 0 && (
            <div className="mb-4 space-y-1 bg-gray-950/50 rounded-lg p-3">
              <p className="text-[11px] text-gray-600 mb-1">
                Pérdidas por tipo de entrada:
              </p>
              {lossByType.map(([type, s]) => (
                <div
                  key={type}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-gray-400 truncate">{type}</span>
                  <span className="text-gray-500 shrink-0 ml-2">
                    {s.n} loss ·{" "}
                    <span className="text-red-400">${s.pnl.toFixed(2)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tabla de trades */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800 sticky top-0 bg-gray-900">
                  <th className="pb-2 pr-3">Fecha</th>
                  <th className="pb-2 pr-3">Dir</th>
                  <th className="pb-2 pr-3">Entrada</th>
                  <th className="pb-2 pr-3">Sc</th>
                  <th className="pb-2 pr-3">Indicadores</th>
                  <th className="pb-2">PnL</th>
                </tr>
              </thead>
              <tbody>
                {shownTrades.map((t, i) => {
                  const { type, score, factors } = parseReason(t.reason);
                  const isLoss = t.result === "LOSS";
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-800/50 last:border-0 ${
                        isLoss ? "bg-red-900/10" : ""
                      }`}
                    >
                      <td className="py-2 pr-3 text-gray-500 whitespace-nowrap text-xs">
                        {t.date}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            t.signal === "LONG"
                              ? "bg-emerald-900/40 text-emerald-400"
                              : "bg-red-900/40 text-red-400"
                          }`}
                        >
                          {t.signal}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-gray-300 whitespace-nowrap text-xs">
                        {type}
                      </td>
                      <td className="py-2 pr-3 text-gray-500 text-xs">{score}</td>
                      <td className="py-2 pr-3 text-gray-500 text-xs">
                        {factors}
                      </td>
                      <td
                        className={`py-2 font-medium whitespace-nowrap text-xs ${
                          t.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!windowsResult && !windowsLoading && !windowsError && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">
            Elegí una config y corré la robustez para ver las 13 ventanas
          </p>
        </div>
      )}
    </div>
  );
}
