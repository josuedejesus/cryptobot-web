import type { ResearchVariant } from "@/lib/research/types";
import {
  formatCurrency as money,
  formatNumber as num,
  formatPercent as pct,
} from "@/lib/research/format";
export const metricRows: {
  label: string;
  value: (v: ResearchVariant) => string;
}[] = [
  { label: "PnL total", value: (v) => money(v.summary.totalPnl) },
  { label: "Trades", value: (v) => num(v.summary.totalTrades) },
  { label: "Win rate", value: (v) => pct(v.summary.winRate) },
  { label: "Expectancy", value: (v) => money(v.quality.expectancy) },
  {
    label: "Profit factor",
    value: (v) =>
      v.quality.profitFactorStatus === "UNBOUNDED"
        ? "∞"
        : v.quality.profitFactorStatus === "UNDEFINED"
          ? "—"
          : num(v.quality.profitFactor),
  },
  {
    label: "Max drawdown",
    value: (v) =>
      `${money(v.quality.maxDrawdownAbsolute)} · ${pct(v.quality.maxDrawdownPct)}`,
  },
  {
    label: "Green → Red",
    value: (v) =>
      `${num(v.quality.greenToRedCount)} · ${pct(v.quality.greenToRedRate)}`,
  },
  {
    label: "MFE capture medio",
    value: (v) => pct(v.quality.avgMfeCaptureRatio),
  },
  { label: "Giveback medio", value: (v) => money(v.quality.avgPeakGiveback) },
  { label: "Hold medio (velas)", value: (v) => num(v.quality.avgCandlesHeld) },
  {
    label: "MFE / MAE medios",
    value: (v) => `${money(v.quality.avgMfe)} / ${money(v.quality.avgMae)}`,
  },
  {
    label: "Wins / Losses / Scratches",
    value: (v) =>
      `${v.summary.wins} / ${v.summary.losses} / ${v.summary.scratches}`,
  },
  {
    label: "Fees / Funding",
    value: (v) =>
      `${money(v.summary.totalFees)} / ${money(v.summary.totalFunding)}`,
  },
  {
    label: "Balance inicial / final",
    value: (v) =>
      `${money(v.summary.initialBalance)} / ${money(v.summary.finalBalance)}`,
  },
];
export default function ResearchSummary({
  variants,
  compare,
}: {
  variants: ResearchVariant[];
  compare: boolean;
}) {
  if (compare)
    return (
      <div className="overflow-x-auto bg-gray-900 border border-gray-800 rounded-xl p-4">
        <table className="w-full text-sm text-left">
          <caption className="text-left text-gray-400 mb-3">
            Comparación de métricas · sin ranking
          </caption>
          <thead>
            <tr>
              <th className="p-3">Métrica</th>
              {variants.map((v, i) => (
                <th
                  key={`${v.variantId}-${i}`}
                  className="p-3 font-mono text-xs min-w-56"
                >
                  {v.variantId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((m) => (
              <tr key={m.label} className="border-t border-gray-800">
                <th className="p-3 font-normal text-gray-400">{m.label}</th>
                {variants.map((v, i) => (
                  <td
                    key={`${v.variantId}-${i}`}
                    className="p-3 font-mono whitespace-nowrap"
                  >
                    {m.value(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      {metricRows.map((m) => (
        <div
          key={m.label}
          className="bg-gray-900 border border-gray-800 rounded-xl p-4"
        >
          <p className="text-xs text-gray-400 mb-2">{m.label}</p>
          <p className="font-mono text-lg break-words">
            {m.value(variants[0])}
          </p>
        </div>
      ))}
    </div>
  );
}
