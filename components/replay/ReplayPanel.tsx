"use client";
import { useEffect, useRef, useState } from "react";
import { Download, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getIntrabarTimeframes,
  getSavedConfigs,
  compareStopExecution,
  runReplay,
  ResearchApiError,
  type ReplayRunResponse,
  type StopExecutionComparisonResponse,
} from "@/lib/research/replay-api";
import type { SavedConfig } from "@/lib/research/types";
import VisualReplay from "@/components/replay/VisualReplay";

const field =
  "w-full rounded-lg border border-gray-700 bg-[#12121a] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500";

const fmtNum = (n: number | null, d = 4) =>
  n === null || n === undefined ? "—" : n.toFixed(d);
const fmtMoney = (n: number) => `$${n.toFixed(2)}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") : "—";
const fmtEpoch = (timestamp: number | null) =>
  timestamp === null ? "—" : fmtTime(new Date(timestamp).toISOString());
const short = (hash: string) => hash.slice(0, 12);

function downloadAnalysisBundle(
  filename: string,
  kind: "PRODUCTION_REPLAY" | "STOP_EXECUTION_COMPARISON",
  result: ReplayRunResponse | StopExecutionComparisonResponse,
) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          format: "cryptobot-analysis-bundle",
          version: 1,
          kind,
          exportedAt: new Date().toISOString(),
          timestampSemantics: {
            stream: "Timestamp is the observed stream event time.",
            ohlc: "Timestamp is the stop candle bucket open; exact touch order within that candle is unknown.",
          },
          result,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ReplayPanel() {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [configId, setConfigId] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReplayRunResponse | null>(null);
  const [intrabarOptions, setIntrabarOptions] = useState<string[]>([]);
  const [intrabarTimeframes, setIntrabarTimeframes] = useState<string[]>([]);
  const [stopExecutionTimeframes, setStopExecutionTimeframes] = useState<string[]>([]);
  const [selectedStopExecutionTimeframe, setSelectedStopExecutionTimeframe] = useState("");
  const [comparison, setComparison] = useState<StopExecutionComparisonResponse | null>(null);
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null);
  const [tradeFocusRequest, setTradeFocusRequest] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const selectedConfig = configs.find((config) => config.id === configId);

  useEffect(() => {
    const controller = new AbortController();
    getSavedConfigs(controller.signal)
      .then((list) => {
        setConfigs(list);
        const active = list.find((c) => c.isActive) ?? list[0];
        if (active) setConfigId(active.id);
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(
          e instanceof ResearchApiError
            ? e.message
            : "No se pudieron cargar las configuraciones.",
        );
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedConfig) return;
    const controller = new AbortController();
    getIntrabarTimeframes(selectedConfig.timeframe, controller.signal)
      .then((timeframes) => {
        setIntrabarOptions(timeframes);
        setSelectedStopExecutionTimeframe((selected) =>
          timeframes.includes(selected) ? selected : timeframes.at(-1) ?? "",
        );
        setIntrabarTimeframes((selected) =>
          selected.filter((timeframe) => timeframes.includes(timeframe)),
        );
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setIntrabarOptions([]);
      });
    return () => controller.abort();
  }, [selectedConfig?.timeframe]);

  async function run() {
    if (!configId || !from || !to) {
      setError("Elegí una config y un rango de fechas.");
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    try {
      const res = await runReplay(
        {
          configId,
          from,
          to,
          intrabarTimeframes,
          ...(selectedConfig?.stopExecutionMode === "INTRABAR" &&
          selectedStopExecutionTimeframe
            ? { stopExecutionTimeframe: selectedStopExecutionTimeframe }
            : {}),
        },
        controller.signal,
      );
      setResult(res);
      setComparison(null);
      setSelectedTradeIndex(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(
        e instanceof ResearchApiError
          ? e.message
          : "El replay falló. Intentá de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runStopComparison() {
    if (!configId || !from || !to || stopExecutionTimeframes.length === 0) {
      setError("Elegí una config, un rango y al menos una resolución de stop.");
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    try {
      const res = await compareStopExecution(
        { configId, from, to, stopExecutionTimeframes },
        controller.signal,
      );
      setComparison(res);
      setResult(null);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof ResearchApiError ? e.message : "La comparación falló.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <History className="size-5 text-emerald-400" />
        <h1 className="text-xl font-bold">Production Replay</h1>
        <span className="text-sm text-gray-500">
          · reejecuta la política de una config sobre mercado histórico real
        </span>
      </div>

      {/* Controles */}
      <fieldset
        disabled={busy}
        className="space-y-5 rounded-xl border border-gray-800 bg-[#0d0d14] p-5 disabled:opacity-60"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="cfg">Config (política congelada)</Label>
            <select
              id="cfg"
              className={`${field} mt-2`}
              value={configId}
              onChange={(e) => setConfigId(Number(e.target.value))}
            >
              {!configs.length && (
                <option value={0}>No hay configuraciones guardadas</option>
              )}
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} · {c.name} · {c.symbol} · {c.timeframe} / HTF{" "}
                  {c.trendTimeframe}
                  {c.isActive ? " · activa" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="from">Desde (UTC)</Label>
            <Input
              id="from"
              className={`${field} mt-2`}
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="to">Hasta (UTC)</Label>
            <Input
              id="to"
              className={`${field} mt-2`}
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            Carga warmup automático antes del rango; gestiona en el cierre del
            signal timeframe (igual que el bot).
          </p>
          <Button onClick={run} disabled={busy || !configId}>
            {busy ? <Loader2 className="animate-spin" /> : <History />}
            {busy ? "Corriendo…" : "Correr replay"}
          </Button>
        </div>
        {intrabarOptions.length > 0 && (
          <fieldset className="border-t border-gray-800 pt-4">
            <legend className="px-1 text-sm font-medium text-gray-200">
              Intrabar analysis
              <span className="ml-2 text-xs font-normal text-amber-300">
                Observation only · no ejecuta decisiones
              </span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {intrabarOptions.map((timeframe) => {
                const checked = intrabarTimeframes.includes(timeframe);
                return (
                  <label key={timeframe} className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && intrabarTimeframes.length >= 3}
                      onChange={(event) =>
                        setIntrabarTimeframes((selected) =>
                          event.target.checked
                            ? [...selected, timeframe]
                            : selected.filter((item) => item !== timeframe),
                        )
                      }
                      className="size-4 accent-emerald-400"
                    />
                    {timeframe}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <fieldset className="border-t border-gray-800 pt-4">
          <legend className="px-1 text-sm font-medium text-gray-200">
            Stop Execution Comparison
            <span className="ml-2 text-xs font-normal text-amber-300">
              Strategy/ATR/regime idénticos · sin ganador automático
            </span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {intrabarOptions.map((timeframe) => {
              const checked = stopExecutionTimeframes.includes(timeframe);
              return (
                <label key={`stop-${timeframe}`} className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && stopExecutionTimeframes.length >= 5}
                    onChange={(event) =>
                      setStopExecutionTimeframes((selected) =>
                        event.target.checked
                          ? [...selected, timeframe]
                          : selected.filter((item) => item !== timeframe),
                      )
                    }
                    className="size-4 accent-amber-400"
                  />
                  {timeframe}
                </label>
              );
            })}
            <Button
              size="sm"
              variant="secondary"
              onClick={runStopComparison}
              disabled={busy || !configId || stopExecutionTimeframes.length === 0}
            >
              {busy ? <Loader2 className="animate-spin" /> : <History />}
              Compare stops
            </Button>
          </div>
        </fieldset>
      </fieldset>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Manifest */}
          <section className="rounded-xl border border-gray-800 bg-[#0d0d14] p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-300">
                Manifest reproducible
              </h2>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadAnalysisBundle(
                    `replay-${result.manifest.symbol}-${new Date(result.manifest.window.reportFrom).toISOString().slice(0, 10)}`,
                    "PRODUCTION_REPLAY",
                    result,
                  )
                }
              >
                <Download /> Export bundle
              </Button>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Símbolo" value={result.manifest.symbol} />
              <Field
                label="Timeframes"
                value={`${result.manifest.timeframe} / HTF ${result.manifest.trendTimeframe}`}
              />
              <Field
                label="Velas señal / trend"
                value={`${result.manifest.signalCandles} / ${result.manifest.trendCandles}`}
              />
              <Field
                label="Ventana reporte"
                value={`${fmtTime(new Date(result.manifest.window.reportFrom).toISOString())} → ${fmtTime(
                  new Date(result.manifest.window.reportTo).toISOString(),
                )}`}
              />
              <Field
                label="configHash"
                value={short(result.manifest.configHash)}
                title={result.manifest.configHash}
                mono
              />
              <Field
                label="datasetHash"
                value={short(result.manifest.datasetHash)}
                title={result.manifest.datasetHash}
                mono
              />
              <Field
                label="strategyDatasetHash"
                value={short(result.manifest.strategyDatasetHash)}
                title={result.manifest.strategyDatasetHash}
                mono
              />
              <Field
                label="strategyResultHash"
                value={short(result.strategyResultHash)}
                title={result.strategyResultHash}
                mono
              />
              <Field
                label="resultHash"
                value={short(result.resultHash)}
                title={result.resultHash}
                mono
              />
              <Field
                label="Stop execution"
                value={`${result.manifest.stopExecution.mode}${result.manifest.stopExecution.timeframe ? ` · ${result.manifest.stopExecution.timeframe} OHLC` : ""}`}
                title="STREAM: hora del evento observado. OHLC: apertura de la vela stop; el orden exacto del toque dentro de la vela es desconocido."
              />
              {result.manifest.stopExecution.datasetHash && (
                <Field
                  label={`Stop dataset · ${result.manifest.stopExecution.candleCount} candles`}
                  value={short(result.manifest.stopExecution.datasetHash)}
                  title={result.manifest.stopExecution.datasetHash}
                  mono
                />
              )}
              <Field
                label="Warmup desde"
                value={fmtTime(
                  new Date(result.manifest.window.warmupStart).toISOString(),
                )}
              />
            </div>
          </section>

          {/* Summary */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <Stat label="Trades" value={String(result.summary.totalTrades)} />
            <Stat label="Cerrados" value={String(result.summary.closedTrades)} />
            <Stat
              label="Wins"
              value={String(result.summary.wins)}
              tone="pos"
            />
            <Stat
              label="Losses"
              value={String(result.summary.losses)}
              tone="neg"
            />
            <Stat label="Win rate" value={fmtPct(result.summary.winRate)} />
            <Stat
              label="Net PnL"
              value={fmtMoney(result.summary.netPnl)}
              tone={result.summary.netPnl >= 0 ? "pos" : "neg"}
            />
            <Stat
              label="Max posiciones"
              value={String(result.summary.maxConcurrentPositions)}
            />
            <Stat label="Stop exits" value={String(result.summary.stopExits)} />
            <Stat label="Gap through" value={String(result.summary.gapThroughStops)} />
            <Stat
              label="Avg stop slippage"
              value={result.summary.averageStopSlippage === null ? "—" : fmtNum(result.summary.averageStopSlippage, 5)}
            />
          </section>

          <VisualReplay
            result={result}
            selectedTradeIndex={selectedTradeIndex}
            onSelectedTradeIndexChange={setSelectedTradeIndex}
            tradeFocusRequest={tradeFocusRequest}
          />

          {result.manifest.intrabarDatasets.length > 0 && (
            <section className="rounded-xl border border-gray-800 bg-[#0d0d14] p-4">
              <h2 className="text-sm font-semibold text-gray-200">
                Intrabar datasets · observation only
              </h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {result.manifest.intrabarDatasets.map((dataset) => (
                  <Field
                    key={dataset.timeframe}
                    label={`${dataset.timeframe} · ${dataset.candleCount} candles · ${fmtTime(new Date(dataset.from).toISOString())} → ${fmtTime(new Date(dataset.to).toISOString())}`}
                    value={short(dataset.datasetHash)}
                    title={dataset.datasetHash}
                    mono
                  />
                ))}
              </div>
            </section>
          )}

          {/* Trades */}
          <section className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0d0d14]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase text-gray-500">
                <tr>
                  {[
                    "Lado",
                    "Entrada",
                    "Salida",
                    "Stop",
                    "PnL",
                    "Resultado",
                    "Motivo",
                    "Entry time",
                    "Exit time",
                    "Replay",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.trades.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      Sin trades en la ventana.
                    </td>
                  </tr>
                )}
                {result.trades.map((t, i) => (
                  <tr
                    key={i}
                    className={`border-b border-gray-900/60 ${selectedTradeIndex === i ? "bg-gray-900/60" : ""}`}
                  >
                    <td className="px-3 py-2">{t.type ?? "—"}</td>
                    <td className="px-3 py-2">{fmtNum(t.entryPrice)}</td>
                    <td className="px-3 py-2">{fmtNum(t.exitPrice)}</td>
                    <td className="px-3 py-2">{fmtNum(t.stopLoss)}</td>
                    <td
                      className={`px-3 py-2 ${
                        (t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {t.pnl === null ? "—" : fmtMoney(t.pnl)}
                    </td>
                    <td className="px-3 py-2">
                      {t.result ?? (t.exitTime ? "—" : "ABIERTO")}
                    </td>
                    <td className="px-3 py-2 text-gray-400">{t.reason ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-400">
                      {fmtTime(t.entryTime)}
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {fmtTime(t.exitTime)}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant={selectedTradeIndex === i ? "secondary" : "ghost"}
                        onClick={() => {
                          setSelectedTradeIndex(i);
                          setTradeFocusRequest((request) => request + 1);
                        }}
                      >
                        Select
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {comparison && (
        <section className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0d0d14] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-200">
              Stop Execution Comparison · {comparison.symbol} · management {comparison.managementTimeframe}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-amber-300">No winner selected</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  downloadAnalysisBundle(
                    `stop-comparison-${comparison.symbol}-${new Date(comparison.window.reportFrom).toISOString().slice(0, 10)}`,
                    "STOP_EXECUTION_COMPARISON",
                    comparison,
                  )
                }
              >
                <Download /> Export bundle
              </Button>
            </div>
          </div>
          <table className="mt-3 w-full min-w-[980px] text-left text-xs">
            <thead className="text-gray-500">
              <tr><th className="py-2">Mode</th><th>Resolution</th><th>Run hash</th><th>Trades</th><th>W/L · win%</th><th>Net PnL</th><th>PF</th><th>Max DD</th><th>Expectancy</th><th>Fees</th><th>Avg/median hold</th><th>MFE</th><th>MAE</th><th>Capture</th><th>Giveback</th><th>Green → Red</th><th>Observed activation</th><th>Stops</th><th>Gaps</th><th>Stop slip</th><th>Stop→fill</th></tr>
            </thead>
            <tbody>
              {comparison.variants.map((variant) => (
                <tr key={`${variant.mode}-${variant.resolution}`} className="border-t border-gray-900 text-gray-300">
                  <td className="py-2">{variant.mode}</td>
                  <td className="font-mono">{variant.resolution}</td>
                  <td className="font-mono" title={variant.resultHash}>{short(variant.resultHash)}</td>
                  <td>{variant.summary.trades}</td>
                  <td>{variant.summary.wins}/{variant.summary.losses} · {(variant.summary.winRate * 100).toFixed(1)}%</td>
                  <td>{fmtMoney(variant.summary.netPnl)}</td>
                  <td>{variant.summary.profitFactor?.toFixed(2) ?? "—"}</td>
                  <td>{fmtMoney(variant.summary.maxDrawdown)}</td>
                  <td>{fmtMoney(variant.summary.expectancy)}</td>
                  <td>{fmtMoney(variant.summary.fees)}</td>
                  <td>{variant.summary.averageHoldTimeMs === null ? "—" : `${(variant.summary.averageHoldTimeMs / 3_600_000).toFixed(1)}h`} / {variant.summary.medianHoldTimeMs === null ? "—" : `${(variant.summary.medianHoldTimeMs / 3_600_000).toFixed(1)}h`}</td>
                  <td>{fmtPct(variant.summary.medianMfe ?? 0)}</td>
                  <td>{fmtPct(variant.summary.medianMae ?? 0)}</td>
                  <td>{variant.summary.medianCaptureRatio === null ? "—" : fmtPct(variant.summary.medianCaptureRatio)}</td>
                  <td>{variant.summary.medianGiveback === null ? "—" : fmtPct(variant.summary.medianGiveback)}</td>
                  <td>{variant.summary.greenToRedCount}</td>
                  <td>{variant.summary.activationThresholdReachedCount}</td>
                  <td>{variant.summary.stopExits}</td>
                  <td>{variant.summary.gapExits}</td>
                  <td>{fmtNum(variant.summary.averageStopSlippage, 5)}</td>
                  <td>{fmtNum(variant.summary.averageEffectiveStopToExecution, 5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-2">
            {comparison.variants.filter((variant) => variant.firstDivergence).map((variant) => (
              <p key={`${variant.mode}-${variant.resolution}-divergence`} className="text-xs text-amber-300">
                {variant.mode} {variant.resolution} · first divergence: {variant.firstDivergence?.explanation}
              </p>
            ))}
          </div>
          <div className="mt-4 space-y-3 border-t border-gray-800 pt-3">
            {comparison.variants.map((variant) => {
              const diagnostic = variant.executionDiagnostics;
              const touch = diagnostic.firstEligibleTouch;
              return (
                <div key={`${variant.mode}-${variant.resolution}-diagnostics`} className="text-xs text-gray-400">
                  <p>
                    {variant.mode} {variant.resolution} · dataset {diagnostic.candleCount} candles · {short(diagnostic.datasetHash ?? "no-hash")} · {fmtEpoch(diagnostic.returnedRange.firstOpenTime)} → {fmtEpoch(diagnostic.returnedRange.lastOpenTime)}
                  </p>
                  <p>
                    Adaptive activations {diagnostic.adaptiveActivationCount} · candidates {diagnostic.stopCandidateCount} · effective stops {diagnostic.effectiveStopCount} · eligible candles {diagnostic.eligibleCandles} · touches {diagnostic.eligibleTouches} · executions {diagnostic.stopExecutions} · gaps {diagnostic.gapExecutions} · changed entries/exits {variant.comparisonDelta.changedEntries}/{variant.comparisonDelta.changedExits}
                  </p>
                  {touch && (
                    <p className="text-amber-300">
                      First touch trade {touch.tradeId} · effective {fmtNum(touch.effectiveStop, 6)} from {fmtEpoch(touch.effectiveFrom)} · O/H/L/C {fmtNum(touch.candle.open, 6)}/{fmtNum(touch.candle.high, 6)}/{fmtNum(touch.candle.low, 6)}/{fmtNum(touch.candle.close, 6)} · {touch.gapThrough ? "gap" : "range touch"} · {touch.executed ? `executed ${fmtEpoch(touch.executionTime)} @ ${fmtNum(touch.executionPrice, 6)}` : "not executed"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-gray-600">
            CANDLE_CLOSE es el baseline. Cada variante parte de una instancia de Paper nueva y datasets con hashes separados.
          </p>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  title,
  mono,
}: {
  label: string;
  value: string;
  title?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div
        title={title}
        className={`mt-0.5 text-gray-200 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos"
      ? "text-emerald-400"
      : tone === "neg"
        ? "text-red-400"
        : "text-white";
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d0d14] p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
