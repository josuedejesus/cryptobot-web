"use client";

import { useState } from "react";
import {
  Save,
  Activity,
  Waves,
  X,
  Compass,
  Target,
  Check,
  ShieldAlert,
} from "lucide-react";
import { BotConfig } from "@/hooks/useBot";

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
    <div className="min-w-0">
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? NaN : parseFloat(raw));
        }}
        // text-base (16px) evita que iOS Safari haga auto-zoom al enfocar
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-600"
      />
      {hint && (
        <p className="text-[11px] text-gray-600 mt-1 leading-snug">{hint}</p>
      )}
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
    // Toda la fila es tappable, no solo el switch — área de toque más
    // grande y confiable en mobile (mínimo ~44px de alto recomendado).
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between gap-3 py-2 -mx-1 px-1 rounded-lg active:bg-gray-800/60 transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <span
        className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${
          value ? (danger ? "bg-red-600" : "bg-emerald-600") : "bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
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
    // pb-24 deja espacio para que la barra fija de "Guardar" (mobile) no
    // tape el final del contenido al hacer scroll.
    <div className="max-w-2xl mx-auto space-y-4 pb-24 sm:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-sm text-white">
          Configuración del Bot
        </h2>
        {/* Botón de guardar visible en desktop; en mobile se usa la barra
            fija de abajo para no competir con el header al hacer scroll. */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? "bg-gray-800 text-emerald-400 border border-emerald-700/40"
              : "bg-emerald-600 text-white hover:bg-emerald-500"
          } disabled:opacity-60`}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Guardando..." : saved ? "¡Guardado!" : "Guardar cambios"}
        </button>
      </div>

      {activeTrade && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3 flex items-start gap-3">
          <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
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
          Guardado. Reiniciá el bot para aplicar cambios de símbolo o timeframe.
        </div>
      )}

      <div
        className={`space-y-4 ${activeTrade ? "opacity-40 pointer-events-none select-none" : ""}`}
      >
        {/* General */}
        <SectionCard title="General">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label className="text-xs text-gray-500 block mb-1">
                Símbolo
              </label>
              <input
                value={form.symbol}
                onChange={(e) => set("symbol", e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div className="min-w-0">
              <label className="text-xs text-gray-500 block mb-1">
                Tendencia
              </label>
              <select
                value={form.trendTimeframe}
                onChange={(e) => set("trendTimeframe", e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-base sm:text-sm focus:outline-none focus:border-emerald-600"
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
            {/* grid en vez de flex: garantiza que los 4 botones siempre
                entren en una fila, sin desbordar en pantallas angostas. */}
            <div className="grid grid-cols-4 gap-2">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => set("timeframe", tf)}
                  className={`px-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
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
            <div className="col-span-2 sm:col-span-1">
              <NumberField
                label="Min Band Width %"
                value={form.minBandWidth}
                onChange={(v) => set("minBandWidth", v)}
                step={0.1}
                hint="Mercado por debajo de esto se ignora (comprimido)"
              />
            </div>
          </div>

          <div className="space-y-1 mt-4 pt-4 border-t border-gray-800">
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
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-800">
              <div className="min-w-0">
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
                className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${
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

        {/* Stochastic RSI */}
        <SectionCard
          title="Stochastic RSI"
          icon={<Activity className="w-3.5 h-3.5 text-blue-500" />}
        >
          <p className="text-[11px] text-gray-600 mb-3">
            Evento de entrada: cruce de %K sobre/bajo %D saliendo de zona
            extrema.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="RSI período"
              value={form.stochRsiRsiPeriod}
              onChange={(v) => set("stochRsiRsiPeriod", v)}
            />
            <NumberField
              label="Stochastic período"
              value={form.stochRsiStochPeriod}
              onChange={(v) => set("stochRsiStochPeriod", v)}
            />
            <NumberField
              label="%K período"
              value={form.stochRsiKPeriod}
              onChange={(v) => set("stochRsiKPeriod", v)}
            />
            <NumberField
              label="%D período"
              value={form.stochRsiDPeriod}
              onChange={(v) => set("stochRsiDPeriod", v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <NumberField
              label="Sobreventa (LONG)"
              value={form.stochRsiOversold}
              onChange={(v) => set("stochRsiOversold", v)}
              hint="Cruce alcista solo si venía bajo este nivel"
            />
            <NumberField
              label="Sobrecompra (SHORT)"
              value={form.stochRsiOverbought}
              onChange={(v) => set("stochRsiOverbought", v)}
              hint="Cruce bajista solo si venía sobre este nivel"
            />
          </div>
        </SectionCard>

        {/* Squeeze Release + ATR Expansion */}
        <SectionCard
          title="Squeeze Release + ATR Expansion"
          icon={<Waves className="w-3.5 h-3.5 text-amber-500" />}
        >
          <p className="text-[11px] text-gray-600 mb-3">
            Evento de entrada: las bandas de Bollinger se liberan tras
            compresión y el ATR confirma que el movimiento tiene fuerza real. La
            dirección la da la alineación de EMA9/EMA21.
          </p>
          <NumberField
            label="Umbral de squeeze (Bollinger Band Width %)"
            value={form.squeezeTreshold}
            onChange={(v) => set("squeezeTreshold", v)}
            step={0.25}
            hint="Bandwidth debe estar por debajo de este valor y bajando para considerarse squeeze. Más alto = menos selectivo (en 5+ prácticamente deja de filtrar compresión real en XRPUSDT)"
          />
        </SectionCard>

        {/* VWAP Reversion */}
        <SectionCard
          title="VWAP Reversion"
          icon={<Compass className="w-3.5 h-3.5 text-purple-500" />}
        >
          <p className="text-[11px] text-gray-600 mb-3">
            Evento de entrada: el precio toca/cruza el VWAP desde el lado
            contrario y cierra de vuelta del lado original — rechazo confirmado.
            No tiene parámetros propios además del peso en el score (abajo).
          </p>
        </SectionCard>

        {/* Riesgo */}
        <SectionCard
          title="Riesgo — SL inicial + Trailing Stop"
          icon={<Target className="w-3.5 h-3.5 text-amber-400" />}
        >
          <p className="text-[11px] text-gray-600 mb-3">
            El SL inicial protege apenas abre el trade. Una vez que el precio se
            mueve a favor lo suficiente, el trailing stop lo sigue de cerca —
            sin techo de TP fijo, deja correr los movimientos grandes.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <NumberField
              label="ATR período"
              value={form.atrPeriod}
              onChange={(v) => set("atrPeriod", v)}
            />
            <NumberField
              label="SL inicial × ATR"
              value={form.slAtrMultiplier}
              onChange={(v) => set("slAtrMultiplier", v)}
              step={0.25}
              hint="Distancia del stop loss antes de activar trailing"
            />
          </div>
          <div className="pt-4 border-t border-gray-800">
            <ToggleField
              label="Activar Trailing Stop"
              value={form.enableTrailingStop}
              onChange={(v) => set("enableTrailingStop", v)}
              hint="Off = solo SL fijo, sin TP (no recomendado)"
            />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <NumberField
                label="Activación (%)"
                value={form.trailingActivationPct}
                onChange={(v) => set("trailingActivationPct", v)}
                step={0.001}
                hint="Ganancia mínima para empezar a trailear"
              />
              <NumberField
                label="Distancia (%)"
                value={form.trailingDistancePct}
                onChange={(v) => set("trailingDistancePct", v)}
                step={0.001}
                hint="Qué tan cerca sigue el trailing al precio"
              />
            </div>
          </div>
        </SectionCard>

        {/* Score compuesto */}
        <SectionCard
          title="Score compuesto"
          icon={<Target className="w-3.5 h-3.5 text-emerald-400" />}
        >
          <p className="text-[11px] text-gray-600 mb-4">
            Solo dos eventos abren la entrada: Stoch RSI y Squeeze Release + ATR
            Expansion. Volumen, Tendencia y VWAP son confirmaciones — nunca
            abren entrada por sí solas, solo suman o restan puntos. Entra si el
            total supera el mínimo y le gana claramente a la dirección
            contraria.
          </p>
          <div className="mb-4">
            <NumberField
              label="Score mínimo para entrar"
              value={form.scoreMinToEnter}
              onChange={(v) => set("scoreMinToEnter", v)}
              step={0.5}
              hint="Más alto = más selectivo, menos trades"
            />
          </div>
          <p className="text-[11px] text-gray-600 mb-3">Puntos por factor</p>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Stoch RSI cruce"
              value={form.scoreStochRsiCross}
              onChange={(v) => set("scoreStochRsiCross", v)}
              step={0.5}
            />
            <NumberField
              label="Squeeze + ATR Expansion"
              value={form.scoreSqueezeExpansion}
              onChange={(v) => set("scoreSqueezeExpansion", v)}
              step={0.5}
            />
            <NumberField
              label="Volumen alto"
              value={form.scoreVolumeHigh}
              onChange={(v) => set("scoreVolumeHigh", v)}
              step={0.5}
            />
            <NumberField
              label="Tendencia a favor"
              value={form.scoreTrendAligned}
              onChange={(v) => set("scoreTrendAligned", v)}
              step={0.5}
              hint="Negativo si va en contra"
            />
            <NumberField
              label="Sobre/bajo VWAP"
              value={form.scoreVwapAligned}
              onChange={(v) => set("scoreVwapAligned", v)}
              step={0.5}
            />
            <NumberField
              label="VWAP Reversion"
              value={form.scoreVwapReversion}
              onChange={(v) => set("scoreVwapReversion", v)}
              step={0.5}
            />
          </div>
        </SectionCard>

        {/* Breakeven Stop */}
        <SectionCard
          title="Breakeven Stop"
          icon={<Target className="w-3.5 h-3.5 text-cyan-400" />}
        >
          <p className="text-[11px] text-gray-600 mb-3">
            Protección temprana e independiente del trailing: apenas el precio
            se mueve un poco a favor, el stop se mueve al precio de entrada (+
            un pequeño colchón). No reemplaza al trailing — solo evita que un
            trade que llegó a estar en ganancia termine cerrando en pérdida
            grande si revierte antes de activar el trailing.
          </p>
          <ToggleField
            label="Activar Breakeven Stop"
            value={form.enableBreakeven}
            onChange={(v) => set("enableBreakeven", v)}
          />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <NumberField
              label="Activación (%)"
              value={form.breakevenActivationPct}
              onChange={(v) => set("breakevenActivationPct", v)}
              step={0.0005}
              hint="Ganancia mínima para mover el stop a breakeven"
            />
            <NumberField
              label="Colchón (%)"
              value={form.breakevenOffsetPct}
              onChange={(v) => set("breakevenOffsetPct", v)}
              step={0.0001}
              hint="Margen sobre el entry para cubrir fees"
            />
          </div>
        </SectionCard>

        {/* Live Trading */}
        <SectionCard
          title="Live Trading"
          icon={<ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
        >
          <p className="text-[11px] text-gray-600 mb-4">
            Estos parámetros solo aplican cuando el modo es Live — en Paper
            Trading no tienen efecto.
          </p>

          <p className="text-[11px] text-gray-500 mb-2 font-medium">
            Kill switch — pérdida diaria
          </p>
          <NumberField
            label="Pérdida máxima diaria (USD)"
            value={form.maxDailyLossUsd ?? NaN}
            onChange={(v) => set("maxDailyLossUsd", Number.isNaN(v) ? null : v)}
            step={5}
            hint="Si la pérdida acumulada del día supera este valor, el bot deja de abrir nuevos trades hasta el día siguiente. Vacío = desactivado."
          />

          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-[11px] text-gray-500 mb-2 font-medium">
              Entrada por limit order
            </p>
            <p className="text-[11px] text-gray-600 mb-3">
              La entrada intenta ejecutarse como limit order (fee de maker, más
              barato) antes de caer a market. Si no se llena a tiempo y el
              precio no se alejó demasiado, entra a market como respaldo.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Offset del limit (%)"
                value={form.entryLimitOffsetPct}
                onChange={(v) => set("entryLimitOffsetPct", v)}
                step={0.0001}
                hint="Qué tan favorable respecto al precio actual"
              />
              <NumberField
                label="Timeout (ms)"
                value={form.entryLimitTimeoutMs}
                onChange={(v) => set("entryLimitTimeoutMs", v)}
                step={500}
                hint="Antes de cancelar y decidir qué hacer"
              />
            </div>
            <div className="mt-4">
              <NumberField
                label="Drift máximo tolerado (%)"
                value={form.entryMaxDriftPct}
                onChange={(v) => set("entryMaxDriftPct", v)}
                step={0.0001}
                hint="Si el precio se alejó más que esto sin llenar el limit, se descarta la señal en vez de entrar a market"
              />
            </div>
          </div>
        </SectionCard>

        {/* Confirmación de Entrada */}
        <SectionCard
          title="Confirmación de Entrada"
          icon={<Target className="w-3.5 h-3.5 text-cyan-400" />}
        >
          <p className="text-[11px] text-gray-600 mb-3">
            En vez de entrar directo al precio de la señal, espera a que el
            precio confirme un rebote rápido (mejor precio de entrada) antes de
            comprometerse. Si el pullback se profundiza demasiado, descarta la
            señal — el patrón histórico muestra que esos casos suelen terminar
            en pérdida.
          </p>
          <ToggleField
            label="Activar confirmación de entrada"
            value={form.enableEntryConfirmation}
            onChange={(v) => set("enableEntryConfirmation", v)}
          />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <NumberField
              label="Rebote requerido (%)"
              value={form.entryReboundPct}
              onChange={(v) => set("entryReboundPct", v)}
              step={0.0005}
              hint="Cuánto debe rebotar desde el peor punto para confirmar"
            />
            <NumberField
              label="Pullback máximo (%)"
              value={form.entryMaxPullbackPct}
              onChange={(v) => set("entryMaxPullbackPct", v)}
              step={0.001}
              hint="Si se profundiza más que esto, descarta la señal"
            />
          </div>
          <div className="mt-4">
            <NumberField
              label="Velas máximas de espera"
              value={form.entryConfirmMaxCandles}
              onChange={(v) => set("entryConfirmMaxCandles", v)}
              step={1}
              hint="Ventana máxima esperando confirmación antes de descartar"
            />
          </div>
        </SectionCard>
      </div>

      {/* Barra de guardar fija — solo mobile. En desktop el botón vive en
          el header, así que esta barra queda oculta (sm:hidden). El
          padding-bottom usa env(safe-area-inset-bottom) para no quedar
          tapada por la barra de gestos en iPhones con notch. */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-gray-950/95 backdrop-blur border-t border-gray-800 px-4 pt-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? "bg-gray-800 text-emerald-400 border border-emerald-700/40"
              : "bg-emerald-600 text-white active:bg-emerald-500"
          } disabled:opacity-60`}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? "Guardando..." : saved ? "¡Guardado!" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
