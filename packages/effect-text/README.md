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
- **Explicit browser freshness** — browser caches and prepared-handle reuse can key off a named browser profile plus a font-readiness revision
- **Shared measurement cache** — Effect `Cache`-backed deduplication across prepare calls, with a browser-specific cache keyed by full font signature and explicit freshness state
- **Multiple layout projections** — summary, full lines, per-line width resolution, cursor stepping, or `Stream`
- **Typed errors** — `MeasurementFailed` and `TextLayoutDecodeError` with tagged error channels
- **Emoji correction** — one-time probe for browsers with weak complex-emoji measurement
- **Soft-hyphen, tab, and hard-break support** — preserved through segmentation and layout
- **Dictionary hyphenation** — checked-in dictionaries for `en-us`, `en-gb`, `de`, `fr`, and `es`, with deterministic fallback for every other locale
- **Compiled unicode break surface** — NBSP/WJ/ZWSP, URL-like runs, numeric runs, paired punctuation, and CJK punctuation pairs are compiled into explicit prepared break kinds before layout
- **Released overflow policy** — hard breaks first, then soft hyphens and explicit break opportunities, then grapheme fallback; a line only exceeds `maxWidth` when a single grapheme is itself wider than the requested width
- **Bidi visual ordering** — prepared bidi metadata drives pure mixed-direction visual output with mirrored paired punctuation inside rtl visual runs
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
  const prepared = yield* Text.prepareWithSegments({
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

`Text.TextLayoutLive` provides the bundled preparation services with deterministic measurement defaults and shipped hyphenation dictionaries. See [Services](#services) for custom wiring.

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
| `Text.layoutLines`         | `(preparedWithSegments, request) → ReadonlyArray<LayoutLine>`                            | Pure      |
| `Text.layoutLinesWith`     | `(preparedWithSegments, request, resolveMaxWidth) → ReadonlyArray<LayoutLine>`           | Pure      |
| `Text.walkLineRanges`      | `(preparedWithSegments, request, resolveMaxWidth?) → ReadonlyArray<LayoutLineRange>`     | Pure      |
| `Text.layoutNextLine`      | `(preparedWithSegments, request, cursor) → Option<[LayoutLine, LayoutCursor]>`           | Pure      |
| `Text.streamLines`         | `(preparedWithSegments, request) → Stream<LayoutLine>`                                   | Pure      |

Use `Text.prepare` when the caller only needs summary projections such as `Text.layout` or `Text.measureNaturalWidth`. Use `Text.prepareWithSegments` when the caller needs materialized line text, logical cursor bounds, obstacle-aware width projection, cursor stepping, or streaming line projection.

`LayoutLine.text` is always visual output text. `walkLineRanges`, `layoutNextLine`, and `streamLines` keep `start` / `end` cursors in logical source order so consumers can map visual output back to stable source bounds without depending on internal permutation tables.

## Services

The live preparation surface is built from four required services plus one optional hyphenation seam:

| Service                           | Responsibility                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Contracts.WordSegmenter`         | Builds `text`, `space`, and `hard-break` segments                                                |
| `Contracts.TextMeasurer`          | Converts font + text into a pixel width                                                          |
| `Contracts.MeasurementCache`      | Shared `Cache` keyed by the active measurement identity                                          |
| `Contracts.EngineProfile`         | Runtime fit tolerance, tab stops, bidi defaults, and break quirks                                |
| `Contracts.HyphenationDictionary` | Adds locale-aware discretionary break opportunities during `prepare` while keeping `layout` pure |

Browser-specific behavior is not ambient global state — it is data and services provided through `Layer`.

`TextPreparationServices` is the required preparation environment. `Contracts.HyphenationDictionary` is additive: when the service is absent, preparation stays deterministic and falls back to the non-dictionary break path.

`Text.TextLayoutLive` composes the bundled preparation services with deterministic defaults. For custom wiring, compose the individual layers:

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

The deterministic `MeasurementCache` deduplicates calls to `TextMeasurer` by font/text identity. In the browser lane, `Browser.BrowserMeasurementCacheLive` also keys cache entries by the browser support profile and a font-readiness revision so cached widths can be refreshed when named fonts become ready.

## Dictionary hyphenation

Dictionary hyphenation stays effectful during `prepare` and pure during `layout`.

- The explicit public surface is `Contracts.HyphenationDictionary`, `Text.HyphenationDictionaryLive`, `Text.NoHyphenationDictionaryLive`, and `Text.HyphenationLocale`.
- `Text.TextLayoutLive` and `Text.HyphenationDictionaryLive()` ship checked-in dictionaries for `en-us`, `en-gb`, `de`, `fr`, and `es`.
- Set `hyphenationLocale` on `Text.prepare` or `Text.prepareWithSegments` to enable locale-aware dictionary breaks for a prepared handle.
- Author-provided soft hyphens remain authoritative. Dictionary hyphenation can add later opportunities, but it does not erase or reinterpret explicit discretionary breaks already present in the source text.
- Any other locale falls back deterministically to the non-dictionary break path. `Text.NoHyphenationDictionaryLive` forces that fallback even for supported locales.

```ts
import { Effect } from "effect"
import { Text } from "effect-text"

const prepared =
  yield *
  Text.prepareWithSegments({
    text: "colouration",
    font: { family: "Mono", size: 10 },
    hyphenationLocale: "en-gb",
    whiteSpace: "normal"
  }).pipe(Effect.provide(Text.TextLayoutLive))

Text.layoutLines(prepared, { maxWidth: 35, lineHeight: 12 })
// => ["colour-", "ation"]
```

[`07-dictionary-hyphenation`](./examples/07-dictionary-hyphenation.ts) is the package-owned runnable example for the full public surface: the stable contract tag, the shipped live layer, custom dictionaries, and deterministic no-dictionary fallback.

## Browser canvas measurement

Swap in `CanvasTextMeasurerLive` to use `CanvasRenderingContext2D.measureText`. The prepare/layout split stays the same — only the measurement and cache layers change. `Browser.BrowserSupportManifest` holds the supported browser profiles, and `Browser.BrowserMeasurementCacheLive` takes the active support profile plus the font-readiness revision used for cache freshness:

```ts
import { Effect, Layer } from "effect"
import { Browser, Contracts, Text } from "effect-text"

const browserProfile = Browser.browserSupportProfile()
const fontReadinessRevision = Browser.initialFontReadinessRevision()

// Provide a real CanvasRenderingContext2D in the browser
const canvasLayer = Browser.CanvasTextMeasurerLive({
  context,
  emojiCorrection: true,
  textBaseline: "alphabetic"
})

const services = Layer.mergeAll(
  Text.WordSegmenterLive,
  Layer.succeed(Contracts.EngineProfile, browserProfile.engineProfile),
  Browser.BrowserMeasurementCacheLive({
    fontReadinessRevision,
    profileId: browserProfile.id
  }).pipe(Layer.provide(canvasLayer))
)

const prepared =
  yield *
  Text.prepare({
    text: "Canvas-backed measurement.",
    font: { family: browserProfile.defaultFontFamily, size: 16 },
    whiteSpace: browserProfile.defaultWhiteSpaceMode
  }).pipe(Effect.provide(services))
```

If named-font readiness changes, bump the revision with `Browser.incrementFontReadinessRevision`, rebuild the browser cache layer, and prepare again against the new cache revision.

[`04-canvas-measurement`](./examples/04-canvas-measurement.ts) shows the official `CanvasTextMeasurerLive` + `BrowserMeasurementCacheLive` composition with explicit profile data, explicit freshness, and raw-versus-corrected emoji widths. [`06-live-browser-parity`](./examples/06-live-browser-parity.ts) walks the shipped browser support envelope and the checked-in parity artifacts in one package-owned proof entrypoint.

### Emoji correction

`emojiCorrection` is optional and additive.

- `false` disables the correction pass completely.
- `true` enables the default one-time probe (`"🙂"`, minimum advance multiplier `1`).
- `{ minimumAdvanceMultiplier, probe }` keeps the same additive algorithm while letting the caller choose the probe glyph and minimum per-emoji advance floor.

Guarantees:

- The correction only widens under-measured emoji-containing runs; it never reduces a browser measurement.
- Non-emoji runs stay unchanged.
- The correction remains an additive browser-layer concern; `Text.layout` stays pure and unchanged.

Limits and non-goals:

- This is not a general shaping or browser-normalization pass.
- It does not repair browser-specific kerning, mark positioning, or font fallback behavior outside emoji under-measurement.
- It does not inspect user agents; it only consumes the configured browser measurer and support-profile data.

### Browser support manifest

`Browser.BrowserSupportManifest` is the shipped authority for browser profile names, font policy, released white-space coverage, parity cases, and explicit caveats.

| Profile            | Font policy                                            | Covered surface                                                                                                                                                         | Explicit caveats and non-goals                                                                                                                                                                                                            |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canvas-monospace` | Named-family control profile using `Mono, monospace`   | `whiteSpace: normal, pre-wrap`, the released parity case set, and the control named-font browser lane                                                                   | Covers only the checked-in `Mono` control family and fallback stack. Alternate named fonts, alternate fallback stacks, and shaping-engine parity outside the checked-in artifacts remain outside the shipped surface.                     |
| `canvas-system-ui` | Browser-default UI stack using `system-ui, sans-serif` | The resolved browser-default UI stack for `whiteSpace: normal, pre-wrap`, the released parity case set, and a slightly looser fit epsilon for browser-resolved UI fonts | Covers the browser-resolved `system-ui` stack rather than one pinned font file. User-agent-specific fallback changes, alternate UI stacks, and shaping-engine parity outside the checked-in artifacts remain outside the shipped surface. |

Each shipped profile also publishes the `Contracts.EngineProfile` data that the pure layout plane should consume. Browser-specific fit heuristics and break preferences stay in that profile data rather than in user-agent inspection or app-local conditionals.

The shipped `tabWidth` policy is explicit and shared across both browser profiles: `tabWidth: 4`, interpreted as CSS-style tab stops aligned to four space columns measured from the active space advance. The browser runtime and deterministic runtime both consume that same policy through `Contracts.EngineProfile`, so `a\tb` projects with the same tab semantics in both lanes.

The shipped browser parity envelope also includes an explicit fit-vs-paint divergence case so browser-backed preparation can keep tighter fit-prefix widths and wider paint-side grapheme widths in the same compiled kernel when summary-only browser parity would otherwise lose visible width.

### Browser accuracy artifacts

The checked-in browser accuracy harness in [`examples/live/browserAccuracyHarness.ts`](./examples/live/browserAccuracyHarness.ts) is the source of truth for the shipped browser parity claims. It reads the release envelope from `Browser.BrowserSupportManifest`, evaluates every shipped parity case for every shipped browser profile, and verifies or refreshes the checked-in artifacts below.

- [`canvas-monospace` accuracy artifact](./examples/live/artifacts/canvas-monospace.json)
- [`canvas-system-ui` accuracy artifact](./examples/live/artifacts/canvas-system-ui.json)

This is plain support data. It exists so the browser README, examples, tests, and verification harness can describe the same supported configuration without duplicating literals in multiple places.

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

The returned cursor stays a plain logical source position. Internal stepping hints are scoped to the prepared handle and requested width and do not add enumerable fields to the public cursor object.

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

| Module         | Key exports                                                                                                                                                                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Text`         | `prepare`, `prepareUnknown`, `layout`, `layoutLines`, `layoutLinesWith`, `layoutNextLine`, `streamLines`, `initialCursor`, `PreparedText`, `TextLayoutLive`, `HyphenationDictionaryLive`, `NoHyphenationDictionaryLive`, `HyphenationLocale`, `WordSegmenterLive`, `TextMeasurerLive`, `EngineProfileLive`, `MeasurementCacheLive` |
| `Browser`      | `CanvasTextMeasurerLive`, `BrowserMeasurementCacheLive`, `DefaultBrowserSupportProfile`, `browserSupportProfile`, `BrowserSupportManifest`, `BrowserSupportProfileIdSchema`, `FontReadinessRevision`, `initialFontReadinessRevision`, `incrementFontReadinessRevision`                                                             |
| `Contracts`    | `WordSegmenter`, `TextMeasurer`, `MeasurementCache`, `HyphenationDictionary`, `EngineProfile`, `TextPreparationServices`                                                                                                                                                                                                           |
| `Errors`       | `TextLayoutDecodeError`, `MeasurementFailed`, `PrepareError`                                                                                                                                                                                                                                                                       |
| `Experimental` | `Calibration.evaluateProfile`, `Calibration.optimizeProfile`, `Calibration.makeProfileSearchSpace`, calibration schemas                                                                                                                                                                                                            |

Subpath imports are also available: `import * as Text from "effect-text/Text"`. Internal modules (`internal/*`) are blocked from consumers via the package exports map.

## Examples

Runnable examples in [`examples/`](./examples):

| Example                                                                                  | What it shows                                                                 |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`01-quick-start`](./examples/01-quick-start.ts)                                         | Deterministic prepare/layout flow                                             |
| [`02-cursor-and-stream`](./examples/02-cursor-and-stream.ts)                             | Cursor stepping and `Stream` projection                                       |
| [`03-explicit-services-and-caching`](./examples/03-explicit-services-and-caching.ts)     | Custom measurement seam with shared caching                                   |
| [`04-canvas-measurement`](./examples/04-canvas-measurement.ts)                           | Official browser layer composition and additive emoji correction              |
| [`05-experimental-calibration-search`](./examples/05-experimental-calibration-search.ts) | `effect-search`-driven engine-profile optimization                            |
| [`06-live-browser-parity`](./examples/06-live-browser-parity.ts)                         | Package-owned browser support-envelope proof                                  |
| [`07-dictionary-hyphenation`](./examples/07-dictionary-hyphenation.ts)                   | Stable hyphenation contract, shipped dictionaries, and deterministic fallback |

```sh
bun run packages/effect-text/examples/01-quick-start.ts
```

## Current scope

This release ships a bounded browser parity envelope rather than full CSS and shaping parity.

**Included:** deterministic measurement caching, checked-in hyphenation dictionaries for `en-us`, `en-gb`, `de`, `fr`, and `es`, deterministic fallback for every other locale, optional canvas measurement, explicit font-readiness cache invalidation for browser-backed measurement, optional additive emoji correction, checked-in browser accuracy artifacts for `canvas-monospace` and `canvas-system-ui`, fit-vs-paint browser kernel divergence for summary parity, preserved hard breaks, tabs, soft-hyphen breaks, NBSP/WJ/ZWSP semantics, URL-like and numeric run preparation, paired punctuation handling for Latin and CJK copy, bidi visual ordering with mirrored punctuation inside rtl visual runs, logical source bounds that stay stable across visual reordering, greedy multiline wrapping, pure layout summaries, cursor and stream projections, per-line width resolution, experimental calibration corpora.

**Not yet included:** browser-engine-specific correction passes beyond the current emoji probe, search-driven calibration workflows across `effect-search` and `effect-math`.

**Current browser parity envelope:** the checked-in browser artifacts cover `canvas-monospace` and `canvas-system-ui` only. `canvas-monospace` is the control lane for the checked-in `Mono, monospace` stack. `canvas-system-ui` covers the browser-resolved `system-ui, sans-serif` stack on the released white-space modes and parity cases only. Untested named fonts, alternate fallback stacks, shaping-engine parity outside the recorded artifact set, and browser-specific correction passes beyond the optional emoji correction remain outside the current parity claims.

**Explicit bidi non-goals for the current surface:** explicit Unicode bidi control characters, selection/copy-paste semantics, and shaping-engine parity outside the tested named-font envelope. Formatting controls are detected as an unsupported branch during preparation; `effect-text` does not claim control-aware Unicode bidi parity beyond the shipped mirror table and mixed-direction visual ordering tests.

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
