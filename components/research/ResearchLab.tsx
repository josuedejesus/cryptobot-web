"use client";
import { useEffect, useRef, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/research/research-api";
import type {
  LabRequest,
  LabResult,
  ResearchCapabilities,
  SavedConfig,
} from "@/lib/research/types";
import { formatDate } from "@/lib/research/format";
import { isAdaptive } from "@/lib/research/presentation";
import ResearchControls from "./ResearchControls";
import ResearchSummary from "./ResearchSummary";
import ResearchReproducibility from "./ResearchReproducibility";
import ResearchExcursion from "./ResearchExcursion";
import ResearchTradeTable from "./ResearchTradeTable";
import ResearchAdaptivePhases from "./ResearchAdaptivePhases";
export default function ResearchLab() {
  const [bootstrap, setBootstrap] = useState<{
    capabilities: ResearchCapabilities;
    configs: SavedConfig[];
  } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LabResult | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      api.getResearchCapabilities(controller.signal),
      api.getSavedConfigs(controller.signal),
    ])
      .then(([capabilities, configs]) => {
        if (!controller.signal.aborted) setBootstrap({ capabilities, configs });
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(
            e instanceof Error ? e.message : "No se pudo cargar Research.",
          );
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => () => inFlight.current?.abort(), []);
  async function run(request: LabRequest) {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const next: LabResult =
        request.kind === "single"
          ? {
              kind: "single",
              data: await api.runResearch(request.body, controller.signal),
            }
          : {
              kind: "compare",
              data: await api.compareResearchExits(
                request.body,
                controller.signal,
              ),
            };
      if (!controller.signal.aborted) setResult(next);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo ejecutar el experimento.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      inFlight.current = null;
    }
  }
  const variants = result
    ? result.kind === "single"
      ? [result.data]
      : result.data.results
    : [];
  // El diagnóstico de fases aplica a cualquier variante Adaptive (V1 y V2).
  const adaptiveVariants = variants.filter((variant) =>
    isAdaptive(variant.exitStrategy.type),
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FlaskConical className="text-emerald-400" aria-hidden />
          Research Lab
        </h1>
        <p className="text-sm text-gray-400 mt-2">
          Experimentación histórica de estrategias de salida
        </p>
      </div>
      {loadError ? (
        <div
          role="alert"
          className="border border-red-900 bg-gray-900 rounded-xl p-5"
        >
          <p className="text-red-400 mb-3">{loadError}</p>
          <Button
            variant="outline"
            onClick={() => {
              setLoadError("");
              setRetry((v) => v + 1);
            }}
          >
            Reintentar carga
          </Button>
        </div>
      ) : bootstrap ? (
        <ResearchControls
          capabilities={bootstrap.capabilities}
          configs={bootstrap.configs}
          busy={busy}
          onRun={run}
        />
      ) : (
        <p role="status" className="p-6 text-gray-400">
          Cargando configuraciones y capabilities…
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="bg-red-950/20 border border-red-900 rounded-xl p-4 text-red-400"
        >
          {error}
        </p>
      )}
      {busy && (
        <div
          role="status"
          className="bg-gray-900 border border-gray-800 rounded-xl p-10 flex justify-center gap-3"
        >
          <Loader2 className="animate-spin" aria-hidden />
          Ejecutando simulación histórica…
        </div>
      )}
      {result && (
        <section aria-label="Resultados Research" className="space-y-5">
          <header className="space-y-2">
            <h2 className="text-lg font-semibold">
              {result.data.metadata.symbol} · Signal{" "}
              {result.data.metadata.timeframe} · Execution{" "}
              {result.data.metadata.executionTimeframe} · Trend{" "}
              {result.data.metadata.trendTimeframe}
            </h2>
            <p className="text-sm text-gray-400">
              {result.data.metadata.executionMode} ·{" "}
              {formatDate(result.data.metadata.from)} ·{" "}
              {formatDate(result.data.metadata.to)} UTC
            </p>
            {result.kind === "single" && (
              <p className="text-xs font-mono break-all text-gray-400">
                {result.data.variantId}
              </p>
            )}
          </header>
          {result.data.metadata.executionTimeframe !==
            result.data.metadata.timeframe && (
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
              <h3 className="font-medium">
                Execution replay {result.data.metadata.executionTimeframe}
              </h3>
              <p className="text-sm text-gray-300 mt-1">
                Las señales se siguen generando en{" "}
                {result.data.metadata.timeframe}. Stops y salidas se reproducen
                usando velas de {result.data.metadata.executionTimeframe}.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Los indicadores (ATR, VWAP, Stoch RSI) siguen siendo de{" "}
                {result.data.metadata.timeframe}. Las velas de ejecución solo
                aportan la trayectoria de precio posterior a la entrada, así que
                MFE/MAE y el timing de salida ganan resolución.
              </p>
            </div>
          )}
          {result.data.metadata.executionMode === "FIXED_ENTRY_COHORT" && (
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
              <h3 className="font-medium">Fixed Entry Cohort</h3>
              <p className="text-sm text-gray-300 mt-1">
                {result.kind === "compare"
                  ? result.data.metadata.entries
                  : result.data.quality.evaluatedEntries}{" "}
                entradas idénticas evaluadas independientemente.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Las posiciones pueden solaparse. Este modo mide la calidad de
                salida y no representa directamente un portfolio ejecutable.
              </p>
            </div>
          )}
          {result.kind === "compare" && (
            <ResearchReproducibility
              reproducibility={result.data.reproducibility}
              manifest={result.data.manifest}
            />
          )}
          <ResearchSummary
            variants={variants}
            compare={result.kind === "compare"}
          />
          <p className="text-xs text-gray-500">
            Métricas calculadas por el backend. MFE/MAE brutos; capture y
            giveback sobre base bruta. OHLC no identifica el orden intravela.
          </p>
          <ResearchExcursion variants={variants} />
          {adaptiveVariants.length > 0 && (
            <ResearchAdaptivePhases
              key={adaptiveVariants.map((v) => v.variantId).join("|")}
              variants={adaptiveVariants}
              request={{
                configId: result.data.metadata.configId,
                from: result.data.metadata.from,
                to: result.data.metadata.to,
                initialBalance: adaptiveVariants[0].summary.initialBalance,
                ...(result.data.metadata.executionTimeframe ===
                result.data.metadata.timeframe
                  ? {}
                  : {
                      executionTimeframe:
                        result.data.metadata.executionTimeframe,
                    }),
              }}
            />
          )}
          <ResearchTradeTable
            traceBase={{
              configId: result.data.metadata.configId,
              from: result.data.metadata.from,
              to: result.data.metadata.to,
              initialBalance: variants[0]?.summary.initialBalance,
              ...(result.data.metadata.executionTimeframe ===
              result.data.metadata.timeframe
                ? {}
                : {
                    executionTimeframe: result.data.metadata.executionTimeframe,
                  }),
            }}
            timeframes={{
              signal: result.data.metadata.timeframe,
              execution: result.data.metadata.executionTimeframe,
            }}
            variants={variants}
            compare={result.kind === "compare"}
          />
        </section>
      )}
      {!result && !busy && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-400 text-sm">
          Configurá y ejecutá un experimento para inspeccionar el comportamiento
          histórico de las salidas.
        </div>
      )}
    </div>
  );
}
