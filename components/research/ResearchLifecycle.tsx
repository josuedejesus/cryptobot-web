"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { traceResearchTrade } from "@/lib/research/research-api";
import type {
  ResearchTraceRequest,
  ResearchTraceResponse,
} from "@/lib/research/types";
import {
  formatCurrency as money,
  formatPrice as price,
  formatPercent as pct,
  formatDate as date,
} from "@/lib/research/format";
export default function ResearchLifecycle({
  request,
  onClose,
}: {
  request: ResearchTraceRequest;
  onClose: () => void;
}) {
  const [result, setResult] = useState<ResearchTraceResponse | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    traceResearchTrade(request, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setResult(response);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el trace.",
          );
      });
    return () => controller.abort();
  }, [request, attempt]);
  const trace = result?.trace;
  return (
    <section
      aria-label="Trade lifecycle"
      className="bg-gray-950 border border-gray-700 rounded-xl p-4 space-y-4 whitespace-normal"
    >
      <div className="flex justify-between items-center gap-4">
        <h3 className="font-semibold">Trade lifecycle</h3>
        <Button type="button" variant="outline" onClick={onClose}>
          Cerrar lifecycle
        </Button>
      </div>
      <p className="text-xs font-mono break-all">{request.entryId}</p>
      <p className="text-xs text-gray-400">
        Reproduce una entrada del cohort CURRENT Sequential con la configuración
        guardada y las fechas del resultado. No requiere una sesión previa. Una
        entrada exclusiva del modo Sequential puede no pertenecer a ese cohort.
      </p>
      {!trace && !error && <p role="status">Cargando lifecycle…</p>}
      {error && (
        <div role="alert">
          <p className="text-red-400">{error}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError("");
              setResult(null);
              setAttempt((n) => n + 1);
            }}
          >
            Reintentar trace
          </Button>
        </div>
      )}
      {trace && (
        <>
          <p className="font-mono text-xs break-all">{trace.variantId}</p>
          <p className="text-sm">
            Signal timeframe: <strong>{trace.signalTimeframe}</strong> ·
            Execution timeframe: <strong>{trace.executionTimeframe}</strong>
          </p>
          <p className="text-xs text-gray-400">
            {trace.executionTimeframe === trace.signalTimeframe
              ? `Cada fila es una vela de ${trace.signalTimeframe}.`
              : `Las señales se generan en ${trace.signalTimeframe}. Cada fila de abajo es una vela de ${trace.executionTimeframe}: NEXT_CANDLE significa la siguiente vela de ${trace.executionTimeframe}. "ATR as of" muestra el cierre de ${trace.signalTimeframe} del que proviene el ATR — nunca posterior al cierre de la fila, así que no hay lookahead.`}
          </p>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[
              ["Side", trace.side],
              ["Entrada", price(trace.entryPrice)],
              ["Salida", price(trace.final.exitPrice)],
              ["PnL", money(trace.final.pnl)],
              ["MFE reporte", pct(trace.final.maxFavorablePct)],
              ["MFE procesado", pct(trace.summary.maxManagedFavorablePct)],
              ["Exit reason", trace.final.exitReason],
              ["Stop inicial", price(trace.initialStop)],
              ["Fees", money(trace.final.fee)],
              ["Funding", money(trace.final.funding)],
              ["Entrada UTC", date(trace.entryTime)],
              ["Salida UTC", date(trace.final.exitTime)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-gray-400">{label}</dt>
                <dd className="font-mono">{value}</dd>
              </div>
            ))}
          </dl>
          <p aria-label="Lifecycle phases" className="text-sm font-mono">
            {["ENTRY", ...trace.summary.phasesReached, "EXIT"].join(" → ")}
          </p>
          <p className="text-xs text-gray-400">
            Stop before puede cerrar en esa vela. Stop after de NEXT_CANDLE
            aplica en la siguiente; no se ejecuta retrospectivamente. Gap stop
            significa apertura más allá del stop, incluso si coincide con el
            cierre anterior. MFE/MAE del reporte incluyen toda la vela de
            salida.
          </p>
          <div className="overflow-x-auto max-h-[600px]">
            <table
              className="w-full text-xs text-left whitespace-nowrap"
              aria-label="Lifecycle candles"
            >
              <thead className="sticky top-0 bg-gray-950">
                <tr>
                  {[
                    "Candle / UTC",
                    "Phase",
                    "OHLC",
                    "MFE / MAE",
                    "ATR / source / as of",
                    "Stop before",
                    "Candidate",
                    "Stop after",
                    "Event",
                  ].map((h) => (
                    <th key={h} className="p-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trace.steps.map((s) => (
                  <tr
                    key={s.candleIndex}
                    className={`border-t border-gray-800 ${s.gapExit ? "bg-amber-950/20" : s.exit ? "bg-gray-800/50" : ""}`}
                  >
                    <th className="p-3 font-normal">
                      #{s.candleIndex}
                      <br />
                      {date(s.candleOpenTime)}
                      <br />
                      Cierre: {date(s.decisionTime)}
                      <br />
                      <span className="text-gray-500">
                        {trace.executionTimeframe}
                      </span>
                    </th>
                    <td className="p-3">
                      {s.phaseBefore ?? "—"} → {s.phaseAfter ?? "—"}
                      <br />
                      Favorable: {pct(s.favorablePctBefore)} →{" "}
                      {pct(s.favorablePctAfter)}
                      <br />
                      Best: {price(s.bestPriceBefore)} →{" "}
                      {price(s.bestPriceAfter)}
                    </td>
                    <td className="p-3">
                      O {price(s.candle.open)}
                      <br />H {price(s.candle.high)}
                      <br />L {price(s.candle.low)}
                      <br />C {price(s.candle.close)}
                      <br />
                      Open gap: {pct(s.openGapPct)}
                    </td>
                    <td className="p-3">
                      {pct(s.excursion.maxFavorablePct)}
                      <br />
                      {money(s.excursion.maxFavorablePnl)} /{" "}
                      {money(s.excursion.maxAdversePnl)}
                    </td>
                    <td className="p-3">
                      {s.atrUsed === null ? "—" : price(s.atrUsed)} ·{" "}
                      {s.atrSource ?? "—"}
                      <br />
                      Current:{" "}
                      {s.currentAtr === null ? "—" : price(s.currentAtr)}
                      <br />
                      Entry: {s.atrAtEntry === null ? "—" : price(s.atrAtEntry)}
                      <br />
                      As of: {s.atrAsOfTime === null ? "—" : date(s.atrAsOfTime)}
                    </td>
                    <td className="p-3">{price(s.stopBefore)}</td>
                    <td className="p-3">
                      {s.stopCandidate === null ? "—" : price(s.stopCandidate)}
                      <br />
                      Protected:{" "}
                      {s.protectedCandidate === null
                        ? "—"
                        : price(s.protectedCandidate)}
                      <br />
                      ATR:{" "}
                      {s.atrCandidate === null ? "—" : price(s.atrCandidate)}
                    </td>
                    <td className="p-3">
                      {price(s.stopAfter)}
                      <br />
                      {s.effectiveFrom}
                      {s.closeBeyondStopAfter && (
                        <>
                          <br />
                          Close beyond stop after
                        </>
                      )}
                    </td>
                    <td className="p-3">
                      {s.thresholdCrossings.map((c) => (
                        <div key={c.type}>
                          {c.type} {pct(c.threshold)}
                        </div>
                      ))}
                      {s.gapExit
                        ? "Gap stop"
                        : s.stopTriggered
                          ? "Stop hit"
                          : ""}
                      {s.exit && (
                        <div>
                          Exit: {s.exit.reason}
                          <br />
                          Raw: {price(s.exit.rawPrice)}
                          <br />
                          Fill: {price(s.exit.price)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!trace.steps.length && (
            <p>
              Sin velas gestionadas; cierre final según la política del engine.
            </p>
          )}
          <details>
            <summary className="cursor-pointer text-sm">Raw trace</summary>
            <pre className="mt-3 max-h-96 overflow-auto text-xs p-3 bg-gray-900 rounded-lg">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </>
      )}
    </section>
  );
}
