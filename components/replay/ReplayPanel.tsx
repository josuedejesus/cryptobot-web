"use client";
import { useEffect, useRef, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSavedConfigs,
  runReplay,
  ResearchApiError,
  type ReplayRunResponse,
} from "@/lib/research/replay-api";
import type { SavedConfig } from "@/lib/research/types";

const field =
  "w-full rounded-lg border border-gray-700 bg-[#12121a] px-3 py-2 text-sm text-white outline-none focus:border-emerald-500";

const fmtNum = (n: number | null, d = 4) =>
  n === null || n === undefined ? "—" : n.toFixed(d);
const fmtMoney = (n: number) => `$${n.toFixed(2)}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") : "—";
const short = (hash: string) => hash.slice(0, 12);

export default function ReplayPanel() {
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [configId, setConfigId] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ReplayRunResponse | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getSavedConfigs(controller.signal)
      .then((list) => {
        setConfigs(list);
        const active = list.find((c) => c.isActive) ?? list[0];
        if (active) setConfigId(active.id);
      })
      .catch((e) => {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(
          e instanceof ResearchApiError
            ? e.message
            : "No se pudieron cargar las configuraciones.",
        );
      });
    return () => controller.abort();
  }, []);

  async function run() {
    if (!configId || !from || !to) {
      setError("Elegí una config y un rango de fechas.");
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError("");
    try {
      const res = await runReplay({ configId, from, to }, controller.signal);
      setResult(res);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(
        e instanceof ResearchApiError
          ? e.message
          : "El replay falló. Intentá de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <History className="size-5 text-emerald-400" />
        <h1 className="text-xl font-bold">Production Replay</h1>
        <span className="text-sm text-gray-500">
          · reejecuta la política de una config sobre mercado histórico real
        </span>
      </div>

      {/* Controles */}
      <fieldset
        disabled={busy}
        className="space-y-5 rounded-xl border border-gray-800 bg-[#0d0d14] p-5 disabled:opacity-60"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Label htmlFor="cfg">Config (política congelada)</Label>
            <select
              id="cfg"
              className={`${field} mt-2`}
              value={configId}
              onChange={(e) => setConfigId(Number(e.target.value))}
            >
              {!configs.length && (
                <option value={0}>No hay configuraciones guardadas</option>
              )}
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} · {c.name} · {c.symbol} · {c.timeframe} / HTF{" "}
                  {c.trendTimeframe}
                  {c.isActive ? " · activa" : ""}
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
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            Carga warmup automático antes del rango; gestiona en el cierre del
            signal timeframe (igual que el bot).
          </p>
          <Button onClick={run} disabled={busy || !configId}>
            {busy ? <Loader2 className="animate-spin" /> : <History />}
            {busy ? "Corriendo…" : "Correr replay"}
          </Button>
        </div>
      </fieldset>

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Manifest */}
          <section className="rounded-xl border border-gray-800 bg-[#0d0d14] p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-300">
              Manifest reproducible
            </h2>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Símbolo" value={result.manifest.symbol} />
              <Field
                label="Timeframes"
                value={`${result.manifest.timeframe} / HTF ${result.manifest.trendTimeframe}`}
              />
              <Field
                label="Velas señal / trend"
                value={`${result.manifest.signalCandles} / ${result.manifest.trendCandles}`}
              />
              <Field
                label="Ventana reporte"
                value={`${fmtTime(new Date(result.manifest.window.reportFrom).toISOString())} → ${fmtTime(
                  new Date(result.manifest.window.reportTo).toISOString(),
                )}`}
              />
              <Field
                label="configHash"
                value={short(result.manifest.configHash)}
                title={result.manifest.configHash}
                mono
              />
              <Field
                label="datasetHash"
                value={short(result.manifest.datasetHash)}
                title={result.manifest.datasetHash}
                mono
              />
              <Field
                label="Warmup desde"
                value={fmtTime(
                  new Date(result.manifest.window.warmupStart).toISOString(),
                )}
              />
            </div>
          </section>

          {/* Summary */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Trades" value={String(result.summary.totalTrades)} />
            <Stat label="Cerrados" value={String(result.summary.closedTrades)} />
            <Stat
              label="Wins"
              value={String(result.summary.wins)}
              tone="pos"
            />
            <Stat
              label="Losses"
              value={String(result.summary.losses)}
              tone="neg"
            />
            <Stat label="Win rate" value={fmtPct(result.summary.winRate)} />
            <Stat
              label="Net PnL"
              value={fmtMoney(result.summary.netPnl)}
              tone={result.summary.netPnl >= 0 ? "pos" : "neg"}
            />
          </section>

          {/* Trades */}
          <section className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0d0d14]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 text-xs uppercase text-gray-500">
                <tr>
                  {[
                    "Lado",
                    "Entrada",
                    "Salida",
                    "Stop",
                    "PnL",
                    "Resultado",
                    "Motivo",
                    "Abierto",
                    "Cerrado",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.trades.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-6 text-center text-gray-500"
                    >
                      Sin trades en la ventana.
                    </td>
                  </tr>
                )}
                {result.trades.map((t, i) => (
                  <tr key={i} className="border-b border-gray-900/60">
                    <td className="px-3 py-2">{t.type ?? "—"}</td>
                    <td className="px-3 py-2">{fmtNum(t.entryPrice)}</td>
                    <td className="px-3 py-2">{fmtNum(t.exitPrice)}</td>
                    <td className="px-3 py-2">{fmtNum(t.stopLoss)}</td>
                    <td
                      className={`px-3 py-2 ${
                        (t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {t.pnl === null ? "—" : fmtMoney(t.pnl)}
                    </td>
                    <td className="px-3 py-2">
                      {t.result ?? (t.closedAt ? "—" : "ABIERTO")}
                    </td>
                    <td className="px-3 py-2 text-gray-400">{t.reason ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-400">
                      {fmtTime(t.openedAt)}
                    </td>
                    <td className="px-3 py-2 text-gray-400">
                      {fmtTime(t.closedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  title,
  mono,
}: {
  label: string;
  value: string;
  title?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div
        title={title}
        className={`mt-0.5 text-gray-200 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  const color =
    tone === "pos"
      ? "text-emerald-400"
      : tone === "neg"
        ? "text-red-400"
        : "text-white";
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d0d14] p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
