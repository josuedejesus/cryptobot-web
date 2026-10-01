import type { ScoreBreakdown } from "@/lib/signals/types";
import { factorsTotal, selectedFactors } from "@/lib/signals/presentation";

const signed = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;

/**
 * Desglose del score tal como lo persistió la estrategia.
 *
 * El frontend NO recalcula: `points` sale de la fila y `Total` es la suma de
 * esos mismos puntos. Si la suma no coincide con el score guardado se avisa,
 * porque significa que algo cambió entre el cálculo y la persistencia — y eso
 * es justo lo que esta vista tiene que dejar ver.
 */
export default function ScoreBreakdownView({
  breakdown,
  storedScore,
}: {
  breakdown: ScoreBreakdown;
  storedScore: number | null;
}) {
  const factors = selectedFactors(breakdown);
  const total = factorsTotal(factors);
  const side = breakdown.selectedSide ?? breakdown.signal ?? null;
  const mismatch =
    storedScore !== null &&
    factors.length > 0 &&
    Math.abs(storedScore - total) > 1e-9;

  return (
    <section aria-label="Score breakdown" className="space-y-2">
      <h4 className="text-xs text-gray-500 uppercase tracking-widest">
        Score breakdown
      </h4>

      {factors.length === 0 ? (
        <p className="text-sm text-gray-500">
          Esta decisión no guardó factores
          {side === null ? "" : ` para ${side}`}.
        </p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">
            Factores del score persistidos para {side ?? "la señal"}
          </caption>
          <tbody>
            {factors.map((factor) => (
              <tr key={factor.code} className="align-top">
                <td className="py-1 pr-3 text-gray-300">
                  {factor.label}
                  <span className="block text-[10px] text-gray-600 font-mono">
                    {factor.code} · {factor.category}
                  </span>
                </td>
                <td
                  className={`py-1 text-right font-mono tabular-nums whitespace-nowrap ${
                    factor.points >= 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {signed(factor.points)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-gray-700">
              <td className="pt-2 text-gray-400">Total</td>
              <td className="pt-2 text-right font-mono tabular-nums">
                {total.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Debugging explícito: lo guardado y la suma, por separado. */}
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
        <div className="flex gap-1.5">
          <dt>Score guardado</dt>
          <dd className="font-mono text-gray-300">
            {storedScore === null ? "—" : storedScore.toFixed(2)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Suma del desglose</dt>
          <dd className="font-mono text-gray-300">
            {factors.length === 0 ? "—" : total.toFixed(2)}
          </dd>
        </div>
      </dl>

      {mismatch && (
        <p className="text-xs text-amber-400">
          El score guardado y la suma del desglose no coinciden. No se corrige
          ninguno de los dos: se muestran tal como están persistidos.
        </p>
      )}

      {breakdown.scores !== undefined &&
        Object.keys(breakdown.scores).length > 0 && (
          <p className="text-xs text-gray-600">
            Scores por lado:{" "}
            {Object.entries(breakdown.scores)
              .map(([key, value]) => `${key} ${value.toFixed(2)}`)
              .join(" · ")}
          </p>
        )}
    </section>
  );
}
