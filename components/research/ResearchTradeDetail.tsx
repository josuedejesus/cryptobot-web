import type { AnalyzedTrade, ResearchVariant } from "@/lib/research/types";
import {
  formatCurrency as money,
  formatNumber as num,
  formatPercent as pct,
  formatDate as date,
  formatPrice as price,
} from "@/lib/research/format";
export default function ResearchTradeDetail({
  entryId,
  items,
  variants,
  timeframes,
}: {
  entryId: string;
  items: (AnalyzedTrade | undefined)[];
  variants: ResearchVariant[];
  timeframes?: { signal: string; execution: string };
}) {
  const shared = items.find(Boolean)?.trade;
  if (!shared) return null;
  return (
    <section
      aria-label={`Detalle ${entryId}`}
      className="p-4 bg-gray-950 rounded-lg space-y-4 whitespace-normal"
    >
      <h3 className="font-mono text-sm break-all">{entryId}</h3>
      <p>
        {shared.side} · Señal: {date(shared.signalTime)} UTC · Entrada:{" "}
        {date(shared.entryTime)} UTC · Precio: {price(shared.entryPrice)}
      </p>
      {timeframes && (
        <p className="text-xs text-gray-400">
          Signal timeframe: {timeframes.signal} · Execution timeframe:{" "}
          {timeframes.execution}
          {timeframes.execution === timeframes.signal
            ? ""
            : " · las salidas se resuelven con esa resolución"}
        </p>
      )}
      <div className="grid md:grid-cols-2 gap-5">
        {items.map((item, i) => (
          <div key={`${variants[i].variantId}-${i}`} className="min-w-0">
            <h4 className="font-mono text-xs mb-3 break-all">
              {variants[i].variantId}
            </h4>
            {item ? (
              <>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    ["Salida UTC", date(item.trade.exitTime)],
                    [
                      "Salida exacta",
                      new Date(item.trade.exitTime).toISOString(),
                    ],
                    ["Precio salida", price(item.trade.exitPrice)],
                    ["PnL", money(item.trade.pnl)],
                    ["Fees", money(item.trade.fee)],
                    ["Funding", money(item.trade.funding)],
                    ["Resultado", item.trade.result],
                    ["Exit reason", item.trade.exitReason],
                    ["Velas", num(item.trade.candlesHeld)],
                    ["MFE bruto", money(item.trade.maxFavorablePnl)],
                    ["MAE bruto", money(item.trade.maxAdversePnl)],
                    ["Mejor precio", price(item.trade.maxFavorable)],
                    ["Peor precio", price(item.trade.maxAdverse)],
                    ["Capture", pct(item.metrics.mfeCaptureRatio)],
                    ["Giveback", money(item.metrics.peakGiveback)],
                    ["Green → Red", item.metrics.greenToRed ? "Sí" : "No"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="text-gray-200">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-gray-400">
                  Señal: {item.trade.reason}
                </p>
              </>
            ) : (
              <p>Sin resultado para esta entrada.</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
