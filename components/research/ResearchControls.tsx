"use client";
import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  ExitParamName,
  ExitStrategyType,
  LabRequest,
  ResearchCapabilities,
  ResearchExecutionMode,
  SavedConfig,
} from "@/lib/research/types";
import {
  initialValue,
  isRatio,
  parameterLabel,
  selectionFromDraft,
} from "@/lib/research/exit-parameters";
import { exitStrategyLabel } from "@/lib/research/presentation";
const field =
  "w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white focus-visible:outline-emerald-500";
interface VariantDraft {
  key: string;
  type: ExitStrategyType;
  enabled: boolean;
  params: Partial<Record<ExitParamName, string>>;
}
export default function ResearchControls({
  capabilities,
  configs,
  busy,
  onRun,
}: {
  capabilities: ResearchCapabilities;
  configs: SavedConfig[];
  busy: boolean;
  onRun: (request: LabRequest) => void;
}) {
  const [configId, setConfigId] = useState(
    configs.find((c) => c.isActive)?.id ?? configs[0]?.id ?? 0,
  );
  const [kind, setKind] = useState<"single" | "compare">("single");
  const [mode, setMode] = useState<ResearchExecutionMode>(
    capabilities.executionModes.includes("SEQUENTIAL")
      ? "SEQUENTIAL"
      : capabilities.executionModes[0],
  );
  const [type, setType] = useState<ExitStrategyType>(
    capabilities.exitStrategies[0]?.type,
  );
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    capabilities.exitStrategies.map((v, i) => ({
      key: `${v.type}-${i}`,
      type: v.type,
      enabled: true,
      params: Object.fromEntries(
        v.params.map((p) => [p.name, initialValue(p)]),
      ),
    })),
  );
  const [from, setFrom] = useState(() =>
    new Date(
      Date.now() - Math.min(90, capabilities.limits.maxRangeDays) * 86400000,
    )
      .toISOString()
      .slice(0, 16),
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 16));
  const [balance, setBalance] = useState(
    String(capabilities.initialBalanceDefault),
  );
  const [error, setError] = useState("");
  const config = configs.find((c) => c.id === configId);
  // "" = igual que la señal, el default y el comportamiento previo del backend.
  const [executionTimeframe, setExecutionTimeframe] = useState("");
  const signalTimeframe = config?.timeframe ?? "";
  const executionOptions = (
    capabilities.executionTimeframes?.[signalTimeframe] ?? []
  ).filter((tf) => tf !== signalTimeframe);
  const selected = variants.filter((v) =>
    kind === "single" ? v.type === type : v.enabled,
  );
  const update = (key: string, patch: Partial<VariantDraft>) =>
    setVariants((vs) =>
      vs.map((v) => (v.key === key ? { ...v, ...patch } : v)),
    );
  return (
    <form
      className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        try {
          const start = new Date(`${from}Z`),
            end = new Date(`${to}Z`);
          if (
            !from ||
            !to ||
            !Number.isFinite(start.getTime()) ||
            !Number.isFinite(end.getTime()) ||
            start >= end
          )
            throw new Error(
              "Ingresá fechas válidas: desde debe ser anterior a hasta.",
            );
          if (
            end.getTime() - start.getTime() >
            capabilities.limits.maxRangeDays * 86400000
          )
            throw new Error(
              `El rango máximo es ${capabilities.limits.maxRangeDays} días.`,
            );
          if (!config)
            throw new Error("Seleccioná una configuración guardada.");
          if (
            !balance.trim() ||
            !Number.isFinite(Number(balance)) ||
            Number(balance) < 0
          )
            throw new Error("El balance debe ser un número mayor o igual a 0.");
          if (
            !selected.length ||
            selected.length > capabilities.limits.maxExitVariants
          )
            throw new Error(
              `Seleccioná entre 1 y ${capabilities.limits.maxExitVariants} variantes.`,
            );
          const exits = selected.map((v) =>
            selectionFromDraft(
              v.type,
              v.params,
              capabilities.exitStrategies.find((c) => c.type === v.type)
                ?.params ?? [],
            ),
          );
          const base = {
            configId,
            from: start.toISOString(),
            to: end.toISOString(),
            initialBalance: Number(balance),
            // Solo se envía cuando difiere del signal timeframe: un request sin
            // el campo produce exactamente el resultado anterior.
            ...(executionTimeframe && executionTimeframe !== signalTimeframe
              ? { executionTimeframe }
              : {}),
          };
          setError("");
          onRun(
            kind === "single"
              ? {
                  kind,
                  body: {
                    ...base,
                    executionMode: mode,
                    exitStrategy: exits[0],
                  },
                }
              : { kind, body: { ...base, exits } },
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : "Revisá los campos.");
        }
      }}
    >
      <h2 className="text-xs text-gray-400 uppercase tracking-widest">
        Configuración del experimento
      </h2>
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="preset">Preset guardado</Label>
            <select
              id="preset"
              className={`${field} mt-2`}
              value={configId}
              onChange={(e) => setConfigId(Number(e.target.value))}
            >
              {!configs.length && (
                <option value={0}>No hay configuraciones guardadas</option>
              )}
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.symbol} · {c.timeframe} / HTF {c.trendTimeframe}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="from">Desde (UTC)</Label>
            <Input
              id="from"
              className={`${field} mt-2`}
              type="datetime-local"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="to">Hasta (UTC)</Label>
            <Input
              id="to"
              className={`${field} mt-2`}
              type="datetime-local"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            {config
              ? `${config.symbol} · ${config.timeframe} · HTF ${config.trendTimeframe}`
              : "Creá un preset desde Configuración / Robustez."}
            <span className="block text-xs text-gray-500 mt-1">
              Solo lectura · máximo {capabilities.limits.maxRangeDays} días;{" "}
              {capabilities.limits.maxCandles.toLocaleString()} velas por
              timeframe.
            </span>
          </p>
          <div>
            <Label htmlFor="execution-timeframe">Execution timeframe</Label>
            <select
              id="execution-timeframe"
              className={`${field} mt-2`}
              value={executionTimeframe}
              disabled={!executionOptions.length}
              onChange={(e) => setExecutionTimeframe(e.target.value)}
              aria-describedby="execution-timeframe-help"
            >
              <option value="">
                {signalTimeframe
                  ? `Same as signal (${signalTimeframe})`
                  : "Same as signal"}
              </option>
              {executionOptions.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
            <p
              id="execution-timeframe-help"
              className="text-xs text-gray-500 mt-1"
            >
              {executionTimeframe && executionTimeframe !== signalTimeframe
                ? `Las señales se siguen generando en ${signalTimeframe}. Stops y salidas se reproducen con velas de ${executionTimeframe}.`
                : "Controla con cuánta precisión se gestionan las posiciones después de la entrada. Las señales no cambian."}
            </p>
          </div>
          <div>
            <Label htmlFor="balance">Balance inicial analítico</Label>
            <Input
              id="balance"
              className={`${field} mt-2`}
              type="number"
              min="0"
              step="any"
              required
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Operación Research"
        >
          <Button
            type="button"
            variant="outline"
            aria-pressed={kind === "single"}
            onClick={() => setKind("single")}
            className={
              kind === "single" ? "border-emerald-500 text-emerald-400" : ""
            }
          >
            Una estrategia
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-pressed={kind === "compare"}
            disabled={
              !capabilities.executionModes.includes("FIXED_ENTRY_COHORT")
            }
            onClick={() => setKind("compare")}
            className={
              kind === "compare" ? "border-emerald-500 text-emerald-400" : ""
            }
          >
            Comparar exits
          </Button>
        </div>
        {kind === "single" ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="execution-mode">Modo de ejecución</Label>
              <select
                id="execution-mode"
                className={`${field} mt-2`}
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value as ResearchExecutionMode)
                }
              >
                {capabilities.executionModes.map((m) => (
                  <option key={m} value={m}>
                    {m === "SEQUENTIAL" ? "Sequential" : "Fixed Entry Cohort"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="exit-type">Estrategia de salida</Label>
              <select
                id="exit-type"
                className={`${field} mt-2`}
                value={type}
                onChange={(e) => setType(e.target.value as ExitStrategyType)}
              >
                {capabilities.exitStrategies.map((v) => (
                  <option key={v.type} value={v.type}>
                    {exitStrategyLabel(v.type)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {variants.map((v) => (
              <label key={v.key} className="flex gap-2 items-center text-sm">
                <input
                  type="checkbox"
                  checked={v.enabled}
                  onChange={(e) => update(v.key, { enabled: e.target.checked })}
                />
                {exitStrategyLabel(v.type)}
              </label>
            ))}
          </div>
        )}
        {(kind === "compare" || mode === "FIXED_ENTRY_COHORT") && (
          <p className="rounded-lg border border-gray-700 bg-gray-950 p-3 text-sm text-gray-300">
            <strong>Fixed Entry Cohort</strong> · Compara estrategias de salida
            usando exactamente las mismas entradas. Las posiciones pueden
            solaparse; no representa directamente un portfolio ejecutable.
          </p>
        )}
        {selected
          .filter((v) => v.type !== "CURRENT")
          .map((v) => {
            const capability = capabilities.exitStrategies.find(
              (c) => c.type === v.type,
            );
            return (
              <div
                key={v.key}
                className="border-t border-gray-800 pt-4 space-y-3"
              >
                <h3 className="text-sm font-medium">
                  {exitStrategyLabel(v.type)}
                </h3>
                {capability?.experimental && (
                  <p className="text-xs text-gray-400">
                    {capability.params.some((p) => p.recommended !== undefined)
                      ? "Pre-llenado con la mejor configuración MEDIDA sobre el cohort fijo de research; no es el default de la estrategia ni un óptimo validado fuera de muestra. Editable."
                      : "Defaults experimentales baseline; no son parámetros óptimos."}
                  </p>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {capability?.params.map((p) => (
                    <div key={p.name}>
                      <Label htmlFor={`${v.key}-${p.name}`}>
                        {parameterLabel(p)}
                        {isRatio(p) ? " (%)" : ""} · {v.type}
                      </Label>
                      <Input
                        id={`${v.key}-${p.name}`}
                        className={`${field} mt-2`}
                        type="number"
                        step="any"
                        required
                        min={
                          p.min === undefined && p.minExclusive === undefined
                            ? undefined
                            : (p.min ?? p.minExclusive)! *
                              (isRatio(p) ? 100 : 1)
                        }
                        max={
                          p.max === undefined
                            ? undefined
                            : p.max * (isRatio(p) ? 100 : 1)
                        }
                        value={v.params[p.name] ?? ""}
                        aria-describedby={
                          p.description ? `${v.key}-${p.name}-help` : undefined
                        }
                        onChange={(e) =>
                          update(v.key, {
                            params: { ...v.params, [p.name]: e.target.value },
                          })
                        }
                      />
                      {p.description && (
                        <p
                          id={`${v.key}-${p.name}-help`}
                          className="text-xs text-gray-500 mt-1"
                        >
                          {p.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={busy || !configs.length || !selected.length}
          className="bg-emerald-600 text-white hover:bg-emerald-500 h-10 px-5"
        >
          {busy ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Play aria-hidden />
          )}
          {busy
            ? "Ejecutando simulación histórica…"
            : kind === "single"
              ? "Ejecutar experimento"
              : "Comparar exits"}
        </Button>
      </div>
    </form>
  );
}
