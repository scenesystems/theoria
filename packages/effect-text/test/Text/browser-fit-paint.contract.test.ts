import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, Match, Number, String } from "effect"
import * as Arr from "effect/Array"

import { Browser, Contracts, Text } from "../../src/index.js"

const profile = Browser.DefaultBrowserSupportProfile

class ShapingCanvasContext {
  direction: Browser.CanvasTextDirectionType = "inherit"
  font = "10px Mono"
  textBaseline: Browser.CanvasTextBaselineType = "alphabetic"

  measureText(text: string): Browser.CanvasTextMetricsType {
    return {
      width: Match.value(text).pipe(
        Match.when("f", () => 10),
        Match.when("i", () => 10),
        Match.when("ff", () => 18),
        Match.when("fi", () => 16),
        Match.when("ffi", () => 24),
        Match.orElse((measured) => Number.multiply(String.length(measured), 10))
      )
    }
  }
}

const layer = Layer.mergeAll(
  Text.WordSegmenterLive,
  Layer.succeed(Contracts.EngineProfile, profile.engineProfile),
  Browser.BrowserMeasurementCacheLive({
    fontReadinessRevision: Browser.initialFontReadinessRevision(),
    profileId: profile.id
  }).pipe(Layer.provide(Browser.CanvasTextMeasurerLive({ context: new ShapingCanvasContext() })))
)

describe("Text browser fit-paint contracts", () => {
  it.effect("fits with shaped prefixes while painting additive grapheme advances", () =>
    Effect.gen(function*() {
      const prepared = yield* Text.prepareWithSegments({
        text: "ffi",
        font: { family: profile.defaultFontFamily, size: 10 },
        whiteSpace: "normal"
      }).pipe(Effect.provide(layer))
      const request: Text.LayoutRequestType = { maxWidth: 24, lineHeight: 12 }

      expect(Text.layout(prepared, request)).toEqual({
        lineCount: 1,
        height: 12,
        maxLineWidth: 30
      })
      expect(Text.layoutLines(prepared, request)).toEqual(Arr.of(
        {
          baseDirection: "ltr",
          index: 0,
          order: "visual",
          text: "ffi",
          width: 30
        }
      ))
    }))
})
