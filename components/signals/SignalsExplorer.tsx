"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  getSignalFacets,
  getSignalMeta,
  getSignals,
  SignalsApiError,
} from "@/lib/signals/api";
import {
  emptyFilters,
  type SignalFacets,
  type SignalFilters,
  type SignalListResponse,
  type SignalMeta,
} from "@/lib/signals/types";
import { rejectionLabel, statusLabel } from "@/lib/signals/presentation";
import SignalsTable from "./SignalsTable";

const percent = new Intl.NumberFormat("es-GT", {
  style: "percent",
  maximumFractionDigits: 1,
});

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 min-w-0">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest truncate">
        {label}
      </p>
      <p className="text-lg font-mono tabular-nums text-gray-100">{value}</p>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (next: string) => void;
}) {
  return (
    <label className="text-xs text-gray-500 block min-w-0">
      <span className="block mb-1">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-emerald-600"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInput({
  label,
  value,
  type,
  onChange,
}: {
  label: string;
  value: string;
  type: "number" | "date";
  onChange: (next: string) => void;
}) {
  return (
    <label className="text-xs text-gray-500 block min-w-0">
      <span className="block mb-1">{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-emerald-600"
      />
    </label>
  );
}

const all = (label: string) => ({ value: "ALL", label });

export default function SignalsExplorer() {
  const [filters, setFilters] = useState<SignalFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<SignalMeta | null>(null);
  const [facets, setFacets] = useState<SignalFacets | null>(null);
  /** Se incrementa con el botón de refresh. No hay polling (§41). */
  const [reload, setReload] = useState(0);

  const limit = meta?.limits.defaultLimit ?? 25;

  /**
   * El resultado se guarda JUNTO con la petición que lo produjo, y `loading`
   * se DERIVA de comparar ambas claves en vez de ser un `setState` dentro del
   * efecto. Así no hay un render intermedio en el que los datos ya son viejos
   * pero `loading` todavía dice que no.
   */
  const requestKey = JSON.stringify({ filters, page, limit, reload });
  const [result, setResult] = useState<{
    key: string;
    data: SignalListResponse;
  } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(
    null,
  );
  const data = result?.data ?? null;
  const error = failure?.key === requestKey ? failure.message : null;
  const loading = result?.key !== requestKey && error === null;

  // Catálogos: una sola vez al montar, no por página.
  useEffect(() => {
    const controller = new AbortController();
    void getSignalMeta(controller.signal)
      .then(setMeta)
      .catch(() => undefined);
    void getSignalFacets(controller.signal)
      .then(setFacets)
      .catch(() => undefined);
    return () => {
      controller.abort();
    };
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    getSignals(filters, page, limit, controller.signal)
      .then((response) => {
        setResult({ key: requestKey, data: response });
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setFailure({
          key: requestKey,
          message:
            cause instanceof SignalsApiError
              ? cause.message
              : "No se pudieron cargar las señales.",
        });
      });
    return () => {
      controller.abort();
    };
  }, [requestKey, filters, page, limit]);

  /** Cambiar un filtro vuelve a la página 1: la 7 podría no existir ya. */
  const set = useCallback((patch: Partial<SignalFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const summary = data?.summary;
  const other =
    summary === undefined
      ? []
      : Object.entries(summary.byStatus).filter(
          ([status]) => status !== "EXECUTED" && status !== "REJECTED",
        );

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">Señales</h1>
        <p className="text-sm text-gray-400">
          Registro de señales detectadas por el bot y la decisión tomada antes
          de abrir una posición.
        </p>
      </header>

      {/* ── Filtros rápidos ── */}
      <div className="flex flex-wrap items-end gap-4">
        <div
          role="group"
          aria-label="Filtrar por modo"
          className="flex rounded-lg border border-gray-700 overflow-hidden"
        >
          {[
            { value: "ALL", label: "Todos" },
            { value: "PAPER", label: "Paper" },
            { value: "LIVE", label: "Live" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filters.mode === option.value}
              onClick={() => {
                set({ mode: option.value });
              }}
              className={`px-3 py-1.5 text-xs ${
                filters.mode === option.value
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          role="group"
          aria-label="Filtrar por decisión"
          className="flex rounded-lg border border-gray-700 overflow-hidden"
        >
          {[
            { value: "ALL", label: "Todas" },
            { value: "EXECUTED", label: "Ejecutadas" },
            { value: "REJECTED", label: "Rechazadas" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filters.status === option.value}
              onClick={() => {
                set({ status: option.value });
              }}
              className={`px-3 py-1.5 text-xs ${
                filters.status === option.value
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setReload((value) => value + 1);
          }}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800"
        >
          <RefreshCw className="w-3 h-3" />
          Actualizar
        </button>
      </div>

      {/* ── Summary cards ── */}
      {summary !== undefined && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card label="Señales" value={String(summary.signals)} />
            <Card label="Ejecutadas" value={String(summary.executed)} />
            <Card label="Rechazadas" value={String(summary.rejected)} />
            <Card
              label="Tasa de ejecución"
              value={
                summary.executionRate === null
                  ? "—"
                  : percent.format(summary.executionRate)
              }
            />
          </div>
          {other.length > 0 && (
            <p className="text-[11px] text-gray-500">
              {/* Honestidad aritmética: señales ≠ ejecutadas + rechazadas. */}
              Otros estados en este rango:{" "}
              {other
                .map(([status, count]) => `${statusLabel(status)} ${count}`)
                .join(" · ")}
              . La tasa de ejecución usa el total de señales como denominador.
            </p>
          )}
          <p className="text-[11px] text-gray-500">
            Score · promedio {summary.score.all.average?.toFixed(2) ?? "—"} ·
            mediana {summary.score.all.median?.toFixed(2) ?? "—"} (
            {summary.score.all.scored} con score) · ejecutadas{" "}
            {summary.score.executed.average?.toFixed(2) ?? "—"} · rechazadas{" "}
            {summary.score.rejected.average?.toFixed(2) ?? "—"}
          </p>
        </div>
      )}

      {/* ── Filtros detallados ── */}
      <details className="bg-gray-900 border border-gray-800 rounded-xl">
        <summary className="px-4 py-2.5 text-sm text-gray-300 cursor-pointer hover:text-white">
          Más filtros
        </summary>
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Select
            label="Estado"
            value={filters.status}
            onChange={(status) => {
              set({ status });
            }}
            options={[
              all("Todos"),
              ...(meta?.statuses ?? []).map((status) => ({
                value: status,
                label: statusLabel(status),
              })),
            ]}
          />
          <Select
            label="Dirección"
            value={filters.side}
            onChange={(side) => {
              set({ side });
            }}
            options={[
              all("Todas"),
              { value: "LONG", label: "LONG" },
              { value: "SHORT", label: "SHORT" },
            ]}
          />
          <Select
            label="Símbolo"
            value={filters.symbol}
            onChange={(symbol) => {
              set({ symbol });
            }}
            options={[
              all("Todos"),
              ...(facets?.symbols ?? []).map((symbol) => ({
                value: symbol,
                label: symbol,
              })),
            ]}
          />
          <Select
            label="Tipo de señal"
            value={filters.signalType}
            onChange={(signalType) => {
              set({ signalType });
            }}
            options={[
              all("Todos"),
              ...(facets?.signalTypes ?? []).map((type) => ({
                value: type,
                label: type,
              })),
            ]}
          />
          <Select
            label="Motivo de rechazo"
            value={filters.rejectionCode}
            onChange={(rejectionCode) => {
              set({ rejectionCode });
            }}
            options={[
              all("Todos"),
              ...(facets?.rejectionCodes ?? []).map((code) => ({
                value: code,
                label: rejectionLabel(code),
              })),
            ]}
          />
          <TextInput
            label="Score mínimo"
            type="number"
            value={filters.minScore}
            onChange={(minScore) => {
              set({ minScore });
            }}
          />
          <TextInput
            label="Score máximo"
            type="number"
            value={filters.maxScore}
            onChange={(maxScore) => {
              set({ maxScore });
            }}
          />
          <TextInput
            label="Desde"
            type="date"
            value={filters.from}
            onChange={(from) => {
              set({ from });
            }}
          />
          <TextInput
            label="Hasta"
            type="date"
            value={filters.to}
            onChange={(to) => {
              set({ to });
            }}
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setFilters(emptyFilters);
                setPage(1);
              }}
              className="px-3 py-2 text-xs text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </details>

      {/* ── Tabla ── */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        {error !== null ? (
          <p role="alert" className="text-sm text-amber-400">
            {error}
          </p>
        ) : loading && data === null ? (
          <p className="text-sm text-gray-500">Cargando señales…</p>
        ) : data !== null && data.items.length === 0 ? (
          /* §28 · vacío NO es un error. */
          <div className="py-8 text-center space-y-1.5">
            <p className="text-sm text-gray-300">
              Todavía no hay señales registradas.
            </p>
            <p className="text-xs text-gray-500">
              Las nuevas señales de Paper y Live aparecerán aquí cuando el bot
              detecte una oportunidad de entrada.
            </p>
          </div>
        ) : (
          data !== null && <SignalsTable items={data.items} />
        )}

        {data !== null && data.items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-gray-500">
              {data.total} señales · página {data.page} de {data.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => {
                  setPage((value) => Math.max(1, value - 1));
                }}
                className="px-3 py-1.5 text-xs text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={data.page >= data.totalPages}
                onClick={() => {
                  setPage((value) => value + 1);
                }}
                className="px-3 py-1.5 text-xs text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>

      {/* §27 · período legacy. No se inventan decisiones hacia atrás. */}
      <p className="text-[11px] text-gray-600">
        El registro detallado de señales está disponible a partir de la
        activación de Trading Observability. Los trades anteriores existen, pero
        no tienen una decisión asociada.
      </p>
    </div>
  );
}
