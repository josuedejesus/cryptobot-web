import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compareResearchExits,
  getResearchCapabilities,
  getSavedConfigs,
  runResearch,
  traceResearchTrade,
} from "@/lib/research/research-api";
const body = {
  configId: 7,
  from: "2026-01-01T00:00:00.000Z",
  to: "2026-02-01T00:00:00.000Z",
};
afterEach(() => vi.unstubAllGlobals());
describe("Research API boundary", () => {
  it("uses the documented endpoints and serializes only requests", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetcher);
    await getResearchCapabilities();
    await getSavedConfigs();
    await runResearch(body);
    await compareResearchExits({ ...body, exits: [{ type: "CURRENT" }] });
    expect(fetcher.mock.calls.map((call) => new URL(call[0]).pathname)).toEqual(
      [
        "/research/capabilities",
        "/bot-config/saved-configs",
        "/research/run",
        "/research/compare-exits",
      ],
    );
    expect(fetcher.mock.calls[2][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(body),
    });
  });
  it.each([
    [
      400,
      { message: ["ATR multiplier must be greater than 0."] },
      "ATR multiplier",
    ],
    [404, { message: "private detail" }, "Configuración no encontrada"],
    [500, { message: "stack secret" }, "no pudo completar"],
  ])("handles HTTP %s safely", async (status, payload, message) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status, json: async () => payload }),
    );
    await expect(runResearch(body)).rejects.toThrow(message);
  });
  it("posts trace with original entry identity and sanitizes missing entries", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetcher);
    const request = {
      ...body,
      entryId: "LONG:1:2",
      exitStrategy: { type: "ADAPTIVE_RUNNER" as const },
    };
    await traceResearchTrade(request);
    expect(new URL(fetcher.mock.calls[0][0]).pathname).toBe("/research/trace");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify(request),
    });
    fetcher.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "private stack" }),
    });
    await expect(traceResearchTrade(request)).rejects.toThrow("cohort CURRENT");
  });
  it("handles network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(getSavedConfigs()).rejects.toThrow("No se pudo conectar");
  });
});
