"use client";

import { useState } from "react";
import type { ResearchReproducibility as Reproducibility } from "@/lib/research/types";

/**
 * Sección Reproducibility.
 *
 * Los hashes vienen de la MISMA ejecución que produjo los resultados de
 * arriba: el backend los deriva de la config efectiva, el dataset, el contexto
 * y el cohort que acabó de usar, no de una segunda carga. Eso es lo que hace
 * que anotar un Run ID sirva para reproducir la corrida después.
 */

const short = (hash: string | null) =>
  hash === null ? "—" : `${hash.slice(0, 12)}…`;

function Row({
  label,
  value,
  title,
  mono = true,
}: {
  label: string;
  value: string;
  title?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span
        className={`text-xs text-gray-200 text-right break-all ${mono ? "font-mono" : ""}`}
        title={title ?? value}
      >
        {value}
      </span>
    </div>
  );
}

export default function ResearchReproducibility({
  reproducibility,
  manifest,
}: {
  reproducibility: Reproducibility;
  manifest: unknown;
}) {
  const [copied, setCopied] = useState(false);
  const manifestText = JSON.stringify(manifest, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(manifestText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de clipboard queda la descarga, que no depende de él.
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([manifestText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `research-lab-manifest-${reproducibility.runId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="font-medium">Reproducibility</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 hover:bg-gray-800 transition"
          >
            {copied ? "Copiado" : "Copy manifest"}
          </button>
          <button
            type="button"
            onClick={download}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 hover:bg-gray-800 transition"
          >
            Download manifest
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-x-8 gap-y-0 sm:grid-cols-2">
        <Row label="Run ID" value={reproducibility.runId} />
        <Row label="Entries" value={String(reproducibility.entryCount)} />
        <Row
          label="Config hash"
          value={short(reproducibility.effectiveConfigHash)}
          title={reproducibility.effectiveConfigHash}
        />
        <Row
          label="Experiment hash"
          value={short(reproducibility.experimentDefinitionHash)}
          title={reproducibility.experimentDefinitionHash}
        />
        <Row
          label="Dataset hash (signal)"
          value={short(reproducibility.signalDatasetHash)}
          title={reproducibility.signalDatasetHash}
        />
        <Row
          label="Dataset hash (trend)"
          value={short(reproducibility.trendDatasetHash)}
          title={reproducibility.trendDatasetHash}
        />
        <Row
          label="Dataset hash (execution)"
          value={short(reproducibility.executionDatasetHash)}
          title={reproducibility.executionDatasetHash ?? "sin execution track"}
        />
        <Row
          label="Cohort hash"
          value={short(reproducibility.entryCohortHash)}
          title={reproducibility.entryCohortHash}
        />
        <Row
          label="Provider"
          value={reproducibility.provider}
          mono={false}
        />
        <Row
          label="Velas signal"
          value={String(reproducibility.signalCandleCount)}
        />
        <Row
          label="Rango real"
          value={
            reproducibility.actualFrom === null
              ? "—"
              : `${reproducibility.actualFrom.slice(0, 16)}Z → ${
                  reproducibility.actualTo?.slice(0, 16) ?? "?"
                }Z`
          }
        />
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Derivado de esta misma ejecución: misma config efectiva, mismas velas,
        mismo cohort. El rango real incluye el warmup, que empieza antes del
        periodo pedido. Dos corridas con estos mismos hashes son el mismo
        experimento.
      </p>
    </div>
  );
}
