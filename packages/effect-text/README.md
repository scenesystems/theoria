# `@scenesystems/effect-text`

`@scenesystems/effect-text` separates text preparation from repeated layout. Preparation is effectful because segmentation, measurement, caching, engine profiles, and optional hyphenation can require services. It compiles those results into a prepared handle. Width-dependent layout is then pure, so the same handle can be projected repeatedly for resizing, animation, or variable-width lines.

`Text.prepare` produces an opaque handle for summaries and natural width. `Text.prepareWithSegments` retains the logical surface needed for materialized lines, cursors, streams, and obstacle-aware widths.

The experimental calibration surface turns measured layouts into seeded [`effect-search`](../effect-search/README.md) studies. Its scoring operations use [`effect-math`](../effect-math/README.md), while the released preparation and layout path remains independent of calibration.

## Installation

```sh
npm install @scenesystems/effect-text effect
```

The required peer range is `effect ^3.22.1`.

## Minimal example

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

The default `Text.TextLayoutLive` uses deterministic measurement. Browser applications can compose `Browser.CanvasTextMeasurerLive` and `Browser.BrowserMeasurementCacheLive` with the same preparation contracts. Font-readiness revisions and support-profile identity belong in cache identity when browser fonts change.

The `React` boundary contains prepare-identity and pure projection helpers. Components and hooks remain application concerns. Framework code is responsible for running preparation effects, caching prepared handles, and invoking pure layout during render or resize work.

## Public surface

| Namespace                  | Responsibility                                                                                    | Stability   |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ----------- |
| `Text`                     | Preparation, prepared handles, summaries, lines, cursors, streams, and layers                     | Provisional |
| `Contracts`                | `WordSegmenter`, `TextMeasurer`, `MeasurementCache`, `EngineProfile`, and `HyphenationDictionary` | Stable      |
| `Browser`                  | Canvas measurement, cache freshness, support data, and parity helpers                             | Provisional |
| `React`                    | Cache identity and pure prepared-layout projections                                               | Provisional |
| `Errors`                   | `MeasurementFailed`, `TextLayoutDecodeError`, and `PrepareError`                                  | Stable      |
| `Experimental.Calibration` | Search-backed engine-profile evaluation and calibration                                           | Unstable    |

Uppercase and lowercase companion subpaths are exported for compatibility, including `/Text`, `/Browser`, `/browser`, `/React`, `/react`, `/Contracts`, `/contracts`, `/Errors`, `/Experimental`, and `/experimental`. Experimental APIs may change outside semver guarantees.

## Support and errors

The shipped browser profiles are `canvas-monospace` and `canvas-system-ui`. Dictionary hyphenation covers `en-us`, `en-gb`, `de`, `fr`, and `es`, with exact-locale then base-language fallback. Tabs use four-column CSS-style stops. Overflow checks hard breaks, soft hyphens, dictionary hyphens, explicit breaks, then grapheme fallback.

This is a bounded manual layout engine. Full CSS layout and arbitrary shaping-engine parity are outside its support envelope. Explicit unsupported Unicode bidi controls are detected during preparation. Browser claims are limited to the checked-in [`support manifest`](./src/contracts/supportManifest.ts) and parity artifacts.

`Text.prepare` and `Text.prepareWithSegments` can fail with `MeasurementFailed`. `Text.prepareUnknown` also reports `TextLayoutDecodeError` for invalid input. Pure layout functions have no Effect error channel once preparation succeeds.

## Examples and reference

[`examples/`](./examples) covers the basic prepare/layout flow, cursor and stream projection, explicit services and caching, canvas measurement, dictionary hyphenation, browser parity, and experimental calibration.

## Status

This package is pre-1.0. `Contracts` and `Errors` are stable lanes within that release line; `Text`, `Browser`, and `React` remain provisional. Experimental calibration is unstable.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md). Report defects and request support through [GitHub issues](https://github.com/scenesystems/theoria/issues).

## Attribution

The effectful preparation and pure layout split is inspired by [pretext](https://github.com/chenglou/pretext).

## License

[MIT](./LICENSE), Copyright 2026 Scene Systems.
