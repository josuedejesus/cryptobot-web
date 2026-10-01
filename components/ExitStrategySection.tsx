"use client";

import { useEffect, useState } from "react";

/**
 * Sección "Estrategia de salida".
 *
 * El formulario se genera desde `/bot-config/capabilities`: la UI no sabe
 * "mágicamente" qué parámetros acepta cada estrategia, los pide. Así añadir una
 * estrategia en el backend no obliga a tocar este componente.
 *
 * La disponibilidad por modo también viene del backend. El `disabled` de acá es
 * una conveniencia visual, **no** la protección: quien rechaza guardar Adaptive
 * en una config de Live es el backend.
 */

export interface ExitStrategyParamSpec {
  name: string;
  label: string;
  type: "number";
  default: number;
  min: number;
  max: number;
  step: number;
  display: "percent" | "multiplier" | "integer";
  description: string;
}

export interface ExitStrategyCapability {
  type: string;
  paper: boolean;
  live: boolean;
  label: string;
  experimental: boolean;
  description: string;
  params: ExitStrategyParamSpec[];
}

/** Cómo se muestra cada parámetro según su `display`. */
const toDisplay = (value: number, display: ExitStrategyParamSpec["display"]) =>
  display === "percent" ? value * 100 : value;
const fromDisplay = (
  value: number,
  display: ExitStrategyParamSpec["display"],
) => (display === "percent" ? value / 100 : value);
const unitOf = (display: ExitStrategyParamSpec["display"]) =>
  display === "percent" ? "%" : display === "multiplier" ? "×" : "";
const stepOf = (spec: ExitStrategyParamSpec) =>
  spec.display === "percent" ? spec.step * 100 : spec.step;

export default function ExitStrategySection({
  mode,
  type,
  params,
  onChange,
}: {
  /** Modo de la config que se está editando. */
  mode: string;
  /** Tipo guardado, o null = CURRENT. */
  type: string | null;
  params: Record<string, number> | null;
  onChange: (next: {
    type: string | null;
    params: Record<string, number> | null;
  }) => void;
}) {
  const [capabilities, setCapabilities] = useState<ExitStrategyCapability[]>([]);
  const [error, setError] = useState("");
  const operationalMode = mode === "live" ? "live" : "paper";
  const selectedType = type ?? "CURRENT";

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";
    fetch(`${base}/bot-config/capabilities`)
      .then((r) => r.json())
      .then((data: { exitStrategies: ExitStrategyCapability[] }) =>
        setCapabilities(data.exitStrategies ?? []),
      )
      .catch(() => setError("No se pudieron cargar las estrategias de salida."));
  }, []);

  const selected = capabilities.find((c) => c.type === selectedType);
  const allowed = (c: ExitStrategyCapability) =>
    operationalMode === "live" ? c.live : c.paper;

  const setParam = (spec: ExitStrategyParamSpec, displayValue: number) => {
    const next = { ...(params ?? {}) };
    next[spec.name] = fromDisplay(displayValue, spec.display);
    onChange({ type: selectedType, params: next });
  };

  const changeType = (nextType: string) => {
    if (nextType === "CURRENT") {
      /**
       * Al volver a CURRENT se LIMPIAN los parámetros. Podrían conservarse sin
       * afectar el hash —el backend canonicaliza y los parámetros inactivos no
       * cuentan— pero dejarlos guardados invita a confundir qué estaba activo
       * al leer la fila a mano.
       */
      onChange({ type: null, params: null });
      return;
    }
    // Al elegir una estrategia se siembran sus defaults, así nunca se guarda
    // un parcial que dependa de los defaults del frontend.
    const capability = capabilities.find((c) => c.type === nextType);
    const defaults: Record<string, number> = {};
    for (const spec of capability?.params ?? [])
      defaults[spec.name] = spec.default;
    onChange({ type: nextType, params: { ...defaults, ...(params ?? {}) } });
  };

  return (
    <div className="space-y-4">
      {error !== "" && (
        <p className="text-xs text-amber-400">{error}</p>
      )}

      <div className="min-w-0">
        <label className="text-xs text-gray-500 block mb-1">
          Estrategia de salida
        </label>
        <select
          value={selectedType}
          onChange={(e) => changeType(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-600"
        >
          {capabilities.map((capability) => (
            <option
              key={capability.type}
              value={capability.type}
              disabled={!allowed(capability)}
            >
              {capability.label}
              {capability.experimental ? " — Paper / Experimental" : ""}
              {allowed(capability) ? "" : " (no disponible en Live)"}
            </option>
          ))}
        </select>
        {selected !== undefined && (
          <p className="text-xs text-gray-500 mt-1.5">{selected.description}</p>
        )}
        {selected !== undefined && !allowed(selected) && (
          <p className="text-xs text-amber-400 mt-1.5">
            Disponible actualmente para Paper Trading. El backend rechaza
            guardarla en una configuración de Live.
          </p>
        )}
      </div>

      {selected !== undefined && selected.experimental && allowed(selected) && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2">
          <p className="text-xs text-amber-400">
            <span className="font-medium">Forward testing.</span> Current es la
            estrategia operativa; esta está en evaluación sobre datos futuros.
          </p>
        </div>
      )}

      {/* Parámetros: dependen de la estrategia, generados desde el schema. */}
      {selected !== undefined && selected.params.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {selected.params.map((spec) => {
            const raw = params?.[spec.name] ?? spec.default;
            return (
              <div key={spec.name} className="min-w-0">
                <label className="text-xs text-gray-500 block mb-1">
                  {spec.label}
                  {unitOf(spec.display) !== "" && (
                    <span className="text-gray-600">
                      {" "}
                      ({unitOf(spec.display)})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={toDisplay(raw, spec.display)}
                  min={toDisplay(spec.min, spec.display)}
                  max={toDisplay(spec.max, spec.display)}
                  step={stepOf(spec)}
                  onChange={(e) => setParam(spec, Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-600"
                />
                <p className="text-xs text-gray-600 mt-1">{spec.description}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
