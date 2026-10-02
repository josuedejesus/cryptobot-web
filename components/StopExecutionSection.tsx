"use client";

import { useEffect, useState } from "react";

interface StopCapabilities {
  paper: string[];
  live: string[];
}

export default function StopExecutionSection({
  mode,
  value,
  onChange,
}: {
  mode: string;
  value: string | null | undefined;
  onChange: (mode: "CANDLE_CLOSE" | "INTRABAR") => void;
}) {
  const [capabilities, setCapabilities] = useState<StopCapabilities | null>(null);
  const selected = value === "INTRABAR" ? "INTRABAR" : "CANDLE_CLOSE";

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";
    fetch(`${base}/bot-config/capabilities`)
      .then((response) => response.json())
      .then((data: { stopExecution?: StopCapabilities }) =>
        setCapabilities(data.stopExecution ?? null),
      )
      .catch(() => setCapabilities(null));
  }, []);

  if (mode === "live")
    return (
      <div className="rounded-md border border-gray-800 bg-black/10 px-3 py-3">
        <p className="text-xs font-semibold text-gray-300">Stop execution</p>
        <p className="mt-1 text-sm font-mono text-emerald-300">EXCHANGE_NATIVE</p>
        <p className="mt-1 text-xs text-gray-500">
          Live mantiene órdenes STOP_MARKET nativas del exchange.
        </p>
      </div>
    );

  const available = capabilities?.paper ?? ["CANDLE_CLOSE", "INTRABAR"];
  return (
    <fieldset className="space-y-2 rounded-md border border-gray-800 bg-black/10 px-3 py-3">
      <legend className="px-1 text-xs font-semibold text-gray-300">Stop execution · Paper</legend>
      {available.map((modeValue) => {
        const modeName = modeValue as "CANDLE_CLOSE" | "INTRABAR";
        return (
          <label key={modeValue} className="flex cursor-pointer items-start gap-2.5 text-xs">
            <input
              type="radio"
              name="stopExecutionMode"
              value={modeValue}
              checked={selected === modeValue}
              onChange={() => onChange(modeName)}
              className="mt-0.5 size-4 accent-emerald-400"
            />
            <span>
              <span className="font-medium text-gray-200">
                {modeValue === "CANDLE_CLOSE" ? "Candle close" : "Intrabar stream"}
              </span>
              <span className="mt-0.5 block leading-relaxed text-gray-500">
                {modeValue === "CANDLE_CLOSE"
                  ? "Conserva exactamente la evaluación de stops en cierres del management timeframe."
                  : "Ejecuta solo un stop ya efectivo cuando el stream de precio lo atraviesa; no recalcula Adaptive."}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
