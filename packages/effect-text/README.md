# `effect-text`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Prepare text once, then reflow it as often as you want without paying the expensive work each time.

Reach for it when resize, animation, browser measurement, or calibration would otherwise force you to recompute text layout from scratch.

## Why Use It?

- Do the effectful work once with `Text.prepare` or `Text.prepareWithSegments`, then keep layout projection pure as width and context change.
- Keep measurement, caching, hyphenation, and browser-profile seams explicit instead of hiding them behind one browser-only path.
- Use browser and React helpers without dragging UI concerns into the core text model.
- Work inside a published support envelope with explicit browser profiles, locales, and parity claims.
- Tune calibration profiles with `effect-search` without making ordinary layout itself effectful.

## Installation

```sh
npm install effect-text effect
```

Use `bun add` or `pnpm add` if that is your package manager. `effect` is a required peer dependency.

## Quick Start

```ts typecheck
import { Effect } from "effect"
import { Text } from "effect-text"

const program = Effect.gen(function* () {
  const prepared = yield* Text.prepareWithSegments({
    text: "The facilitator summarized three interview themes before the debrief.",
    font: { family: "Mono", size: 16 },
    whiteSpace: "normal"
  })

  return {
    narrow: Text.layout(prepared, { maxWidth: 140, lineHeight: 20 }),
    wideLines: Text.layoutLines(prepared, { maxWidth: 220, lineHeight: 20 })
  }
}).pipe(Effect.provide(Text.TextLayoutLive))

void program
```

Use `Text.prepare` when you only need summary projections such as `layout` or `measureNaturalWidth`. Use `Text.prepareWithSegments` when you need materialized lines, cursor stepping, `Text.streamLines`, or variable-width layout.

## What Can I Do With It?

Most users start with one prepared text value, then project it through different widths, renderers, or measurement services.

| Task | Start here |
| --- | --- |
| First deterministic prepare/layout flow | [`examples/01-quick-start.ts`](./examples/01-quick-start.ts) |
| Cursor stepping and streaming projection | [`examples/02-cursor-and-stream.ts`](./examples/02-cursor-and-stream.ts) |
| Custom measurement services and shared caching | [`examples/03-explicit-services-and-caching.ts`](./examples/03-explicit-services-and-caching.ts) |
| Browser measurement layers and shipped support profiles | [`examples/04-canvas-measurement.ts`](./examples/04-canvas-measurement.ts) and [`examples/06-live-browser-parity.ts`](./examples/06-live-browser-parity.ts) |
| Dictionary hyphenation and locale fallback | [`examples/07-dictionary-hyphenation.ts`](./examples/07-dictionary-hyphenation.ts) |
| Calibration studies over layout corpora | [`examples/05-experimental-calibration-search.ts`](./examples/05-experimental-calibration-search.ts) |

## Which Surface Should I Use?

- `Text` covers preparation and pure layout.
- `Contracts` covers measurement and segmentation seams when you need to swap or persist lower-level text services.
- `effect-text/browser` adds browser measurement support.
- `effect-text/react` adds React-facing projection helpers.

Start with `Text.TextLayoutLive` for the default runtime. Reach for the other surfaces only when you need to replace the measurement boundary or carry prepared output into UI code.

## What Can I Rely On?

- Browser profiles: `canvas-monospace` and `canvas-system-ui`
- Hyphenation locales: `en-us`, `en-gb`, `de`, `fr`, `es`
- Locale fallback: exact match, then shipped base language, then deterministic non-dictionary fallback
- Browser claims are limited to the shipped support manifest and checked-in parity artifacts
- Full CSS layout parity, arbitrary shaping-engine parity, and explicit Unicode bidi control handling are outside the current release

The shipped support manifest lives at [`src/contracts/supportManifest.ts`](./src/contracts/supportManifest.ts).

## Learn More

- Browse the runnable examples in [`examples/`](./examples).
- From the repository root, run `bun run docs:packages -- --package effect-text --view agent` for the generated docs surface.
- See [`../effect-search/README.md`](../effect-search/README.md) for the optimization layer behind `Experimental.Calibration` and [`../effect-math/README.md`](../effect-math/README.md) for the numerical package used behind its scoring adapters.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
