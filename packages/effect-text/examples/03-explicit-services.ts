/**
 * Composes the public preparation services with a caller-selected engine
 * profile and the shipped deterministic measurer.
 *
 * Run with `bun run packages/effect-text/examples/03-explicit-services.ts`.
 */
import { BunContext, BunRuntime } from "@effect/platform-bun"
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

const program = Effect.gen(function*() {
  const prepared = yield* Text.prepare({
    text: "soft\u00adhyphen and\tcustom tabs",
    font: { family: "Mono", size: 12 },
    whiteSpace: "pre-wrap"
  }).pipe(Effect.provide(services))

  yield* Effect.log("explicit preparation services", {
    narrow: Text.summary(prepared, { maxWidth: 72, lineHeight: 16 }),
    wide: Text.summary(prepared, { maxWidth: 180, lineHeight: 16 })
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
