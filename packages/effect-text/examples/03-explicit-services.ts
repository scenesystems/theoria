/**
 * Composes the public preparation services with a caller-selected engine
 * profile and the shipped deterministic measurer.
 *
 * Run with `bun run packages/effect-text/examples/03-explicit-services.ts`.
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Effect, Layer } from "effect"

import { Contracts, Text } from "@scenesystems/effect-text"

const services = Layer.mergeAll(
  Text.WordSegmenterLive,
  Layer.succeed(Contracts.EngineProfile, {
    lineFitEpsilon: 0.01,
    tabWidth: 8,
    defaultDirection: "ltr",
    preferEarlySoftHyphenBreak: true,
    preferPrefixWidthsForBreakableRuns: true
  }),
  Text.MeasurementCacheLive.pipe(Layer.provide(Text.TextMeasurerLive))
)

const program = Effect.gen(function*() {
  const prepared = yield* Text.prepare({
    text: "soft\u00adhyphen and\tcustom tabs",
    font: { family: "Mono", size: 12 },
    whiteSpace: "pre-wrap"
  }).pipe(Effect.provide(services))

  yield* Effect.log("explicit preparation services", {
    narrow: Text.layout(prepared, { maxWidth: 72, lineHeight: 16 }),
    wide: Text.layout(prepared, { maxWidth: 180, lineHeight: 16 })
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
