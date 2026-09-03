# @scenesystems/effect-text

`@scenesystems/effect-text` lays out text into lines without a browser layout engine. Use it when you need line breaks, line widths, and total height for a string at a given width, and you need them repeatedly: in a canvas renderer, a virtualized list, a resize handler, or an animation that changes the available width every frame.

The package splits the work in two. Preparation is an Effect: it segments the text, measures its runs through a `TextMeasurer` service, consults an `EngineProfile` and optional hyphenation dictionary, and compiles the results into a prepared handle. Layout is a pure function of that handle and a width. Prepare once, then lay out at as many widths as you like with no measurement, no services, and no error channel.

The experimental calibration surface tunes engine profiles against measured layouts with [`@scenesystems/effect-search`](../effect-search/README.md) and scores them with [`@scenesystems/effect-math`](../effect-math/README.md). The preparation and layout path does not depend on either.

## Installation

```sh
npm install @scenesystems/effect-text effect
```

Effect `^3.22.1` is a required peer dependency.

## Basic use

`Text.prepareWithSegments` prepares a string once. `Text.layout` returns the line count, height, and widest line for a width; `Text.layoutLines` returns the lines themselves.

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
    compact: Text.layout(prepared, { maxWidth: 120, lineHeight: 20 }),
    wide: Text.layoutLines(prepared, { maxWidth: 240, lineHeight: 20 })
  }
}).pipe(Effect.provide(Text.TextLayoutLive))
```

`Text.TextLayoutLive` bundles the default services: an `Intl`-based word segmenter, a deterministic width estimator, an in-memory measurement cache, the default engine profile, and the bundled hyphenation dictionaries. It is enough for tests, servers, and any place where estimated widths are acceptable. Browser applications replace the measurer with a canvas-backed one, described below.

## Preparation and layout

`PrepareInput` has three required fields and one optional one. `text` is the string. `font` names the family, size, and optional weight that the measurer will use. `whiteSpace` is `normal`, which collapses runs of whitespace, or `pre-wrap`, which preserves spaces, tabs, and hard breaks. `hyphenationLocale` opts a string into dictionary hyphenation.

Two preparation functions return different handles. `Text.prepare` returns a `PreparedText` that supports summaries and `Text.measureNaturalWidth`, the width of the widest unbroken chunk. `Text.prepareWithSegments` returns a `PreparedTextWithSegments` that also retains the logical segments needed to materialize lines, step cursors, and vary the width per line. Choose the smaller handle when you only need geometry. `Text.prepareUnknown` decodes untrusted input against the schema before preparing it.

Layout functions take a handle and a `LayoutRequest` with a positive `maxWidth` and `lineHeight`:

| Function                      | Handle        | Returns                                                           |
| ----------------------------- | ------------- | ----------------------------------------------------------------- |
| `Text.layout`                 | either        | `lineCount`, `height`, and `maxLineWidth`                         |
| `Text.layoutLines`            | with segments | The visual lines with their text and painted width                |
| `Text.layoutLinesWithSummary` | with segments | Lines and summary from one walk                                   |
| `Text.layoutLinesWith`        | with segments | Lines where a resolver supplies the width for each line index     |
| `Text.layoutNextLine`         | with segments | One line and the cursor for the next, or `Option.none` at the end |
| `Text.streamLines`            | with segments | A `Stream` of lines that computes only as far as it is pulled     |

`Text.layoutLinesWith` is how text flows around obstacles or into a shaped container: return a different `maxWidth` for each line. `Text.layoutNextLine` with `Text.initialCursor()` and `Text.streamLines` serve virtualized rendering, where only the first visible lines are needed.

```ts typecheck
import { Chunk, Effect, Stream } from "effect"
import { Text } from "@scenesystems/effect-text"

export const program = Effect.gen(function* () {
  const prepared = yield* Text.prepareWithSegments({
    text: "Text can flow into a shape when each line asks for its own width.",
    font: { family: "Mono", size: 14 },
    whiteSpace: "normal"
  })
  const request = { maxWidth: 160, lineHeight: 18 }

  const shaped = Text.layoutLinesWith(prepared, request, (lineIndex) => 160 - lineIndex * 20)
  const firstThree = yield* Text.streamLines(prepared, request).pipe(Stream.take(3), Stream.runCollect)

  return { shaped, firstThree: Chunk.toReadonlyArray(firstThree) }
}).pipe(Effect.provide(Text.TextLayoutLive))
```

Line breaking prefers hard breaks, then soft hyphens, then dictionary hyphens, then explicit break opportunities, and falls back to breaking between graphemes only when a single grapheme exceeds the width. Tabs align to four-column stops.

## Measurement services

Preparation requires five services, all declared in `Contracts`: `WordSegmenter`, `TextMeasurer`, `MeasurementCache`, `EngineProfile`, and `HyphenationDictionary`. `Text.TextLayoutLive` provides all of them. To replace one, compose the individual layers instead.

```ts typecheck
import { Effect, Layer } from "effect"
import { Contracts, Text } from "@scenesystems/effect-text"

const services = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.NoHyphenationDictionaryLive,
  Layer.succeed(Contracts.EngineProfile, {
    lineFitEpsilon: 0.01,
    tabWidth: 8,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: true,
    preferPrefixWidthsForBreakableRuns: true
  }),
  Text.MeasurementCacheLive.pipe(Layer.provide(Text.TextMeasurerLive))
)

export const program = Text.prepare({
  text: "soft\u00adhyphen and\tcustom tabs",
  font: { family: "Mono", size: 12 },
  whiteSpace: "pre-wrap"
}).pipe(
  Effect.map((prepared) => Text.layout(prepared, { maxWidth: 72, lineHeight: 16 })),
  Effect.provide(services)
)
```

In a browser, measure with the real font. `Browser.CanvasTextMeasurerLive` wraps a 2D canvas context, serializes access to it, and optionally corrects under-reported emoji advances. `Browser.BrowserMeasurementCacheLive` keys its cache by a support-profile id and a font-readiness revision, so measurements taken before a web font loaded are discarded once you bump the revision. `Browser.browserSupportProfile` returns the engine profile tuned for `canvas-monospace` or `canvas-system-ui`.

```ts typecheck
import { Effect, Layer } from "effect"
import { Browser, Contracts, Text } from "@scenesystems/effect-text"

type CanvasContext = Parameters<typeof Browser.CanvasTextMeasurerLive>[0]["context"]

export const layoutOnCanvas = (context: CanvasContext, text: string, maxWidth: number) => {
  const profile = Browser.browserSupportProfile("canvas-system-ui")
  const services = Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.NoHyphenationDictionaryLive,
    Layer.succeed(Contracts.EngineProfile, profile.engineProfile),
    Browser.BrowserMeasurementCacheLive({
      profileId: profile.id,
      fontReadinessRevision: Browser.initialFontReadinessRevision()
    }).pipe(Layer.provide(Browser.CanvasTextMeasurerLive({ context, textBaseline: "alphabetic" })))
  )

  return Text.prepareWithSegments({ text, font: { family: "system-ui", size: 16 }, whiteSpace: "normal" }).pipe(
    Effect.map((prepared) => Text.layoutLinesWithSummary(prepared, { maxWidth, lineHeight: 22 })),
    Effect.provide(services)
  )
}
```

Widths are in the measurer's units, which for canvas measurement are CSS pixels. Validate against your target browsers and fonts; the package guarantees consistent breaking for a given set of measurements, not equivalence with a browser's own layout.

## Hyphenation

Set `hyphenationLocale` on the prepare input to break words at dictionary hyphenation points. The default layer bundles `en-us`, `en-gb`, `de`, `fr`, and `es`, and falls back from an exact tag to its base language. `Text.HyphenationSupport` lists the bundled locales.

`Text.HyphenationDictionaryLive({ dictionaries })` adds or overrides entries; each word maps to the indexes where a hyphen may be inserted. `Text.NoHyphenationDictionaryLive` disables dictionary hyphenation while keeping soft hyphens (`U+00AD`) in the text as break opportunities.

```ts typecheck
import { Effect, Layer } from "effect"
import { Text } from "@scenesystems/effect-text"

const services = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  Text.MeasurementCacheLive.pipe(Layer.provide(Text.TextMeasurerLive)),
  Text.HyphenationDictionaryLive({ dictionaries: { "en-gb": { colouration: [3, 6] } } })
)

export const program = Text.prepareWithSegments({
  text: "colouration",
  font: { family: "Mono", size: 10 },
  hyphenationLocale: "en-gb",
  whiteSpace: "normal"
}).pipe(
  Effect.map((prepared) => Text.layoutLines(prepared, { maxWidth: 35, lineHeight: 12 })),
  Effect.provide(services)
)
```

## React integration

The `React` module contains no components or hooks. It provides the two pieces that a React integration needs and that are easy to get wrong: a stable cache identity for prepared handles and a pure projection for render time.

`React.prepareIdentityFor` combines the prepare input, engine profile, support-profile id, and font-readiness revision into a `PrepareIdentity`; `React.prepareIdentityKey` encodes it as a string suitable for a `Map` key or a query cache. Two inputs with the same key produce the same prepared handle, so the application can run preparation once per key and keep the handle in state. `React.projectPreparedLayout` is `Text.layoutLinesWithSummary` under a name that signals it is safe to call during render: it measures nothing and touches no services.

The application owns the rest: running preparation effects, storing handles, bumping the font-readiness revision when `document.fonts` changes, and calling the projection in render or resize work.

## Public surface

Every module is available as a namespace from the package root and as a subpath such as `@scenesystems/effect-text/Text`.

| Module                                        | Scope                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`Text`](./src/Text/index.ts)                 | Prepare inputs, prepared handles, layout functions, cursors, streams, and default layers          |
| [`Contracts`](./src/contracts/index.ts)       | `WordSegmenter`, `TextMeasurer`, `MeasurementCache`, `EngineProfile`, and `HyphenationDictionary` |
| [`Browser`](./src/Browser/index.ts)           | Canvas measurement, browser measurement cache, font-readiness revisions, and support profiles     |
| [`React`](./src/React/index.ts)               | Prepare identities and pure layout projection                                                     |
| [`Errors`](./src/Errors/index.ts)             | `MeasurementFailed`, `TextLayoutDecodeError`, and the `PrepareError` union                        |
| [`Experimental`](./src/experimental/index.ts) | Search-backed engine-profile calibration; may change outside semver guarantees                    |

`Contracts` and `Errors` are stable within the current release line. `Text`, `Browser`, and `React` are provisional and may change in minor releases. Paths under `internal` are not exported.

## Errors and boundaries

`Text.prepare` and `Text.prepareWithSegments` fail with `MeasurementFailed` when the measurer cannot measure a run. `Text.prepareUnknown` also fails with `TextLayoutDecodeError` for input that does not match `PrepareInput`; `PrepareError` is the union of the two. Layout functions have no error channel: once a handle exists, every width produces a result.

This is a bounded manual layout engine. It resolves bidirectional levels for mixed-direction text and mirrors paired punctuation, but it declines unsupported bidi control characters at preparation time and performs no font shaping. Full CSS layout equivalence is out of scope.

## Examples

The [examples directory](./examples/) contains one runnable program per capability. Start with the [quick start](./examples/01-quick-start.ts), then follow the topic you need: [cursors and streams](./examples/02-cursor-and-stream.ts), [explicit services](./examples/03-explicit-services.ts), [canvas measurement](./examples/04-canvas-measurement.ts), [dictionary hyphenation](./examples/07-dictionary-hyphenation.ts), and [experimental calibration](./examples/05-experimental-calibration-search.ts).

## Status

This package is pre-1.0. Minor releases may change public APIs; pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading. The `Experimental` module may change or be removed with less migration support than the other modules.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## Attribution

The split between effectful preparation and pure layout is inspired by [pretext](https://github.com/chenglou/pretext).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
