# @scenesystems/effect-text

Measure text in [Effect](https://effect.website) programs and reuse the measurements for greedy multiline layout at different widths. Use it for canvas renderers, virtualized views, diagrams, and other applications that need deterministic line geometry without invoking a browser layout engine.

Preparation is an `Effect`: it segments text, measures runs, optionally applies dictionary hyphenation, and captures a text-engine profile. Every projection after preparation is synchronous and pure.

## Installation

```sh
bun add @scenesystems/effect-text effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package root or matching subpaths, such as `@scenesystems/effect-text/Text`.

## Basic use

The default `Text.layer` combines the Unicode-aware segmenter, default profile, bundled hyphenation dictionaries, deterministic estimator, and layer-owned measurement cache.

```ts typecheck
import { Effect } from "effect"
import { Text } from "@scenesystems/effect-text"

export const program = Effect.gen(function* () {
  const prepared = yield* Text.prepareWithSegments({
    text: "Prepare once, then lay out at several widths.",
    font: { family: "Mono", size: 16 },
    whiteSpace: "normal"
  })

  return {
    compact: Text.summary(prepared, { maxWidth: 120, lineHeight: 20 }),
    wide: Text.lines(prepared, { maxWidth: 240, lineHeight: 20 }),
    complete: Text.layout(prepared, { maxWidth: 180, lineHeight: 20 })
  }
}).pipe(Effect.provide(Text.layer))
```

`Text.summary` returns only `lineCount`, `height`, and `maxLineWidth`. `Text.lines` materializes visual-order lines. `Text.layout` returns both `lines` and `summary` from one walk.

## Inputs, handles, and projections

- `Text.Input` contains `text`, `font`, `whiteSpace`, and an optional `hyphenationLocale`.
- `whiteSpace: "normal"` collapses whitespace; `"pre-wrap"` preserves spaces, tabs, and hard breaks.
- `Text.Request` contains positive `maxWidth` and `lineHeight` values in the measurer's units.
- `Text.prepare` returns `Text.Text`, the smaller handle for `summary` and `naturalWidth`.
- `Text.prepareWithSegments` returns `Text.WithSegments`, which also supports line materialization, ranges, cursors, and streams.
- `Text.prepareUnknown` strictly decodes unknown input before preparing it.

Prepared handles expose pure projection operations, not their measurement tables
or mutable cursor hints. They have no encoding or content-based equality contract;
use `PreparationKey` when an application needs a structural cache identity.

| Function                | Handle                  | Result                                                  |
| ----------------------- | ----------------------- | ------------------------------------------------------- |
| `Text.summary`          | `Text.Text`             | Aggregate geometry without line strings                 |
| `Text.naturalWidth`     | `Text.Text`             | Widest hard-break-delimited width before wrapping       |
| `Text.lines`            | `Text.WithSegments`     | All visual-order lines at one width                     |
| `Text.linesWith`        | `Text.WithSegments`     | Lines using a per-line width resolver                   |
| `Text.ranges`           | `Text.WithSegments`     | Painted widths and half-open logical cursor ranges      |
| `Text.layout`           | `Text.WithSegments`     | Lines and summary from one walk                         |
| `Text.nextLine`         | `Text.WithSegments`     | One line and its successor cursor, wrapped in `Option`  |
| `Text.stream`           | `Text.WithSegments`     | A lazy `Stream` beginning at the canonical `Text.start` |
| `Text.summaryFromLines` | previously made `Lines` | Aggregate geometry using a caller-supplied line height  |

All layout functions support data-first and pipeable data-last calls. `linesWith` is useful for shaped containers; `nextLine`, `ranges`, and `stream` support incremental or virtualized rendering.

```ts typecheck
import { Effect, Number, Stream } from "effect"
import { Text } from "@scenesystems/effect-text"

export const program = Effect.gen(function* () {
  const prepared = yield* Text.prepareWithSegments({
    text: "Each output line can receive a different available width.",
    font: { family: "Mono", size: 14 },
    whiteSpace: "normal"
  })
  const request = { maxWidth: 180, lineHeight: 18 }
  const shaped = Text.linesWith(prepared, request, (index) =>
    Number.max(80, Number.subtract(180, Number.multiply(index, 20)))
  )
  const first = Text.nextLine(prepared, request, Text.start)
  const firstThree = yield* Text.stream(prepared, request).pipe(Stream.take(3), Stream.runCollect)

  return { first, firstThree, shaped }
}).pipe(Effect.provide(Text.layer))
```

## Services and layers

Preparation requires `Text.Segmenter`, `Text.CurrentProfile`, and `MeasurementCache.MeasurementCache`. The cache owns successful measurement memoization and requires a `TextMeasurer.TextMeasurer` when its scoped layer is built. Hyphenation is optional: when no `Hyphenation.Hyphenation` service is present, explicit soft hyphens still work but dictionary breaks do not.

`TextMeasurer.layer` is the deterministic estimator used by `Text.layer`. Compose the individual layers to select a profile or disable dictionary hyphenation.

```ts typecheck
import { Effect, Layer } from "effect"
import { Hyphenation, MeasurementCache, Text, TextMeasurer } from "@scenesystems/effect-text"

const services = Layer.mergeAll(
  Text.layerSegmenter,
  Hyphenation.layerNone,
  Layer.succeed(Text.CurrentProfile, {
    lineFitEpsilon: 0.01,
    tabWidth: 8,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: true,
    preferPrefixWidthsForBreakableRuns: true
  }),
  MeasurementCache.layer.pipe(Layer.provide(TextMeasurer.layer))
)

export const program = Text.prepare({
  text: "soft\u00adhyphen and\tcustom tabs",
  font: { family: "Mono", size: 12 },
  whiteSpace: "pre-wrap"
}).pipe(
  Effect.map((prepared) => Text.summary(prepared, { maxWidth: 72, lineHeight: 16 })),
  Effect.provide(services)
)
```

Each scoped acquisition of `MeasurementCache.layer` owns a fresh cache. Its
`TextMeasurer` dependency is supplied while constructing the cache layer, as in
the example above; consumers of the resulting services do not need to provide
the measurer again. Reacquire the cache layer after font availability changes
rather than retaining widths measured against stale fonts.

## Canvas measurement and profiles

[`CanvasTextMeasurer.layer`](./src/CanvasTextMeasurer.ts) measures with a
caller-owned canvas-like 2D context. It serializes access and restores the
context state after success, failure, or interruption. Its options also control
emoji advance correction.

`CanvasProfile.monospace` and `CanvasProfile.systemUi` pair font selection with a `Text.Profile`; `CanvasProfile.get()` selects one by id and defaults to monospace.

```ts typecheck
import { Effect, Layer } from "effect"
import { CanvasProfile, CanvasTextMeasurer, MeasurementCache, Text } from "@scenesystems/effect-text"

export const layoutOnCanvas = (context: CanvasTextMeasurer.Context, text: string, maxWidth: number) => {
  const profile = CanvasProfile.systemUi
  const services = Layer.mergeAll(
    Text.layerSegmenter,
    Layer.succeed(Text.CurrentProfile, profile.engineProfile),
    MeasurementCache.layer.pipe(
      Layer.provide(CanvasTextMeasurer.layer(new CanvasTextMeasurer.Options({ context, textBaseline: "alphabetic" })))
    )
  )

  return Text.prepareWithSegments({
    text,
    font: { family: profile.defaultFontFamily, size: 16 },
    whiteSpace: profile.defaultWhiteSpaceMode
  }).pipe(
    Effect.map((prepared) => Text.layout(prepared, { maxWidth, lineHeight: 22 })),
    Effect.provide(services)
  )
}
```

Pass a browser `CanvasRenderingContext2D` directly. Canvas widths are CSS
pixels; the application owns font loading and cache invalidation.
[`PreparationKey`](./src/PreparationKey.ts) provides structural cache keys
that include the input, profile, and font-readiness revision.

## Hyphenation

`Hyphenation.layer()` bundles patterns for English (US and GB), German, French, and Spanish, with exact-to-base locale fallback. Passing `Hyphenation.Options.dictionaries` replaces the bundled source map rather than extending it. Sources use native tagged `Hyphenation.Dictionary` cases:

- `Dictionary.Words({ words })` for explicit word-to-offset maps
- `Dictionary.Patterns({ patterns })` for Liang pattern data
- `Dictionary.Compiled({ hyphenateWord })` for a pure compiled matcher

`Hyphenation.layerNone` disables dictionary breaks. Layer-owned locale and word caches are lazy, so unused dictionaries are not compiled.

```ts typecheck
import { Array as Arr, Effect, Layer } from "effect"
import { Hyphenation, MeasurementCache, Text, TextMeasurer } from "@scenesystems/effect-text"

const services = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  Hyphenation.layer(
    new Hyphenation.Options({
      dictionaries: {
        "en-gb": Hyphenation.Dictionary.Words({
          words: { colouration: Arr.make(3, 6) }
        })
      }
    })
  ),
  MeasurementCache.layer.pipe(Layer.provide(TextMeasurer.layer))
)

export const program = Text.prepareWithSegments({
  text: "colouration",
  font: { family: "Mono", size: 10 },
  hyphenationLocale: "en-gb",
  whiteSpace: "normal"
}).pipe(
  Effect.map((prepared) => Text.lines(prepared, { maxWidth: 35, lineHeight: 12 })),
  Effect.provide(services)
)
```

## Calibration

`Calibration` evaluates named `Text.Profile` candidates against expected summaries and optional exact lines. `Calibration.evaluate` and `Calibration.optimize` are Effects because they prepare and measure text; `Calibration.score` is a pure weighted-sum projection of an existing report. `Calibration.searchSpace` compiles the concise `Calibration.Search` dimensions used by the optimizer. Optimization returns the selected profile and report together with `optimizationResult` and `OptimizationArtifacts`: a per-invocation event log and cumulative resumable snapshot. Supply `optimizationStorage` to persist those trials and checkpoints.

See [the calibration example](./examples/05-calibration-search.ts) for a seeded search and [the live fixtures](./examples/live/calibrationFixtures.ts) for complete case, profile, service, and search models.

## Errors and limitations

`Text.prepare` and `Text.prepareWithSegments` fail with `TextMeasurer.Failed` when measurement does not return a finite non-negative advance. `Text.prepareUnknown` can additionally fail with `Text.DecodeError`. Layout projections have no error channel once preparation succeeds.

Layout has the following limits:

- line breaking is greedy and supports only the documented whitespace modes;
- callers supply line height, fonts, font readiness, and the measurement host;
- `TextMeasurer.layer` estimates advances and does not shape fonts;
- canvas measurement uses host shaping for measured strings, but this package still controls breaking and visual-line assembly;
- mixed-direction text and paired punctuation are handled for the supported line-local model, but bidi embedding/control semantics and full UAX #9 behavior are outside the support envelope;
- inline styling, vertical writing, justification, and browser layout equivalence are out of scope.

Validate canvas output against every target browser and font. The package guarantees deterministic projection for a prepared set of measurements, not pixel parity with DOM layout.

## Examples

See the [API reference](./src/index.ts) for all modules and the [examples directory](./examples/) for runnable programs:

- [Basic layout](./examples/01-quick-start.ts)
- [Cursors and streams](./examples/02-cursor-and-stream.ts)
- [Services and layers](./examples/03-explicit-services.ts)
- [Canvas measurement](./examples/04-canvas-measurement.ts)
- [Calibration](./examples/05-calibration-search.ts)
- [Synthetic canvas regression artifacts](./examples/06-synthetic-regression-artifacts.ts)
- [Dictionary hyphenation](./examples/07-dictionary-hyphenation.ts)

## Benchmarks

Run `bun run packages/effect-text/benchmarks/run.ts` from the repository root to
measure the public projections and warm-cache preparation. The report is written
to `.tmp/effect-text-benchmark.json`. It records nanosecond durations, operation
outputs, and Effect dispatch overhead. Timings depend on the host.

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples) and the package [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## Attribution

The split between effectful preparation and pure layout is inspired by [pretext](https://github.com/chenglou/pretext).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
