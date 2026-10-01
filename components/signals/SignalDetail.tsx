"use client";

import { useEffect, useState } from "react";
import { ClipboardCopy, Check, AlertTriangle } from "lucide-react";
import { getSignalDetail, SignalsApiError } from "@/lib/signals/api";
import type { SignalDetail as Detail } from "@/lib/signals/types";
import {
  exitParamKind,
  exitParamLabels,
  orderExitParams,
  KNOWN_CONTEXT_VERSION,
  readBreakdown,
  readContext,
  rejectionLabel,
  stageLabel,
  statusLabel,
} from "@/lib/signals/presentation";
import ScoreBreakdownView from "./ScoreBreakdownView";
import SignalContextView from "./SignalContextView";

const price = new Intl.NumberFormat("es-GT", { maximumFractionDigits: 8 });
const money = new Intl.NumberFormat("es-GT", {
  style: "currency",
  currency: "USD",
  currencyDisplay: "narrowSymbol",
});
const stamp = new Intl.DateTimeFormat("es-GT", {
  timeZone: "UTC",
  dateStyle: "short",
  timeStyle: "medium",
});
const at = (value: string) => stamp.format(new Date(value));

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300"
    >
      {copied ? (
        <Check className="w-3 h-3" />
      ) : (
        <ClipboardCopy className="w-3 h-3" />
      )}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-200 break-words">{children}</dd>
    </div>
  );
}

export default function SignalDetail({
  id,
  onOpenTrade,
}: {
  id: number;
  /** Deja que la página decida qué hacer con un trade; acá no se navega. */
  onOpenTrade?: (tradeId: number) => void;
}) {
  /**
   * Resultado y error se guardan con el `id` que los produjo, y el estado de
   * carga se deriva de comparar. Evita el `setState` dentro del efecto, y de
   * paso evita mostrar el detalle de la fila anterior durante un instante al
   * abrir otra.
   */
  const [loaded, setLoaded] = useState<{ id: number; detail: Detail } | null>(
    null,
  );
  const [failure, setFailure] = useState<{
    id: number;
    message: string;
    status: number;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getSignalDetail(id, controller.signal)
      .then((value) => {
        setLoaded({ id, detail: value });
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setFailure(
          cause instanceof SignalsApiError
            ? { id, message: cause.message, status: cause.status }
            : { id, message: "No se pudo cargar el detalle.", status: 0 },
        );
      });
    return () => {
      controller.abort();
    };
  }, [id]);

  const detail = loaded?.id === id ? loaded.detail : null;
  const error = failure?.id === id ? failure : null;

  if (error !== null)
    return (
      <p role="alert" className="text-sm text-amber-400 p-4">
        {error.status === 404
          ? "Esa decisión no existe."
          : `No se pudo cargar el detalle: ${error.message}`}
      </p>
    );
  if (detail === null)
    return <p className="text-sm text-gray-500 p-4">Cargando detalle…</p>;

  const context = readContext(detail.context);
  const breakdown = readBreakdown(detail.scoreBreakdown);
  const knownContext = detail.contextVersion === KNOWN_CONTEXT_VERSION;
  const fill = detail.trade?.entryPrice ?? null;
  const drift =
    detail.expectedEntryPrice !== null && fill !== null
      ? fill - detail.expectedEntryPrice
      : null;

  const timeline: { at: string; label: string }[] = [
    { at: detail.signalCandleOpenTime, label: "Apertura de la vela de señal" },
    { at: detail.signalCandleCloseTime, label: "Cierre de la vela de señal" },
    { at: detail.decisionTime, label: "Decisión" },
    ...(detail.executionAttemptedAt === null
      ? []
      : [{ at: detail.executionAttemptedAt, label: "Orden enviada" }]),
    ...(detail.orderAcknowledgedAt === null
      ? []
      : [{ at: detail.orderAcknowledgedAt, label: "Orden confirmada" }]),
    ...(detail.trade === null
      ? []
      : [
          {
            at: detail.trade.openedAt,
            label: `Trade #${String(detail.trade.id)} abierto`,
          },
        ]),
  ];

  return (
    <section
      aria-label={`Detalle de la señal ${String(detail.id)}`}
      className="p-4 bg-gray-950 rounded-lg space-y-6"
    >
      {/* ── SEÑAL ── */}
      <section aria-label="Señal" className="space-y-3">
        <h3 className="text-sm font-medium">
          {detail.signalType ?? "Señal sin tipo"}
        </h3>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Dirección">{detail.side ?? "—"}</Field>
          <Field label="Score">
            <span className="font-mono tabular-nums">
              {detail.score === null ? "—" : detail.score.toFixed(2)}
            </span>
          </Field>
          <Field label="Símbolo">{detail.symbol}</Field>
          <Field label="Timeframe">{detail.timeframe}</Field>
        </dl>
        {detail.reason !== null && (
          <div>
            <p className="text-[11px] text-gray-500">Reason</p>
            <p className="text-sm text-gray-300">{detail.reason}</p>
          </div>
        )}
      </section>

      {/* ── DECISIÓN ── */}
      <section aria-label="Decisión tomada" className="space-y-2">
        <h4 className="text-xs text-gray-500 uppercase tracking-widest">
          Decisión
        </h4>
        <p className="text-sm text-gray-200">{statusLabel(detail.status)}</p>
        {(detail.rejectionStage !== null || detail.rejectionCode !== null) && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {detail.rejectionStage !== null && (
              <Field label="Etapa">
                {stageLabel(detail.rejectionStage)}
                <span className="block text-[10px] text-gray-600 font-mono">
                  {detail.rejectionStage}
                </span>
              </Field>
            )}
            {detail.rejectionCode !== null && (
              <Field label="Código">
                {rejectionLabel(detail.rejectionCode)}
                {/* El código técnico es la identidad estable, no la etiqueta. */}
                <span className="block text-[10px] text-gray-600 font-mono">
                  {detail.rejectionCode}
                </span>
              </Field>
            )}
          </dl>
        )}
        {detail.rejectionDetail !== null && (
          <p className="text-xs text-gray-400">{detail.rejectionDetail}</p>
        )}
      </section>

      {/* ── SCORE BREAKDOWN ── */}
      {breakdown === null ? (
        <p className="text-sm text-gray-500">
          Esta decisión no guardó desglose del score.
        </p>
      ) : (
        <ScoreBreakdownView
          breakdown={breakdown}
          storedScore={detail.score}
        />
      )}

      {/* ── CONTEXTO ── */}
      {!knownContext && (
        <p className="text-xs text-amber-400 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Contexto en versión {detail.contextVersion}; esta vista conoce la{" "}
          {KNOWN_CONTEXT_VERSION}. Se muestran los campos reconocidos y el JSON
          completo más abajo.
        </p>
      )}
      {context === null ? (
        <p className="text-sm text-gray-500">
          Esta decisión no guardó contexto de indicadores.
        </p>
      ) : (
        <SignalContextView context={context} />
      )}

      {/* ── TIMELINE ── */}
      <section aria-label="Cronología" className="space-y-2">
        <h4 className="text-xs text-gray-500 uppercase tracking-widest">
          Cronología
        </h4>
        {!detail.causalTiming && (
          <p
            role="alert"
            className="text-xs text-amber-400 flex items-start gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            La vela de señal cierra DESPUÉS del instante de decisión. El
            registro se muestra sin modificar.
          </p>
        )}
        {detail.causalTiming && (
          <p className="text-xs text-emerald-400">
            Causal timing ✓ · el cierre de la vela precede a la decisión
          </p>
        )}
        <ol className="space-y-1.5">
          {timeline.map((step, index) => (
            <li key={`${step.label}-${String(index)}`} className="flex gap-3 text-xs">
              <span className="font-mono tabular-nums text-gray-400 whitespace-nowrap">
                {at(step.at)}
              </span>
              <span className="text-gray-300">{step.label}</span>
            </li>
          ))}
        </ol>
        <p className="text-[10px] text-gray-600">
          UTC. Solo se listan los instantes realmente almacenados.
        </p>
      </section>

      {/* ── PRECIOS ── */}
      <section aria-label="Precios" className="space-y-2">
        <h4 className="text-xs text-gray-500 uppercase tracking-widest">
          Precios
        </h4>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Precio de decisión">
            <span className="font-mono tabular-nums">
              {price.format(detail.decisionPrice)}
            </span>
          </Field>
          <Field label="Entrada esperada">
            <span className="font-mono tabular-nums">
              {detail.expectedEntryPrice === null
                ? "—"
                : price.format(detail.expectedEntryPrice)}
            </span>
          </Field>
          <Field label="Fill real">
            {/* Viene del Trade. No se deduce de la decisión. */}
            <span className="font-mono tabular-nums">
              {fill === null ? "—" : price.format(fill)}
            </span>
          </Field>
          <Field label="Drift esperado → real">
            <span className="font-mono tabular-nums">
              {drift === null ? "—" : price.format(drift)}
            </span>
          </Field>
        </dl>
      </section>

      {/* ── TRADE ── */}
      {detail.trade !== null && (
        <section aria-label="Trade asociado" className="space-y-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-widest">
            Trade
          </h4>
          <div className="flex items-center gap-3">
            {onOpenTrade === undefined ? (
              <span className="text-sm font-medium">
                Trade #{detail.trade.id}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onOpenTrade(detail.trade!.id);
                }}
                className="text-sm font-medium text-emerald-400 hover:underline"
              >
                Trade #{detail.trade.id}
              </button>
            )}
            {detail.trade.result !== null && (
              <span className="text-xs text-gray-400">
                {detail.trade.result}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Entrada">
              <span className="font-mono tabular-nums">
                {price.format(detail.trade.entryPrice)}
              </span>
            </Field>
            <Field label="Salida">
              <span className="font-mono tabular-nums">
                {detail.trade.exitPrice === null
                  ? "—"
                  : price.format(detail.trade.exitPrice)}
              </span>
            </Field>
            <Field label="PnL">
              {/* Valor canónico del Trade. Acá no se recalcula nada. */}
              <span className="font-mono tabular-nums">
                {detail.trade.pnl === null ? "—" : money.format(detail.trade.pnl)}
              </span>
            </Field>
            <Field label="Cerrado">
              {detail.trade.closedAt === null
                ? "Abierto"
                : at(detail.trade.closedAt)}
            </Field>
          </dl>
          {detail.trade.reason !== null && (
            <p className="text-xs text-gray-500">
              Motivo de salida: {detail.trade.reason}
            </p>
          )}
        </section>
      )}

      {/* ── PROVENANCE DE CONFIG ── */}
      <section aria-label="Configuración efectiva" className="space-y-2">
        <h4 className="text-xs text-gray-500 uppercase tracking-widest">
          Configuración
        </h4>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Config ID">
            {detail.configId === null ? "—" : `#${String(detail.configId)}`}
          </Field>
          <Field label="Config hash">
            <span className="font-mono text-xs break-all">
              {detail.configHash}
            </span>
            <span className="block mt-0.5">
              <CopyButton value={detail.configHash} label="Copiar config hash" />
            </span>
          </Field>
        </dl>

        {/* Exit strategy del snapshot efectivo, no de la config actual. */}
        {detail.exitStrategy !== null && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-gray-500">Estrategia de salida</p>
            <p className="text-sm text-gray-200 font-mono">
              {detail.exitStrategy.type}
            </p>
            {detail.exitStrategy.params !== null &&
              Object.keys(detail.exitStrategy.params).length > 0 && (
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {orderExitParams(detail.exitStrategy.params).map(
                    ([name, value]) => {
                      const kind = exitParamKind(name);
                      return (
                        <div key={name} className="min-w-0">
                          <dt className="text-[11px] text-gray-500 truncate">
                            {exitParamLabels[name] ?? name}
                          </dt>
                          <dd className="text-xs font-mono tabular-nums text-gray-300">
                            {kind === "percent"
                              ? `${(value * 100).toFixed(2)}%`
                              : kind === "multiplier"
                                ? `${value.toFixed(2)}×`
                                : String(value)}
                          </dd>
                        </div>
                      );
                    },
                  )}
                </dl>
              )}
          </div>
        )}

        {detail.configSnapshot === null ? (
          <p className="text-xs text-gray-500">
            No hay snapshot para este hash. La telemetría es best-effort: la
            decisión se registró igual, pero la configuración exacta no quedó
            guardada.
          </p>
        ) : (
          <details className="group">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-200">
              Ver configuración efectiva
            </summary>
            <dl className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1">
              {Object.entries(detail.configSnapshot)
                .filter(([key]) => key !== "exitStrategy")
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-2 text-xs min-w-0">
                    <dt className="text-gray-500 truncate font-mono">{key}</dt>
                    <dd className="text-gray-300 font-mono tabular-nums whitespace-nowrap">
                      {typeof value === "boolean"
                        ? value
                          ? "Sí"
                          : "No"
                        : value === null
                          ? "—"
                          : typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                    </dd>
                  </div>
                ))}
            </dl>
          </details>
        )}
      </section>

      {/* ── TÉCNICO ── */}
      <details>
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-200">
          Detalles técnicos
        </summary>
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Decision ID">#{detail.id}</Field>
          <Field label="Modo">{detail.mode}</Field>
          <Field label="signalIdentity">
            <span className="font-mono text-xs break-all">
              {detail.signalIdentity}
            </span>
            <span className="block mt-0.5">
              <CopyButton
                value={detail.signalIdentity}
                label="Copiar signalIdentity"
              />
            </span>
          </Field>
          <Field label="contextVersion">{detail.contextVersion}</Field>
          {detail.clientOrderId !== null && (
            <Field label="clientOrderId">
              <span className="font-mono text-xs break-all">
                {detail.clientOrderId}
              </span>
            </Field>
          )}
          {detail.exchangeOrderId !== null && (
            <Field label="exchangeOrderId">
              <span className="font-mono text-xs break-all">
                {detail.exchangeOrderId}
              </span>
            </Field>
          )}
          <Field label="Registrada">{at(detail.createdAt)}</Field>
        </dl>

        {/* Fallback de §39: siempre disponible, nunca lo primero que se ve. */}
        {detail.context !== null && (
          <details className="mt-3">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
              Raw context
            </summary>
            <pre className="mt-2 text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(detail.context, null, 2)}
            </pre>
          </details>
        )}
        {detail.scoreBreakdown !== null && (
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">
              Raw score breakdown
            </summary>
            <pre className="mt-2 text-[10px] text-gray-400 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(detail.scoreBreakdown, null, 2)}
            </pre>
          </details>
        )}
      </details>
    </section>
  );
}
