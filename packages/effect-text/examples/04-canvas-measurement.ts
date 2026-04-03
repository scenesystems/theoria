/**
 * Canvas Measurement — browser-style measurement as an additive layer.
 *
 * What this shows: a canvas-like context can be supplied through
 * `CanvasTextMeasurerLive` without changing the rest of the pipeline.
 *
 * Feature Type Links:
 * - {@link Browser.CanvasTextMeasurerLive}
 * - {@link Contracts.TextMeasurer}
 * - {@link Text.TextLayoutLive}
 *
 * Run: bun run packages/effect-text/examples/04-canvas-measurement.ts
 */
import { BunRuntime } from "@effect/platform-bun"
import { BunContext } from "@effect/platform-bun"
import { Effect, Layer, Match } from "effect"

import { Browser, Text } from "effect-text"

class DemoCanvasContext {
  direction: "inherit" = "inherit"
  font = "12px Mono"
  textBaseline: "alphabetic" = "alphabetic"

  measureText(text: string): { readonly width: number } {
    return {
      width: Match.value(text).pipe(
        Match.when("🙂", () => 4),
        Match.when("AB", () => 20),
        Match.when("A🙂B", () => 22),
        Match.orElse((value) => value.length * 10)
      )
    }
  }
}

const program = Effect.gen(function*() {
  const services = Layer.mergeAll(
    Text.WordSegmenterLive,
    Text.EngineProfileLive,
    Text.MeasurementCacheLive.pipe(
      Layer.provide(
        Browser.CanvasTextMeasurerLive({
          context: new DemoCanvasContext(),
          emojiCorrection: true,
          textBaseline: "alphabetic"
        })
      )
    )
  )

  const prepared = yield* Text.prepare({
    text: "A🙂B",
    font: { family: "Mono", size: 12 },
    whiteSpace: "normal"
  }).pipe(Effect.provide(services))

  yield* Effect.log("canvas-backed measurement", {
    summary: Text.layout(prepared, { maxWidth: 100, lineHeight: 16 }),
    lines: Text.layoutLines(prepared, { maxWidth: 100, lineHeight: 16 })
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
