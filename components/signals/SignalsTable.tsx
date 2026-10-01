"use client";

import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { SignalListItem } from "@/lib/signals/types";
import {
  rejectionLabel,
  statusLabel,
  statusTone,
} from "@/lib/signals/presentation";
import SignalDetail from "./SignalDetail";

const stamp = new Intl.DateTimeFormat("es-GT", {
  timeZone: "UTC",
  dateStyle: "short",
  timeStyle: "short",
});

/**
 * Badge de estado.
 *
 * `REJECTED` NO va en rojo: una señal rechazada es el bot aplicando sus
 * reglas, no un error. El rojo queda para `EXECUTION_FAILED`.
 */
function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const className =
    tone === "executed"
      ? "bg-emerald-500/15 text-emerald-400"
      : tone === "failed"
        ? ""
        : tone === "rejected"
          ? "bg-gray-700/60 text-gray-300"
          : "bg-amber-500/15 text-amber-400";
  return (
    <Badge
      variant={tone === "failed" ? "destructive" : "secondary"}
      className={className}
    >
      {statusLabel(status)}
    </Badge>
  );
}

const sideClass = (side: string | null) =>
  side === "LONG"
    ? "text-emerald-400"
    : side === "SHORT"
      ? "text-red-400"
      : "text-gray-500";

export default function SignalsTable({
  items,
  onOpenTrade,
}: {
  items: SignalListItem[];
  onOpenTrade?: (tradeId: number) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Señales detectadas y la decisión tomada
        </caption>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-800">
            <th scope="col" className="py-2 pr-3 font-medium">
              Fecha
            </th>
            {/* §36: columnas secundarias ocultas en viewport chico. */}
            <th scope="col" className="py-2 pr-3 font-medium hidden md:table-cell">
              Modo
            </th>
            <th scope="col" className="py-2 pr-3 font-medium hidden lg:table-cell">
              Símbolo
            </th>
            <th scope="col" className="py-2 pr-3 font-medium hidden lg:table-cell">
              TF
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Señal
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Dirección
            </th>
            <th scope="col" className="py-2 pr-3 font-medium text-right">
              Score
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Decisión
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Motivo
            </th>
            <th scope="col" className="py-2 font-medium hidden md:table-cell">
              Trade
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const open = expanded === item.id;
            return (
              <Fragment key={item.id}>
                <tr
                  className={`border-b border-gray-800/60 hover:bg-gray-800/30 ${
                    open ? "bg-gray-800/30" : ""
                  }`}
                >
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => {
                        setExpanded(open ? null : item.id);
                      }}
                      className="font-mono tabular-nums text-xs text-gray-300 hover:text-white text-left"
                    >
                      {stamp.format(new Date(item.decisionTime))}
                    </button>
                  </td>
                  <td className="py-2 pr-3 hidden md:table-cell">
                    <span
                      className={`text-[10px] uppercase tracking-wider ${
                        item.mode === "LIVE" ? "text-sky-400" : "text-gray-400"
                      }`}
                    >
                      {item.mode}
                    </span>
                  </td>
                  <td className="py-2 pr-3 hidden lg:table-cell text-gray-300">
                    {item.symbol}
                  </td>
                  <td className="py-2 pr-3 hidden lg:table-cell text-gray-400">
                    {item.timeframe}
                  </td>
                  <td className="py-2 pr-3 text-gray-200 min-w-0">
                    <span className="block max-w-[14rem] truncate">
                      {item.signalType ?? "—"}
                    </span>
                    {/* §20 · forward test visible, sin cambiar nada. */}
                    {item.exitStrategyType === "ADAPTIVE_CHANDELIER" && (
                      <span className="text-[10px] text-amber-400">
                        Adaptive Chandelier · forward test
                      </span>
                    )}
                  </td>
                  <td className={`py-2 pr-3 ${sideClass(item.side)}`}>
                    {item.side ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-gray-200">
                    {item.score === null ? "—" : item.score.toFixed(1)}
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-400">
                    {item.rejectionCode === null
                      ? "—"
                      : rejectionLabel(item.rejectionCode)}
                  </td>
                  <td className="py-2 hidden md:table-cell">
                    {item.tradeId === null ? (
                      <span className="text-gray-600">—</span>
                    ) : onOpenTrade === undefined ? (
                      <span className="text-gray-300">#{item.tradeId}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenTrade(item.tradeId!);
                        }}
                        className="text-emerald-400 hover:underline"
                      >
                        #{item.tradeId}
                      </button>
                    )}
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={10} className="p-0 pb-3">
                      <SignalDetail id={item.id} onOpenTrade={onOpenTrade} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
