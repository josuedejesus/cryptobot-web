import type { SignalContextV1 } from "@/lib/signals/types";
import {
  contextGroups,
  type ContextField,
} from "@/lib/signals/presentation";

const number = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 4 });
const price = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 8 });

/**
 * Formatea un campo del contexto.
 *
 * Regla dura de §11: `null` y ausente se muestran como "—". Nunca 0 — decir
 * "RSI 0" cuando el indicador no estaba disponible sería inventar un dato
 * que la estrategia no vio.
 */
function render(field: ContextField): string {
  const { value, kind } = field;
  if (value === null || value === undefined) return "—";
  if (kind === "boolean") return value === true ? "Sí" : "No";
  if (typeof value === "string") return value;
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  if (kind === "price") return price.format(value);
  return number.format(value);
}

/** Indicadores que la estrategia YA había calculado al decidir. */
export default function SignalContextView({
  context,
}: {
  context: SignalContextV1;
}) {
  const groups = contextGroups(context);
  return (
    <section aria-label="Contexto de la señal" className="space-y-3">
      <h4 className="text-xs text-gray-500 uppercase tracking-widest">
        Indicadores al decidir
      </h4>
      {context.price !== undefined && context.price !== null && (
        <p className="text-xs text-gray-500">
          Precio de la vela de señal:{" "}
          <span className="font-mono text-gray-300">
            {price.format(context.price)}
          </span>
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <div key={group.title} className="min-w-0">
            <h5 className="text-[11px] text-gray-400 font-medium mb-1.5">
              {group.title}
            </h5>
            <dl className="space-y-1">
              {group.fields.map((field) => (
                <div
                  key={field.label}
                  className="flex items-baseline justify-between gap-3 text-xs"
                >
                  <dt className="text-gray-500 truncate">{field.label}</dt>
                  <dd className="font-mono tabular-nums text-gray-300 whitespace-nowrap">
                    {render(field)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
