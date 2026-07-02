"use client";

import { useState } from "react";
import { Save, TrendingUp, TrendingDown, BarChart2, X, Compass } from "lucide-react";

interface BotConfig {
  symbol: string;
  timeframe: string;
  mode: string;
  positionSize: number;
  leverage: number;
  minBandWidth: number;
  trendTimeframe: string;
  onlyLong: boolean;
  onlyShort: boolean;
  isPaused: boolean;

  // EMA Cross
  emaCrossLongRsiMin: number;
  emaCrossLongRsiMax: number;
  emaCrossShortRsiMin: number;
  emaCrossShortRsiMax: number;
  emaCrossNeedsPrevCandle: boolean;

  // RSI Momentum
  rsiMomentumLongPrevMax: number;
  rsiMomentumLongCurrMin: number;
  rsiMomentumLongCurrMax: number;
  rsiMomentumShortPrevMin: number;
  rsiMomentumShortCurrMin: number;
  rsiMomentumDelta: number;
  rsiMomentumNeedsPrevCandle: boolean;
  enableRsiMomLong: boolean;

  // Divergencia
  enableBullishDiv: boolean;
  divLongRsiMax: number;
  divLongPrevRsiMax: number;
  enableBearishDiv: boolean;
  divShortRsiMin: number;
  divShortRsiMax: number;
  divNeedsPrevCandle: boolean;

  // BB Breakout
  bbBreakoutLongRsiMin: number;
  bbBreakoutLongRsiMax: number;
  bbBreakoutShortRsiMin: number;
  bbBreakoutShortRsiMax: number;
  bbBreakoutNeedsTrend: boolean;

  // Global
  enableTrendFilter: boolean;
}

interface BotControllerProps {
  config: BotConfig;
  onSave: (data: Partial<BotConfig>) => Promise<void>;
  activeTrade?: boolean;
}

const TIMEFRAMES = ["3m", "5m", "15m", "30m"];
const TREND_TIMEFRAMES = ["15m", "30m", "1h", "4h"];

// ── Componentes fuera del render principal ──
// Viven afuera de BotController para no perder identidad (y por lo tanto
// foco/scroll) en cada tecla tipeada. Reciben value/onChange en vez de
// leer directamente del form por closure.

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <input
        type="number"
        step={step}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? NaN : parseFloat(raw));
        }}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-600"
      />
      {hint && <p className="text-[11px] text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

function ToggleField({
  label,
  value,
  onChange,
  hint,
  danger,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          value ? (danger ? "bg-red-600" : "bg-emerald-600") : "bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <p className="text-xs text-gray-500 uppercase tracking-widest">
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

export default function BotController({
  config,
  onSave,
  activeTrade,
}: BotControllerProps) {
  const [form, setForm] = useState<BotConfig>({ ...config });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof BotConfig, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm text-white">
          Configuración del Bot
        </h2>
        
      </div>

      {activeTrade && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 flex items-center gap-3">
          <X className="w-4 h-4 text-red-400 shrink-0" />
          <div>
            <p className="text-red-400 text-sm font-medium">
              Trade activo en curso
            </p>
            <p className="text-gray-500 text-xs">
              Cerrá el trade antes de modificar la configuración.
            </p>
          </div>
        </div>
      )}

      {saving && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-2 text-amber-400 text-xs">
          Guardado. Reiniciá el bot para aplicar cambios de símbolo o
          timeframe.
        </div>
      )}

      <div
        className={`space-y-4 ${activeTrade ? "opacity-40 pointer-events-none select-none" : ""}`}
      >
        {/* General */}
        <SectionCard title="General">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Símbolo
              </label>
              <input
                value={form.symbol}
                onChange={(e) => set("symbol", e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                Tendencia
              </label>
              <select
                value={form.trendTimeframe}
                onChange={(e) => set("trendTimeframe", e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-600"
              >
                {TREND_TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs text-gray-500 block mb-2">
              Timeframe
            </label>
            <div className="flex gap-2">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => set("timeframe", tf)}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.timeframe === tf
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <NumberField
              label="Position Size (USDT)"
              value={form.positionSize}
              onChange={(v) => set("positionSize", v)}
            />
            <NumberField
              label="Leverage"
              value={form.leverage}
              onChange={(v) => set("leverage", v)}
            />
            <NumberField
              label="Min Band Width %"
              value={form.minBandWidth}
              onChange={(v) => set("minBandWidth", v)}
              step={0.1}
            />
          </div>

          <div className="space-y-4 mt-4 pt-4 border-t border-gray-800">
            <ToggleField
              label="Solo LONG"
              value={form.onlyLong}
              onChange={(v) => set("onlyLong", v)}
              hint="Ignora todas las señales SHORT"
            />
            <ToggleField
              label="Solo SHORT"
              value={form.onlyShort}
              onChange={(v) => set("onlyShort", v)}
              hint="Ignora todas las señales LONG"
            />
            <ToggleField
              label="Pausar bot"
              value={form.isPaused}
              onChange={(v) => set("isPaused", v)}
              hint="Detiene la ejecución de nuevas entradas"
              danger
            />
            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <div>
                <p className="text-sm font-medium">Modo</p>
                <p className="text-xs text-gray-500">
                  {form.mode === "live"
                    ? "⚠️ Operando con dinero real"
                    : "Simulación sin riesgo"}
                </p>
              </div>
              <button
                onClick={() =>
                  set("mode", form.mode === "paper" ? "live" : "paper")
                }
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  form.mode === "live" ? "bg-red-600" : "bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    form.mode === "live" ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </SectionCard>

        {/* EMA Cross */}
        <SectionCard
          title="Cruce de EMA"
          icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
        >
          <p className="text-[11px] text-gray-600 mb-3">LONG (cruce alcista)</p>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="RSI mín."
              value={form.emaCrossLongRsiMin}
              onChange={(v) => set("emaCrossLongRsiMin", v)}
            />
            <NumberField
              label="RSI máx."
              value={form.emaCrossLongRsiMax}
              onChange={(v) => set("emaCrossLongRsiMax", v)}
            />
          </div>
          <p className="text-[11px] text-gray-600 mt-4 mb-3">SHORT (cruce bajista)</p>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="RSI mín."
              value={form.emaCrossShortRsiMin}
              onChange={(v) => set("emaCrossShortRsiMin", v)}
            />
            <NumberField
              label="RSI máx."
              value={form.emaCrossShortRsiMax}
              onChange={(v) => set("emaCrossShortRsiMax", v)}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <ToggleField
              label="Requiere vela anterior confirmada"
              value={form.emaCrossNeedsPrevCandle}
              onChange={(v) => set("emaCrossNeedsPrevCandle", v)}
              hint="Filtra cruces prematuros"
            />
          </div>
        </SectionCard>

        {/* RSI Momentum */}
        <SectionCard
          title="RSI Momentum"
          icon={<BarChart2 className="w-3.5 h-3.5 text-blue-500" />}
        >
          <p className="text-[11px] text-gray-600 mb-3">LONG (rebote desde oversold)</p>
          <div className="grid grid-cols-3 gap-4">
            <NumberField
              label="prevRSI máx."
              value={form.rsiMomentumLongPrevMax}
              onChange={(v) => set("rsiMomentumLongPrevMax", v)}
            />
            <NumberField
              label="RSI mín. actual"
              value={form.rsiMomentumLongCurrMin}
              onChange={(v) => set("rsiMomentumLongCurrMin", v)}
            />
            <NumberField
              label="RSI máx. actual"
              value={form.rsiMomentumLongCurrMax}
              onChange={(v) => set("rsiMomentumLongCurrMax", v)}
            />
          </div>
          <p className="text-[11px] text-gray-600 mt-4 mb-3">SHORT (caída desde overbought)</p>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="prevRSI mín."
              value={form.rsiMomentumShortPrevMin}
              onChange={(v) => set("rsiMomentumShortPrevMin", v)}
            />
            <NumberField
              label="RSI mín. actual"
              value={form.rsiMomentumShortCurrMin}
              onChange={(v) => set("rsiMomentumShortCurrMin", v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <NumberField
              label="Delta máx."
              value={form.rsiMomentumDelta}
              onChange={(v) => set("rsiMomentumDelta", v)}
              hint="Cambio máx. de RSI entre velas (ambas direcciones)"
            />
          </div>
          <div className="space-y-4 mt-4 pt-4 border-t border-gray-800">
            <ToggleField
              label="Activar RSI Momentum alcista"
              value={form.enableRsiMomLong}
              onChange={(v) => set("enableRsiMomLong", v)}
            />
            <ToggleField
              label="Requiere vela anterior confirmada"
              value={form.rsiMomentumNeedsPrevCandle}
              onChange={(v) => set("rsiMomentumNeedsPrevCandle", v)}
            />
          </div>
        </SectionCard>

        {/* Divergencias */}
        <SectionCard
          title="Divergencias"
          icon={<TrendingDown className="w-3.5 h-3.5 text-purple-500" />}
        >
          <p className="text-[11px] text-gray-600 mb-3">LONG (divergencia alcista)</p>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="RSI máx."
              value={form.divLongRsiMax}
              onChange={(v) => set("divLongRsiMax", v)}
            />
            <NumberField
              label="prevRSI máx."
              value={form.divLongPrevRsiMax}
              onChange={(v) => set("divLongPrevRsiMax", v)}
            />
          </div>
          <p className="text-[11px] text-gray-600 mt-4 mb-3">SHORT (divergencia bajista)</p>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="RSI mín."
              value={form.divShortRsiMin}
              onChange={(v) => set("divShortRsiMin", v)}
            />
            <NumberField
              label="RSI máx."
              value={form.divShortRsiMax}
              onChange={(v) => set("divShortRsiMax", v)}
            />
          </div>
          <div className="space-y-4 mt-4 pt-4 border-t border-gray-800">
            <ToggleField
              label="Activar Divergencia alcista"
              value={form.enableBullishDiv}
              onChange={(v) => set("enableBullishDiv", v)}
            />
            <ToggleField
              label="Activar Divergencia bajista"
              value={form.enableBearishDiv}
              onChange={(v) => set("enableBearishDiv", v)}
            />
            <ToggleField
              label="Divergencia bajista requiere vela anterior"
              value={form.divNeedsPrevCandle}
              onChange={(v) => set("divNeedsPrevCandle", v)}
            />
          </div>
        </SectionCard>

        {/* BB Breakout */}
        <SectionCard
          title="Bollinger Breakout"
          icon={<BarChart2 className="w-3.5 h-3.5 text-amber-500" />}
        >
          <p className="text-[11px] text-gray-600 mb-3">LONG (ruptura banda superior)</p>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="RSI mín."
              value={form.bbBreakoutLongRsiMin}
              onChange={(v) => set("bbBreakoutLongRsiMin", v)}
            />
            <NumberField
              label="RSI máx."
              value={form.bbBreakoutLongRsiMax}
              onChange={(v) => set("bbBreakoutLongRsiMax", v)}
            />
          </div>
          <p className="text-[11px] text-gray-600 mt-4 mb-3">SHORT (ruptura banda inferior)</p>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="RSI mín."
              value={form.bbBreakoutShortRsiMin}
              onChange={(v) => set("bbBreakoutShortRsiMin", v)}
            />
            <NumberField
              label="RSI máx."
              value={form.bbBreakoutShortRsiMax}
              onChange={(v) => set("bbBreakoutShortRsiMax", v)}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <ToggleField
              label="Requiere tendencia + vela anterior alineadas"
              value={form.bbBreakoutNeedsTrend}
              onChange={(v) => set("bbBreakoutNeedsTrend", v)}
              hint="Off = versión permisiva (sin filtro de tendencia)"
            />
          </div>
        </SectionCard>

        {/* Global */}
        <SectionCard
          title="Filtros globales"
          icon={<Compass className="w-3.5 h-3.5 text-gray-400" />}
        >
          <ToggleField
            label="Filtro de tendencia global"
            value={form.enableTrendFilter}
            onChange={(v) => set("enableTrendFilter", v)}
            hint="Bloquea señales LONG en tendencia bajista y viceversa. Off = versión permisiva vieja"
          />
        </SectionCard>
      </div>

      {/* Footer save */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? "bg-gray-800 text-emerald-400 border border-emerald-700/40"
              : "bg-emerald-600 text-white hover:bg-emerald-500"
          } disabled:opacity-60`}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Guardando..." : saved ? "¡Guardado!" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}