/**
 * Compares bundled dictionary breaks, a caller-supplied dictionary, and the
 * explicit no-dictionary fallback for one locale-aware input.
 *
 * Run with `bun run packages/effect-text/examples/07-dictionary-hyphenation.ts`.
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"

import { Text } from "@scenesystems/effect-text"

const prepareInput: Text.PrepareInputType = {
  text: "colouration",
  font: { family: "Mono", size: 10 },
  hyphenationLocale: "en-gb",
  whiteSpace: "normal"
}

const request: Text.LayoutRequestType = { maxWidth: 35, lineHeight: 12 }
const measurerLayer = Text.TextMeasurerLive
const baseServices = Layer.mergeAll(
  Text.WordSegmenterLive,
  Text.EngineProfileLive,
  measurerLayer,
  Text.MeasurementCacheLive.pipe(Layer.provide(measurerLayer))
)

const customDictionaryServices = Layer.mergeAll(
  baseServices,
  Text.HyphenationDictionaryLive({ dictionaries: { "en-gb": { colouration: [3, 6] } } })
)

const noDictionaryServices = Layer.mergeAll(baseServices, Text.NoHyphenationDictionaryLive)

const program = Effect.gen(function*() {
  const shippedDictionaryLines = yield* Text.prepareWithSegments(prepareInput).pipe(
    Effect.provide(Text.TextLayoutLive),
    Effect.map((prepared) => Text.layoutLines(prepared, request))
  )
  const customDictionaryLines = yield* Text.prepareWithSegments(prepareInput).pipe(
    Effect.provide(customDictionaryServices),
    Effect.map((prepared) => Text.layoutLines(prepared, request))
  )
  const forcedFallbackLines = yield* Text.prepareWithSegments(prepareInput).pipe(
    Effect.provide(noDictionaryServices),
    Effect.map((prepared) => Text.layoutLines(prepared, request))
  )

  yield* Effect.log("dictionary hyphenation", {
    customDictionaryLines,
    forcedFallbackLines,
    hyphenationLocale: prepareInput.hyphenationLocale,
    shippedDictionaryLines,
    supportedLocales: ["en-us", "en-gb", "de", "fr", "es"]
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
