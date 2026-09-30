# Research Lab V1

Route: `/research`. Open from the Research Lab link in the home navigation;
Dashboard/CryptoBot links return to `/`. Spanish UI, existing dark gray/emerald
visual language, Tailwind, reusable shadcn Button/Input/Label, semantic tables.
No chart dependency added. Research does not mount useBot or a WebSocket.

## API and contract

`lib/research/research-api.ts` centralizes all requests using the existing
`NEXT_PUBLIC_API_URL` convention (fallback http://localhost:3001). There was no
shared HTTP/auth client in this frontend. Presets are read from the existing
GET /bot-config/saved-configs endpoint. They are never activated or edited here.

Types mirror `../cryptobot/src/research/RESEARCH_API.md` and the response mapper:
metadata, summary, quality, and trades `{ entryId, trade, metrics }`. Capability
lists/defaults/limits drive controls. CURRENT has no params; Chandelier activation
is shown in percent (0.5), converted to a fraction (0.005) only for the request.
Dates entered/displayed as UTC, sent as normalized ISO UTC. Initial balance is
non-negative per the API and defaults from capabilities. No trading metrics are
computed in React: helpers only format units, join rows and filter classifications.

Single: POST /research/run with a selected exit and SEQUENTIAL/FIXED_ENTRY_COHORT.
Compare: POST /research/compare-exits with enabled variants (initially both).
Compare always means Fixed Entry Cohort; banner explains overlap and analytical,
non-portfolio semantics. Variant state is a list with stable UI keys.

Summary cards and comparison table display backend metrics, including negative
capture. Profit factor UNBOUNDED displays infinity; UNDEFINED/null displays dash.
Money uses the existing dollar display convention; prices retain up to 8 decimals.
No ranking, recommendation, score or winner badge.

Trade tables join exclusively by entryId, even when variants have different array
orders. Missing entries display dash rather than attaching another trade by index.
Detail expands in-place, with shared entry data and per-variant exit/cost/excursion
analysis. Filters: ALL, WIN, LOSS, SCRATCH, GREEN_TO_RED. Compare filters match any
variant. No new sorting framework: the existing tables did not provide one.

Loading has no invented progress or zero metrics. Submit is locked while running
and a synchronous ref prevents duplicate requests. Errors show safe 400 messages,
404 config feedback, generic 500/network feedback, and bootstrap retry. Requests
are aborted on unmount (this does not cancel server-side synchronous execution).
Results are in memory and replaced on a new experiment; nothing is persisted.

## Execution timeframe (Multi-Timeframe Execution Replay)

`Execution timeframe` selector, next to the analytical balance. Options come from
`capabilities.executionTimeframes[config.timeframe]`; the default option is
`Same as signal (4h)` and the request omits `executionTimeframe` while it is
selected, so a default run is byte-identical to the previous behaviour. Only
finer timeframes are listed as explicit options, because the signal timeframe is
the default.

The helper text under the selector, the result banner and the lifecycle header
all state the same thing, so nobody reads 15m as "15m signals":

- default: "Controla con cuanta precision se gestionan las posiciones despues de
  la entrada. Las senales no cambian."
- 15m: "Las senales se siguen generando en 4h. Stops y salidas se reproducen con
  velas de 15m."

Result header: `XRPUSDT · Signal 4h · Execution 15m · Trend 1d`, from response
metadata (never inferred from the form). When execution differs from signal, an
extra card repeats that indicators stay on the signal timeframe and that only
MFE/MAE and exit timing gain resolution.

Trade detail shows `Signal timeframe` / `Execution timeframe` plus the exact exit
ISO timestamp next to the localized one. Lifecycle rows are one execution candle
each: every row is tagged with the execution timeframe, the ATR column shows
`As of` (the signal close the ATR came from, never after the row's own close) and
the header explains that NEXT_CANDLE now means the next execution candle. Rows
are not grouped by signal candle in V1. No metric is recomputed in React.

The trace request inherits `executionTimeframe` from the result metadata, so
Inspect lifecycle replays the same resolution that produced the row.

## Components

- ResearchLab: load capabilities/configs, request lifecycle, result composition.
- ResearchControls: request form and exit variant inputs.
- ResearchSummary: cards or side-by-side metric table.
- ResearchTradeTable: identity join, filters, expand control.
- ResearchTradeDetail: shared entry and variant-specific inspection.
- lib/research: explicit types, API boundary, formatting and presentation helpers.

## Validation

The frontend had no test runner. Vitest + Testing Library + jsdom were added as
DEV dependencies. `npm test` runs the UI and API boundary suites, including
capability/config loading, CURRENT/Chandelier inputs, percent conversion, both
execution modes, compare selection, loading/errors/retry, backend metric display,
unbounded PF, reordered entryIds, filters, detail expansion and 39-vs-39 rendering.
Fixtures are synthetic API responses; no backend or real trading is contacted.

- `npm test`: 2 files / 19 tests pass.
- `npm run typecheck`: passes.
- Scoped ESLint for app/research, components/research, lib/research, tests and
  vitest.config.mts: passes.
- Global `npm run lint`: same pre-existing 8 errors / 9 warnings in
  BacktestPanel, BotController, app/page and useBot (not changed in this task,
  except the navigation link in app/page). They include explicit any and React
  effect/immutability rules. No suppression or unrelated fixes were added.
- `npm run build`: passes, includes static /research. Baseline also passes when
  Google Fonts is reachable; restricted network fails downloading existing Inter.
- Chrome headless production smoke, mocked/intercepted API responses: desktop
  1440px and mobile 390px, no JS exceptions and no page-level horizontal overflow.
  This is separate from the automated 39-row component test.

No API incompatibility found. Backend, Live/Paper/Legacy untouched. Follow-up debt:
existing global lint issues, live API acceptance against an available backend,
contract generation/shared package if API evolves, and virtualization/pagination
if large research responses make tables expensive. No frontend optimizer, sweeps,
Adaptive Runner, jobs, experiment storage or charts were implemented.


## MFE Excursion Analysis

The new section consumes `excursion` directly from each API variant. It shows
price-MFE distribution, cumulative thresholds grouped by threshold and variantId,
and up to five net losing excursions per variant. Threshold rows align by numeric
thresholdPct, never array index. Missing values display a dash; no metrics are
recalculated from trades. Single and Compare share the same component.

Green-to-red rates divide by trades reaching that threshold (backend calculation).
WIN/LOSS/SCRATCH retains domain classification, including negative scratches.
Identical fixed entries do not imply identical reached subsets or holding periods.
The API documents gross capture/giveback and full exit-candle OHLC limitations.
Empty results show an explicit empty state. Tables scroll horizontally on mobile.


## Adaptive Runner V1

Capabilities now supplies ADAPTIVE_RUNNER, six experimental baseline defaults,
unit, label/help and validation constraints. ResearchControls renders these
parameter definitions; no strategy list/default parameter values are hardcoded.
`exit-parameters.ts` only validates form fields and transforms percent display units.
Protection activation .75%, capture 25%, runner activation 1.5%, strong activation 3%
map to .0075, .25, .015 and .03 in requests. ATR multipliers remain 2 and 1.5.

Single supports both execution modes. Compare may select all three exits; summary,
excursion, trade tables and detail already support arbitrary variant counts. Trades
remain joined by entryId. No metrics or phases are inferred in React. Backend phase
tracing is deferred: full exit-candle MFE is not a safe proxy for phases processed.
Adaptive is never saved to a production BotConfig or activated in Live/Paper.


## Lifecycle diagnostics

Adaptive rows expose Inspect lifecycle. No trace is requested until the action is
clicked. The panel calls POST /research/trace using the result's configId/date range,
initial balance, entryId and normalized variant selection, not current edited form
fields. Requests abort when closed/unmounted; errors support retry. No global session
or previous server execution is required.

The panel displays backend phases, candle OHLC, strategy-managed bestPrice/favorable
movement, engine MFE/MAE, candidates, stop before/after, effective timing, ATR source,
threshold crossings, gap/stop exits, raw versus slipped fills, and collapsible raw JSON.
No decisions, phases or MFE are inferred in React. MFE of the whole exit candle is
separate from favorable movement actually processed by the strategy.

Gap stop is relative to the existing stop. Open gap percentage independently reports
price discontinuity from previous close. A stop created above the closing market in
NEXT_CANDLE can trigger at the next open even with open gap 0%.

The endpoint always rebuilds the CURRENT Sequential cohort. An entry exclusive to an
Adaptive Sequential run may not belong to it and returns a clear 404; no trace is
silently substituted. Reproduction assumes saved config, history and engine settings
remain unchanged. Generic CURRENT/CHANDELIER traces are available through the API;
the V1 UI enables Adaptive inspection, whose candidate/phase instrumentation is complete.
