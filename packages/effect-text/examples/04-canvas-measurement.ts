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

import { Browser, Contracts, Text } from "effect-text"

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
  const browserProfile = Browser.browserSupportProfile("canvas-system-ui")
  const fontReadinessRevision = Browser.initialFontReadinessRevision()
  const services = Layer.mergeAll(
    Text.WordSegmenterLive,
    Layer.succeed(Contracts.EngineProfile, browserProfile.engineProfile),
    Browser.BrowserMeasurementCacheLive({ fontReadinessRevision, profileId: browserProfile.id }).pipe(
      Layer.provide(
        Browser.CanvasTextMeasurerLive({
          context: new DemoCanvasContext(),
          emojiCorrection: true,
          textBaseline: "alphabetic"
        })
      )
    )
  )

  const prepared = yield* Text.prepareWithSegments({
    text: "A🙂B",
    font: { family: browserProfile.defaultFontFamily, size: 12 },
    whiteSpace: browserProfile.defaultWhiteSpaceMode
  }).pipe(Effect.provide(services))

  yield* Effect.log("canvas-backed measurement", {
    browserEngineProfile: browserProfile.engineProfile,
    browserProfile: browserProfile.id,
    browserTabPolicy: browserProfile.tabPolicy,
    fontReadinessRevision,
    summary: Text.layout(prepared, { maxWidth: 100, lineHeight: 16 }),
    lines: Text.layoutLines(prepared, { maxWidth: 100, lineHeight: 16 })
  })
})

BunRuntime.runMain(program.pipe(Effect.provide(BunContext.layer)))
