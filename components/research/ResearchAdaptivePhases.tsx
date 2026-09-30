"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { analyzeAdaptivePhases } from "@/lib/research/research-api";
import type {
  AdaptiveCandidateKind,
  AdaptiveExitControl,
  AdaptiveRunnerInertia,
  AnalyzeAdaptiveRequest,
  AnalyzeAdaptiveResponse,
  ResearchVariant,
} from "@/lib/research/types";
import { exitStrategyLabel } from "@/lib/research/presentation";
import {
  formatCurrency as money,
  formatDate as date,
  formatPercent as pct,
  formatPrice as price,
} from "@/lib/research/format";
import ResearchLifecycle from "./ResearchLifecycle";

/**
 * Adaptive Phase Analysis — SOLO diagnóstico.
 *
 * Todo lo que se muestra lo calcula el backend sobre el mismo Fixed Entry
 * Cohort de compare-exits. Acá no se recalcula ninguna métrica.
 */
export default function ResearchAdaptivePhases({
  request,
  variants,
}: {
  request: Omit<AnalyzeAdaptiveRequest, "exitStrategy">;
  /** Variantes Adaptive del resultado (V1, V2 o ambas). */
  variants: ResearchVariant[];
}) {
  const [result, setResult] = useState<AnalyzeAdaptiveResponse | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [inspect, setInspect] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const variant = variants[Math.min(selected, variants.length - 1)];
  const exitStrategy = variant.exitStrategy;

  useEffect(() => {
    const controller = new AbortController();
    // Sin setState sincrónico acá: el reset lo hace quien dispara el reintento
    // y el Lab remonta la sección con `key` cuando cambia la variante.
    analyzeAdaptivePhases({ ...request, exitStrategy }, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setResult(response);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el análisis.",
          );
      });
    return () => controller.abort();
  }, [request, exitStrategy, attempt]);

  const analysis = result?.analysis;
  const inertiaRows: { label: string; inertia: AdaptiveRunnerInertia }[] =
    analysis
      ? [
          { label: "Runner", inertia: analysis.runnerInertia },
          { label: "Strong runner", inertia: analysis.strongRunnerInertia },
        ]
      : [];
  const candidateLabel: Record<AdaptiveCandidateKind, string> = {
    PROTECTED: "Protected",
    RUNNER_ATR: "Runner ATR",
    STRONG_RUNNER_ATR: "Strong runner ATR",
  };

  return (
    <section
      aria-label="Adaptive Phase Analysis"
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">Adaptive Phase Analysis</h2>
          <p className="text-xs text-gray-500 mt-1">
            Diagnóstico: distingue una fase ALCANZADA de una fase que realmente
            movió el stop. No cambia trades ni PnL.
          </p>
        </div>
        {variants.length > 1 ? (
          <label className="text-xs text-gray-400">
            Variante{" "}
            <select
              aria-label="Variante Adaptive"
              className="ml-2 bg-gray-950 border border-gray-700 rounded-lg p-2"
              value={selected}
              onChange={(e) => {
                setError("");
                setResult(null);
                setSelected(Number(e.target.value));
              }}
            >
              {variants.map((v, i) => (
                <option key={v.variantId} value={i}>
                  {exitStrategyLabel(v.exitStrategy.type)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-gray-400">
            {exitStrategyLabel(exitStrategy.type)}
          </p>
        )}
      </div>

      {!analysis && !error && <p role="status">Analizando fases…</p>}

      {error && (
        <div role="alert" className="space-y-2">
          <p className="text-red-400 text-sm">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError("");
              setResult(null);
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar análisis
          </Button>
        </div>
      )}

      {analysis && analysis.totalTrades === 0 && (
        <p className="text-sm text-gray-400">
          El cohort no produjo entradas para analizar.
        </p>
      )}

      {analysis && analysis.totalTrades > 0 && (
        <>
          <div className="overflow-x-auto">
            <table
              className="w-full text-xs text-left whitespace-nowrap"
              aria-label="Phase reach"
            >
              <caption className="sr-only">Fases alcanzadas</caption>
              <thead>
                <tr className="text-gray-400">
                  {[
                    "Phase",
                    "Trades reached",
                    "%",
                    "Candles",
                    "Effective stop updates",
                    "Ineffective",
                  ].map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.phases.map((phase) => (
                  <tr key={phase.phase} className="border-t border-gray-800">
                    <th className="p-2 font-normal">{phase.phase}</th>
                    <td className="p-2">
                      {phase.tradesReached} / {analysis.totalTrades}
                    </td>
                    <td className="p-2">{pct(phase.tradesReachedRate)}</td>
                    <td className="p-2">{phase.candlesInPhase}</td>
                    <td className="p-2">{phase.effectiveStopUpdates}</td>
                    <td className="p-2">{phase.ineffectiveCandidates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table
              className="w-full text-xs text-left whitespace-nowrap"
              aria-label="Candidate effectiveness"
            >
              <caption className="sr-only">Efectividad por candidato</caption>
              <thead>
                <tr className="text-gray-400">
                  {[
                    "Candidate",
                    "Generated",
                    "Improves stop",
                    "Rejected by stop",
                    "Equal",
                    "Won in candle",
                    "Effective updates",
                  ].map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  Object.keys(analysis.candidates) as AdaptiveCandidateKind[]
                ).map((kind) => {
                  const c = analysis.candidates[kind];
                  return (
                    <tr key={kind} className="border-t border-gray-800">
                      <th className="p-2 font-normal">
                        {candidateLabel[kind]}
                      </th>
                      <td className="p-2">{c.generated}</td>
                      <td className="p-2">{c.improvedStop}</td>
                      <td className="p-2">{c.rejectedByExistingStop}</td>
                      <td className="p-2">{c.equalToExistingStop}</td>
                      <td className="p-2">{c.wonWithinStep}</td>
                      <td className="p-2 font-medium">
                        {c.effectiveStopUpdates}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            aria-label="Runner effectiveness"
            className="grid sm:grid-cols-2 gap-3"
          >
            {inertiaRows.map(({ label, inertia }) => (
              <div
                key={label}
                className="rounded-lg border border-gray-700 bg-gray-950 p-3 space-y-1 text-xs"
              >
                <h3 className="text-sm font-medium">{label}</h3>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {[
                    ["Phase reached", String(inertia.phaseReached)],
                    ["Candidate generated", String(inertia.candidateGenerated)],
                    ["Improved stop", String(inertia.candidateImprovedStop)],
                    [
                      "Rejected by existing stop",
                      String(inertia.candidateRejectedByExistingStop),
                    ],
                    [
                      "Lost to protected candidate",
                      String(inertia.candidateLostToProtectedCandidate),
                    ],
                    [
                      "Effectiveness rate",
                      inertia.effectivenessRate === null
                        ? "—"
                        : pct(inertia.effectivenessRate),
                    ],
                    [
                      "Trades where it moved a stop",
                      String(inertia.tradesWhereRunnerChangedAtLeastOneStop),
                    ],
                    [
                      "Trades where it never did",
                      String(inertia.tradesWhereRunnerNeverChangedStop),
                    ],
                    [
                      "Rejection distance (median)",
                      inertia.rejectionDistancePct
                        ? pct(inertia.rejectionDistancePct.median)
                        : "—",
                    ],
                  ].map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-gray-500">{key}</dt>
                      <dd className="font-mono">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table
              className="w-full text-xs text-left whitespace-nowrap"
              aria-label="Exit control"
            >
              <caption className="sr-only">
                Qué mecanismo controló la salida
              </caption>
              <thead>
                <tr className="text-gray-400">
                  <th className="p-2">Exit control</th>
                  <th className="p-2">Trades</th>
                </tr>
              </thead>
              <tbody>
                {(
                  Object.entries(analysis.exitControl) as [
                    AdaptiveExitControl,
                    number,
                  ][]
                )
                  .filter(([, value]) => value > 0)
                  .map(([key, value]) => (
                    <tr key={key} className="border-t border-gray-800">
                      <th className="p-2 font-normal">{key}</th>
                      <td className="p-2">{value}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">
              GAP tiene su propio bucket; la fase que produjo el stop atravesado
              queda en <code>exitStopSource</code>:{" "}
              {Object.entries(analysis.exitStopSource)
                .filter(([, value]) => value > 0)
                .map(([key, value]) => `${key} ${value}`)
                .join(" · ") || "—"}
            </p>
          </div>

          {analysis.topInertRunnerCases.length > 0 && (
            <div className="overflow-x-auto">
              <h3 className="text-sm font-medium mb-2">
                Runner candidates rechazados por el stop vigente
              </h3>
              <table
                className="w-full text-xs text-left whitespace-nowrap"
                aria-label="Inert runner cases"
              >
                <thead>
                  <tr className="text-gray-400">
                    {[
                      "Entry",
                      "Side",
                      "Candle",
                      "Entry price",
                      "Best",
                      "ATR",
                      "Stop before",
                      "Runner candidate",
                      "Distance",
                      "Favorable",
                      "Phase",
                      "Exit",
                      "PnL",
                      "",
                    ].map((h, i) => (
                      <th key={`${h}-${i}`} className="p-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analysis.topInertRunnerCases.map((c, i) => (
                    <tr
                      key={`${c.entryId}-${c.candleIndex}-${i}`}
                      className="border-t border-gray-800"
                    >
                      <th className="p-2 font-mono font-normal break-all">
                        {c.entryId}
                      </th>
                      <td className="p-2">{c.side}</td>
                      <td className="p-2">
                        #{c.candleIndex}
                        <br />
                        {date(c.candleOpenTime)}
                      </td>
                      <td className="p-2">{price(c.entryPrice)}</td>
                      <td className="p-2">{price(c.bestPrice)}</td>
                      <td className="p-2">
                        {c.atrUsed === null ? "—" : price(c.atrUsed)}
                        <br />
                        <span className="text-gray-500">
                          {c.atrSource ?? "—"}
                        </span>
                      </td>
                      <td className="p-2">
                        {price(c.stopBefore)}
                        <br />
                        <span className="text-gray-500">{c.stopSource}</span>
                      </td>
                      <td className="p-2">{price(c.runnerCandidate)}</td>
                      <td className="p-2 font-medium">{pct(c.distancePct)}</td>
                      <td className="p-2">{pct(c.favorablePct)}</td>
                      <td className="p-2">{c.phase}</td>
                      <td className="p-2">{c.exitReason}</td>
                      <td className="p-2">{money(c.pnl)}</td>
                      <td className="p-2">
                        <Button
                          type="button"
                          variant="outline"
                          aria-label={`Inspect lifecycle ${c.entryId}`}
                          onClick={() => setInspect(c.entryId)}
                        >
                          Inspect lifecycle
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result?.sensitivity && (
            <dl
              aria-label="Adaptive sensitivity"
              className="grid sm:grid-cols-3 gap-3 text-xs"
            >
              {[
                ["Compared trades", result.sensitivity.comparedTrades],
                ["Same exit", result.sensitivity.sameExitCount],
                ["Different exit", result.sensitivity.differentExitCount],
                [
                  "Different phase timing",
                  result.sensitivity.tradesWithDifferentPhaseTiming,
                ],
                [
                  "Different runner candidate",
                  result.sensitivity.tradesWithDifferentRunnerCandidate,
                ],
                [
                  "Different effective stop",
                  result.sensitivity.tradesWithDifferentEffectiveStop,
                ],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-mono">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {inspect && (
            <ResearchLifecycle
              key={inspect}
              request={{ ...request, entryId: inspect, exitStrategy }}
              onClose={() => setInspect(null)}
            />
          )}
        </>
      )}
    </section>
  );
}
