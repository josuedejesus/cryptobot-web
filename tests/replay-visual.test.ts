import { describe, expect, it } from "vitest";
import {
  replayCandlesClosedAt,
  replayEventsVisibleAt,
} from "@/lib/research/replay-visual";

describe("Visual Replay cutoff", () => {
  it("only returns candles fully closed at the cursor", () => {
    const candles = [0, 60, 120].map((time) => ({
      time,
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      volume: 1,
    }));
    expect(replayCandlesClosedAt(candles, 60, 120).map((candle) => candle.time)).toEqual([
      0,
      60,
    ]);
    expect(replayCandlesClosedAt(candles, 60, 180)).toHaveLength(3);
  });

  it("hides lifecycle events strictly after the cursor", () => {
    const events = [{ time: 1000 }, { time: 2000 }, { time: 3000 }];
    expect(replayEventsVisibleAt(events, 2000)).toEqual(events.slice(0, 2));
  });
});