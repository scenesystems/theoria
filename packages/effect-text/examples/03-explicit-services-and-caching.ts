/**
 * Explicit Services And Caching — custom measurement seam.
 *
 * What this shows: runtime behavior stays behind `Contracts` tags. A custom
 * measurer can be layered in while `Text.prepare` continues to own caching.
 *
 * Feature Type Links:
 * - {@link Contracts.TextMeasurer}
 * - {@link Text.MeasurementCacheLive}
 * - {@link Text.TextPreparationServices}
 *
 * Run: bun run packages/effect-text/examples/03-explicit-services-and-caching.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Effect, Layer, Ref } from "effect"

import { Contracts, Text } from "effect-text"

const program = Effect.gen(function*() {
  const measurements = yield* Ref.make(0)
  const measurerLayer = Layer.succeed(Contracts.TextMeasurer, {
    measure: (_font, text: string) => Ref.update(measurements, (count) => count + 1).pipe(Effect.as(text.length * 6))
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

  const narrow = Text.layout(prepared, { maxWidth: 42, lineHeight: 16 })
  const wide = Text.layout(prepared, { maxWidth: 120, lineHeight: 16 })
  const measurementCount = yield* Ref.get(measurements)

  yield* Effect.log("explicit services and caching", {
    measurementCount,
    narrow,
    wide
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
