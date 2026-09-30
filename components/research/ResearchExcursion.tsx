import type { ResearchVariant } from "@/lib/research/types";
import { formatCurrency as money, formatNumber as num, formatPercent as pct } from "@/lib/research/format";

export default function ResearchExcursion({variants}: {variants: ResearchVariant[]}) {
  // Alignment only: all analytical values come directly from the response.
  const thresholds = [...new Set(variants.flatMap(v => v.excursion.thresholds.map(t => t.thresholdPct)))].sort((a,b) => a-b);
  return <section aria-label="MFE Excursion Analysis" className="space-y-4 bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6">
    <h2 className="text-lg font-semibold">MFE Excursion Analysis</h2>
    <p className="text-sm text-gray-400">MFE (Maximum Favorable Excursion) mide el mayor movimiento favorable antes de cerrar una posición. Green→Red indica trades que alcanzaron el nivel y terminaron con PnL neto negativo; su tasa usa solamente los trades que alcanzaron ese nivel.</p>
    <p className="text-xs text-gray-400">Los niveles son acumulativos. Con las mismas entradas, una salida más temprana puede alcanzar menos niveles. OHLC no identifica el orden intravela.</p>
    {variants.every(v => v.excursion.totalTrades === 0) ? <p>Sin trades para analizar excursiones.</p> : <>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left">
        <caption className="text-left text-gray-400 mb-3">Distribución del MFE favorable en precio</caption>
        <thead><tr><th className="p-3">Variante</th>{["Mean", "Median", "P25", "P75", "P90", "Maximum"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{variants.map((v,i) => <tr key={`${v.variantId}-${i}`} className="border-t border-gray-800"><th className="p-3 font-mono text-xs">{v.variantId}</th>{(["mean","median","p25","p75","p90","max"] as const).map(key => <td key={key} className="p-3 whitespace-nowrap">{pct(v.excursion.distribution[key])}</td>)}</tr>)}</tbody>
      </table></div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left">
        <caption className="text-left text-gray-400 mb-3">Niveles acumulativos por variante</caption>
        <thead><tr>{["MFE reached", "Variante", "Trades", "Reach rate", "WIN / LOSS / SCRATCH", "Finished red", "Green→Red", "Median capture", "Avg giveback"].map(label => <th className="p-3 whitespace-nowrap" key={label}>{label}</th>)}</tr></thead>
        <tbody>{thresholds.flatMap(threshold => variants.map((v,i) => {
          const t = v.excursion.thresholds.find(t => t.thresholdPct === threshold);
          return <tr key={`${threshold}-${v.variantId}-${i}`} className="border-t border-gray-800" data-testid={`excursion-${threshold}-${i}`}>
            <th className="p-3 whitespace-nowrap">≥ {pct(threshold)}</th><td className="p-3 font-mono text-xs">{v.variantId}</td>
            <td className="p-3">{t ? num(t.reachedCount) : "—"}</td><td className="p-3">{pct(t?.reachedRate ?? null)}</td>
            <td className="p-3 whitespace-nowrap">{t ? `${t.finishedPositiveCount} / ${t.finishedNegativeCount} / ${t.finishedScratchCount}` : "—"}</td>
            <td className="p-3">{t ? num(t.greenToRedCount) : "—"}</td><td className="p-3">{pct(t?.greenToRedRate ?? null)}</td>
            <td className="p-3">{pct(t?.medianMfeCaptureRatio ?? null)}</td><td className="p-3">{money(t?.avgPeakGiveback ?? null)}</td>
          </tr>;
        }))}</tbody>
      </table></div>
    </>}
    {variants.map((v,i) => <div key={`${v.variantId}-${i}`} className="overflow-x-auto">
      <h3 className="font-medium mb-2">Mayores movimientos favorables terminados en pérdida</h3>
      <p className="text-xs font-mono text-gray-400 mb-3 break-all">{v.variantId}</p>
      {!v.excursion.largestExcursionLosses.length ? <p className="text-sm text-gray-400">Sin pérdidas en esta variante.</p> : <table className="w-full text-sm text-left" aria-label={`Excursion losses ${v.variantId}`}>
        <thead><tr>{["Entry", "Side", "MFE %", "PnL", "Capture", "Giveback", "Hold", "Exit reason"].map(label => <th key={label} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead>
        <tbody>{v.excursion.largestExcursionLosses.map(t => <tr key={t.entryId} className="border-t border-gray-800">
          <th className="p-3 font-mono text-xs">{t.entryId}</th><td className="p-3">{t.trade.side}</td><td className="p-3">{pct(t.metrics.maxFavorablePct)}</td><td className="p-3">{money(t.trade.pnl)}</td><td className="p-3">{pct(t.metrics.mfeCaptureRatio)}</td><td className="p-3">{money(t.metrics.peakGiveback)}</td><td className="p-3">{num(t.trade.candlesHeld)}</td><td className="p-3">{t.trade.exitReason}</td>
        </tr>)}</tbody>
      </table>}
    </div>)}
  </section>;
}
