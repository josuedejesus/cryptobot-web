"use client";
import { Fragment, useState } from "react";
import type {
  ResearchVariant,
  ResearchRequest,
  ResearchTraceRequest,
} from "@/lib/research/types";
import {
  joinTrades,
  matchesFilter,
  type TradeFilter,
} from "@/lib/research/presentation";
import {
  formatCurrency as money,
  formatPercent as pct,
  formatDate as date,
  formatPrice as price,
} from "@/lib/research/format";
import ResearchLifecycle from "./ResearchLifecycle";
import ResearchTradeDetail from "./ResearchTradeDetail";
import { Button } from "@/components/ui/button";
const filters: { value: TradeFilter; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "WIN", label: "WIN" },
  { value: "LOSS", label: "LOSS" },
  { value: "SCRATCH", label: "SCRATCH" },
  { value: "GREEN_TO_RED", label: "Green → Red" },
];
export default function ResearchTradeTable({
  variants,
  compare,
  traceBase,
  timeframes,
}: {
  variants: ResearchVariant[];
  compare: boolean;
  traceBase?: ResearchRequest;
  timeframes?: { signal: string; execution: string };
}) {
  const [inspect, setInspect] = useState<ResearchTraceRequest | null>(null);
  const traceable =
    !!traceBase &&
    variants.some((v) => v.exitStrategy.type === "ADAPTIVE_RUNNER");
  const [filter, setFilter] = useState<TradeFilter>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = joinTrades(variants).filter((row) =>
    row.variants.some((t) => matchesFilter(t, filter)),
  );
  const columns =
    (compare ? 4 + variants.length * 3 : 15) + (traceable ? 1 : 0);
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          Trades · {rows.length} filas visibles
        </h2>
        <label className="text-xs text-gray-400">
          Filtrar resultados{" "}
          <select
            aria-label="Filtrar resultados"
            className="ml-2 bg-gray-950 border border-gray-700 rounded-lg p-2"
            value={filter}
            onChange={(e) => setFilter(e.target.value as TradeFilter)}
          >
            {filters.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {compare && (
        <p className="text-xs text-gray-500">
          Filtro: coincide en cualquier variante.
        </p>
      )}
      <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <caption className="sr-only">
            Trades históricos; abrir detalle para inspeccionar una entrada
          </caption>
          <thead className="sticky top-0 bg-gray-900">
            <tr>
              {(compare
                ? ["Entry ID", "Side", "Entrada UTC", "Precio entrada"]
                : [
                    "# / Detalle",
                    "Side",
                    "Entrada UTC",
                    "Salida UTC",
                    "Entrada",
                    "Salida",
                    "PnL",
                    "MFE",
                    "MAE",
                    "Capture",
                    "Giveback",
                    "Green → Red",
                    "Velas",
                    "Exit reason",
                    "Resultado",
                  ]
              ).map((h) => (
                <th key={h} className="p-3 text-gray-400">
                  {h}
                </th>
              ))}
              {compare &&
                variants.map((v, i) => (
                  <Fragment key={`${v.variantId}-${i}`}>
                    {["PnL", "Capture", "Salida UTC"].map((h) => (
                      <th key={h} className="p-3 text-gray-400">
                        <span
                          className="block max-w-56 truncate"
                          title={v.variantId}
                        >
                          {v.variantId}
                        </span>
                        {h}
                      </th>
                    ))}
                  </Fragment>
                ))}
              {traceable && <th className="p-3">Lifecycle</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const item = row.variants.find((t) => t !== undefined)!;
              const t = item.trade;
              return (
                <Fragment key={row.entryId}>
                  <tr
                    data-entry-id={row.entryId}
                    className="border-t border-gray-800/60"
                  >
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        aria-expanded={expanded === row.entryId}
                        aria-controls={`detail-${i}`}
                        aria-label={`Detalle ${row.entryId}`}
                        onClick={() =>
                          setExpanded(
                            expanded === row.entryId ? null : row.entryId,
                          )
                        }
                      >
                        {compare ? row.entryId : `${i + 1} · Detalle`}
                      </Button>
                    </td>
                    <td className="p-3">{t.side}</td>
                    <td className="p-3">{date(t.entryTime)}</td>
                    {compare ? (
                      <>
                        <td className="p-3 font-mono">{price(t.entryPrice)}</td>
                        {row.variants.map((v, j) => (
                          <Fragment key={j}>
                            <td className="p-3 font-mono">
                              {v ? money(v.trade.pnl) : "—"}
                            </td>
                            <td className="p-3">
                              {v ? pct(v.metrics.mfeCaptureRatio) : "—"}
                            </td>
                            <td className="p-3">
                              {v ? date(v.trade.exitTime) : "—"}
                            </td>
                          </Fragment>
                        ))}
                      </>
                    ) : (
                      <>
                        <td className="p-3">{date(t.exitTime)}</td>
                        <td className="p-3">{price(t.entryPrice)}</td>
                        <td className="p-3">{price(t.exitPrice)}</td>
                        <td
                          className={`p-3 font-mono ${t.pnl < 0 ? "text-red-400" : "text-emerald-400"}`}
                        >
                          {money(t.pnl)}
                        </td>
                        <td className="p-3">{money(t.maxFavorablePnl)}</td>
                        <td className="p-3">{money(t.maxAdversePnl)}</td>
                        <td className="p-3">
                          {pct(item.metrics.mfeCaptureRatio)}
                        </td>
                        <td className="p-3">
                          {money(item.metrics.peakGiveback)}
                        </td>
                        <td className="p-3">
                          {item.metrics.greenToRed ? "Sí" : "No"}
                        </td>
                        <td className="p-3">{t.candlesHeld}</td>
                        <td className="p-3">{t.exitReason}</td>
                        <td className="p-3">{t.result}</td>
                      </>
                    )}
                    {traceable && (
                      <td className="p-3">
                        {variants.map((variant, j) =>
                          variant.exitStrategy.type === "ADAPTIVE_RUNNER" &&
                          row.variants[j] &&
                          traceBase ? (
                            <Button
                              key={`${variant.variantId}-${j}`}
                              type="button"
                              variant="outline"
                              aria-label={`Inspect lifecycle ${row.entryId} ${variant.variantId}`}
                              onClick={() =>
                                setInspect({
                                  ...traceBase,
                                  entryId: row.entryId,
                                  exitStrategy: variant.exitStrategy,
                                })
                              }
                            >
                              Inspect lifecycle
                            </Button>
                          ) : null,
                        )}
                      </td>
                    )}
                  </tr>
                  {expanded === row.entryId && (
                    <tr id={`detail-${i}`}>
                      <td colSpan={columns}>
                        <ResearchTradeDetail
                          entryId={row.entryId}
                          items={row.variants}
                          variants={variants}
                          timeframes={timeframes}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {inspect && (
        <ResearchLifecycle
          key={`${inspect.entryId}-${JSON.stringify(inspect.exitStrategy)}`}
          request={inspect}
          onClose={() => setInspect(null)}
        />
      )}
      {!rows.length && (
        <p className="text-sm text-gray-400 py-5 text-center">
          No hay trades para este filtro.
        </p>
      )}
    </section>
  );
}
