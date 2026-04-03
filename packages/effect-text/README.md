# `effect-text`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Effect-native text preparation and greedy multiline layout. Prepare once, lay out many times — pure, deterministic, and portable.

[Quick start](#quick-start) · [Design](#design) · [Services](#services) · [API at a glance](#api-at-a-glance) · [Examples](#examples)

---

## Why effect-text?

Text layout has two fundamentally different phases: expensive work (segmentation, measurement, caching) and cheap work (line wrapping at a given width). Most text engines mix them together. `effect-text` keeps them apart:

- **`Text.prepare`** is effectful — it owns segmentation, measurement, and caching through explicit `Context.Tag` services
- **`Text.layout`** is pure — safe to call on every resize, scroll, or animation frame with zero service dependencies

### What you get

- **Prepare/layout split** — effectful preparation, pure arithmetic layout
- **Deterministic default layer** — width estimator that works in tests, SSR, and server contexts without a browser
- **Additive browser measurement** — swap in `CanvasTextMeasurerLive` for `CanvasRenderingContext2D.measureText` without changing application code
- **Shared measurement cache** — Effect `Cache`-backed deduplication across prepare calls
- **Multiple layout projections** — summary, full lines, per-line width resolution, cursor stepping, or `Stream`
- **Typed errors** — `MeasurementFailed` and `TextLayoutDecodeError` with tagged error channels
- **Emoji correction** — one-time probe for browsers with weak complex-emoji measurement
- **Soft-hyphen, tab, and hard-break support** — preserved through segmentation and layout
- **Released overflow policy** — hard breaks first, then soft hyphens and explicit break opportunities, then grapheme fallback; a line only exceeds `maxWidth` when a single grapheme is itself wider than the requested width
- **Bidi metadata** — per-segment direction and bidi level (visual reordering not yet included)
- **Experimental calibration** — typed corpora for engine-profile evaluation and `effect-search`-driven optimization
- **No native deps** — pure TypeScript. Just `effect` as a peer dependency

## Installation

```sh
npm install effect-text effect
# or
pnpm add effect-text effect
# or
bun add effect-text effect
```

Requires `effect` as a peer dependency.

## Quick start

Prepare text once, then lay out at any width — no services needed after preparation:

```ts
import { Effect } from "effect"
import { Text } from "effect-text"

const program = Effect.gen(function* () {
  const prepared = yield* Text.prepare({
    text: "Effect keeps the hot path pure.",
    font: { family: "Mono", size: 16 },
    whiteSpace: "normal"
  })

  // Pure — no services, safe to call on every resize
  const summary = Text.layout(prepared, { maxWidth: 120, lineHeight: 20 })
  const lines = Text.layoutLines(prepared, { maxWidth: 120, lineHeight: 20 })

  return { summary, lines }
}).pipe(Effect.provide(Text.TextLayoutLive))

Effect.runPromise(program)
```

`Text.TextLayoutLive` provides the four required services with deterministic defaults. See [Services](#services) for custom wiring.

Code snippets with `yield*` belong inside `Effect.gen(function* () { ... })`.

## Design

The package is shaped by three ideas:

- **`pretext` got the architecture right** — expensive work in `prepare`, arithmetic-only work in `layout`
- **Runtime seams stay explicit** — measurement, caching, and engine quirks are services provided through `Layer`, not ambient globals
- **Upstream `effect` already has the right primitives** — `Context.Tag`, `Layer`, `Cache`, `Stream`, `Schema`, and typed errors

That yields a small public surface:

| Function                   | Signature                                                                                | Phase     |
| -------------------------- | ---------------------------------------------------------------------------------------- | --------- |
| `Text.prepare`             | `(input) → Effect<PreparedText, MeasurementFailed, TextPreparationServices>`             | Effectful |
| `Text.prepareWithSegments` | `(input) → Effect<PreparedTextWithSegments, MeasurementFailed, TextPreparationServices>` | Effectful |
| `Text.prepareUnknown`      | `(input: unknown) → Effect<PreparedText, PrepareError, TextPreparationServices>`         | Effectful |
| `Text.layout`              | `(prepared, request) → LayoutSummary`                                                    | Pure      |
| `Text.layoutLines`         | `(prepared, request) → ReadonlyArray<LayoutLine>`                                        | Pure      |
| `Text.layoutLinesWith`     | `(prepared, request, resolveMaxWidth) → ReadonlyArray<LayoutLine>`                       | Pure      |
| `Text.layoutNextLine`      | `(preparedWithSegments, request, cursor) → Option<[LayoutLine, LayoutCursor]>`           | Pure      |
| `Text.streamLines`         | `(preparedWithSegments, request) → Stream<LayoutLine>`                                   | Pure      |

All pure layout functions reuse the same prepared handle. Prepare once, project many times at different widths.

## Services

The live layer is composed from four services:

| Service                      | Responsibility                                                    |
| ---------------------------- | ----------------------------------------------------------------- |
| `Contracts.WordSegmenter`    | Builds `text`, `space`, and `hard-break` segments                 |
| `Contracts.TextMeasurer`     | Converts font + text into a pixel width                           |
| `Contracts.MeasurementCache` | Shared `Cache` keyed by font/text identity                        |
| `Contracts.EngineProfile`    | Runtime fit tolerance, tab stops, bidi defaults, and break quirks |

Browser-specific behavior is not ambient global state — it is data and services provided through `Layer`.

`Text.TextLayoutLive` composes all four with deterministic defaults. For custom wiring, compose the individual layers:

```ts
import { Effect, Layer, Ref } from "effect"
import { Contracts, Text } from "effect-text"

const program = Effect.gen(function* () {
  const callCount = yield* Ref.make(0)

  // Custom measurer that counts how many times it's called
  const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text: string) => Ref.update(callCount, (n) => n + 1).pipe(Effect.as(text.length * 6))
  })

  const services = Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.EngineProfileLive,
    Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
  )

  const prepared = yield* Text.prepare({
    text: "cache cache",
    font: { family: "Mono", size: 12 },
    whiteSpace: "normal"
  }).pipe(Effect.provide(services))

  // Pure layout — the same prepared handle at two widths
  const narrow = Text.layout(prepared, { maxWidth: 42, lineHeight: 16 })
  const wide = Text.layout(prepared, { maxWidth: 120, lineHeight: 16 })
  const measurements = yield* Ref.get(callCount)

  yield* Effect.log({ measurements, narrow, wide })
})
```

The `MeasurementCache` deduplicates calls to `TextMeasurer` — identical font/text pairs hit the cache instead of re-measuring.

## Browser canvas measurement

Swap in `CanvasTextMeasurerLive` to use `CanvasRenderingContext2D.measureText`. The prepare/layout split stays the same — only the measurement service changes:

```ts
import { Effect, Layer } from "effect"
import { Browser, Text } from "effect-text"

// Provide a real CanvasRenderingContext2D in the browser
const canvasLayer = Browser.CanvasTextMeasurerLive({
  context,
  emojiCorrection: true,
  textBaseline: "alphabetic"
})

const services = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.MeasurementCacheLive.pipe(Layer.provide(canvasLayer))
)

const prepared =
  yield *
  Text.prepare({
    text: "Canvas-backed measurement.",
    font: { family: "system-ui", size: 16 },
    whiteSpace: "normal"
  }).pipe(Effect.provide(services))
```

The canvas layer preserves deterministic caching through `MeasurementCache` and can apply a one-time emoji probe so browsers with weak complex-emoji measurement still produce stable widths.

**`emojiCorrection`** accepts `true` for defaults or `{ minimumAdvanceMultiplier, probe }` for fine-grained control.

## Per-line width resolution

`layoutLinesWith` lets downstream projections vary the available width per line — useful for obstacle-aware layout (floated images, pull quotes) while keeping `prepare` effectful and `layout` pure:

```ts
import { Text } from "effect-text"

const lines = Text.layoutLinesWith(
  prepared,
  request,
  (lineIndex) => (lineIndex < 3 ? 200 : 400) // narrower for the first three lines
)
```

## Cursor and stream projections

For incremental or reactive consumers, prepared text can be walked line-by-line with a cursor or projected as a `Stream`:

```ts
import { Chunk, Effect, Option, Stream } from "effect"
import { Text } from "effect-text"

const prepared = yield * Text.prepareWithSegments(input)

// Cursor stepping — pure, no allocation of full line array
const first = Text.layoutNextLine(prepared, request, Text.initialCursor())
const second = Option.flatMap(first, ([, cursor]) => Text.layoutNextLine(prepared, request, cursor))

// Stream projection — composes with Effect's Stream operators
const allLines = yield * Text.streamLines(prepared, request).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray))
```

## Experimental calibration

The `Experimental.Calibration` module lets you describe a typed calibration corpus and evaluate candidate `Contracts.EngineProfile` values by reusing the existing prepare/layout split. It does not change the runtime path or make `layout` effectful.

### Evaluating a profile

```ts
import { Effect, Layer } from "effect"
import { Contracts, Experimental, Text } from "effect-text"

const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
  measure: (_font, text: string) => Effect.succeed(text.length * 5)
})

const services = Layer.mergeAll(Text.WordSegmenterLive, Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer)))

const report =
  yield *
  Experimental.Calibration.evaluateProfile(
    {
      name: "tight-tabs",
      engineProfile: {
        lineFitEpsilon: 0.005,
        tabWidth: 2,
        defaultDirection: "ltr",
        preferEarlySoftHyphenBreak: false,
        preferPrefixWidthsForBreakableRuns: true
      }
    },
    [
      {
        name: "tab-advance",
        prepare: {
          text: "a\tb",
          font: { family: "Mono", size: 10 },
          whiteSpace: "pre-wrap"
        },
        layout: { maxWidth: 100, lineHeight: 12 },
        expected: {
          lineCount: 1,
          maxLineWidth: 15,
          lines: [{ text: "a\tb", width: 15 }]
        }
      }
    ]
  ).pipe(Effect.provide(services))
// => CalibrationReport { caseCount: 1, matchedCaseCount: …, results: […] }
```

Calibration targets can stay coarse with summary-level checks (`lineCount`, `maxLineWidth`) or tighten into exact expected `lines` with per-line text and width.

### Search-driven profile optimization

The `optimizeProfile` helper composes with `effect-search` to drive an optimization loop over candidate engine profiles using the same corpus format:

```ts
import { Effect, Layer } from "effect"
import { Sampler } from "effect-search"
import { Contracts, Experimental, Text } from "effect-text"

const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
  measure: (_font, text: string) => Effect.succeed(text.length * 5)
})

const services = Layer.mergeAll(Text.WordSegmenterLive, Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer)))

const optimized =
  yield *
  Experimental.Calibration.optimizeProfile({
    cases: [
      {
        name: "tab-advance",
        prepare: { text: "a\tb", font: { family: "Mono", size: 10 }, whiteSpace: "pre-wrap" },
        layout: { maxWidth: 100, lineHeight: 12 },
        expected: { lineCount: 1, maxLineWidth: 15, lines: [{ text: "a\tb", width: 15 }] }
      }
    ],
    services,
    trials: 16,
    sampler: Sampler.tpe({ seed: 7 })
  })
// => { bestProfile, bestReport, studyResult }
```

This keeps search integration explicitly experimental: the core `Text` module stays lightweight, while profile tuning composes on top through `Experimental.Calibration`.

## Error handling

Every error is tagged for precise matching:

| Error                   | When it occurs                                                               |
| ----------------------- | ---------------------------------------------------------------------------- |
| `MeasurementFailed`     | `TextMeasurer.measure` returned a failure (e.g., invalid font, canvas error) |
| `TextLayoutDecodeError` | `prepareUnknown` received input that doesn't match `PrepareInput` schema     |

```ts
import { Effect } from "effect"
import { Text } from "effect-text"

const safe = Text.prepareUnknown(untrustedInput).pipe(
  Effect.catchTag("TextLayoutDecodeError", (e) => Effect.logError(`Invalid input: ${e.reason}`)),
  Effect.catchTag("MeasurementFailed", (e) =>
    Effect.logError(`Measurement failed for ${e.fontFamily}/${e.fontSize}: ${e.reason}`)
  )
)
```

`PrepareError` is the union type: `MeasurementFailed | TextLayoutDecodeError`.

## Stability

| Module         | Stability   | Meaning                                                             |
| -------------- | ----------- | ------------------------------------------------------------------- |
| `Text`         | Provisional | Core prepare/layout architecture is stable; shape is still evolving |
| `Contracts`    | Stable      | Runtime seams intended to be depended on directly                   |
| `Errors`       | Stable      | Typed error tags are part of the boundary contract                  |
| `Experimental` | Unstable    | May change outside semver guarantees                                |

## API at a glance

```ts
import { Browser, Contracts, Errors, Experimental, Text } from "effect-text"
```

| Module         | Key exports                                                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Text`         | `prepare`, `prepareUnknown`, `layout`, `layoutLines`, `layoutLinesWith`, `layoutNextLine`, `streamLines`, `initialCursor`, `PreparedText`, `TextLayoutLive`, `WordSegmenterLive`, `TextMeasurerLive`, `EngineProfileLive`, `MeasurementCacheLive` |
| `Browser`      | `CanvasTextMeasurerLive`                                                                                                                                                                                                                          |
| `Contracts`    | `WordSegmenter`, `TextMeasurer`, `MeasurementCache`, `EngineProfile`, `TextPreparationServices`                                                                                                                                                   |
| `Errors`       | `TextLayoutDecodeError`, `MeasurementFailed`, `PrepareError`                                                                                                                                                                                      |
| `Experimental` | `Calibration.evaluateProfile`, `Calibration.optimizeProfile`, `Calibration.makeProfileSearchSpace`, calibration schemas                                                                                                                           |

Subpath imports are also available: `import * as Text from "effect-text/Text"`. Internal modules (`internal/*`) are blocked from consumers via the package exports map.

## Examples

Runnable examples in [`examples/`](./examples):

| Example                                                                                  | What it shows                                      |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [`01-quick-start`](./examples/01-quick-start.ts)                                         | Deterministic prepare/layout flow                  |
| [`02-cursor-and-stream`](./examples/02-cursor-and-stream.ts)                             | Cursor stepping and `Stream` projection            |
| [`03-explicit-services-and-caching`](./examples/03-explicit-services-and-caching.ts)     | Custom measurement seam with shared caching        |
| [`04-canvas-measurement`](./examples/04-canvas-measurement.ts)                           | Canvas-backed measurement with emoji correction    |
| [`05-experimental-calibration-search`](./examples/05-experimental-calibration-search.ts) | `effect-search`-driven engine-profile optimization |

```sh
bun run packages/effect-text/examples/01-quick-start.ts
```

## Current scope

This first release is intentionally a foundation rather than full browser parity.

**Included:** deterministic measurement caching, optional canvas measurement, one-time emoji correction fallback, preserved hard breaks, tabs, soft-hyphen breaks, bidi metadata, greedy multiline wrapping, pure layout summaries, cursor and stream projections, per-line width resolution, experimental calibration corpora.

**Not yet included:** full bidi visual reordering, dictionary-driven hyphenation, canvas font-loading orchestration, browser-engine-specific correction passes beyond the current emoji probe, search-driven calibration workflows across `effect-search` and `effect-math`.

Those features belong behind the existing service seams rather than in a different architecture.

## Acknowledgments

The prepare/layout architecture is inspired by [pretext](https://github.com/chenglou/pretext) by Cheng Lou — the insight that text layout decomposes into an expensive effectful preparation phase and a cheap pure projection phase. `effect-text` brings this architecture to Effect, replacing ambient globals with explicit `Context.Tag` services and `Layer` composition.

Built on [Effect](https://effect.website). Experimental calibration uses [`effect-search`](https://github.com/scenesystems/theoria/tree/main/packages/effect-search) for Bayesian optimization over candidate engine profiles.

## Contributing

```sh
bun run check    # Type check
bun run test     # Run tests
bun run lint     # Lint
bun run build    # Build ESM + CJS
bun run docgen   # Generate API docs
```

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
