# `effect-text`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Effect-native text preparation and greedy multiline layout.
`Text.prepare` owns segmentation, measurement, and caching. `Text.layout*`
stays pure, so prepared text can be reprojected on resize, animation, or
obstacle changes without re-entering services.

[Install](#install) · [Quick Start](#quick-start) · [Surface](#surface) ·
[Support Envelope](#support-envelope) · [Examples](#examples) ·
[Proof](#proof)

## Install

```sh
npm install effect-text effect
```

Use the equivalent `pnpm add` or `bun add` command if that is your package
manager. `effect` is a required peer dependency.

## Quick Start

```ts
import { Effect } from "effect"
import { Text } from "effect-text"

const program = Effect.gen(function* () {
  const prepared = yield* Text.prepareWithSegments({
    text: "Prepare once, layout many times.",
    font: { family: "Mono", size: 16 },
    whiteSpace: "normal"
  })

  return {
    summary: Text.layout(prepared, { maxWidth: 120, lineHeight: 20 }),
    lines: Text.layoutLines(prepared, { maxWidth: 120, lineHeight: 20 })
  }
}).pipe(Effect.provide(Text.TextLayoutLive))

Effect.runPromise(program)
```

Use `Text.prepare` when you only need summary projections such as `layout` or
`measureNaturalWidth`. Use `Text.prepareWithSegments` when you need materialized
lines, cursor stepping, streaming projection, or variable-width layout.

## Surface

| Surface                    | What it owns                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Text`                     | Effectful preparation and pure layout: `prepare`, `prepareWithSegments`, `layout`, `layoutLines`, `layoutLinesWith`, `layoutNextLine`, `streamLines` |
| `Contracts`                | Explicit runtime seams: `WordSegmenter`, `TextMeasurer`, `MeasurementCache`, `EngineProfile`, `HyphenationDictionary`                                |
| `Browser`                  | Browser measurer layers, cache freshness, support data, parity harness helpers                                                                       |
| `React`                    | Prepare-identity helpers and pure prepared-layout projection helpers                                                                                 |
| `Errors`                   | `MeasurementFailed`, `TextLayoutDecodeError`, `PrepareError`                                                                                         |
| `Experimental.Calibration` | Additive `effect-search` studies with internal `effect-math` scoring adapters                                                                        |

Ownership boundaries are deliberate:

- `effect-text/browser` owns support data, browser measurement, font-readiness
  revision helpers, and parity artifacts.
- `effect-text/react` stays framework-thin: prepare identity plus pure
  prepared-layout projection only.
- `Experimental.Calibration` is additive and does not make layout effectful.

## Support Envelope

Shipped behavior is explicit and bounded.

- Browser profiles: `canvas-monospace` and `canvas-system-ui`
- Hyphenation locales: `en-us`, `en-gb`, `de`, `fr`, `es`
- Locale fallback: exact match, then shipped base language, then deterministic
  non-dictionary fallback
- Overflow precedence: `hard-break -> soft-hyphen -> dictionary-hyphen -> explicit-break -> grapheme-fallback`
- Tab policy: `tabWidth: 4`, CSS-style column stops
- Browser freshness: support-profile identity + full font identity +
  font-readiness revision

Stability lanes are also explicit:

| Module         | Stability   |
| -------------- | ----------- |
| `Contracts`    | Stable      |
| `Errors`       | Stable      |
| `Text`         | Provisional |
| `Browser`      | Provisional |
| `React`        | Provisional |
| `Experimental` | Unstable    |

Current non-goals:

- No claim of full CSS layout parity.
- No claim of full shaping-engine parity across arbitrary font stacks.
- Browser claims are limited to the shipped support manifest and checked-in
  parity artifacts.
- Explicit Unicode bidi control handling remains outside the released surface.

The checked-in support authority lives at
[`src/contracts/supportManifest.ts`](./src/contracts/supportManifest.ts).

## Examples

Runnable examples live in [`examples/`](./examples):

| Example                                                                                  | What it proves                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`01-quick-start`](./examples/01-quick-start.ts)                                         | Deterministic prepare/layout flow                            |
| [`02-cursor-and-stream`](./examples/02-cursor-and-stream.ts)                             | Cursor stepping and `Stream` projection                      |
| [`03-explicit-services-and-caching`](./examples/03-explicit-services-and-caching.ts)     | Custom service wiring and shared caching                     |
| [`04-canvas-measurement`](./examples/04-canvas-measurement.ts)                           | Official browser-layer composition                           |
| [`05-experimental-calibration-search`](./examples/05-experimental-calibration-search.ts) | Seeded `effect-search` optimization over calibration corpora |
| [`06-live-browser-parity`](./examples/06-live-browser-parity.ts)                         | Shipped browser support envelope and parity artifacts        |
| [`07-dictionary-hyphenation`](./examples/07-dictionary-hyphenation.ts)                   | Dictionary hyphenation and deterministic fallback            |

Run one directly with Bun:

```sh
bun run packages/effect-text/examples/01-quick-start.ts
```

## Proof

Run the package proof surface from `packages/effect-text/`:

```sh
bun run check
bun run check:tests
bun run lint
bun run test
bun run bench
bun run verify:browser-parity
bun run verify:calibration
bun run verify:support-manifest
bun run build
bun run docgen
```

Refresh checked-in artifacts only when intentional runtime changes land:

```sh
bun run verify:browser-parity --write
bun run verify:calibration --write
bun run bench
bun run verify:support-manifest
```

## Acknowledgments

The prepare/layout split is inspired by
[pretext](https://github.com/chenglou/pretext). `Experimental.Calibration`
builds on the local [`effect-search`](../effect-search/README.md) package for
seeded studies and uses [`effect-math`](../effect-math/README.md) behind
internal adapters for loss aggregation and summary statistics.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
