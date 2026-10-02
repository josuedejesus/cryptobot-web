import type { ReplaySeriesCandle } from "./replay-api";

export function replayCandlesClosedAt(
  candles: readonly ReplaySeriesCandle[],
  durationSeconds: number,
  cursorSeconds: number,
): ReplaySeriesCandle[] {
  return candles.filter(
    (candle) => candle.time + durationSeconds <= cursorSeconds,
  );
}

export function replayEventsVisibleAt<T extends { time: number }>(
  events: readonly T[],
  cursorTimeMs: number,
): T[] {
  return events.filter((event) => event.time <= cursorTimeMs);
}