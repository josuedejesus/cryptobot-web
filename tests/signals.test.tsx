import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignalsExplorer from "@/components/signals/SignalsExplorer";
import SignalDetail from "@/components/signals/SignalDetail";
import * as api from "@/lib/signals/api";
import { buildQuery, SignalsApiError } from "@/lib/signals/api";
import { emptyFilters } from "@/lib/signals/types";
import { exitParamLabels } from "@/lib/signals/presentation";
import {
  detail,
  empty,
  facets,
  list,
  meta,
  paged,
  rejectedDetail,
} from "./signals.fixture";

vi.mock("@/lib/signals/api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/signals/api")>(
      "@/lib/signals/api",
    );
  return {
    ...actual,
    getSignals: vi.fn(),
    getSignalDetail: vi.fn(),
    getSignalFacets: vi.fn(),
    getSignalMeta: vi.fn(),
  };
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getSignals).mockResolvedValue(list);
  vi.mocked(api.getSignalDetail).mockResolvedValue(detail);
  vi.mocked(api.getSignalFacets).mockResolvedValue(facets);
  vi.mocked(api.getSignalMeta).mockResolvedValue(meta);
});

const ready = async () => {
  render(<SignalsExplorer />);
  // La tabla: el tipo de señal también aparece como <option> del filtro.
  await screen.findByRole("table");
  return userEvent.setup();
};

/** Última llamada a getSignals, para afirmar sobre los filtros enviados. */
const lastCall = () => {
  const calls = vi.mocked(api.getSignals).mock.calls;
  return calls[calls.length - 1]!;
};

// ── §44 · lista ───────────────────────────────────────────────────────────

describe("lista de señales", () => {
  it("muestra el encabezado y la explicación", async () => {
    await ready();
    expect(
      screen.getByRole("heading", { level: 1, name: "Señales" }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Registro de señales detectadas por el bot/),
    ).toBeTruthy();
  });

  it("renderiza una fila por decisión con sus columnas", async () => {
    await ready();
    const rows = screen.getAllByRole("row");
    // Encabezado + 3 filas.
    expect(rows).toHaveLength(4);
    const first = within(rows[1]!);
    expect(first.getByText("VWAP Reversion alcista")).toBeTruthy();
    expect(first.getByText("LONG")).toBeTruthy();
    expect(first.getByText("4.0")).toBeTruthy();
    expect(first.getByText("XRPUSDT")).toBeTruthy();
  });

  it("muestra el badge de ejecutada", async () => {
    await ready();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]!).getByText("Ejecutada")).toBeTruthy();
  });

  it("muestra el badge de rechazada", async () => {
    await ready();
    const rows = screen.getAllByRole("row");
    expect(within(rows[2]!).getByText("Rechazada")).toBeTruthy();
  });

  it("traduce el motivo de rechazo a lenguaje humano en la tabla", async () => {
    await ready();
    // Scope a la tabla: el select de filtros muestra las mismas etiquetas.
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Ya había una posición abierta")).toBeTruthy();
    expect(table.getByText("Confirmación expirada")).toBeTruthy();
  });

  it("§33 · no interpreta el score como calidad", async () => {
    await ready();
    for (const forbidden of [
      /señal fuerte/i,
      /alta calidad/i,
      /mala señal/i,
      /high quality/i,
      /strong trade/i,
    ])
      expect(screen.queryByText(forbidden)).toBeNull();
  });

  it("§20 · marca las señales con Adaptive Chandelier en forward test", async () => {
    await ready();
    const rows = screen.getAllByRole("row");
    expect(
      within(rows[1]!).getByText(/Adaptive Chandelier · forward test/),
    ).toBeTruthy();
    // La fila sin Adaptive no lleva badge.
    expect(
      within(rows[2]!).queryByText(/Adaptive Chandelier/),
    ).toBeNull();
  });

  it("§29 · distingue PAPER de LIVE", async () => {
    await ready();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]!).getByText("PAPER")).toBeTruthy();
    expect(within(rows[3]!).getByText("LIVE")).toBeTruthy();
  });

  it("§16 · enlaza al trade cuando existe y muestra — cuando no", async () => {
    await ready();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]!).getByText("#812")).toBeTruthy();
    expect(within(rows[2]!).queryByText(/^#\d+$/)).toBeNull();
  });
});

// ── §31 / §32 · resumen ───────────────────────────────────────────────────

describe("summary cards", () => {
  it("muestra señales, ejecutadas, rechazadas y tasa", async () => {
    await ready();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("18")).toBeTruthy();
    expect(screen.getByText("24")).toBeTruthy();
    expect(screen.getByText("42.9%")).toBeTruthy();
  });

  it("muestra promedio y mediana del score", async () => {
    await ready();
    expect(screen.getByText(/promedio 3\.80/)).toBeTruthy();
    expect(screen.getByText(/mediana 4\.00/)).toBeTruthy();
  });

  it("avisa cuando hay estados que no son executed ni rejected", async () => {
    vi.mocked(api.getSignals).mockResolvedValue({
      ...list,
      summary: {
        ...list.summary,
        byStatus: { EXECUTED: 18, REJECTED: 24, AWAITING_CONFIRMATION: 6 },
      },
    });
    await ready();
    expect(
      screen.getByText(/Otros estados en este rango: Esperando confirmación 6/),
    ).toBeTruthy();
  });
});

// ── §6 / §30 · filtros ────────────────────────────────────────────────────

describe("filtros", () => {
  it("§30 · filtra por modo con los botones rápidos", async () => {
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Paper" }));
    await waitFor(() => {
      expect(lastCall()[0].mode).toBe("PAPER");
    });
    await user.click(screen.getByRole("button", { name: "Live" }));
    await waitFor(() => {
      expect(lastCall()[0].mode).toBe("LIVE");
    });
  });

  it("§30 · filtra ejecutadas y rechazadas con un click", async () => {
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Ejecutadas" }));
    await waitFor(() => {
      expect(lastCall()[0].status).toBe("EXECUTED");
    });
    await user.click(screen.getByRole("button", { name: "Rechazadas" }));
    await waitFor(() => {
      expect(lastCall()[0].status).toBe("REJECTED");
    });
  });

  it("puebla los selects con los valores presentes, no con una lista fija", async () => {
    const user = await ready();
    await user.click(screen.getByText("Más filtros"));
    const symbol = screen.getByLabelText("Símbolo") as HTMLSelectElement;
    expect(
      [...symbol.options].map((option) => option.value),
    ).toEqual(["ALL", "BTCUSDT", "XRPUSDT"]);
  });

  it("muestra los motivos de rechazo traducidos en el select", async () => {
    const user = await ready();
    await user.click(screen.getByText("Más filtros"));
    const select = screen.getByLabelText(
      "Motivo de rechazo",
    ) as HTMLSelectElement;
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "Todos",
      "Confirmación expirada",
      "Ya había una posición abierta",
    ]);
  });

  it("filtra por rango de score", async () => {
    const user = await ready();
    await user.click(screen.getByText("Más filtros"));
    await user.type(screen.getByLabelText("Score mínimo"), "3");
    await waitFor(() => {
      expect(lastCall()[0].minScore).toBe("3");
    });
  });

  it("filtra por rango de fechas", async () => {
    const user = await ready();
    await user.click(screen.getByText("Más filtros"));
    await user.type(screen.getByLabelText("Desde"), "2026-09-01");
    await waitFor(() => {
      expect(lastCall()[0].from).toBe("2026-09-01");
    });
  });

  it("limpiar filtros vuelve al estado inicial", async () => {
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Live" }));
    await waitFor(() => {
      expect(lastCall()[0].mode).toBe("LIVE");
    });
    await user.click(screen.getByText("Más filtros"));
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => {
      expect(lastCall()[0]).toEqual(emptyFilters);
    });
  });

  it("buildQuery omite ALL y los vacíos", () => {
    const query = buildQuery(
      { ...emptyFilters, mode: "PAPER", minScore: "  " },
      2,
      25,
    );
    const params = new URLSearchParams(query);
    expect(params.get("mode")).toBe("PAPER");
    expect(params.get("page")).toBe("2");
    expect(params.has("status")).toBe(false);
    expect(params.has("minScore")).toBe(false);
  });
});

// ── §7 · paginación ───────────────────────────────────────────────────────

describe("paginación", () => {
  it("por defecto pide la página 1 con el límite del backend", async () => {
    await ready();
    expect(lastCall()[1]).toBe(1);
    expect(lastCall()[2]).toBe(25);
  });

  it("avanza y retrocede de página", async () => {
    vi.mocked(api.getSignals).mockResolvedValue(paged);
    const user = await ready();
    expect(screen.getByText(/60 señales · página 1 de 3/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => {
      expect(lastCall()[1]).toBe(2);
    });
  });

  it("deshabilita Anterior en la primera página", async () => {
    vi.mocked(api.getSignals).mockResolvedValue(paged);
    await ready();
    expect(
      screen.getByRole("button", { name: "Anterior" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("cambiar un filtro vuelve a la página 1", async () => {
    vi.mocked(api.getSignals).mockResolvedValue(paged);
    const user = await ready();
    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => {
      expect(lastCall()[1]).toBe(2);
    });
    await user.click(screen.getByRole("button", { name: "Live" }));
    await waitFor(() => {
      expect(lastCall()[1]).toBe(1);
    });
  });
});

// ── §28 / §40 · estados vacío y error ─────────────────────────────────────

describe("empty state y errores", () => {
  it("§28 · el vacío no se presenta como error", async () => {
    vi.mocked(api.getSignals).mockResolvedValue(empty);
    render(<SignalsExplorer />);
    expect(
      await screen.findByText("Todavía no hay señales registradas."),
    ).toBeTruthy();
    expect(
      screen.getByText(/aparecerán aquí cuando el bot detecte/),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("§40 · un fallo de API se muestra como alerta, distinta del vacío", async () => {
    vi.mocked(api.getSignals).mockRejectedValue(
      new SignalsApiError("No se pudo conectar con el bot.", 0),
    );
    render(<SignalsExplorer />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No se pudo conectar con el bot.");
    expect(
      screen.queryByText("Todavía no hay señales registradas."),
    ).toBeNull();
  });

  it("§27 · avisa del período legacy sin inventar decisiones", async () => {
    await ready();
    expect(
      screen.getByText(/disponible a partir de la activación de Trading Observability/),
    ).toBeTruthy();
  });

  it("§41 · el refresh es manual", async () => {
    const user = await ready();
    const before = vi.mocked(api.getSignals).mock.calls.length;
    await user.click(screen.getByRole("button", { name: /Actualizar/ }));
    await waitFor(() => {
      expect(vi.mocked(api.getSignals).mock.calls.length).toBeGreaterThan(
        before,
      );
    });
  });
});

// ── §8 · apertura del detalle ─────────────────────────────────────────────

describe("detalle desde la tabla", () => {
  it("abre el detalle al hacer click en la fila", async () => {
    const user = await ready();
    const rows = screen.getAllByRole("row");
    const toggle = within(rows[1]!).getByRole("button", {
      expanded: false,
    });
    await user.click(toggle);
    expect(await screen.findByLabelText("Detalle de la señal 1")).toBeTruthy();
    expect(vi.mocked(api.getSignalDetail)).toHaveBeenCalledWith(
      1,
      expect.anything(),
    );
  });
});

// ── §9–§22 · contenido del detalle ────────────────────────────────────────

describe("detalle", () => {
  const open = async (id = 1) => {
    render(<SignalDetail id={id} />);
    await screen.findByLabelText(`Detalle de la señal ${String(id)}`);
  };

  it("§9 · muestra tipo, dirección, score y reason reales", async () => {
    await open();
    const section = within(screen.getByLabelText("Señal"));
    expect(
      section.getByRole("heading", { name: "VWAP Reversion alcista" }),
    ).toBeTruthy();
    expect(section.getByText("LONG")).toBeTruthy();
    expect(section.getByText("4.00")).toBeTruthy();
    expect(section.getByText(/\+ Tendencia a favor, Sobre VWAP/)).toBeTruthy();
  });

  it("§10 · renderiza el score breakdown legible, no JSON", async () => {
    await open();
    const section = screen.getByLabelText("Score breakdown");
    const rows = within(section).getAllByRole("row");
    expect(within(rows[0]!).getByText("VWAP Reversion alcista")).toBeTruthy();
    expect(within(rows[0]!).getByText("+2.00")).toBeTruthy();
    expect(within(rows[1]!).getByText("Tendencia a favor")).toBeTruthy();
    expect(within(rows[2]!).getByText("Sobre VWAP")).toBeTruthy();
    // Total = suma de lo persistido.
    expect(within(section).getByText("Total")).toBeTruthy();
  });

  it("§10 · muestra score guardado y suma del desglose por separado", async () => {
    await open();
    const section = screen.getByLabelText("Score breakdown");
    expect(within(section).getByText("Score guardado")).toBeTruthy();
    expect(within(section).getByText("Suma del desglose")).toBeTruthy();
  });

  it("§10 · avisa si el score guardado no coincide con el desglose", async () => {
    vi.mocked(api.getSignalDetail).mockResolvedValue({ ...detail, score: 9 });
    await open();
    expect(
      screen.getByText(/no coinciden/),
    ).toBeTruthy();
  });

  it("§11 · agrupa el contexto en secciones legibles", async () => {
    await open();
    const section = screen.getByLabelText("Contexto de la señal");
    expect(within(section).getByText("Momentum")).toBeTruthy();
    expect(within(section).getByText("Tendencia")).toBeTruthy();
    expect(within(section).getByText("Volatilidad")).toBeTruthy();
    expect(within(section).getByText("RSI")).toBeTruthy();
    expect(within(section).getByText("43.2")).toBeTruthy();
    expect(within(section).getByText("BULLISH")).toBeTruthy();
  });

  it("§11 · un null se muestra como — y NUNCA como 0", async () => {
    await open();
    const section = screen.getByLabelText("Contexto de la señal");
    // `trend.strength` es null en el fixture.
    const strength = within(section).getByText("Fuerza").parentElement!;
    expect(strength.textContent).toContain("—");
    expect(strength.textContent).not.toContain("0");
  });

  it("§11 · los booleanos se muestran como Sí/No", async () => {
    await open();
    const section = screen.getByLabelText("Contexto de la señal");
    const squeeze = within(section).getByText("Squeeze").parentElement!;
    expect(squeeze.textContent).toContain("Sí");
  });

  it("§12 · muestra estado, etapa y código técnico del rechazo", async () => {
    vi.mocked(api.getSignalDetail).mockResolvedValue(rejectedDetail);
    await open(2);
    const section = within(screen.getByLabelText("Decisión tomada"));
    expect(section.getByText("Rechazada")).toBeTruthy();
    expect(section.getByText("Ejecución")).toBeTruthy();
    expect(section.getByText("Ya había una posición abierta")).toBeTruthy();
    // El código original sigue visible: es la identidad estable.
    expect(section.getByText("POSITION_ALREADY_OPEN")).toBeTruthy();
    expect(section.getByText("ya hay una posición activa")).toBeTruthy();
  });

  it("§13 · lista solo los timestamps almacenados", async () => {
    await open();
    const timeline = within(screen.getByLabelText("Cronología"));
    expect(timeline.getByText("Apertura de la vela de señal")).toBeTruthy();
    expect(timeline.getByText("Cierre de la vela de señal")).toBeTruthy();
    expect(timeline.getByText("Decisión")).toBeTruthy();
    expect(timeline.getByText("Orden enviada")).toBeTruthy();
    expect(timeline.getByText("Orden confirmada")).toBeTruthy();
    expect(timeline.getByText("Trade #812 abierto")).toBeTruthy();
  });

  it("§13 · omite los timestamps ausentes en vez de inventarlos", async () => {
    vi.mocked(api.getSignalDetail).mockResolvedValue(rejectedDetail);
    await open(2);
    const timeline = within(screen.getByLabelText("Cronología"));
    expect(timeline.queryByText("Orden enviada")).toBeNull();
    expect(timeline.queryByText("Orden confirmada")).toBeNull();
  });

  it("§14 · confirma el timing causal", async () => {
    await open();
    expect(screen.getByText(/Causal timing ✓/)).toBeTruthy();
  });

  it("§14 · advierte cuando el timing no es causal, sin alterar los datos", async () => {
    vi.mocked(api.getSignalDetail).mockResolvedValue({
      ...detail,
      causalTiming: false,
    });
    await open();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("cierra DESPUÉS");
    expect(alert.textContent).toContain("sin modificar");
  });

  it("§15 · muestra los tres precios y el drift", async () => {
    await open();
    const prices = within(screen.getByLabelText("Precios"));
    expect(prices.getByText("Precio de decisión")).toBeTruthy();
    expect(prices.getByText("Entrada esperada")).toBeTruthy();
    expect(prices.getByText("Fill real")).toBeTruthy();
    expect(prices.getByText("Drift esperado → real")).toBeTruthy();
  });

  it("§15 · sin entrada esperada no calcula drift", async () => {
    vi.mocked(api.getSignalDetail).mockResolvedValue(rejectedDetail);
    await open(2);
    const drift = screen.getByText("Drift esperado → real").parentElement!;
    expect(drift.textContent).toContain("—");
  });

  it("§34 · una decisión rechazada no muestra PnL", async () => {
    vi.mocked(api.getSignalDetail).mockResolvedValue(rejectedDetail);
    await open(2);
    expect(screen.queryByText("PnL")).toBeNull();
  });

  it("§35 · el PnL mostrado es el del Trade", async () => {
    await open();
    const trade = within(screen.getByLabelText("Trade asociado"));
    expect(trade.getByText("PnL").parentElement!.textContent).toContain("3.21");
  });

  it("§17 · muestra config id y hash con botón de copiar", async () => {
    await open();
    const config = within(screen.getByLabelText("Configuración efectiva"));
    expect(config.getByText("#14")).toBeTruthy();
    expect(config.getByText("a83f2176c0c0a604fa9967aada6719bb")).toBeTruthy();
    expect(config.getByLabelText("Copiar config hash")).toBeTruthy();
  });

  it("§18 · el snapshot efectivo se puede inspeccionar", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByText("Ver configuración efectiva"));
    expect(screen.getByText("scoreMinToEnter")).toBeTruthy();
    expect(screen.getByText("onlyLong")).toBeTruthy();
  });

  it("§18 · sin snapshot lo dice en vez de mostrar una config vacía", async () => {
    vi.mocked(api.getSignalDetail).mockResolvedValue(rejectedDetail);
    await open(2);
    expect(screen.getByText(/No hay snapshot para este hash/)).toBeTruthy();
    expect(screen.queryByText("Ver configuración efectiva")).toBeNull();
  });

  it("§19 · muestra la exit strategy efectiva y sus parámetros", async () => {
    await open();
    const config = within(screen.getByLabelText("Configuración efectiva"));
    expect(config.getByText("ADAPTIVE_CHANDELIER")).toBeTruthy();
    expect(config.getByText("0.25%")).toBeTruthy();
    expect(config.getByText("ATR baja volatilidad")).toBeTruthy();
    expect(config.getByText("0.80×")).toBeTruthy();
    expect(config.getByText("1.40×")).toBeTruthy();
    expect(config.getByText("100")).toBeTruthy();
  });

  it("§19 · ordena los parámetros por el schema, no alfabéticamente", async () => {
    await open();
    const config = screen.getByLabelText("Configuración efectiva");
    const labels = [...config.querySelectorAll("dt")]
      .map((node) => node.textContent ?? "")
      .filter((text) => Object.values(exitParamLabels).includes(text));
    expect(labels).toEqual([
      "Activación",
      "ATR baja volatilidad",
      "ATR volatilidad normal",
      "ATR alta volatilidad",
      "Ventana",
      "Percentil bajo",
      "Percentil alto",
    ]);
  });

  it("§21 / §22 · sección técnica con signalIdentity y copy", async () => {
    await open();
    expect(screen.getByText("36ab0a8e968ea49ea6c5e6a0")).toBeTruthy();
    expect(screen.getByLabelText("Copiar signalIdentity")).toBeTruthy();
    expect(screen.getByText("cli-812")).toBeTruthy();
    expect(screen.getByText("ex-99")).toBeTruthy();
  });

  it("§22 · no muestra ids que no existen", async () => {
    vi.mocked(api.getSignalDetail).mockResolvedValue(rejectedDetail);
    await open(2);
    expect(screen.queryByText("clientOrderId")).toBeNull();
    expect(screen.queryByText("exchangeOrderId")).toBeNull();
  });

  it("§39 · una contextVersion desconocida no rompe la vista", async () => {
    vi.mocked(api.getSignalDetail).mockResolvedValue({
      ...detail,
      contextVersion: 7,
    });
    await open();
    expect(screen.getByText(/Contexto en versión 7/)).toBeTruthy();
    // Los campos conocidos siguen renderizándose.
    const section = screen.getByLabelText("Contexto de la señal");
    expect(within(section).getByText("43.2")).toBeTruthy();
    expect(screen.getByText("Raw context")).toBeTruthy();
  });

  it("§39 · tolera un context que no es objeto", async () => {
    vi.mocked(api.getSignalDetail).mockResolvedValue({
      ...detail,
      context: "algo inesperado",
      scoreBreakdown: null,
    });
    await open();
    expect(
      screen.getByText("Esta decisión no guardó contexto de indicadores."),
    ).toBeTruthy();
    expect(
      screen.getByText("Esta decisión no guardó desglose del score."),
    ).toBeTruthy();
  });

  it("§40 · un 404 se distingue de un fallo genérico", async () => {
    vi.mocked(api.getSignalDetail).mockRejectedValue(
      new SignalsApiError("Decision not found", 404),
    );
    render(<SignalDetail id={999} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Esa decisión no existe.");
  });

  it("§46 · no muestra nada que parezca un secreto del snapshot", async () => {
    const user = userEvent.setup();
    await open();
    await user.click(screen.getByText("Ver configuración efectiva"));
    for (const forbidden of [/apiKey/i, /secret/i, /password/i, /token/i])
      expect(screen.queryByText(forbidden)).toBeNull();
  });
});
