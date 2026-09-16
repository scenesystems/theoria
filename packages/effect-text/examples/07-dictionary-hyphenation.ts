/**
 * Compares bundled dictionary breaks, a caller-supplied dictionary, and the
 * explicit no-dictionary fallback for one locale-aware input.
 *
 * Run with `bun run packages/effect-text/examples/07-dictionary-hyphenation.ts`.
 */
import * as BunContext from "@effect/platform-bun/BunContext"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"

import { Hyphenation, MeasurementCache, Text, TextMeasurer } from "@scenesystems/effect-text"

const prepareInput: Text.Input = {
  text: "colouration",
  font: { family: "Mono", size: 10 },
  hyphenationLocale: "en-gb",
  whiteSpace: "normal"
}

const request: Text.Request = { maxWidth: 35, lineHeight: 12 }
const baseServices = Layer.mergeAll(
  Text.layerSegmenter,
  Text.layerProfile,
  MeasurementCache.layer.pipe(Layer.provide(TextMeasurer.layer))
)

const customDictionaryServices = Layer.mergeAll(
  baseServices,
  Hyphenation.layer(
    new Hyphenation.Options({
      dictionaries: {
        "en-gb": Hyphenation.Dictionary.Words({ words: { colouration: Arr.make(3, 6) } })
      }
    })
  )
)

const noDictionaryServices = Layer.mergeAll(baseServices, Hyphenation.layerNone)

const program = Effect.gen(function*() {
  const shippedDictionaryLines = yield* Text.prepareWithSegments(prepareInput).pipe(
    Effect.provide(Text.layer),
    Effect.map((prepared) => Text.lines(prepared, request))
  )
  const customDictionaryLines = yield* Text.prepareWithSegments(prepareInput).pipe(
    Effect.provide(customDictionaryServices),
    Effect.map((prepared) => Text.lines(prepared, request))
  )
  const forcedFallbackLines = yield* Text.prepareWithSegments(prepareInput).pipe(
    Effect.provide(noDictionaryServices),
    Effect.map((prepared) => Text.lines(prepared, request))
  )

  yield* Effect.log("dictionary hyphenation", {
    customDictionaryLines,
    forcedFallbackLines,
    hyphenationLocale: prepareInput.hyphenationLocale,
    shippedDictionaryLines
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
